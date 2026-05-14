import { prisma } from '@/lib/db/client';
import { PLANS } from '@/lib/billing/plans';
import type { PulseSnapshot, TrendPoint } from './types';

type RawDailyRow = { d: string; v: bigint | number };
type RawCountRow = { count: bigint | number };

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function computePulseKpis(): Promise<PulseSnapshot> {
  const now = new Date();
  const minus7d = new Date(now.getTime() - 7 * DAY_MS);
  const minus30d = new Date(now.getTime() - 30 * DAY_MS);
  const minus60d = new Date(now.getTime() - 60 * DAY_MS);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    delta7d,
    delta30d,
    mauCurrentRaw,
    mauPrevRaw,
    activeSubs,
    canceledThisMonth,
    lostPayingLast30d,
    subsForSpark,
    userSparkRaw,
    mauSparkRaw,
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
    prisma.subscription.findMany({
      where: { canceledAt: { gte: startOfMonth }, plan: { in: ['PRO', 'TEAM'] } },
      select: { plan: true },
    }),
    prisma.subscription.findMany({
      where: { canceledAt: { gte: minus30d }, plan: { in: ['PRO', 'TEAM'] } },
      select: { id: true },
    }),
    prisma.subscription.findMany({
      where: {
        plan: { in: ['PRO', 'TEAM'] },
        status: { in: ['ACTIVE', 'TRIALING', 'CANCELED'] },
        createdAt: { lte: now },
      },
      select: { plan: true, createdAt: true, cancelAt: true, canceledAt: true },
    }),
    prisma.$queryRaw<RawDailyRow[]>`
      SELECT DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC')::date::text AS d,
             COUNT(*)::int AS v
      FROM "User"
      WHERE "createdAt" >= ${minus30d}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<RawDailyRow[]>`
      SELECT DATE_TRUNC('day', j."startedAt" AT TIME ZONE 'UTC')::date::text AS d,
             COUNT(DISTINCT p."userId")::int AS v
      FROM "Job" j
      JOIN "Project" p ON p.id = j."projectId"
      WHERE j."startedAt" >= ${minus30d}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const mauValue = Number(mauCurrentRaw[0]?.count ?? 0);
  const prevMauValue = Number(mauPrevRaw[0]?.count ?? 0);

  let mrrUsd = 0;
  let proCount = 0;
  let teamCount = 0;
  let proUsd = 0;
  let teamUsd = 0;
  let newMrrThisMonth = 0;
  let activePayingValue = 0;
  let activePaying30dGained = 0;

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
    if (sub.createdAt >= startOfMonth) newMrrThisMonth += price;
    if (sub.createdAt >= minus30d) activePaying30dGained++;
  }

  const mrrCanceledThisMonth = canceledThisMonth.reduce(
    (sum, s) => sum + (PLANS[s.plan]?.priceMonthly ?? 0),
    0,
  );
  const deltaUsdThisMonth = newMrrThisMonth - mrrCanceledThisMonth;
  const activePaying30dDelta = activePaying30dGained - lostPayingLast30d.length;

  // Build daily sparklines (last 30 days, UTC day boundaries).
  const signupsByDay = new Map<string, number>(
    userSparkRaw.map((r) => [r.d, Number(r.v)]),
  );
  const mauByDay = new Map<string, number>(
    mauSparkRaw.map((r) => [r.d, Number(r.v)]),
  );

  const todayUtc = utcDayStart(now);
  const userSpark: TrendPoint[] = [];
  const mauSpark: TrendPoint[] = [];
  const mrrSpark: TrendPoint[] = [];
  const activePayingSpark: TrendPoint[] = [];

  // Walk newest → oldest to compute cumulative users.
  let signupsAfterDay = 0;
  for (let i = 0; i < 30; i++) {
    const dayStart = new Date(todayUtc.getTime() - i * DAY_MS);
    const key = utcDayKey(dayStart);
    userSpark.unshift({ d: key, v: totalUsers - signupsAfterDay });
    signupsAfterDay += signupsByDay.get(key) ?? 0;
  }

  for (let i = 29; i >= 0; i--) {
    const dayStart = new Date(todayUtc.getTime() - i * DAY_MS);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS - 1);
    const key = utcDayKey(dayStart);

    mauSpark.push({ d: key, v: mauByDay.get(key) ?? 0 });

    let mrrAtDay = 0;
    let countAtDay = 0;
    for (const sub of subsForSpark) {
      if (sub.createdAt > dayEnd) continue;
      if (sub.canceledAt && sub.canceledAt <= dayEnd) continue;
      if (sub.cancelAt && sub.cancelAt <= dayEnd) continue;
      countAtDay++;
      mrrAtDay += PLANS[sub.plan].priceMonthly;
    }
    mrrSpark.push({ d: key, v: mrrAtDay });
    activePayingSpark.push({ d: key, v: countAtDay });
  }

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
      spark: mauSpark,
    },
    mrr: {
      value: mrrUsd,
      valueUsd: mrrUsd,
      deltaUsdThisMonth,
      proCount,
      teamCount,
      proUsd,
      teamUsd,
      spark: mrrSpark,
    },
    activePaying: {
      value: activePayingValue,
      delta30d: activePaying30dDelta,
      conversionRate: totalUsers > 0 ? activePayingValue / totalUsers : null,
      spark: activePayingSpark,
    },
  };
}
