import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobStatus, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PLANS } from '@/lib/billing/plans';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import type { DashboardSnapshot } from '@/app/lib/admin/home/types';

const { requireAdminOrNotFound } = vi.hoisted(() => ({
  requireAdminOrNotFound: vi.fn(),
}));

vi.mock('@/app/lib/auth/admin', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, requireAdminOrNotFound };
});

import { GET as homeGet } from '@/app/api/admin/home/route';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/home');
}

async function callSnapshot(): Promise<DashboardSnapshot> {
  const res = await homeGet(makeRequest());
  expect(res.status).toBe(200);
  return (await res.json()) as DashboardSnapshot;
}

const SCRATCH_PREFIX = 'scratch-aib797-';
const SCRATCH_PROJECT_PREFIX = '[e2e-snapshot]';

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function deleteScratchSubscriptions(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.subscription.deleteMany({
    where: { userId: { startsWith: SCRATCH_PREFIX } },
  });
}

async function deleteScratchProjects(): Promise<void> {
  const prisma = getPrismaClient();
  // Members and jobs referencing these projects would block delete, so wipe
  // jobs/members for those projects first.
  const scratchProjects = await prisma.project.findMany({
    where: { name: { startsWith: SCRATCH_PROJECT_PREFIX } },
    select: { id: true },
  });
  const ids = scratchProjects.map((p) => p.id);
  if (ids.length > 0) {
    await prisma.projectMember.deleteMany({ where: { projectId: { in: ids } } });
    await prisma.job.deleteMany({ where: { projectId: { in: ids } } });
    await prisma.project.deleteMany({ where: { id: { in: ids } } });
  }
}

async function deleteScratchUsers(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.user.deleteMany({
    where: { id: { startsWith: SCRATCH_PREFIX } },
  });
}

interface CreatedUser {
  id: string;
  email: string;
}

async function createScratchUser(opts?: {
  createdAt?: Date;
}): Promise<CreatedUser> {
  const prisma = getPrismaClient();
  const id = `${SCRATCH_PREFIX}${uniqueSuffix()}`;
  const email = `${id}@test.com`;
  const createdAt = opts?.createdAt ?? new Date();
  const user = await prisma.user.create({
    data: {
      id,
      email,
      name: 'AIB-797 scratch user',
      emailVerified: createdAt,
      createdAt,
      updatedAt: createdAt,
    },
  });
  return { id: user.id, email: user.email };
}

async function createScratchProject(opts: {
  userId: string;
  createdAt?: Date;
}): Promise<{ id: number; key: string }> {
  const prisma = getPrismaClient();
  const suffix = uniqueSuffix();
  const key = `S${suffix.slice(0, 5)}`.toUpperCase().slice(0, 6);
  const project = await prisma.project.create({
    data: {
      name: `${SCRATCH_PROJECT_PREFIX} ${suffix}`,
      description: 'AIB-797 scratch project',
      githubOwner: 'aib797',
      githubRepo: `scratch-${suffix}`,
      userId: opts.userId,
      key,
      createdAt: opts.createdAt ?? new Date(),
      updatedAt: opts.createdAt ?? new Date(),
    },
  });
  return { id: project.id, key: project.key };
}

async function createScratchSubscription(opts: {
  userId: string;
  plan: SubscriptionPlan;
  status?: SubscriptionStatus;
  createdAt?: Date;
  canceledAt?: Date | null;
}): Promise<void> {
  const prisma = getPrismaClient();
  const createdAt = opts.createdAt ?? new Date();
  await prisma.subscription.create({
    data: {
      userId: opts.userId,
      stripeSubscriptionId: `sub_${opts.userId}_${uniqueSuffix()}`,
      stripePriceId: `price_${opts.plan.toLowerCase()}_scratch`,
      plan: opts.plan,
      status: opts.status ?? SubscriptionStatus.ACTIVE,
      currentPeriodStart: createdAt,
      currentPeriodEnd: new Date(createdAt.getTime() + 30 * 86_400_000),
      createdAt,
      updatedAt: createdAt,
      canceledAt: opts.canceledAt ?? null,
    },
  });
}

async function createJob(opts: {
  projectId: number;
  status: JobStatus;
  createdAt?: Date;
}): Promise<void> {
  const prisma = getPrismaClient();
  const when = opts.createdAt ?? new Date();
  await prisma.job.create({
    data: {
      projectId: opts.projectId,
      command: 'implement',
      status: opts.status,
      startedAt: when,
      completedAt: opts.status === 'COMPLETED' ? when : null,
      createdAt: when,
      updatedAt: when,
    },
  });
}

async function seedFreshCronMarkers(): Promise<void> {
  const prisma = getPrismaClient();
  const oneMinAgo = new Date(Date.now() - 60_000);
  await prisma.cronRunLog.createMany({
    data: [
      { workflowName: 'nightly-health', ranAt: oneMinAgo },
      { workflowName: 'nightly-log-prune', ranAt: oneMinAgo },
    ],
  });
}

// The stripe-webhook alert fires when there are recent paid-plan transitions
// but NO matching Stripe webhook event within the same 24h window. Test
// fixtures (and any scratch subscriptions we create here) touch
// Subscription.updatedAt, so we need at least one matching event to suppress
// the alert and keep the baseline healthy.
async function seedRecentStripeEvent(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.stripeEvent.create({
    data: {
      id: `evt_test_aib797_${uniqueSuffix()}`,
      type: 'customer.subscription.updated',
      processedAt: new Date(Date.now() - 60_000),
    },
  });
}

describe('GET /api/admin/home — snapshot composition (US1/US2 T019/T036)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    requireAdminOrNotFound.mockReset();
    requireAdminOrNotFound.mockResolvedValue({
      ok: true,
      email: 'admin@e2e.local',
    });

    // Wipe global state that would otherwise leak across tests. The snapshot
    // route hits all data globally, so we have to reach beyond the worker's
    // project here. CronRunLog/Job/InsightsReport are append-only and safe to
    // truncate between tests.
    await prisma.cronRunLog.deleteMany({});
    await prisma.insightsReport.deleteMany({});
    await prisma.job.deleteMany({});

    // Drop scratch data from any previous run / failure.
    await deleteScratchSubscriptions();
    await deleteScratchProjects();
    await deleteScratchUsers();

    // Drop any stripe events from prior runs so the baseline is deterministic.
    await prisma.stripeEvent.deleteMany({});

    // Suppress cron-stale and stripe-webhook alerts so the test fixtures can
    // drive the alert surface deterministically.
    await seedFreshCronMarkers();
    await seedRecentStripeEvent();

    void ctx;
  });

  it('(a) clean fixture: alerts == [], planDistribution.sum equals subscription count, mau == 0', async () => {
    const snapshot = await callSnapshot();

    expect(snapshot.alerts).toEqual([]);

    const subscriptionCount = await prisma.subscription.count();
    const distribution = snapshot.businessHealth.planDistribution;
    expect(
      distribution.free + distribution.pro + distribution.team
    ).toBe(subscriptionCount);

    expect(snapshot.pulse.mau.value).toBe(0);
    expect(snapshot.pulse.users.sparkline).toHaveLength(30);
    expect(snapshot.pulse.mrr.sparkline).toHaveLength(30);
    expect(snapshot.trends.signupsPerDay).toHaveLength(30);
    expect(snapshot.trends.jobsPerDay).toHaveLength(30);
    expect(snapshot.trends.mrrPerMonth).toHaveLength(12);

    // Top-tables are empty because we cleared all Jobs in beforeEach; the new
    // paying users table reflects whatever baseline subscriptions exist (the
    // suite preserves test-user-id's PRO sub so we only assert the shape).
    expect(Array.isArray(snapshot.actionable.newPayingUsers)).toBe(true);
    expect(Array.isArray(snapshot.actionable.recentCancellations)).toBe(true);
    expect(snapshot.actionable.topActiveUsers).toEqual([]);
    expect(snapshot.actionable.topProjects).toEqual([]);

    expect(snapshot.meta.currencyMinorUnit).toBe('cents');
  });

  it('(b) small fixture: 3 scratch users + 1 PRO sub + 2 completed jobs → MRR delta = PRO price, mau ≥ 1, alerts == []', async () => {
    const baseline = await callSnapshot();

    const userA = await createScratchUser();
    await createScratchUser();
    await createScratchUser();

    await createScratchSubscription({
      userId: userA.id,
      plan: SubscriptionPlan.PRO,
    });

    const project = await createScratchProject({ userId: userA.id });
    await createJob({ projectId: project.id, status: JobStatus.COMPLETED });
    await createJob({ projectId: project.id, status: JobStatus.COMPLETED });

    const snapshot = await callSnapshot();

    expect(snapshot.alerts).toEqual([]);

    const subscriptionCount = await prisma.subscription.count();
    const distribution = snapshot.businessHealth.planDistribution;
    expect(
      distribution.free + distribution.pro + distribution.team
    ).toBe(subscriptionCount);

    expect(distribution.pro).toBe(baseline.businessHealth.planDistribution.pro + 1);

    expect(snapshot.pulse.mrr.value).toBe(
      baseline.pulse.mrr.value + PLANS.PRO.priceMonthly
    );

    expect(snapshot.pulse.mau.value).toBeGreaterThanOrEqual(1);
    expect(snapshot.pulse.users.value).toBe(baseline.pulse.users.value + 3);
    expect(snapshot.pulse.paying.value).toBe(baseline.pulse.paying.value + 1);
  });

  it('(c) forced job-success fixture: 10 failed + 1 completed in 7d → alerts[0] is job-success with successRatePct < 0.90', async () => {
    const owner = await createScratchUser();
    const project = await createScratchProject({ userId: owner.id });

    const recent = new Date(Date.now() - 2 * 86_400_000); // 2 days ago
    for (let i = 0; i < 10; i++) {
      await createJob({
        projectId: project.id,
        status: JobStatus.FAILED,
        createdAt: recent,
      });
    }
    await createJob({
      projectId: project.id,
      status: JobStatus.COMPLETED,
      createdAt: recent,
    });

    const snapshot = await callSnapshot();

    expect(snapshot.alerts.length).toBeGreaterThanOrEqual(1);
    const first = snapshot.alerts[0]!;
    expect(first.kind).toBe('job-success');
    if (first.payload.kind === 'job-success') {
      expect(first.payload.successRatePct).toBeLessThan(0.9);
      expect(first.payload.successRatePct).toBeGreaterThanOrEqual(0);
      expect(first.payload.windowDays).toBe(7);
    }
  });

  // T036 — additional fixtures for User Story 2 (business-health + trends).

  it('(d) activation-funnel fixture: cohort user progresses signup → project → job → paid', async () => {
    const baseline = await callSnapshot();

    const cohortUser = await createScratchUser({ createdAt: new Date() });
    const project = await createScratchProject({
      userId: cohortUser.id,
      createdAt: new Date(Date.now() + 1_000),
    });
    await createJob({
      projectId: project.id,
      status: JobStatus.COMPLETED,
      createdAt: new Date(Date.now() + 2_000),
    });
    await createScratchSubscription({
      userId: cohortUser.id,
      plan: SubscriptionPlan.PRO,
      createdAt: new Date(Date.now() + 3_000),
    });

    const snapshot = await callSnapshot();

    const funnel = snapshot.businessHealth.activationFunnel;
    expect(funnel).toHaveLength(4);
    expect(funnel.map((s) => s.id)).toEqual([
      'signups',
      'first_project',
      'first_job',
      'paid',
    ]);

    const baselineFunnel = baseline.businessHealth.activationFunnel;
    expect(funnel[0]!.count).toBe(baselineFunnel[0]!.count + 1);
    expect(funnel[1]!.count).toBe(baselineFunnel[1]!.count + 1);
    expect(funnel[2]!.count).toBe(baselineFunnel[2]!.count + 1);
    expect(funnel[3]!.count).toBe(baselineFunnel[3]!.count + 1);

    // Counts are monotone non-increasing across steps.
    expect(funnel[0]!.count).toBeGreaterThanOrEqual(funnel[1]!.count);
    expect(funnel[1]!.count).toBeGreaterThanOrEqual(funnel[2]!.count);
    expect(funnel[2]!.count).toBeGreaterThanOrEqual(funnel[3]!.count);

    // The signups denominator equals the count of signups in the funnel, which
    // in turn equals the sum of signupsPerDay over the 30-day window (SC-005).
    const signupsSum = snapshot.trends.signupsPerDay.reduce(
      (a, p) => a + p.value,
      0
    );
    expect(signupsSum).toBe(funnel[0]!.count);
  });

  it('(e) churn fixture: PRO subscription canceled this month → cancellationsCount ≥ 1, mrrLostCents ≥ PRO price', async () => {
    const baseline = await callSnapshot();

    const cohortUser = await createScratchUser();
    const monthStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
    );
    const canceledAt = new Date(monthStart.getTime() + 1 * 86_400_000); // day 2 of month
    await createScratchSubscription({
      userId: cohortUser.id,
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.CANCELED,
      createdAt: new Date(monthStart.getTime() - 60 * 86_400_000),
      canceledAt,
    });

    const snapshot = await callSnapshot();

    const churn = snapshot.businessHealth.churn;
    expect(churn.cancellationsCount).toBe(
      baseline.businessHealth.churn.cancellationsCount + 1
    );
    expect(churn.mrrLostCents).toBeGreaterThanOrEqual(PLANS.PRO.priceMonthly);

    // The cancelled subscription should also surface in the recent
    // cancellations actionable table.
    const surfaced = snapshot.actionable.recentCancellations.find(
      (r) => r.userId === cohortUser.id
    );
    expect(surfaced).toBeDefined();
    expect(surfaced?.lostPlan).toBe('PRO');
  });
});
