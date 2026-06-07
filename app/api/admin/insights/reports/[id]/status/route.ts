import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { streamInsightsReportArtifact } from '@/app/lib/blob/client';
import { validateInsightsOutput } from '@/app/lib/insights/output-validation';
import { buildInsightsReportKey } from '@/app/lib/insights/blob-keys';
import { filterEligibleClaudeSessionIds } from '@/app/lib/insights/predicate';

export const dynamic = 'force-dynamic';

const StatusPatchSchema = z
  .object({
    status: z.enum(['COMPLETED', 'FAILED']),
    // AIB-856: `sessionsCount` is no longer sent by the workflow — the API
    // derives it from the marked (readable + eligible) set. Accepted but
    // ignored for backward compatibility.
    sessionsCount: z.number().int().nonnegative().optional(),
    // AIB-856: readable sessions actually fed to /insights (markers written).
    analyzedJobIds: z.array(z.number().int().positive()).optional(),
    // AIB-856: sessions enumerated at run start (the expected coverage).
    expectedSessionsCount: z.number().int().nonnegative().optional(),
    ticketsCount: z.number().int().nonnegative().optional(),
    artifactKey: z
      .string()
      .regex(/^insights\/reports\/\d+\.html$/)
      .optional(),
    artifactSize: z.number().int().positive().optional(),
    errorReason: z.string().min(1).max(500).optional(),
  })
  .refine(
    (data) =>
      data.status !== 'COMPLETED' ||
      (data.analyzedJobIds !== undefined &&
        data.expectedSessionsCount !== undefined &&
        data.ticketsCount !== undefined &&
        data.artifactKey !== undefined &&
        data.artifactSize !== undefined),
    {
      message:
        'COMPLETED transitions require analyzedJobIds, expectedSessionsCount, ticketsCount, and artifact fields',
    }
  )
  .refine(
    (data) => data.status !== 'FAILED' || data.errorReason !== undefined,
    { message: 'FAILED transitions require errorReason' }
  );

type TerminalTransitionData =
  | {
      status: 'COMPLETED';
      sessionsCount: number;
      ticketsCount: number;
      expectedSessionsCount: number;
      artifactKey: string;
      artifactSize: number;
      /** Pre-filtered, currently-eligible Claude session ids to mark (P-4). */
      markedJobIds: number[];
    }
  | { status: 'FAILED'; errorReason: string };

/**
 * Idempotent no-op response for a late/duplicate terminal callback that found
 * nothing to flip (`count===0`, SC-012): return the row's current state.
 */
async function idempotentNoOp(id: number): Promise<Response> {
  const current = await prisma.insightsReport.findUnique({ where: { id } });
  return NextResponse.json(
    {
      id: current!.id,
      status: current!.status,
      completedAt: current!.completedAt?.toISOString() ?? null,
    },
    { status: 200 }
  );
}

/**
 * Cascade the terminal status to the linked Job row. The InsightsReport
 * transition has already committed; if the cascade fails we log and continue
 * so the workflow callback still gets a deterministic response (the orphan Job
 * is picked up by reconciliation). Constitution §IV: surface the failure, do
 * not silently swallow. The Job is updated directly (NOT via
 * /api/jobs/:id/status) to suppress push-notification side effects (FR-022).
 */
async function cascadeJob(
  id: number,
  status: 'COMPLETED' | 'FAILED',
  now: Date
): Promise<void> {
  try {
    await prisma.job.updateMany({
      where: {
        insightsReport: { id },
        status: { in: ['PENDING', 'RUNNING'] },
      },
      data: { status, completedAt: now },
    });
  } catch (error) {
    console.error(
      '[applyTerminalTransition] cascade job update failed',
      { reportId: id, status },
      error
    );
  }
}

/**
 * Atomic conditional transition of a RUNNING row to COMPLETED or FAILED.
 *
 * COMPLETED (AIB-856, P-1/P-3): the guarded `updateMany` + the per-session
 * `InsightsAnalyzedSession.createMany({ skipDuplicates: true })` run in one
 * `prisma.$transaction` so a crash can never leave a COMPLETED report with
 * unmarked sessions (or markers without a completed report). `sessionsCount`
 * is the size of the (pre-filtered, eligible) marked set. A late duplicate
 * callback hits `count===0` → idempotent no-op, writing no markers. The
 * `@unique(jobId)` index + `skipDuplicates` make a double-mark impossible
 * even under a racing duplicate PATCH.
 *
 * FAILED: guarded `updateMany`, **no markers written** (FR-006).
 *
 * In both cases the linked Job is cascaded best-effort after commit.
 */
async function applyTerminalTransition(
  id: number,
  data: TerminalTransitionData,
  now: Date
): Promise<Response> {
  if (data.status === 'COMPLETED') {
    const { markedJobIds, ...reportFields } = data;
    const flipped = await prisma.$transaction(async (tx) => {
      const result = await tx.insightsReport.updateMany({
        where: { id, status: 'RUNNING' },
        data: {
          status: 'COMPLETED',
          sessionsCount: reportFields.sessionsCount,
          ticketsCount: reportFields.ticketsCount,
          expectedSessionsCount: reportFields.expectedSessionsCount,
          artifactKey: reportFields.artifactKey,
          artifactSize: reportFields.artifactSize,
          completedAt: now,
        },
      });
      if (result.count === 0) return false;
      await tx.insightsAnalyzedSession.createMany({
        data: markedJobIds.map((jobId) => ({
          jobId,
          reportId: id,
          analyzedAt: now,
        })),
        skipDuplicates: true,
      });
      return true;
    });
    if (!flipped) return idempotentNoOp(id);
    await cascadeJob(id, 'COMPLETED', now);
    return NextResponse.json(
      { id, status: 'COMPLETED', completedAt: now.toISOString() },
      { status: 200 }
    );
  }

  // FAILED branch — no markers written.
  const result = await prisma.insightsReport.updateMany({
    where: { id, status: 'RUNNING' },
    data: {
      status: 'FAILED',
      errorReason: data.errorReason,
      completedAt: now,
    },
  });
  if (result.count === 0) return idempotentNoOp(id);
  await cascadeJob(id, 'FAILED', now);
  return NextResponse.json(
    { id, status: 'FAILED', completedAt: now.toISOString() },
    { status: 200 }
  );
}

/**
 * PATCH /api/admin/insights/reports/:id/status — workflow-driven terminal
 * status transition (AIB-791 US3, D-16, FR-022).
 *
 * Atomic conditional update: `updateMany WHERE id=? AND status='RUNNING'`.
 * A late callback for an already-FAILED row finds nothing to update;
 * `count===0` triggers the idempotent no-op response (SC-012).
 *
 * On the COMPLETED branch the endpoint re-fetches the uploaded blob and
 * re-runs `validateInsightsOutput` server-side; failure overrides the
 * caller's requested transition to FAILED with a fixed reason (D-8).
 *
 * The linked Job row is updated directly (NOT via /api/jobs/:id/status) so
 * push-notification side effects do not fire (FR-022).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = validateWorkflowAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idString } = await context.params;
  const id = Number.parseInt(idString, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = StatusPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const existing = await prisma.insightsReport.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const now = new Date();

  if (parsed.data.status === 'COMPLETED') {
    const expectedKey = buildInsightsReportKey(id);
    if (parsed.data.artifactKey !== expectedKey) {
      return NextResponse.json(
        { error: 'artifactKey does not match this report id' },
        { status: 400 }
      );
    }

    // Re-fetch the blob and validate server-side. If the upload was rejected
    // or the content fails markers, override to FAILED instead of trusting
    // the workflow's claim (D-8 defense in depth).
    //
    // A transient blob outage must not be silently rewritten to a validation
    // failure — that would mark a genuinely successful run as FAILED and
    // mislead the operator (constitution §IV: external call failures must
    // be surfaced, never swallowed). We surface 503 so the workflow can
    // retry and the RUNNING row stays untouched.
    let html: string;
    try {
      const stream = await streamInsightsReportArtifact(expectedKey);
      if (!stream) {
        return applyTerminalTransition(
          id,
          {
            status: 'FAILED',
            errorReason: 'Insights output validation failed',
          },
          now
        );
      }
      const reader = stream.stream.getReader();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      html = Buffer.concat(chunks).toString('utf-8');
    } catch (error) {
      console.error('[PATCH insights status] blob fetch failed', error);
      return NextResponse.json(
        {
          error: 'Blob backend unavailable; retry',
          code: 'BLOB_UNREACHABLE',
        },
        { status: 503 }
      );
    }
    const validation = validateInsightsOutput(html);

    if (!validation.ok) {
      return applyTerminalTransition(
        id,
        { status: 'FAILED', errorReason: 'Insights output validation failed' },
        now
      );
    }

    // Marker-poisoning defense (P-4): filter the caller-supplied analyzedJobIds
    // down to sessions that are currently eligible Claude sessions before
    // writing any marker. A buggy/compromised workflow must not be able to mark
    // an arbitrary job as analyzed and thereby exclude it from all future runs.
    // The refinement guarantees analyzedJobIds is present when COMPLETED.
    const marked = await filterEligibleClaudeSessionIds(
      parsed.data.analyzedJobIds!
    );

    // Every enumerated session was pruned/ineligible by terminal time → there
    // is nothing to legitimately mark. Treat as FAILED so the sessions stay
    // eligible for the next run rather than silently completing with no
    // coverage (admin-api.md COMPLETED step 4, FR-006).
    if (marked.length === 0) {
      return applyTerminalTransition(
        id,
        {
          status: 'FAILED',
          errorReason: 'No readable Claude sessions available',
        },
        now
      );
    }

    // Refinement on the schema guarantees these are present when status===COMPLETED.
    return applyTerminalTransition(
      id,
      {
        status: 'COMPLETED',
        sessionsCount: marked.length,
        ticketsCount: parsed.data.ticketsCount!,
        expectedSessionsCount: parsed.data.expectedSessionsCount!,
        artifactKey: parsed.data.artifactKey!,
        artifactSize: parsed.data.artifactSize!,
        markedJobIds: marked,
      },
      now
    );
  }

  // FAILED branch
  return applyTerminalTransition(
    id,
    {
      status: 'FAILED',
      errorReason: parsed.data.errorReason!.slice(0, 500),
    },
    now
  );
}
