import { reconcileOrphanedRunningReports } from '@/app/lib/insights/reconcile';
import {
  getLastCompletedRunEnd,
  listReports,
  toListEntry,
} from '@/app/lib/insights/repository';
import { countShippedClaudeTicketsSince } from '@/app/lib/insights/predicate';
import { InsightsReportView } from '@/components/admin/insights/insights-report-view';

export const dynamic = 'force-dynamic';

/**
 * /admin/insights — hosts the report view. Reconciliation runs FIRST so
 * stale RUNNING rows don't surface as in-progress (AIB-791 P-7).
 * Allowlist guard is in app/admin/layout.tsx.
 */
export default async function InsightsPage() {
  await reconcileOrphanedRunningReports(new Date());

  const reports = await listReports(200);
  const reportEntries = reports.map(toListEntry);
  const latestCompleted = reports.find((r) => r.status === 'COMPLETED') ?? null;
  const latestEntry = latestCompleted ? toListEntry(latestCompleted) : null;

  const prevEnd = await getLastCompletedRunEnd();
  const shippedSincePreviousRun = await countShippedClaudeTicketsSince(prevEnd);

  return (
    <InsightsReportView
      reports={reportEntries}
      latest={latestEntry}
      preflight={{
        shippedSincePreviousRun,
        previousRunEnd: prevEnd?.toISOString() ?? null,
      }}
    />
  );
}
