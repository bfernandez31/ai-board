import { prisma } from '@/lib/db/client';
import { PLANS } from '@/lib/billing/plans';
import type { TrendPoint, JobTrendPoint, MrrMonthPoint } from './types';

type RawSignupRow = { d: string; v: bigint | number };
type RawJobRow = { d: string; completed: bigint | number; failed: bigint | number };

export async function computeSignupsDaily(days = 30): Promise<TrendPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<RawSignupRow[]>`
    SELECT DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC')::date::text AS d,
           COUNT(*)::int AS v
    FROM "User"
    WHERE "createdAt" >= ${since}
    GROUP BY 1
    ORDER BY 1
  `;

  const map = new Map(rows.map((r) => [r.d, Number(r.v)]));
  const result: TrendPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    result.push({ d: key, v: map.get(key) ?? 0 });
  }
  return result;
}

export async function computeJobsDaily(days = 30): Promise<JobTrendPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<RawJobRow[]>`
    SELECT DATE_TRUNC('day', "startedAt" AT TIME ZONE 'UTC')::date::text AS d,
           COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
           COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed
    FROM "Job"
    WHERE "startedAt" >= ${since}
    GROUP BY 1
    ORDER BY 1
  `;

  const map = new Map(rows.map((r) => [r.d, { completed: Number(r.completed), failed: Number(r.failed) }]));
  const result: JobTrendPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const entry = map.get(key);
    result.push({ d: key, completed: entry?.completed ?? 0, failed: entry?.failed ?? 0 });
  }
  return result;
}

export async function computeMrrMonthly(months = 12): Promise<MrrMonthPoint[]> {
  const now = new Date();
  const result: MrrMonthPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthKey = monthStart.toISOString().slice(0, 7);

    const activeSubs = await prisma.subscription.findMany({
      where: {
        createdAt: { lt: monthEnd },
        plan: { in: ['PRO', 'TEAM'] },
        AND: [
          { OR: [{ cancelAt: null }, { cancelAt: { gt: monthStart } }] },
          { OR: [{ canceledAt: null }, { canceledAt: { gt: monthStart } }] },
          { OR: [{ trialEnd: null }, { trialEnd: { lte: monthStart } }] },
        ],
      },
      select: { plan: true },
    });

    const mrr = activeSubs.reduce((sum, s) => sum + PLANS[s.plan].priceMonthly, 0);
    result.push({ m: monthKey, v: mrr });
  }

  return result;
}
