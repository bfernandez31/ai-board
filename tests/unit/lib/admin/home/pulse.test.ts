import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    user: { count: vi.fn(), findMany: vi.fn() },
    job: { findMany: vi.fn() },
    subscription: { findMany: vi.fn(), count: vi.fn() },
    project: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/db/client';
import { computePulse } from '@/app/lib/admin/home/pulse';

type MockedPrisma = {
  user: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  job: { findMany: ReturnType<typeof vi.fn> };
  subscription: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  project: { findMany: ReturnType<typeof vi.fn> };
};

const mockedPrisma = prisma as unknown as MockedPrisma;

const NOW = new Date('2026-05-12T10:00:00.000Z');

beforeEach(() => {
  vi.resetAllMocks();
});

function defaultMocks(overrides: Partial<{
  totalUsers: number;
  usersInLast30: Array<{ createdAt: Date }>;
  usersBeforeSevenDays: number;
  usersBeforeThirtyDays: number;
  jobsThisMonth: Array<{ projectId: number; createdAt: Date }>;
  jobsPrevMonth: Array<{ projectId: number }>;
  activePaying: Array<{ plan: 'PRO' | 'TEAM'; createdAt: Date }>;
  payingNewLast30Subs: Array<{ createdAt: Date }>;
  freeUsersCount: number;
  projects: Array<{ id: number; userId: string }>;
}> = {}) {
  mockedPrisma.user.count
    .mockResolvedValueOnce(overrides.totalUsers ?? 0)
    .mockResolvedValueOnce(overrides.usersBeforeSevenDays ?? 0)
    .mockResolvedValueOnce(overrides.usersBeforeThirtyDays ?? 0);
  mockedPrisma.user.findMany.mockResolvedValue(overrides.usersInLast30 ?? []);
  mockedPrisma.job.findMany
    .mockResolvedValueOnce(overrides.jobsThisMonth ?? [])
    .mockResolvedValueOnce(overrides.jobsPrevMonth ?? []);
  mockedPrisma.subscription.findMany
    .mockResolvedValueOnce(overrides.activePaying ?? [])
    .mockResolvedValueOnce(overrides.payingNewLast30Subs ?? []);
  mockedPrisma.subscription.count.mockResolvedValueOnce(overrides.freeUsersCount ?? 0);
  mockedPrisma.project.findMany.mockResolvedValue(overrides.projects ?? []);
}

describe('computePulse', () => {
  it('returns zero tiles for empty DB', async () => {
    defaultMocks();
    const pulse = await computePulse(NOW);

    expect(pulse.users.value).toBe(0);
    expect(pulse.mau.value).toBe(0);
    expect(pulse.mrr.value).toBe(0);
    expect(pulse.paying.value).toBe(0);
    expect(pulse.users.sparkline).toHaveLength(30);
    expect(pulse.mau.sparkline).toHaveLength(30);
    expect(pulse.mrr.sparkline).toHaveLength(30);
    expect(pulse.paying.sparkline).toHaveLength(30);
  });

  it('computes MRR as PRO × 1500 + TEAM × 3000 (cents)', async () => {
    defaultMocks({
      activePaying: [
        { plan: 'PRO', createdAt: new Date('2026-01-01T00:00:00Z') },
        { plan: 'PRO', createdAt: new Date('2026-01-15T00:00:00Z') },
        { plan: 'TEAM', createdAt: new Date('2026-02-01T00:00:00Z') },
      ],
    });
    const pulse = await computePulse(NOW);

    expect(pulse.mrr.value).toBe(2 * 1500 + 1 * 3000);
    expect(pulse.mrr.unit).toBe('cents');
  });

  it('computes MAU as distinct project owners with ≥1 Job this month', async () => {
    defaultMocks({
      jobsThisMonth: [
        { projectId: 10, createdAt: new Date('2026-05-02T00:00:00Z') },
        { projectId: 10, createdAt: new Date('2026-05-03T00:00:00Z') },
        { projectId: 11, createdAt: new Date('2026-05-04T00:00:00Z') },
        { projectId: 12, createdAt: new Date('2026-05-04T00:00:00Z') },
      ],
      projects: [
        { id: 10, userId: 'u1' },
        { id: 11, userId: 'u2' },
        { id: 12, userId: 'u2' },
      ],
    });
    const pulse = await computePulse(NOW);

    expect(pulse.mau.value).toBe(2);
  });

  it('computes Users delta7d and delta30d', async () => {
    defaultMocks({
      totalUsers: 100,
      usersBeforeSevenDays: 88,
      usersBeforeThirtyDays: 60,
    });
    const pulse = await computePulse(NOW);

    expect(pulse.users.deltas[0].label).toBe('Δ7j');
    expect(pulse.users.deltas[0].value).toBe(12);
    expect(pulse.users.deltas[1].label).toBe('Δ30j');
    expect(pulse.users.deltas[1].value).toBe(40);
  });

  it('sparklines always have exactly 30 elements', async () => {
    defaultMocks({
      totalUsers: 5,
      usersInLast30: [
        { createdAt: new Date('2026-05-10T00:00:00Z') },
        { createdAt: new Date('2026-05-11T00:00:00Z') },
      ],
    });
    const pulse = await computePulse(NOW);

    expect(pulse.users.sparkline).toHaveLength(30);
    expect(pulse.mau.sparkline).toHaveLength(30);
    expect(pulse.mrr.sparkline).toHaveLength(30);
    expect(pulse.paying.sparkline).toHaveLength(30);
  });

  it('computes FREE→PAID conversion rate for paying tile', async () => {
    defaultMocks({
      freeUsersCount: 80,
      activePaying: [
        { plan: 'PRO', createdAt: new Date('2026-01-01T00:00:00Z') },
        { plan: 'PRO', createdAt: new Date('2026-01-15T00:00:00Z') },
        { plan: 'TEAM', createdAt: new Date('2026-02-01T00:00:00Z') },
        { plan: 'TEAM', createdAt: new Date('2026-02-01T00:00:00Z') },
      ],
    });
    const pulse = await computePulse(NOW);

    expect(pulse.paying.value).toBe(4);
    expect(pulse.paying.deltas[1].unit).toBe('percent');
    expect(pulse.paying.deltas[1].value).toBeCloseTo(4 / (4 + 80), 5);
  });
});
