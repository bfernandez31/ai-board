import { prisma } from '@/lib/db/client';

const BATCH_SIZE = 100;

export async function pruneExpiredLogs(retentionDays: number): Promise<{ pruned: number; errors: number }> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  let pruned = 0;
  let errors = 0;

  while (true) {
    const expiredLogs = await prisma.jobLog.findMany({
      where: {
        job: {
          completedAt: { lt: cutoff },
        },
      },
      select: { id: true, jobId: true },
      take: BATCH_SIZE,
    });

    if (expiredLogs.length === 0) break;

    for (const log of expiredLogs) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.jobLog.delete({ where: { id: log.id } });
          await tx.job.update({
            where: { id: log.jobId },
            data: { logStatus: 'PRUNED', logSummary: null },
          });
        });
        pruned++;
      } catch (err) {
        console.error(`[Prune Logs] Failed to prune log ${log.id}:`, err);
        errors++;
      }
    }
  }

  return { pruned, errors };
}
