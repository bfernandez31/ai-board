import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    subscription: { groupBy: vi.fn(), findMany: vi.fn() },
    user: { findMany: vi.fn() },
    project: { findMany: vi.fn() },
    job: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/db/client';
import { computeBusinessHealth } from '@/app/lib/admin/home/business-health';

type MockedPrisma = {
  subscription: {
    groupBy: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  user: { findMany: ReturnType<typeof vi.fn> };
  project: { findMany: ReturnType<typeof vi.fn> };
  job: { findMany: ReturnType<typeof vi.fn> };
};

const mockedPrisma = prisma as unknown as MockedPrisma;
const NOW = new Date('2026-05-12T10:00:00.000Z');

beforeEach(() => {
  vi.resetAllMocks();
});

function defaultMocks(overrides: Partial<{
  groupByPlan: Array<{ plan: 'FREE' | 'PRO' | 'TEAM'; _count: { _all: number } }>;
  cohort: Array<{ id: string; createdAt: Date }>;
  cohortProjects: Array<{ userId: string; createdAt: Date; id: number }>;
  cohortSubs: Array<{ userId: string; createdAt: Date }>;
  cohortJobs: Array<{ projectId: number; createdAt: Date }>;
  monthCancellations: Array<{ plan: 'FREE' | 'PRO' | 'TEAM' }>;
  monthDowngrades: Array<{ plan: 'FREE' | 'PRO' | 'TEAM' }>;
  monthNewPaying: Array<{ plan: 'FREE' | 'PRO' | 'TEAM' }>;
}> = {}) {
  mockedPrisma.subscription.groupBy.mockResolvedValue(overrides.groupByPlan ?? []);
  mockedPrisma.user.findMany.mockResolvedValue(overrides.cohort ?? []);
  mockedPrisma.project.findMany.mockResolvedValue(overrides.cohortProjects ?? []);
  // The composer fans out via Promise.all, so churn fires its 3 subscription
  // calls before computeActivationFunnel's nested subscription call (the
  // funnel awaits user.findMany first).
  mockedPrisma.subscription.findMany
    .mockResolvedValueOnce(overrides.monthCancellations ?? []) // churn cancellations
    .mockResolvedValueOnce(overrides.monthDowngrades ?? []) // churn downgrades
    .mockResolvedValueOnce(overrides.monthNewPaying ?? []) // churn new paying
    .mockResolvedValueOnce(overrides.cohortSubs ?? []); // funnel paid subs
  mockedPrisma.job.findMany.mockResolvedValue(overrides.cohortJobs ?? []);
}

describe('computeBusinessHealth', () => {
  it('returns zeros on empty DB', async () => {
    defaultMocks();
    const res = await computeBusinessHealth(NOW);
    expect(res.planDistribution).toEqual({ free: 0, pro: 0, team: 0 });
    expect(res.activationFunnel).toHaveLength(4);
    expect(res.activationFunnel[0]?.count).toBe(0);
    expect(res.activationFunnel[0]?.conversionFromPrevious).toBeNull();
    expect(res.churn.cancellationsCount).toBe(0);
  });

  it('plan distribution sums match groupBy counts', async () => {
    defaultMocks({
      groupByPlan: [
        { plan: 'FREE', _count: { _all: 100 } },
        { plan: 'PRO', _count: { _all: 12 } },
        { plan: 'TEAM', _count: { _all: 3 } },
      ],
    });
    const res = await computeBusinessHealth(NOW);
    expect(res.planDistribution).toEqual({ free: 100, pro: 12, team: 3 });
  });

  it('funnel respects chronological cohort rule (paid before project = excluded from step 4)', async () => {
    const tEarly = new Date('2026-05-01T00:00:00Z');
    const tMid = new Date('2026-05-05T00:00:00Z');
    const tLate = new Date('2026-05-10T00:00:00Z');

    defaultMocks({
      cohort: [
        { id: 'u1', createdAt: tEarly }, // u1: signup → paid (before project) — excluded from step 4
        { id: 'u2', createdAt: tEarly }, // u2: complete journey
      ],
      cohortProjects: [
        { userId: 'u1', createdAt: tLate, id: 11 }, // u1 project AFTER paid
        { userId: 'u2', createdAt: tMid, id: 21 },
      ],
      cohortJobs: [
        { projectId: 11, createdAt: tLate }, // u1 job after project
        { projectId: 21, createdAt: tLate }, // u2 job after project
      ],
      cohortSubs: [
        { userId: 'u1', createdAt: tMid }, // u1 paid BEFORE project
        { userId: 'u2', createdAt: tLate }, // u2 paid AFTER job
      ],
    });
    const res = await computeBusinessHealth(NOW);

    expect(res.activationFunnel[0]?.count).toBe(2);
    expect(res.activationFunnel[1]?.count).toBe(2);
    expect(res.activationFunnel[2]?.count).toBe(2);
    expect(res.activationFunnel[3]?.count).toBe(1); // only u2
  });

  it('funnel counts are monotone non-increasing', async () => {
    const tEarly = new Date('2026-05-01T00:00:00Z');
    const tMid = new Date('2026-05-05T00:00:00Z');
    defaultMocks({
      cohort: [
        { id: 'u1', createdAt: tEarly },
        { id: 'u2', createdAt: tEarly },
        { id: 'u3', createdAt: tEarly },
      ],
      cohortProjects: [
        { userId: 'u1', createdAt: tMid, id: 11 },
        { userId: 'u2', createdAt: tMid, id: 21 },
      ],
      cohortJobs: [{ projectId: 11, createdAt: new Date('2026-05-10') }],
      cohortSubs: [],
    });
    const res = await computeBusinessHealth(NOW);

    const counts = res.activationFunnel.map((s) => s.count);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1] ?? 0);
    }
  });

  it('step 1 conversion is always null', async () => {
    const tEarly = new Date('2026-05-01T00:00:00Z');
    defaultMocks({
      cohort: [{ id: 'u1', createdAt: tEarly }],
    });
    const res = await computeBusinessHealth(NOW);
    expect(res.activationFunnel[0]?.conversionFromPrevious).toBeNull();
  });

  it('churn formula: mrrLost = sum of plan prices for cancellations + downgrades', async () => {
    defaultMocks({
      monthCancellations: [{ plan: 'PRO' }, { plan: 'TEAM' }, { plan: 'PRO' }],
      monthDowngrades: [{ plan: 'FREE' }],
      monthNewPaying: [{ plan: 'PRO' }],
    });
    const res = await computeBusinessHealth(NOW);
    expect(res.churn.cancellationsCount).toBe(3);
    expect(res.churn.downgradesCount).toBe(1);
    // cancellations: PRO×2 + TEAM×1 = 1500*2 + 3000 = 6000
    // downgrades: FREE = 0
    expect(res.churn.mrrLostCents).toBe(2 * 1500 + 1 * 3000);
    // gained = PRO×1 = 1500
    expect(res.churn.netMrrDeltaCents).toBe(1500 - (2 * 1500 + 1 * 3000));
  });
});
