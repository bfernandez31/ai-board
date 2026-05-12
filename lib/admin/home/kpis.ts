import { prisma } from '@/lib/db/client';
import { PLANS } from '@/lib/billing/plans';
import type { PulseSnapshot, TrendPoint } from './types';

type RawDailyRow = { d: string; v: bigint | number };
type RawCountRow = { count: bigint | number };

function padSpark(rows: RawDailyRow[], days: number): TrendPoint[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.d, Number(r.v));
  }
  const result: TrendPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    result.push({ d: key, v: map.get(key) ?? 0 });
  }
  return result;
}

export async function computePulseKpis(): Promise<PulseSnapshot> {
  const now = new Date();
  const minus7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const minus30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const minus60d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    delta7d,
    delta30d,
    mauCurrentRaw,
    mauPrevRaw,
    activeSubs,
    userSparkRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: minus7d } } }),
    prisma.user.count({ where: { createdAt: { gte: minus30d } } }),
    prisma.$queryRaw<RawCountRow[]>`
      SELECT COUNT(DISTINCT p."userId") AS count
      FROM "Job" j
      JOIN "Project" p ON p.id = j."projectId"
      WHERE j."startedAt" >= ${minus30d}
    `,
    prisma.$queryRaw<RawCountRow[]>`
      SELECT COUNT(DISTINCT p."userId") AS count
      FROM "Job" j
      JOIN "Project" p ON p.id = j."projectId"
      WHERE j."startedAt" >= ${minus60d} AND j."startedAt" < ${minus30d}
    `,
    prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIALING'] },
        plan: { in: ['PRO', 'TEAM'] },
        OR: [{ cancelAt: null }, { cancelAt: { gt: now } }],
      },
      select: { plan: true, status: true, cancelAt: true, createdAt: true },
    }),
    prisma.$queryRaw<RawDailyRow[]>`
      SELECT DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC')::date::text AS d,
             COUNT(*)::int AS v
      FROM "User"
      WHERE "createdAt" >= ${minus30d}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const mauValue = Number(mauCurrentRaw[0]?.count ?? 0);
  const prevMauValue = Number(mauPrevRaw[0]?.count ?? 0);

  // MRR + active paying counts (defensively filter to PRO/TEAM)
  let mrrUsd = 0;
  let proCount = 0;
  let teamCount = 0;
  let proUsd = 0;
  let teamUsd = 0;
  let newMrrThisMonth = 0;
  let activePayingValue = 0;
  let activePaying30dDelta = 0;

  for (const sub of activeSubs) {
    if (sub.plan !== 'PRO' && sub.plan !== 'TEAM') continue;
    activePayingValue++;
    const price = PLANS[sub.plan].priceMonthly;
    mrrUsd += price;
    if (sub.plan === 'PRO') {
      proCount++;
      proUsd += price;
    } else {
      teamCount++;
      teamUsd += price;
    }
    if (sub.createdAt >= startOfMonth) {
      newMrrThisMonth += price;
    }
    if (sub.createdAt >= minus30d) {
      activePaying30dDelta++;
    }
  }

  // Sparklines
  const userSpark = padSpark(userSparkRaw, 30);
  const emptyDays = userSpark.map((p) => ({ d: p.d, v: 0 }));

  return {
    users: {
      value: totalUsers,
      delta7d,
      delta30d,
      spark: userSpark,
    },
    mau: {
      value: mauValue,
      deltaPrev30d: mauValue - prevMauValue,
      shareOfBase: totalUsers > 0 ? mauValue / totalUsers : null,
      spark: emptyDays,
    },
    mrr: {
      value: mrrUsd,
      valueUsd: mrrUsd,
      deltaUsdThisMonth: newMrrThisMonth,
      proCount,
      teamCount,
      proUsd,
      teamUsd,
      spark: emptyDays,
    },
    activePaying: {
      value: activePayingValue,
      delta30d: activePaying30dDelta,
      conversionRate: totalUsers > 0 ? activePayingValue / totalUsers : null,
      spark: emptyDays,
    },
  };
}
