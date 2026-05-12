import { prisma } from '@/lib/db/client';

const DEFAULT_TIMEOUT_MINUTES = 60;
const FAILED_REASON = 'Run timed out — workflow did not report terminal status';

/**
 * Read `INSIGHTS_RUN_TIMEOUT_MINUTES` fresh on every call (no module-level
 * caching). Mirrors the `LOG_RETENTION_DAYS` parsing idiom at
 * `app/api/maintenance/prune-logs/route.ts:16`.
 *
 * Validation: clamp to a minimum of 1 minute; fall back to the default for
 * non-finite values.
 */
function readTimeoutMinutes(): number {
  const raw = process.env.INSIGHTS_RUN_TIMEOUT_MINUTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MINUTES;
  return Math.max(1, Math.floor(parsed));
}

/**
 * Atomically transition any RUNNING InsightsReport rows whose `createdAt`
 * is older than `INSIGHTS_RUN_TIMEOUT_MINUTES` to FAILED with a non-secret
 * reason (AIB-791, D-12, D-14, FR-015, P-1).
 *
 * Uses `updateMany` with a `WHERE status='RUNNING'` guard so concurrent
 * reconciliation calls cannot flip a row backwards: the first call updates
 * the rows; subsequent calls' `count` is zero.
 *
 * Called at the top of `/api/admin/insights/trigger` (POST) and
 * `/api/admin/insights/reports` (GET) — every entry point that reads or
 * mutates the lifecycle (P-7).
 */
export async function reconcileOrphanedRunningReports(
  now: Date
): Promise<{ failed: number }> {
  const timeoutMinutes = readTimeoutMinutes();
  const cutoff = new Date(now.getTime() - timeoutMinutes * 60_000);

  const result = await prisma.insightsReport.updateMany({
    where: {
      status: 'RUNNING',
      createdAt: { lt: cutoff },
    },
    data: {
      status: 'FAILED',
      errorReason: FAILED_REASON,
      completedAt: now,
    },
  });

  return { failed: result.count };
}
