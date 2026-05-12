import { prisma } from '@/lib/db/client';
import { PLANS } from '@/lib/billing/plans';
import type { DashboardSnapshot, Delta, KpiTile } from './types';

const SPARK_LEN = 30;

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfPreviousUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function nDaysAgoUtc(now: Date, n: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n));
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function bucketCountByDay(timestamps: Date[], now: Date): number[] {
  const counts: Record<string, number> = {};
  for (let i = SPARK_LEN - 1; i >= 0; i--) {
    const day = nDaysAgoUtc(now, i);
    counts[dayKey(day)] = 0;
  }
  for (const ts of timestamps) {
    const key = dayKey(startOfDayUtc(ts));
    if (Object.prototype.hasOwnProperty.call(counts, key)) {
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return Object.values(counts);
}

function cumulativeFrom(baseline: number, increments: number[]): number[] {
  const result: number[] = [];
  let running = baseline;
  for (const inc of increments) {
    running += inc;
    result.push(running);
  }
  return result;
}

export async function computePulse(now: Date = new Date()): Promise<DashboardSnapshot['pulse']> {
  const startOf30dWindow = nDaysAgoUtc(now, SPARK_LEN - 1);
  const sevenDaysAgo = nDaysAgoUtc(now, 7);
  const thirtyDaysAgo = nDaysAgoUtc(now, SPARK_LEN);
  const monthStart = startOfUtcMonth(now);
  const prevMonthStart = startOfPreviousUtcMonth(now);

  const [
    totalUsers,
    usersInLast30,
    usersBeforeSevenDays,
    usersBeforeThirtyDays,
    jobsThisMonth,
    jobsPrevMonth,
    activePaying,
    payingNewLast30Subs,
    freeUsersCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      where: { createdAt: { gte: startOf30dWindow } },
      select: { createdAt: true },
    }),
    prisma.user.count({ where: { createdAt: { lt: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { lt: thirtyDaysAgo } } }),
    prisma.job.findMany({
      where: { createdAt: { gte: monthStart } },
      select: { projectId: true, createdAt: true },
    }),
    prisma.job.findMany({
      where: { createdAt: { gte: prevMonthStart, lt: monthStart } },
      select: { projectId: true },
    }),
    prisma.subscription.findMany({
      where: { plan: { in: ['PRO', 'TEAM'] }, status: { in: ['ACTIVE', 'TRIALING'] } },
      select: { plan: true, createdAt: true },
    }),
    prisma.subscription.findMany({
      where: {
        plan: { in: ['PRO', 'TEAM'] },
        status: { in: ['ACTIVE', 'TRIALING'] },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true },
    }),
    prisma.subscription.count({ where: { plan: 'FREE' } }),
  ]);

  const projectIds = Array.from(
    new Set([
      ...jobsThisMonth.map((j) => j.projectId),
      ...jobsPrevMonth.map((j) => j.projectId),
    ])
  );
  const projectsWithOwners = projectIds.length
    ? await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, userId: true },
      })
    : [];
  const projectIdToUserId = new Map(projectsWithOwners.map((p) => [p.id, p.userId]));

  const distinctMauUserIds = new Set<string>();
  for (const j of jobsThisMonth) {
    const u = projectIdToUserId.get(j.projectId);
    if (u) distinctMauUserIds.add(u);
  }
  const distinctMauPrevMonth = new Set<string>();
  for (const j of jobsPrevMonth) {
    const u = projectIdToUserId.get(j.projectId);
    if (u) distinctMauPrevMonth.add(u);
  }

  const totalProActive = activePaying.filter((s) => s.plan === 'PRO').length;
  const totalTeamActive = activePaying.filter((s) => s.plan === 'TEAM').length;
  const mrrCents = totalProActive * PLANS.PRO.priceMonthly + totalTeamActive * PLANS.TEAM.priceMonthly;

  // Users sparkline
  const userIncrements = bucketCountByDay(
    usersInLast30.map((u) => u.createdAt),
    now
  );
  const usersBaseline = totalUsers - userIncrements.reduce((a, b) => a + b, 0);
  const usersSparkline = cumulativeFrom(usersBaseline, userIncrements);

  const usersDelta7d = totalUsers - usersBeforeSevenDays;
  const usersDelta30d = totalUsers - usersBeforeThirtyDays;

  const usersTile: KpiTile = {
    id: 'users',
    label: 'Utilisateurs',
    value: totalUsers,
    unit: 'count',
    deltas: [
      { label: 'Δ7j', value: usersDelta7d, unit: 'absolute', goodDirection: 'up' },
      { label: 'Δ30j', value: usersDelta30d, unit: 'absolute', goodDirection: 'up' },
    ],
    sparkline: usersSparkline,
    tooltip: 'Total inscrits sur la plateforme.',
  };

  // MAU sparkline: count distinct users with ≥1 job per day (last 30 days)
  const mauDayUsers: Map<string, Set<string>> = new Map();
  for (let i = SPARK_LEN - 1; i >= 0; i--) {
    mauDayUsers.set(dayKey(nDaysAgoUtc(now, i)), new Set());
  }
  for (const j of jobsThisMonth) {
    const u = projectIdToUserId.get(j.projectId);
    if (!u) continue;
    const k = dayKey(startOfDayUtc(j.createdAt));
    const bucket = mauDayUsers.get(k);
    if (bucket) bucket.add(u);
  }
  const mauSparkline = Array.from(mauDayUsers.values()).map((s) => s.size);

  const mauValue = distinctMauUserIds.size;
  const mauPrev = distinctMauPrevMonth.size;
  const mauRatio = totalUsers > 0 ? mauValue / totalUsers : 0;
  const mauDeltas: [Delta, Delta] = [
    {
      label: 'vs. mois précédent',
      value: mauValue - mauPrev,
      unit: 'absolute',
      goodDirection: 'up',
    },
    {
      label: 'MAU / total',
      value: mauRatio,
      unit: 'percent',
      goodDirection: 'up',
    },
  ];

  const mauTile: KpiTile = {
    id: 'mau',
    label: 'MAU',
    value: mauValue,
    unit: 'count',
    deltas: mauDeltas,
    sparkline: mauSparkline,
    tooltip: 'Users with ≥1 job this month.',
  };

  // MRR — flat current value; sparkline of cumulative paying users * price approximation (using current prices)
  const paidByDay: number[] = Array.from({ length: SPARK_LEN }, () => 0);
  const baselinePayingPro = activePaying.filter(
    (s) => s.plan === 'PRO' && s.createdAt < startOf30dWindow
  ).length;
  const baselinePayingTeam = activePaying.filter(
    (s) => s.plan === 'TEAM' && s.createdAt < startOf30dWindow
  ).length;
  let runningPro = baselinePayingPro;
  let runningTeam = baselinePayingTeam;
  for (let i = SPARK_LEN - 1; i >= 0; i--) {
    const day = nDaysAgoUtc(now, i);
    const k = dayKey(day);
    const idx = SPARK_LEN - 1 - i;
    let proInc = 0;
    let teamInc = 0;
    for (const sub of activePaying) {
      if (sub.createdAt < startOf30dWindow) continue;
      if (dayKey(startOfDayUtc(sub.createdAt)) === k) {
        if (sub.plan === 'PRO') proInc += 1;
        else if (sub.plan === 'TEAM') teamInc += 1;
      }
    }
    runningPro += proInc;
    runningTeam += teamInc;
    paidByDay[idx] = runningPro * PLANS.PRO.priceMonthly + runningTeam * PLANS.TEAM.priceMonthly;
  }
  const mrrBefore7d =
    paidByDay.length >= 8 ? (paidByDay[paidByDay.length - 1 - 7] ?? 0) : (paidByDay[0] ?? 0);
  const mrrBefore30d = paidByDay[0] ?? 0;

  const mrrTile: KpiTile = {
    id: 'mrr',
    label: 'MRR estimé',
    value: mrrCents,
    unit: 'cents',
    deltas: [
      {
        label: 'Δ7j',
        value: mrrCents - mrrBefore7d,
        unit: 'absolute',
        goodDirection: 'up',
      },
      {
        label: 'Δ30j',
        value: mrrCents - mrrBefore30d,
        unit: 'absolute',
        goodDirection: 'up',
      },
    ],
    sparkline: paidByDay,
    tooltip:
      'MRR estimé à partir des abonnements actifs (PRO+TEAM) × prix actuels.',
  };

  // Paying: count active paying users
  const activePayingCount = activePaying.length;
  const payingSparkline: number[] = [];
  let runningPayCount = activePaying.filter((s) => s.createdAt < startOf30dWindow).length;
  for (let i = SPARK_LEN - 1; i >= 0; i--) {
    const day = nDaysAgoUtc(now, i);
    const k = dayKey(day);
    let inc = 0;
    for (const sub of activePaying) {
      if (sub.createdAt < startOf30dWindow) continue;
      if (dayKey(startOfDayUtc(sub.createdAt)) === k) inc += 1;
    }
    runningPayCount += inc;
    payingSparkline.push(runningPayCount);
  }

  const freeToPaidRatio =
    freeUsersCount + activePayingCount > 0
      ? activePayingCount / (freeUsersCount + activePayingCount)
      : 0;

  const payingTile: KpiTile = {
    id: 'paying',
    label: 'Active payants',
    value: activePayingCount,
    unit: 'count',
    deltas: [
      {
        label: 'Δ30j',
        value: payingNewLast30Subs.length,
        unit: 'absolute',
        goodDirection: 'up',
      },
      {
        label: 'FREE→PAID',
        value: freeToPaidRatio,
        unit: 'percent',
        goodDirection: 'up',
      },
    ],
    sparkline: payingSparkline,
    tooltip: 'Comptes avec abonnement PRO ou TEAM actif.',
  };

  return {
    users: usersTile,
    mau: mauTile,
    mrr: mrrTile,
    paying: payingTile,
  };
}
