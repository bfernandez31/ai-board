import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { streamInsightsReportArtifact } from '@/app/lib/blob/client';
import { validateInsightsOutput } from '@/app/lib/insights/output-validation';
import { buildInsightsReportKey } from '@/app/lib/insights/blob-keys';

export const dynamic = 'force-dynamic';

const StatusPatchSchema = z
  .object({
    status: z.enum(['COMPLETED', 'FAILED']),
    sessionsCount: z.number().int().nonnegative().optional(),
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
      (data.sessionsCount !== undefined &&
        data.ticketsCount !== undefined &&
        data.artifactKey !== undefined &&
        data.artifactSize !== undefined),
    { message: 'COMPLETED transitions require all artifact fields' }
  )
  .refine(
    (data) => data.status !== 'FAILED' || data.errorReason !== undefined,
    { message: 'FAILED transitions require errorReason' }
  );

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
    let html = '';
    try {
      const stream = await streamInsightsReportArtifact(expectedKey);
      if (stream) {
        const reader = stream.stream.getReader();
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
        html = Buffer.concat(chunks).toString('utf-8');
      }
    } catch (error) {
      console.error('[PATCH insights status] blob fetch failed', error);
    }
    const validation = validateInsightsOutput(html);

    if (!validation.ok) {
      const result = await prisma.insightsReport.updateMany({
        where: { id, status: 'RUNNING' },
        data: {
          status: 'FAILED',
          errorReason: 'Insights output validation failed',
          completedAt: now,
        },
      });
      if (result.count === 0) {
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
      await prisma.job
        .updateMany({
          where: {
            insightsReport: { id },
            status: { in: ['PENDING', 'RUNNING'] },
          },
          data: { status: 'FAILED', completedAt: now },
        })
        .catch(() => undefined);
      return NextResponse.json(
        { id, status: 'FAILED', completedAt: now.toISOString() },
        { status: 200 }
      );
    }

    // Refinement on the schema guarantees these are present when status===COMPLETED.
    const sessionsCount = parsed.data.sessionsCount!;
    const ticketsCount = parsed.data.ticketsCount!;
    const artifactKey = parsed.data.artifactKey!;
    const artifactSize = parsed.data.artifactSize!;

    const result = await prisma.insightsReport.updateMany({
      where: { id, status: 'RUNNING' },
      data: {
        status: 'COMPLETED',
        sessionsCount,
        ticketsCount,
        artifactKey,
        artifactSize,
        completedAt: now,
      },
    });
    if (result.count === 0) {
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
    await prisma.job
      .updateMany({
        where: {
          insightsReport: { id },
          status: { in: ['PENDING', 'RUNNING'] },
        },
        data: { status: 'COMPLETED', completedAt: now },
      })
      .catch(() => undefined);
    return NextResponse.json(
      { id, status: 'COMPLETED', completedAt: now.toISOString() },
      { status: 200 }
    );
  }

  // FAILED branch
  const failedResult = await prisma.insightsReport.updateMany({
    where: { id, status: 'RUNNING' },
    data: {
      status: 'FAILED',
      errorReason: parsed.data.errorReason!.slice(0, 500),
      completedAt: now,
    },
  });
  if (failedResult.count === 0) {
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
  await prisma.job
    .updateMany({
      where: {
        insightsReport: { id },
        status: { in: ['PENDING', 'RUNNING'] },
      },
      data: { status: 'FAILED', completedAt: now },
    })
    .catch(() => undefined);
  return NextResponse.json(
    { id, status: 'FAILED', completedAt: now.toISOString() },
    { status: 200 }
  );
}
