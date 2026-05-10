import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import {
  AdminAccessDenied,
  requireAdmin,
  type AdminUser,
} from '@/lib/admin/admin-auth';
import { reconcileOrphanedInsightsReports } from '@/lib/admin/insights/reconcile';
import { derivePeriod } from '@/lib/admin/insights/period';
import {
  countNewShippedClaudeTickets,
  findEarliestClaudeJobStartedAt,
} from '@/lib/admin/insights/claude-job-filter';
import { dispatchInsightsAnalyzeWorkflow } from '@/app/lib/workflows/dispatch-insights-analyze';

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let session: AdminUser;
  try {
    session = await requireAdmin(request);
  } catch (error) {
    if (error instanceof AdminAccessDenied) return notFound();
    throw error;
  }

  await reconcileOrphanedInsightsReports();

  const inFlight = await prisma.adminInsightsReport.findFirst({
    where: { status: 'RUNNING' },
    select: { id: true, startedAt: true },
    orderBy: { createdAt: 'desc' },
  });
  if (inFlight) {
    const iso = inFlight.startedAt.toISOString();
    return NextResponse.json(
      {
        error: `Already running since ${iso}`,
        code: 'ALREADY_RUNNING',
        runStartedAt: iso,
      },
      { status: 409 }
    );
  }

  const previous = await prisma.adminInsightsReport.findFirst({
    where: { status: 'COMPLETED' },
    orderBy: { periodEnd: 'desc' },
    select: { periodEnd: true },
  });

  const earliestClaude = previous
    ? null
    : await findEarliestClaudeJobStartedAt();

  const now = new Date();
  const period = derivePeriod({
    previousHighWater: previous?.periodEnd ?? null,
    earliestClaudeStartedAt: earliestClaude,
    now,
  });

  if ('error' in period) {
    return NextResponse.json(
      {
        error: 'No shipped Claude tickets to analyze yet',
        code: 'NO_NEW_SHIPPED_TICKETS',
        previousRunAt: null,
      },
      { status: 409 }
    );
  }

  const newShipped = await countNewShippedClaudeTickets(period.periodStart);
  if (newShipped === 0) {
    const previousIso = previous?.periodEnd?.toISOString() ?? null;
    return NextResponse.json(
      {
        error: previousIso
          ? `No new shipped tickets since last run on ${previousIso}`
          : 'No shipped Claude tickets to analyze yet',
        code: 'NO_NEW_SHIPPED_TICKETS',
        previousRunAt: previousIso,
      },
      { status: 409 }
    );
  }

  const report = await prisma.adminInsightsReport.create({
    data: {
      status: 'RUNNING',
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      triggeredById: session.id,
    },
    select: {
      id: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      startedAt: true,
    },
  });

  try {
    await dispatchInsightsAnalyzeWorkflow({
      reportId: report.id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    });
  } catch (error) {
    console.error(
      '[POST /api/admin/insights/runs] Dispatch failed, rolling back row',
      { reportId: report.id, error: error instanceof Error ? error.message : String(error) }
    );
    await prisma.adminInsightsReport
      .delete({ where: { id: report.id } })
      .catch((deleteError) => {
        console.error(
          '[POST /api/admin/insights/runs] Failed to rollback row',
          { reportId: report.id, deleteError }
        );
      });
    return NextResponse.json(
      {
        error: 'GitHub workflow dispatch failed',
        code: 'DISPATCH_FAILED',
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      id: report.id,
      status: report.status,
      periodStart: report.periodStart.toISOString(),
      periodEnd: report.periodEnd.toISOString(),
      startedAt: report.startedAt.toISOString(),
    },
    { status: 201 }
  );
}
