import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';

const RouteParamsSchema = z.object({
  id: z.string().regex(/^\d+$/),
});

const BodySchema = z.object({
  qualityScore: z.number().int().min(0).max(100),
  qualityScoreDetails: z.string().min(1).optional(),
});

type Result =
  | { applied: true; jobId: number; qualityScore: number }
  | { applied: false; reason: 'no_verify_job' | 'already_set'; jobId?: number; qualityScore?: number };

/**
 * PATCH /api/tickets/[id]/verify-quality-score
 *
 * Idempotent backfill of the quality score on the ticket's latest verify job.
 * The write lands only when the target job currently has `qualityScore = null`
 * (the gating happens in the same SQL UPDATE, so concurrent callers cannot
 * race past it). When a score already exists, this is a no-op — re-running
 * /review on a ticket whose original verify already produced a score keeps
 * that score untouched.
 *
 * Workflow-token auth only — invoked by ai-board-assist.yml after a manual
 * /review when the original VERIFY workflow's code-review step lost its
 * `QUALITY_SCORE_JSON` marker (e.g., token-limit truncation).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = validateWorkflowAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  const paramsResult = RouteParamsSchema.safeParse(params);
  if (!paramsResult.success) {
    return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 });
  }
  const ticketId = parseInt(paramsResult.data.id, 10);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const bodyResult = BodySchema.safeParse(body);
  if (!bodyResult.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: bodyResult.error.issues },
      { status: 400 }
    );
  }
  const { qualityScore, qualityScoreDetails } = bodyResult.data;

  const latestVerifyJob = await prisma.job.findFirst({
    where: { ticketId, command: 'verify' },
    orderBy: { startedAt: 'desc' },
    select: { id: true, qualityScore: true },
  });

  if (!latestVerifyJob) {
    const result: Result = { applied: false, reason: 'no_verify_job' };
    return NextResponse.json(result, { status: 404 });
  }

  if (latestVerifyJob.qualityScore != null) {
    const result: Result = {
      applied: false,
      reason: 'already_set',
      jobId: latestVerifyJob.id,
      qualityScore: latestVerifyJob.qualityScore,
    };
    return NextResponse.json(result, { status: 200 });
  }

  const updateResult = await prisma.job.updateMany({
    where: { id: latestVerifyJob.id, qualityScore: null },
    data: {
      qualityScore,
      ...(qualityScoreDetails ? { qualityScoreDetails } : {}),
    },
  });

  if (updateResult.count === 0) {
    const refreshed = await prisma.job.findUnique({
      where: { id: latestVerifyJob.id },
      select: { qualityScore: true },
    });
    const result: Result = {
      applied: false,
      reason: 'already_set',
      jobId: latestVerifyJob.id,
      ...(refreshed?.qualityScore != null ? { qualityScore: refreshed.qualityScore } : {}),
    };
    return NextResponse.json(result, { status: 200 });
  }

  const result: Result = {
    applied: true,
    jobId: latestVerifyJob.id,
    qualityScore,
  };
  return NextResponse.json(result, { status: 200 });
}
