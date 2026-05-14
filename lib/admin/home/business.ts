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

  // A cohort user has reached FIRST_JOB if a job has run inside any project
  // they own OR belong to as a member — TEAM members reach this milestone
  // through a project owned by their inviter.
  const usersWithJob = await prisma.$queryRaw<{ user_id: string }[]>`
    SELECT DISTINCT u_id AS user_id
    FROM (
      SELECT p."userId" AS u_id
      FROM "Job" j
      JOIN "Project" p ON p.id = j."projectId"
      WHERE p."userId" = ANY(${cohortIds}::text[])
      UNION
      SELECT pm."userId" AS u_id
      FROM "Job" j
      JOIN "ProjectMember" pm ON pm."projectId" = j."projectId"
      WHERE pm."userId" = ANY(${cohortIds}::text[])
    ) jobs_per_cohort_user
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

  // True downgrade detection requires subscription-plan history, which we do
  // not record. Report 0 rather than the previous approximation, which was
  // structurally impossible to fire (it looked for plan=PRO subs whose
  // stripePriceId matched the TEAM price, but plan is derived from
  // stripePriceId so that combination never occurs).
  const downgrades = 0;

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
