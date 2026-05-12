import type { DashboardSnapshot, DailyPoint, JobsDailyPoint, MonthlyPoint } from './types';

function toUtcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toUtcMonthString(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function buildZeroDaily(): DailyPoint[] {
  const points: DailyPoint[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    points.push({ date: toUtcDateString(d), value: 0 });
  }
  return points;
}

function buildZeroJobsDaily(): JobsDailyPoint[] {
  const points: JobsDailyPoint[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    points.push({ date: toUtcDateString(d), completed: 0, failed: 0 });
  }
  return points;
}

function buildZeroMonthly(): MonthlyPoint[] {
  const points: MonthlyPoint[] = [];
  const today = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    points.push({ month: toUtcMonthString(d), mrrCents: 0 });
  }
  return points;
}

export async function computeTrends(): Promise<DashboardSnapshot['trends']> {
  return {
    signupsPerDay: buildZeroDaily(),
    jobsPerDay: buildZeroJobsDaily(),
    mrrPerMonth: buildZeroMonthly(),
  };
}
