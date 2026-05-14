import { WebhookOutcomeStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { CRITICAL_CRONS } from '@/lib/admin/cron/registry';
import type { Alert } from './types';

export async function computeAlerts(): Promise<Alert[]> {
  const now = new Date();
  const minus7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const minus24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [denominator, numerator, webhookFailures, cronRuns] = await Promise.all([
    prisma.job.count({
      where: {
        status: { in: ['COMPLETED', 'FAILED'] },
        startedAt: { gte: minus7d },
      },
    }),
    prisma.job.count({
      where: {
        status: 'COMPLETED',
        startedAt: { gte: minus7d },
      },
    }),
    prisma.webhookOutcome.count({
      where: {
        status: WebhookOutcomeStatus.FAILURE,
        receivedAt: { gte: minus24h },
      },
    }),
    prisma.cronRun.findMany({
      select: { cron: true, lastSuccessAt: true },
    }),
  ]);

  const alerts: Alert[] = [];

  // LOW_SUCCESS_RATE
  if (denominator >= 20 && numerator / denominator < 0.9) {
    const pct = Math.round((numerator / denominator) * 100);
    alerts.push({
      kind: 'LOW_SUCCESS_RATE',
      message: `Job success rate ${pct}% over last 7 days (${numerator} of ${denominator} jobs)`,
      href: '/admin/insights',
    });
  }

  // STRIPE_WEBHOOK_ERRORS
  if (webhookFailures >= 1) {
    alerts.push({
      kind: 'STRIPE_WEBHOOK_ERRORS',
      message: `${webhookFailures} Stripe webhook failure${webhookFailures > 1 ? 's' : ''} in the last 24 hours`,
      href: '/admin/insights',
    });
  }

  // STALE_CRITICAL_CRON
  const cronRunMap = new Map(cronRuns.map((r) => [r.cron, r.lastSuccessAt]));

  for (const entry of CRITICAL_CRONS) {
    const lastRun = cronRunMap.get(entry.key);
    const thresholdMs = entry.thresholdHours * 60 * 60 * 1000;
    if (!lastRun || now.getTime() - lastRun.getTime() > thresholdMs) {
      alerts.push({
        kind: 'STALE_CRITICAL_CRON',
        message: `Critical cron "${entry.label}" has not run in the last ${entry.thresholdHours} hours`,
        href: '/admin/insights',
      });
    }
  }

  return alerts;
}
