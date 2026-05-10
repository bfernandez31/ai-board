import { NextRequest, NextResponse } from 'next/server';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { prisma } from '@/lib/db/client';
import { buildInsightsScope } from '@/lib/admin/insights-scope';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = validateWorkflowAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idString } = await context.params;
  const id = parseInt(idString, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const report = await prisma.insightsReport.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      periodStart: true,
      periodEnd: true,
    },
  });
  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  // Rebuild scope from scratch so the workflow always reads the freshest set
  // of CLAUDE jobs that match the report's period.
  const scope = await buildInsightsScope(report.periodEnd ?? new Date());

  return NextResponse.json(
    {
      reportId: report.id,
      periodStart: report.periodStart?.toISOString() ?? null,
      periodEnd: report.periodEnd?.toISOString() ?? null,
      ticketIds: scope.ticketIds,
      sessions: scope.jobs.map((j) => ({
        jobId: j.jobId,
        projectId: j.projectId,
        ticketId: j.ticketId,
        rawArtifactKey: j.rawArtifactKey,
      })),
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
