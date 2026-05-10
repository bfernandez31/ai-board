import { prisma } from '@/lib/db/client';

const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000;

export function getInsightsRunTimeoutMs(): number {
  const raw = process.env.INSIGHTS_RUN_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
  return n;
}

/**
 * Lazy reconciliation (D2 in research.md): flip any RUNNING row whose
 * startedAt is older than the configured timeout to FAILED. Idempotent.
 * Returns the count of rows reconciled.
 */
export async function reconcileOrphanedInsightsReports(
  now: Date = new Date()
): Promise<number> {
  const cutoff = new Date(now.getTime() - getInsightsRunTimeoutMs());
  const result = await prisma.adminInsightsReport.updateMany({
    where: { status: 'RUNNING', startedAt: { lt: cutoff } },
    data: {
      status: 'FAILED',
      errorReason: 'Run timed out — workflow did not report terminal status',
      completedAt: now,
    },
  });
  return result.count;
}
