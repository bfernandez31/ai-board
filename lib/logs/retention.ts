/**
 * Job log retention.
 *
 * JobLog rows are pruned on a 30-day rolling window. Call pruneOldJobLogs()
 * from a cron job or admin endpoint; the function is safe to run repeatedly.
 */

import { prisma } from '@/lib/db/client';

export const JOB_LOG_RETENTION_DAYS = 30;

export async function pruneOldJobLogs(
  now: Date = new Date(),
  retentionDays: number = JOB_LOG_RETENTION_DAYS
): Promise<{ deleted: number }> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.jobLog.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  });
  return { deleted: result.count };
}
