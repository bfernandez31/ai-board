import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import {
  AdminAccessDenied,
  requireAdmin,
} from '@/lib/admin/admin-auth';
import { reconcileOrphanedInsightsReports } from '@/lib/admin/insights/reconcile';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 200;

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

interface SerializedReport {
  id: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  periodStart: string;
  periodEnd: string;
  sessionsCount: number | null;
  ticketsCount: number | null;
  errorReason: string | null;
  triggeredByEmail: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(request);
  } catch (error) {
    if (error instanceof AdminAccessDenied) return notFound();
    throw error;
  }

  await reconcileOrphanedInsightsReports();

  const limitParam = request.nextUrl.searchParams.get('limit');
  let limit = DEFAULT_LIMIT;
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  const rows = await prisma.adminInsightsReport.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      sessionsCount: true,
      ticketsCount: true,
      errorReason: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      triggeredBy: { select: { email: true } },
    },
  });

  const reports: SerializedReport[] = rows.map((row) => ({
    id: row.id,
    status: row.status,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    sessionsCount: row.sessionsCount,
    ticketsCount: row.ticketsCount,
    errorReason: row.errorReason,
    triggeredByEmail: row.triggeredBy?.email ?? null,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }));

  const running = await prisma.adminInsightsReport.findFirst({
    where: { status: 'RUNNING' },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });

  const response = NextResponse.json(
    { reports, runningReportId: running?.id ?? null },
    { status: 200 }
  );
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}
