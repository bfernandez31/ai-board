import { reconcileOrphanedRunningReports } from '@/app/lib/insights/reconcile';
import { listReports, toListEntry } from '@/app/lib/insights/repository';
import { computePreflightSnapshot } from '@/app/lib/insights/preflight';
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
  // Prefer the latest COMPLETED report (sortable by generatedAt desc), but
  // fall back to the first row (which may be RUNNING or FAILED) so the view
  // surfaces in-flight or failed runs instead of the empty-state placeholder
  // when no COMPLETED report exists yet.
  const latestCompleted = reports.find((r) => r.status === 'COMPLETED') ?? null;
  const defaultDisplay = latestCompleted ?? reports[0] ?? null;
  const latestEntry = defaultDisplay ? toListEntry(defaultDisplay) : null;

  const preflight = await computePreflightSnapshot();

  return (
    <InsightsReportView
      reports={reportEntries}
      latest={latestEntry}
      preflight={preflight}
    />
  );
}
