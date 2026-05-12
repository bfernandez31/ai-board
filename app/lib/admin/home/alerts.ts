import { prisma } from '@/lib/db/client';
import type { AlertCard } from './types';

export const CRITICAL_CRONS = ['nightly-health', 'nightly-log-prune'] as const;
export type CriticalCronName = (typeof CRITICAL_CRONS)[number];

const JOB_SUCCESS_THRESHOLD = 0.9;
const JOB_SUCCESS_WINDOW_DAYS = 7;
const STRIPE_WINDOW_HOURS = 24;
const CRON_STALE_HOURS = 36;
const STRIPE_RELEVANT_EVENT_PREFIXES = [
  'checkout.session.',
  'customer.subscription.',
  'invoice.payment_',
];

function nHoursAgo(now: Date, hours: number): Date {
  return new Date(now.getTime() - hours * 3_600_000);
}

function nDaysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

export async function detectJobSuccessAlert(now: Date = new Date()): Promise<AlertCard | null> {
  const since = nDaysAgo(now, JOB_SUCCESS_WINDOW_DAYS);
  const [completed, failed, cancelled] = await Promise.all([
    prisma.job.count({ where: { status: 'COMPLETED', createdAt: { gte: since } } }),
    prisma.job.count({ where: { status: 'FAILED', createdAt: { gte: since } } }),
    prisma.job.count({ where: { status: 'CANCELLED', createdAt: { gte: since } } }),
  ]);

  const total = completed + failed + cancelled;
  if (total === 0) return null;

  const rate = completed / total;
  if (rate >= JOB_SUCCESS_THRESHOLD) return null;

  return {
    kind: 'job-success',
    id: 'job-success',
    payload: {
      kind: 'job-success',
      successRatePct: rate,
      failedCount: failed + cancelled,
      windowDays: 7,
    },
    actionLabel: 'Voir les jobs failed',
    actionHref: '/projects?jobStatus=FAILED&since=7d',
  };
}

export async function detectStripeWebhookAlert(now: Date = new Date()): Promise<AlertCard | null> {
  const since = nHoursAgo(now, STRIPE_WINDOW_HOURS);
  const transitions = await prisma.subscription.count({
    where: {
      updatedAt: { gte: since },
      plan: { in: ['PRO', 'TEAM'] },
      status: { in: ['ACTIVE', 'TRIALING'] },
    },
  });
  if (transitions === 0) return null;

  const recentEvents = await prisma.stripeEvent.count({
    where: {
      processedAt: { gte: since },
      OR: STRIPE_RELEVANT_EVENT_PREFIXES.map((prefix) => ({
        type: { startsWith: prefix },
      })),
    },
  });
  if (recentEvents > 0) return null;

  return {
    kind: 'stripe-webhook',
    id: 'stripe-webhook',
    payload: {
      kind: 'stripe-webhook',
      transitionsInWindow: transitions,
      windowHours: 24,
    },
    actionLabel: 'Vérifier les webhooks Stripe',
    actionHref: '/admin/insights',
  };
}

function githubWorkflowUrl(workflowName: string): string {
  const repo = process.env.GITHUB_REPOSITORY ?? 'bfernandez31/ai-board';
  return `https://github.com/${repo}/actions/workflows/${workflowName}.yml`;
}

export async function detectCronStaleAlerts(now: Date = new Date()): Promise<AlertCard[]> {
  const alerts: AlertCard[] = [];
  const staleThreshold = nHoursAgo(now, CRON_STALE_HOURS);

  for (const workflowName of CRITICAL_CRONS) {
    const latest = await prisma.cronRunLog.findFirst({
      where: { workflowName },
      orderBy: { ranAt: 'desc' },
      select: { ranAt: true },
    });

    if (latest === null) {
      alerts.push({
        kind: 'cron',
        id: `cron:${workflowName}`,
        payload: {
          kind: 'cron',
          workflowName,
          lastSuccessAt: null,
          hoursSinceLastSuccess: null,
        },
        actionLabel: `Voir ${workflowName}`,
        actionHref: githubWorkflowUrl(workflowName),
      });
      continue;
    }

    if (latest.ranAt < staleThreshold) {
      const hoursSince = (now.getTime() - latest.ranAt.getTime()) / 3_600_000;
      alerts.push({
        kind: 'cron',
        id: `cron:${workflowName}`,
        payload: {
          kind: 'cron',
          workflowName,
          lastSuccessAt: latest.ranAt.toISOString(),
          hoursSinceLastSuccess: Math.round(hoursSince * 10) / 10,
        },
        actionLabel: `Voir ${workflowName}`,
        actionHref: githubWorkflowUrl(workflowName),
      });
    }
  }

  return alerts;
}

export async function detectAlerts(now: Date = new Date()): Promise<AlertCard[]> {
  const [jobSuccess, stripe, crons] = await Promise.all([
    detectJobSuccessAlert(now),
    detectStripeWebhookAlert(now),
    detectCronStaleAlerts(now),
  ]);

  const result: AlertCard[] = [];
  if (jobSuccess) result.push(jobSuccess);
  if (stripe) result.push(stripe);
  crons.sort((a, b) => {
    const aName = a.payload.kind === 'cron' ? a.payload.workflowName : '';
    const bName = b.payload.kind === 'cron' ? b.payload.workflowName : '';
    return aName.localeCompare(bName);
  });
  result.push(...crons);
  return result;
}
