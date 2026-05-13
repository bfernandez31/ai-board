import { prisma } from '@/lib/db/client';
import { PLANS } from '@/lib/billing/plans';
import type { PlanDistributionRow, ActivationFunnel, Churn } from './types';

export async function computePlanDistribution(): Promise<PlanDistributionRow[]> {
  const grouped = await prisma.subscription.groupBy({
    by: ['plan'],
    _count: { plan: true },
    where: { status: { not: 'CANCELED' } },
  });

  const countMap = new Map(grouped.map((g) => [g.plan, g._count.plan]));

  const totalUsers = await prisma.user.count();
  const paidCount = (countMap.get('PRO') ?? 0) + (countMap.get('TEAM') ?? 0);
  const freeCount = totalUsers - paidCount;

  return [
    { plan: 'FREE', count: Math.max(0, freeCount) },
    { plan: 'PRO', count: countMap.get('PRO') ?? 0 },
    { plan: 'TEAM', count: countMap.get('TEAM') ?? 0 },
  ];
}

export async function computeActivationFunnel(): Promise<ActivationFunnel> {
  const now = new Date();
  const minus30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const cohortUsers = await prisma.user.findMany({
    where: { createdAt: { gte: minus30d } },
    select: { id: true },
  });
  const cohortIds = cohortUsers.map((u) => u.id);
  const cohortSize = cohortIds.length;

  if (cohortSize === 0) {
    return {
      cohortSize: 0,
      steps: [
        { key: 'SIGNUP', count: 0, stepRate: null },
        { key: 'FIRST_PROJECT', count: 0, stepRate: null },
        { key: 'FIRST_JOB', count: 0, stepRate: null },
        { key: 'FIRST_PAID', count: 0, stepRate: null },
      ],
    };
  }

  const step1Count = cohortSize;

  const usersWithProject = await prisma.project.groupBy({
    by: ['userId'],
    where: { userId: { in: cohortIds } },
  });
  const step2Count = usersWithProject.length;

  const usersWithJob = await prisma.$queryRaw<{ user_id: string }[]>`
    SELECT DISTINCT p."userId" AS user_id
    FROM "Job" j
    JOIN "Project" p ON p.id = j."projectId"
    WHERE p."userId" = ANY(${cohortIds}::text[])
  `;
  const step3Count = usersWithJob.length;

  const usersWithPaid = await prisma.subscription.findMany({
    where: {
      userId: { in: cohortIds },
      plan: { in: ['PRO', 'TEAM'] },
      status: { in: ['ACTIVE', 'TRIALING'] },
    },
    select: { userId: true },
  });
  const step4Count = usersWithPaid.length;

  return {
    cohortSize,
    steps: [
      { key: 'SIGNUP', count: step1Count, stepRate: null },
      { key: 'FIRST_PROJECT', count: step2Count, stepRate: step1Count > 0 ? step2Count / step1Count : null },
      { key: 'FIRST_JOB', count: step3Count, stepRate: step2Count > 0 ? step3Count / step2Count : null },
      { key: 'FIRST_PAID', count: step4Count, stepRate: step3Count > 0 ? step4Count / step3Count : null },
    ],
  };
}

export async function computeChurn(): Promise<Churn> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const canceledThisMonth = await prisma.subscription.findMany({
    where: {
      canceledAt: { gte: startOfMonth },
      plan: { in: ['PRO', 'TEAM'] },
    },
    select: { plan: true },
  });
  const cancellations = canceledThisMonth.length;

  // Downgrade approximation: subs updated this month whose plan is less valuable
  // than what TEAM pricing suggests. We look for subs with updatedAt >= startOfMonth
  // that have plan = PRO (possible downgrade from TEAM).
  const updatedThisMonth = await prisma.subscription.findMany({
    where: {
      updatedAt: { gte: startOfMonth },
      plan: 'PRO',
      status: { in: ['ACTIVE', 'TRIALING'] },
    },
    select: { stripePriceId: true },
  });

  // Approximate: a downgrade if the current stripePriceId maps to a TEAM-priced plan
  // but the subscription is PRO. This is documented as an approximation.
  const teamPriceId = PLANS.TEAM.stripePriceId;
  const downgrades = teamPriceId
    ? updatedThisMonth.filter((s) => s.stripePriceId === teamPriceId).length
    : 0;

  const mrrLostCancellations = canceledThisMonth.reduce(
    (sum, s) => sum + (PLANS[s.plan]?.priceMonthly ?? 0),
    0
  );
  const mrrLostDowngrades = downgrades * (PLANS.TEAM.priceMonthly - PLANS.PRO.priceMonthly);
  const mrrLostUsd = mrrLostCancellations + mrrLostDowngrades;

  const newPayingThisMonth = await prisma.subscription.findMany({
    where: {
      createdAt: { gte: startOfMonth },
      plan: { in: ['PRO', 'TEAM'] },
      status: 'ACTIVE',
    },
    select: { plan: true },
  });
  const mrrAddedUsd = newPayingThisMonth.reduce(
    (sum, s) => sum + PLANS[s.plan].priceMonthly,
    0
  );

  return {
    cancellations,
    downgrades,
    mrrLostUsd,
    netMrrDeltaUsd: mrrAddedUsd - mrrLostUsd,
  };
}
