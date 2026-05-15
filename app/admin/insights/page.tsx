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
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const reportEntries = reports.map((r) => toListEntry(r, owner, repo));
  // Prefer the latest COMPLETED report, but fall back to the first row (which
  // may be RUNNING or FAILED) so the view surfaces in-flight or failed runs
  // instead of the empty-state placeholder when no COMPLETED report exists.
  const latestEntry =
    reportEntries.find((r) => r.status === 'COMPLETED') ??
    reportEntries[0] ??
    null;

  const preflight = await computePreflightSnapshot();

  return (
    <InsightsReportView
      reports={reportEntries}
      latest={latestEntry}
      preflight={preflight}
    />
  );
}
