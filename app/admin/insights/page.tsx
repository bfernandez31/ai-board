import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import {
  AdminAccessDenied,
  requireAdmin,
} from '@/lib/admin/admin-auth';
import { reconcileOrphanedInsightsReports } from '@/lib/admin/insights/reconcile';
import { InsightsPageShell } from '@/app/components/admin/insights/insights-page-shell';
import type { InsightsReportSummary } from '@/app/components/admin/insights/past-reports-list';
import type { AdminInsightsListResponse } from '@/app/hooks/admin/use-admin-insights-list';

export const dynamic = 'force-dynamic';

const LIST_LIMIT = 200;

export default async function AdminInsightsPage(): Promise<JSX.Element> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAccessDenied) {
      notFound();
    }
    throw error;
  }

  await reconcileOrphanedInsightsReports();

  const rows = await prisma.adminInsightsReport.findMany({
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
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

  const reports: InsightsReportSummary[] = rows.map((row) => ({
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

  const initialData: AdminInsightsListResponse = {
    reports,
    runningReportId: running?.id ?? null,
  };

  return <InsightsPageShell initialData={initialData} />;
}
