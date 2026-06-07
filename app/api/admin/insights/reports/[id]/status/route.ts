import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { streamInsightsReportArtifact } from '@/app/lib/blob/client';
import { validateInsightsOutput } from '@/app/lib/insights/output-validation';
import { buildInsightsReportKey } from '@/app/lib/insights/blob-keys';
import { advanceCoverage } from '@/app/lib/insights/repository';

export const dynamic = 'force-dynamic';

const StatusPatchSchema = z
  .object({
    status: z.enum(['COMPLETED', 'FAILED']),
    sessionsCount: z.number().int().nonnegative().optional(),
    expectedSessionsCount: z.number().int().nonnegative().optional(),
    ticketsCount: z.number().int().nonnegative().optional(),
    analyzedJobIds: z.array(z.number().int().positive()).optional(),
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
      (data.sessionsCount !== undefined &&
        data.expectedSessionsCount !== undefined &&
        data.ticketsCount !== undefined &&
        data.analyzedJobIds !== undefined &&
        data.artifactKey !== undefined &&
        data.artifactSize !== undefined),
    { message: 'COMPLETED transitions require all artifact + coverage fields' }
  )
  .refine(
    // AIB-852/D5: coverage rows are keyed on the exact jobs the workflow
    // analyzed, one per session.
    (data) =>
      data.status !== 'COMPLETED' ||
      (data.analyzedJobIds !== undefined &&
        data.analyzedJobIds.length > 0 &&
        data.analyzedJobIds.length === data.sessionsCount),
    { message: 'analyzedJobIds must be non-empty and length === sessionsCount' }
  )
  .refine(
    // AIB-852/FR-011: expected can never be below analyzed.
    (data) =>
      data.status !== 'COMPLETED' ||
      (data.expectedSessionsCount !== undefined &&
        data.sessionsCount !== undefined &&
        data.expectedSessionsCount >= data.sessionsCount),
    { message: 'expectedSessionsCount must be >= sessionsCount' }
  )
  .refine(
    (data) => data.status !== 'FAILED' || data.errorReason !== undefined,
    { message: 'FAILED transitions require errorReason' }
  );

type TerminalTransitionData =
  | {
      status: 'COMPLETED';
      sessionsCount: number;
      expectedSessionsCount: number;
      ticketsCount: number;
      artifactKey: string;
      artifactSize: number;
      analyzedJobIds: number[];
    }
  | { status: 'FAILED'; errorReason: string };

/**
 * Idempotent no-op response for a callback that arrived after the row was
 * already terminal (`updateMany` matched zero RUNNING rows, SC-012).
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
 * Atomic conditional transition of a RUNNING row to COMPLETED or FAILED,
 * cascading to the linked Job and returning the canonical JSON shape.
 *
 * AIB-852: on COMPLETED the row flip, the per-session coverage advance
 * (FR-007/D5) and the Job cascade all run in ONE `$transaction` gated on
 * `WHERE status='RUNNING'` (P3/P6) — so a late/duplicate callback neither
 * double-writes coverage nor flips a terminal row, and a row that lost the
 * flip race writes no coverage. FAILED advances no coverage (the sessions
 * stay eligible). The Job is updated directly to suppress notification side
 * effects (FR-022/P6).
 */
async function applyTerminalTransition(
  id: number,
  data: TerminalTransitionData,
  now: Date
): Promise<Response> {
  if (data.status === 'COMPLETED') {
    const {
      analyzedJobIds,
      sessionsCount,
      expectedSessionsCount,
      ticketsCount,
      artifactKey,
      artifactSize,
    } = data;
    // FR-012: flag a gap iff fewer sessions were analyzed than expected.
    const coverageGapReason =
      expectedSessionsCount > sessionsCount ? 'TRANSCRIPT_NOT_AVAILABLE' : null;

    const flipped = await prisma.$transaction(async (tx) => {
      const result = await tx.insightsReport.updateMany({
        where: { id, status: 'RUNNING' },
        data: {
          status: 'COMPLETED',
          sessionsCount,
          expectedSessionsCount,
          coverageGapReason,
          ticketsCount,
          artifactKey,
          artifactSize,
          completedAt: now,
        },
      });
      if (result.count === 0) return false;
      await advanceCoverage(tx, id, analyzedJobIds);
      await tx.job.updateMany({
        where: {
          insightsReport: { id },
          status: { in: ['PENDING', 'RUNNING'] },
        },
        data: { status: 'COMPLETED', completedAt: now },
      });
      return true;
    });

    if (!flipped) return idempotentNoOp(id);
    return NextResponse.json(
      { id, status: 'COMPLETED', completedAt: now.toISOString() },
      { status: 200 }
    );
  }

  // FAILED branch — no coverage advanced.
  const result = await prisma.insightsReport.updateMany({
    where: { id, status: 'RUNNING' },
    data: { status: 'FAILED', errorReason: data.errorReason, completedAt: now },
  });
  if (result.count === 0) return idempotentNoOp(id);
  // The InsightsReport transition is committed; if the Job cascade fails we
  // log and continue so the workflow callback still gets a deterministic
  // response (the orphan Job is picked up by reconciliation). Constitution
  // §IV: surface the failure, do not silently swallow.
  try {
    await prisma.job.updateMany({
      where: {
        insightsReport: { id },
        status: { in: ['PENDING', 'RUNNING'] },
      },
      data: { status: 'FAILED', completedAt: now },
    });
  } catch (error) {
    console.error(
      '[applyTerminalTransition] cascade job update failed',
      { reportId: id, status: 'FAILED' },
      error
    );
  }
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

    // Refinement on the schema guarantees these are present when status===COMPLETED.
    return applyTerminalTransition(
      id,
      {
        status: 'COMPLETED',
        sessionsCount: parsed.data.sessionsCount!,
        expectedSessionsCount: parsed.data.expectedSessionsCount!,
        ticketsCount: parsed.data.ticketsCount!,
        artifactKey: parsed.data.artifactKey!,
        artifactSize: parsed.data.artifactSize!,
        analyzedJobIds: parsed.data.analyzedJobIds!,
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
