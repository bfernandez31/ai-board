import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    user: { count: vi.fn(), findMany: vi.fn() },
    project: { groupBy: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/db/client', () => ({ prisma: mockPrisma }));

import { computePlanDistribution, computeActivationFunnel, computeChurn } from '@/lib/admin/home/business';

describe('computePlanDistribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all three plans including FREE computed from total minus paid', async () => {
    mockPrisma.subscription.groupBy.mockResolvedValue([
      { plan: 'PRO', _count: { plan: 2 } },
      { plan: 'TEAM', _count: { plan: 1 } },
    ]);
    mockPrisma.user.count.mockResolvedValue(10);

    const result = await computePlanDistribution();
    expect(result).toHaveLength(3);
    expect(result.find((r) => r.plan === 'FREE')?.count).toBe(7); // 10 - 2 - 1
    expect(result.find((r) => r.plan === 'PRO')?.count).toBe(2);
    expect(result.find((r) => r.plan === 'TEAM')?.count).toBe(1);
  });

  it('returns zero-count segments even when no paid subs', async () => {
    mockPrisma.subscription.groupBy.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(5);

    const result = await computePlanDistribution();
    expect(result.find((r) => r.plan === 'FREE')?.count).toBe(5);
    expect(result.find((r) => r.plan === 'PRO')?.count).toBe(0);
    expect(result.find((r) => r.plan === 'TEAM')?.count).toBe(0);
  });
});

describe('computeActivationFunnel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 30-day cohort with four steps', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1' }, { id: 'u2' }, { id: 'u3' },
    ]);
    mockPrisma.project.groupBy.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
    mockPrisma.$queryRaw.mockResolvedValue([{ user_id: 'u1' }]);
    mockPrisma.subscription.findMany.mockResolvedValue([{ userId: 'u1' }]);

    const result = await computeActivationFunnel();
    expect(result.cohortSize).toBe(3);
    expect(result.steps).toHaveLength(4);
    expect(result.steps[0].key).toBe('SIGNUP');
    expect(result.steps[0].stepRate).toBeNull(); // first step always null
    expect(result.steps[1].key).toBe('FIRST_PROJECT');
    expect(result.steps[1].count).toBe(2);
  });

  it('returns stepRate=null when prior step is zero', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    mockPrisma.project.groupBy.mockResolvedValue([]);
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.subscription.findMany.mockResolvedValue([]);

    const result = await computeActivationFunnel();
    const firstJobStep = result.steps.find((s) => s.key === 'FIRST_JOB');
    // Prior step (FIRST_PROJECT) is 0 → stepRate should be null
    expect(firstJobStep?.stepRate).toBeNull();
  });

  it('returns empty steps when cohort is empty', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await computeActivationFunnel();
    expect(result.cohortSize).toBe(0);
    result.steps.forEach((s) => {
      expect(s.count).toBe(0);
      expect(s.stepRate).toBeNull();
    });
  });
});

describe('computeChurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cancellation count and MRR lost', async () => {
    const now = new Date();
    mockPrisma.subscription.findMany
      .mockResolvedValueOnce([{ plan: 'PRO' }, { plan: 'TEAM' }]) // canceledThisMonth
      .mockResolvedValueOnce([]) // updatedThisMonth (downgrades)
      .mockResolvedValueOnce([]); // newPayingThisMonth

    const result = await computeChurn();
    expect(result.cancellations).toBe(2);
    expect(result.mrrLostUsd).toBe(4500); // 1500 (PRO) + 3000 (TEAM)
  });

  it('returns zero values when no cancellations', async () => {
    mockPrisma.subscription.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await computeChurn();
    expect(result.cancellations).toBe(0);
    expect(result.downgrades).toBe(0);
    expect(result.mrrLostUsd).toBe(0);
  });
});
