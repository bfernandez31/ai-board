import { NextRequest, NextResponse } from 'next/server';
import { AdminAccessDeniedError, requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/client';
import {
  buildInsightsScope,
  findActiveInsightsReport,
} from '@/lib/admin/insights-scope';
import { dispatchAdminInsightsWorkflow } from '@/lib/workflows/dispatch-admin-insights';

function notFound(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch (error) {
    if (error instanceof AdminAccessDeniedError) {
      return notFound();
    }
    console.error('[POST /api/admin/insights/run] Auth error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  try {
    const existingActive = await findActiveInsightsReport();
    if (existingActive) {
      return NextResponse.json(
        {
          error: 'An insights analysis is already running',
          code: 'ANALYSIS_IN_PROGRESS',
          activeReportId: existingActive.id,
        },
        { status: 409 }
      );
    }

    const scope = await buildInsightsScope();
    if (!scope.hasNewTickets) {
      const previousLabel = scope.previousRunAt
        ? scope.previousRunAt.toISOString()
        : null;
      const message = previousLabel
        ? `No new shipped tickets since last run on ${previousLabel}`
        : 'No shipped tickets are available to analyze yet';
      return NextResponse.json(
        {
          error: message,
          code: 'NO_NEW_TICKETS',
          previousRunAt: previousLabel,
        },
        { status: 422 }
      );
    }

    const report = await prisma.insightsReport.create({
      data: {
        status: 'RUNNING',
        triggeredById: admin.id,
        periodStart: scope.periodStart,
        periodEnd: scope.periodEnd,
        sessionCount: scope.jobs.length,
        ticketCount: scope.ticketIds.length,
      },
    });

    try {
      await dispatchAdminInsightsWorkflow({ report_id: String(report.id) });
    } catch (dispatchError) {
      await prisma.insightsReport.update({
        where: { id: report.id },
        data: {
          status: 'FAILED',
          errorMessage:
            dispatchError instanceof Error
              ? dispatchError.message.slice(0, 2000)
              : 'Workflow dispatch failed',
          completedAt: new Date(),
        },
      });
      throw dispatchError;
    }

    return NextResponse.json(
      {
        reportId: report.id,
        status: report.status,
        sessionCount: report.sessionCount,
        ticketCount: report.ticketCount,
        periodStart: report.periodStart?.toISOString() ?? null,
        periodEnd: report.periodEnd?.toISOString() ?? null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/admin/insights/run] Error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
