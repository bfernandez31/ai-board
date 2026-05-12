import { prisma } from '@/lib/db/client';
import { PLANS } from '@/lib/billing/plans';
import type {
  DailyPoint,
  DashboardSnapshot,
  JobsDailyPoint,
  MonthlyPoint,
} from './types';

const DAILY_WINDOW = 30;
const MONTHLY_WINDOW = 12;

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

function nDaysAgoUtc(now: Date, n: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n));
}

function nMonthsAgoUtc(now: Date, n: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1));
}

function toDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toMonthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function buildDayWindow(now: Date): string[] {
  const keys: string[] = [];
  for (let i = DAILY_WINDOW - 1; i >= 0; i--) {
    keys.push(toDayKey(nDaysAgoUtc(now, i)));
  }
  return keys;
}

function buildMonthWindow(now: Date): string[] {
  const keys: string[] = [];
  for (let i = MONTHLY_WINDOW - 1; i >= 0; i--) {
    keys.push(toMonthKey(nMonthsAgoUtc(now, i)));
  }
  return keys;
}

async function computeSignupsPerDay(now: Date): Promise<DailyPoint[]> {
  const since = nDaysAgoUtc(now, DAILY_WINDOW);
  const rows = await prisma.user.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const counts: Record<string, number> = {};
  for (const key of buildDayWindow(now)) counts[key] = 0;
  for (const r of rows) {
    const k = toDayKey(startOfDayUtc(r.createdAt));
    if (Object.prototype.hasOwnProperty.call(counts, k)) {
      counts[k] = (counts[k] ?? 0) + 1;
    }
  }
  return buildDayWindow(now).map((date) => ({ date, value: counts[date] ?? 0 }));
}

async function computeJobsPerDay(now: Date): Promise<JobsDailyPoint[]> {
  const since = nDaysAgoUtc(now, DAILY_WINDOW);
  const rows = await prisma.job.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, status: true },
  });

  const completed: Record<string, number> = {};
  const failed: Record<string, number> = {};
  for (const key of buildDayWindow(now)) {
    completed[key] = 0;
    failed[key] = 0;
  }
  for (const r of rows) {
    const k = toDayKey(startOfDayUtc(r.createdAt));
    if (!Object.prototype.hasOwnProperty.call(completed, k)) continue;
    if (r.status === 'COMPLETED') {
      completed[k] = (completed[k] ?? 0) + 1;
    } else if (r.status === 'FAILED' || r.status === 'CANCELLED') {
      failed[k] = (failed[k] ?? 0) + 1;
    }
  }
  return buildDayWindow(now).map((date) => ({
    date,
    completed: completed[date] ?? 0,
    failed: failed[date] ?? 0,
  }));
}

async function computeMrrPerMonth(now: Date): Promise<MonthlyPoint[]> {
  const monthKeys = buildMonthWindow(now);
  const firstMonthStart = startOfMonthUtc(nMonthsAgoUtc(now, MONTHLY_WINDOW - 1));

  // For each month, count active PRO/TEAM subscriptions at end of month.
  // We approximate "active at end of month" with: createdAt <= endOfMonth AND
  // (canceledAt is null OR canceledAt > endOfMonth).
  const subs = await prisma.subscription.findMany({
    where: {
      plan: { in: ['PRO', 'TEAM'] },
      createdAt: { lt: endOfMonthUtc(now) },
    },
    select: { plan: true, createdAt: true, canceledAt: true },
  });

  const result: MonthlyPoint[] = [];
  for (const key of monthKeys) {
    const [year, month] = key.split('-').map(Number);
    if (year === undefined || month === undefined) {
      result.push({ month: key, mrrCents: 0 });
      continue;
    }
    const monthEnd = new Date(Date.UTC(year, month, 1)); // exclusive end-of-month
    let pro = 0;
    let team = 0;
    for (const sub of subs) {
      if (sub.createdAt >= monthEnd) continue;
      if (sub.canceledAt !== null && sub.canceledAt < monthEnd) continue;
      if (sub.plan === 'PRO') pro += 1;
      else if (sub.plan === 'TEAM') team += 1;
    }
    result.push({
      month: key,
      mrrCents: pro * PLANS.PRO.priceMonthly + team * PLANS.TEAM.priceMonthly,
    });
  }

  void firstMonthStart;
  return result;
}

export async function computeTrends(
  now: Date = new Date()
): Promise<DashboardSnapshot['trends']> {
  const [signupsPerDay, jobsPerDay, mrrPerMonth] = await Promise.all([
    computeSignupsPerDay(now),
    computeJobsPerDay(now),
    computeMrrPerMonth(now),
  ]);
  return { signupsPerDay, jobsPerDay, mrrPerMonth };
}
