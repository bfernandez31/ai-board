import { NextRequest, NextResponse } from 'next/server';
import { AdminAccessDeniedError, requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/client';
import {
  findActiveInsightsReport,
  findLatestSuccessfulReport,
  previewInsightsScope,
} from '@/lib/admin/insights-scope';

interface SerializedReport {
  id: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  periodStart: string | null;
  periodEnd: string | null;
  sessionCount: number;
  ticketCount: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

function serializeReport(row: {
  id: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  periodStart: Date | null;
  periodEnd: Date | null;
  sessionCount: number;
  ticketCount: number;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
}): SerializedReport {
  return {
    id: row.id,
    status: row.status,
    periodStart: row.periodStart?.toISOString() ?? null,
    periodEnd: row.periodEnd?.toISOString() ?? null,
    sessionCount: row.sessionCount,
    ticketCount: row.ticketCount,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function notFound(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(request);
  } catch (error) {
    if (error instanceof AdminAccessDeniedError) {
      return notFound();
    }
    console.error('[GET /api/admin/insights] Auth error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  try {
    const [reports, latest, active, scope] = await Promise.all([
      prisma.insightsReport.findMany({
        orderBy: { startedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          status: true,
          periodStart: true,
          periodEnd: true,
          sessionCount: true,
          ticketCount: true,
          errorMessage: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      findLatestSuccessfulReport(),
      findActiveInsightsReport(),
      previewInsightsScope(),
    ]);

    return NextResponse.json(
      {
        reports: reports.map(serializeReport),
        latest: latest ? serializeReport(latest) : null,
        active: active ? serializeReport(active) : null,
        scope: {
          previousRunAt: scope.previousRunAt?.toISOString() ?? null,
          newTicketCount: scope.newTicketCount,
          hasNewTickets: scope.hasNewTickets,
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[GET /api/admin/insights] Error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
