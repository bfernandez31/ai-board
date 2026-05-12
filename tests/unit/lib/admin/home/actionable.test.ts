import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    subscription: { findMany: vi.fn(), count: vi.fn() },
    user: { findMany: vi.fn() },
    project: { findMany: vi.fn() },
    job: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/db/client';
import { computeActionable } from '@/app/lib/admin/home/actionable';

type MockedPrisma = {
  subscription: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  user: { findMany: ReturnType<typeof vi.fn> };
  project: { findMany: ReturnType<typeof vi.fn> };
  job: { findMany: ReturnType<typeof vi.fn> };
};

const mockedPrisma = prisma as unknown as MockedPrisma;
const NOW = new Date('2026-05-12T10:00:00.000Z');

beforeEach(() => {
  vi.resetAllMocks();
  mockedPrisma.subscription.findMany.mockResolvedValue([]);
  mockedPrisma.subscription.count.mockResolvedValue(0);
  mockedPrisma.user.findMany.mockResolvedValue([]);
  mockedPrisma.project.findMany.mockResolvedValue([]);
  mockedPrisma.job.findMany.mockResolvedValue([]);
});

describe('computeActionable', () => {
  it('returns empty arrays + zero totals on empty DB', async () => {
    const res = await computeActionable(NOW);
    expect(res.tables.newPayingUsers).toEqual([]);
    expect(res.tables.recentCancellations).toEqual([]);
    expect(res.tables.topActiveUsers).toEqual([]);
    expect(res.tables.topProjects).toEqual([]);
    expect(res.totals.newPayingUsersTotal).toBe(0);
    expect(res.totals.recentCancellationsTotal).toBe(0);
  });

  it('caps newPayingUsers at 25 rows; totals.newPayingUsersTotal returns uncapped count', async () => {
    const subs = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      userId: `u${i}`,
      plan: 'PRO',
      status: 'ACTIVE',
      createdAt: new Date('2026-05-01T00:00:00Z'),
      canceledAt: null,
    }));
    mockedPrisma.subscription.findMany.mockResolvedValueOnce(subs);
    mockedPrisma.subscription.count.mockResolvedValueOnce(73);
    mockedPrisma.user.findMany.mockResolvedValueOnce(
      subs.map((s) => ({ id: s.userId, email: `${s.userId}@x.com` }))
    );

    const res = await computeActionable(NOW);
    expect(res.tables.newPayingUsers).toHaveLength(25);
    expect(res.totals.newPayingUsersTotal).toBe(73);
  });

  it('topActiveUsers tie-break: jobCount DESC, lastJobAt DESC, userId ASC', async () => {
    mockedPrisma.subscription.findMany.mockResolvedValue([]);
    mockedPrisma.subscription.count.mockResolvedValue(0);

    // Two users with identical jobCount and lastJobAt; userId ASC wins.
    mockedPrisma.job.findMany.mockResolvedValue([
      { projectId: 1, createdAt: new Date('2026-05-10T00:00:00Z') },
      { projectId: 1, createdAt: new Date('2026-05-09T00:00:00Z') },
      { projectId: 2, createdAt: new Date('2026-05-10T00:00:00Z') },
      { projectId: 2, createdAt: new Date('2026-05-09T00:00:00Z') },
    ]);
    mockedPrisma.project.findMany.mockResolvedValueOnce([
      { id: 1, userId: 'userA' },
      { id: 2, userId: 'userB' },
    ]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      { id: 'userA', email: 'a@x.com' },
      { id: 'userB', email: 'b@x.com' },
    ]);
    mockedPrisma.subscription.findMany.mockResolvedValueOnce([]);

    const res = await computeActionable(NOW);
    expect(res.tables.topActiveUsers.map((r) => r.userId)).toEqual(['userA', 'userB']);
  });

  it('topProjects length ≤ 5', async () => {
    // create 7 distinct projects with descending counts
    mockedPrisma.job.findMany.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({
        projectId: i + 1,
        createdAt: new Date(`2026-05-${10 + i}T00:00:00Z`),
      }))
    );
    mockedPrisma.project.findMany.mockResolvedValueOnce(
      Array.from({ length: 7 }, (_, i) => ({ id: i + 1, userId: `u${i}` }))
    );
    mockedPrisma.user.findMany.mockResolvedValueOnce([]);
    mockedPrisma.subscription.findMany.mockResolvedValueOnce([]);
    mockedPrisma.project.findMany.mockResolvedValueOnce(
      Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        key: `P${i}`,
        name: `Project ${i}`,
        user: { email: `o${i}@x.com` },
      }))
    );

    const res = await computeActionable(NOW);
    expect(res.tables.topProjects.length).toBeLessThanOrEqual(5);
  });
});
