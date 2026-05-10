import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { claudeEffectiveAgentJobWhere } from '@/lib/admin/insights/claude-job-filter';

const MAX_ROWS = 5000;

const querySchema = z
  .object({
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
  })
  .refine((v) => v.periodEnd > v.periodStart, {
    message: 'periodEnd must be greater than periodStart',
    path: ['periodEnd'],
  });

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = validateWorkflowAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = querySchema.safeParse({
    periodStart: request.nextUrl.searchParams.get('periodStart'),
    periodEnd: request.nextUrl.searchParams.get('periodEnd'),
  });
  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Invalid query parameters',
        details: result.error.issues.map((i) => ({
          message: i.message,
          path: i.path,
        })),
      },
      { status: 400 }
    );
  }

  const { periodStart, periodEnd } = result.data;

  const logs = await prisma.jobLog.findMany({
    where: {
      captureStatus: 'CAPTURED',
      rawArtifactKey: { not: null },
      job: {
        status: 'COMPLETED',
        startedAt: { gte: periodStart, lt: periodEnd },
        ...claudeEffectiveAgentJobWhere(),
      },
    },
    select: {
      capturedAt: true,
      rawArtifactKey: true,
      job: {
        select: {
          id: true,
          projectId: true,
          ticketId: true,
        },
      },
    },
    orderBy: { capturedAt: 'asc' },
    take: MAX_ROWS,
  });

  const artifacts = logs.map((log) => ({
    jobId: log.job.id,
    projectId: log.job.projectId,
    ticketId: log.job.ticketId,
    rawArtifactKey: log.rawArtifactKey,
    capturedAt: log.capturedAt.toISOString(),
  }));

  return NextResponse.json(artifacts, { status: 200 });
}
