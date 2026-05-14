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
  const earliestMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
  );

  // Single query: every PRO/TEAM sub that could plausibly contribute to any month
  // in the window. We compute month-by-month membership in memory.
  const candidates = await prisma.subscription.findMany({
    where: {
      plan: { in: ['PRO', 'TEAM'] },
      createdAt: { lte: now },
      OR: [
        { canceledAt: null },
        { canceledAt: { gt: earliestMonthStart } },
      ],
    },
    select: { plan: true, createdAt: true, cancelAt: true, canceledAt: true, trialEnd: true },
  });

  const result: MrrMonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
    const monthKey = monthStart.toISOString().slice(0, 7);

    let mrr = 0;
    for (const sub of candidates) {
      if (sub.createdAt >= monthEnd) continue;
      if (sub.cancelAt && sub.cancelAt <= monthStart) continue;
      if (sub.canceledAt && sub.canceledAt <= monthStart) continue;
      // Trial subs are not counted as MRR until their trial ends.
      if (sub.trialEnd && sub.trialEnd > monthStart) continue;
      mrr += PLANS[sub.plan].priceMonthly;
    }
    result.push({ m: monthKey, v: mrr });
  }

  return result;
}
