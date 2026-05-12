import { prisma } from '@/lib/db/client';
import { PLANS } from '@/lib/billing/plans';
import type {
  ChurnPanel,
  DashboardSnapshot,
  FunnelStep,
  PlanDistribution,
} from './types';

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function nDaysAgo(now: Date, n: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n));
}

async function computePlanDistribution(): Promise<PlanDistribution> {
  const grouped = await prisma.subscription.groupBy({
    by: ['plan'],
    _count: { _all: true },
  });

  const distribution: PlanDistribution = { free: 0, pro: 0, team: 0 };
  for (const row of grouped) {
    switch (row.plan) {
      case 'FREE':
        distribution.free = row._count._all;
        break;
      case 'PRO':
        distribution.pro = row._count._all;
        break;
      case 'TEAM':
        distribution.team = row._count._all;
        break;
    }
  }
  return distribution;
}

interface FunnelInput {
  userId: string;
  createdAt: Date;
  firstProjectAt: Date | null;
  firstJobAt: Date | null;
  firstPaidAt: Date | null;
}

async function computeActivationFunnel(now: Date): Promise<FunnelStep[]> {
  const since = nDaysAgo(now, 30);
  const cohort = await prisma.user.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, createdAt: true },
  });

  if (cohort.length === 0) {
    return [
      { id: 'signups', label: 'Inscriptions', count: 0, conversionFromPrevious: null },
      { id: 'first_project', label: '1er projet', count: 0, conversionFromPrevious: null },
      { id: 'first_job', label: '1er job', count: 0, conversionFromPrevious: null },
      { id: 'paid', label: 'Activation payante', count: 0, conversionFromPrevious: null },
    ];
  }

  const cohortIds = cohort.map((u) => u.id);
  const [projects, subs] = await Promise.all([
    prisma.project.findMany({
      where: { userId: { in: cohortIds } },
      select: { userId: true, createdAt: true, id: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.subscription.findMany({
      where: {
        userId: { in: cohortIds },
        plan: { in: ['PRO', 'TEAM'] },
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const projectIds = projects.map((p) => p.id);
  const jobs =
    projectIds.length > 0
      ? await prisma.job.findMany({
          where: { projectId: { in: projectIds } },
          select: { projectId: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];

  const projectIdToUser = new Map(projects.map((p) => [p.id, p.userId]));
  const firstProjectAtByUser = new Map<string, Date>();
  for (const p of projects) {
    if (!firstProjectAtByUser.has(p.userId)) {
      firstProjectAtByUser.set(p.userId, p.createdAt);
    }
  }
  const firstJobAtByUser = new Map<string, Date>();
  for (const j of jobs) {
    const userId = projectIdToUser.get(j.projectId);
    if (!userId) continue;
    if (!firstJobAtByUser.has(userId)) {
      firstJobAtByUser.set(userId, j.createdAt);
    }
  }
  const firstPaidAtByUser = new Map<string, Date>();
  for (const s of subs) {
    if (!firstPaidAtByUser.has(s.userId)) {
      firstPaidAtByUser.set(s.userId, s.createdAt);
    }
  }

  const users: FunnelInput[] = cohort.map((u) => ({
    userId: u.id,
    createdAt: u.createdAt,
    firstProjectAt: firstProjectAtByUser.get(u.id) ?? null,
    firstJobAt: firstJobAtByUser.get(u.id) ?? null,
    firstPaidAt: firstPaidAtByUser.get(u.id) ?? null,
  }));

  let signupsCount = users.length;
  let firstProjectCount = 0;
  let firstJobCount = 0;
  let paidCount = 0;

  for (const u of users) {
    const hasProjectAfterSignup =
      u.firstProjectAt !== null && u.firstProjectAt >= u.createdAt;
    if (!hasProjectAfterSignup) continue;
    firstProjectCount += 1;

    const hasJobAfterProject =
      u.firstJobAt !== null && u.firstProjectAt !== null && u.firstJobAt >= u.firstProjectAt;
    if (!hasJobAfterProject) continue;
    firstJobCount += 1;

    const hasPaidAfterJob =
      u.firstPaidAt !== null && u.firstJobAt !== null && u.firstPaidAt >= u.firstJobAt;
    if (!hasPaidAfterJob) continue;
    paidCount += 1;
  }

  function conv(curr: number, prev: number): number | null {
    if (prev <= 0) return null;
    return curr / prev;
  }

  // Defensive: should never happen but guarantees monotone non-increasing.
  signupsCount = Math.max(signupsCount, firstProjectCount);
  firstProjectCount = Math.max(firstProjectCount, firstJobCount);
  firstJobCount = Math.max(firstJobCount, paidCount);

  return [
    { id: 'signups', label: 'Inscriptions', count: signupsCount, conversionFromPrevious: null },
    {
      id: 'first_project',
      label: '1er projet',
      count: firstProjectCount,
      conversionFromPrevious: conv(firstProjectCount, signupsCount),
    },
    {
      id: 'first_job',
      label: '1er job',
      count: firstJobCount,
      conversionFromPrevious: conv(firstJobCount, firstProjectCount),
    },
    {
      id: 'paid',
      label: 'Activation payante',
      count: paidCount,
      conversionFromPrevious: conv(paidCount, firstJobCount),
    },
  ];
}

async function computeChurn(now: Date): Promise<ChurnPanel> {
  const monthStart = startOfUtcMonth(now);

  const [cancellations, downgrades, newPayingThisMonth] = await Promise.all([
    prisma.subscription.findMany({
      where: { canceledAt: { gte: monthStart } },
      select: { plan: true },
    }),
    prisma.subscription.findMany({
      where: {
        plan: 'FREE',
        updatedAt: { gte: monthStart },
        canceledAt: null,
      },
      select: { plan: true },
    }),
    prisma.subscription.findMany({
      where: {
        plan: { in: ['PRO', 'TEAM'] },
        status: { in: ['ACTIVE', 'TRIALING'] },
        createdAt: { gte: monthStart },
      },
      select: { plan: true },
    }),
  ]);

  function priceFor(plan: 'FREE' | 'PRO' | 'TEAM'): number {
    if (plan === 'PRO') return PLANS.PRO.priceMonthly;
    if (plan === 'TEAM') return PLANS.TEAM.priceMonthly;
    return 0;
  }

  const mrrLost =
    cancellations.reduce((acc, c) => acc + priceFor(c.plan), 0) +
    downgrades.reduce((acc, d) => acc + priceFor(d.plan), 0);

  const mrrGained = newPayingThisMonth.reduce(
    (acc, s) => acc + priceFor(s.plan),
    0
  );

  return {
    cancellationsCount: cancellations.length,
    downgradesCount: downgrades.length,
    mrrLostCents: mrrLost,
    netMrrDeltaCents: mrrGained - mrrLost,
  };
}

export async function computeBusinessHealth(
  now: Date = new Date()
): Promise<DashboardSnapshot['businessHealth']> {
  const [planDistribution, activationFunnel, churn] = await Promise.all([
    computePlanDistribution(),
    computeActivationFunnel(now),
    computeChurn(now),
  ]);

  return { planDistribution, activationFunnel, churn };
}
