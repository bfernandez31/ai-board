import { prisma } from '@/lib/db/client';
import { InsightsDashboard } from '@/components/admin/insights-dashboard';

export default async function InsightsPage() {
  const [run, activeRun] = await Promise.all([
    prisma.insightsRun.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.insightsRun.findFirst({
      where: {
        status: { in: ['PENDING', 'RUNNING'] },
        timeoutAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        startedAt: true,
        createdAt: true,
      },
    }),
  ]);

  const serializedRun = run
    ? {
        ...run,
        reportUrl: run.reportKey
          ? `/api/admin/insights/runs/${run.id}/report`
          : null,
        periodStart: run.periodStart?.toISOString() ?? null,
        periodEnd: run.periodEnd?.toISOString() ?? null,
        startedAt: run.startedAt?.toISOString() ?? null,
        completedAt: run.completedAt?.toISOString() ?? null,
        timeoutAt: run.timeoutAt.toISOString(),
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
      }
    : null;

  const serializedActiveRun = activeRun
    ? {
        ...activeRun,
        startedAt: activeRun.startedAt?.toISOString() ?? null,
        createdAt: activeRun.createdAt.toISOString(),
      }
    : null;

  return (
    <InsightsDashboard
      initialLatest={{ run: serializedRun, activeRun: serializedActiveRun }}
    />
  );
}
