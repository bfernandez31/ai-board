import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    job: { groupBy: vi.fn() },
    project: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/db/client', () => ({ prisma: mockPrisma }));

import {
  listNewPayingUsers,
  listRecentCancellations,
  listTopUsersThisMonth,
  listTopProjectsThisMonth,
} from '@/lib/admin/home/tables';

const now = new Date();
const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

describe('listNewPayingUsers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns PRO/TEAM paying users with email and accountAgeDays', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      { plan: 'PRO', status: 'ACTIVE', createdAt: now, user: { email: 'a@test.com', createdAt: oldDate } },
      { plan: 'TEAM', status: 'TRIALING', createdAt: now, user: { email: 'b@test.com', createdAt: oldDate } },
    ]);
    const result = await listNewPayingUsers(30, 50);
    expect(result).toHaveLength(2);
    expect(result[0].email).toBe('a@test.com');
    expect(result[0].plan).toBe('PRO');
    expect(result[0].accountAgeDays).toBeGreaterThanOrEqual(59);
    expect(result[1].plan).toBe('TEAM');
  });

  it('returns empty array when no results', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    const result = await listNewPayingUsers(30, 50);
    expect(result).toHaveLength(0);
  });

  it('filters out entries without a user', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      { plan: 'PRO', status: 'ACTIVE', createdAt: now, user: null },
    ]);
    const result = await listNewPayingUsers(30, 50);
    expect(result).toHaveLength(0);
  });
});

describe('listRecentCancellations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns cancellations with email, lostPlan, accountAgeDays', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      { plan: 'PRO', canceledAt: now, user: { email: 'x@test.com', createdAt: oldDate } },
    ]);
    const result = await listRecentCancellations(30, 50);
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('x@test.com');
    expect(result[0].lostPlan).toBe('PRO');
    expect(result[0].canceledAt).toBeTruthy();
  });

  it('returns empty array when no cancellations', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    const result = await listRecentCancellations(30, 50);
    expect(result).toHaveLength(0);
  });
});

describe('listTopUsersThisMonth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns top users by job count with email and plan', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { user_id: 'u1', job_count: BigInt(10) },
      { user_id: 'u2', job_count: BigInt(5) },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'user1@test.com', subscription: { plan: 'PRO' } },
      { id: 'u2', email: 'user2@test.com', subscription: { plan: 'TEAM' } },
    ]);
    const result = await listTopUsersThisMonth(5);
    expect(result).toHaveLength(2);
    expect(result[0].email).toBe('user1@test.com');
    expect(result[0].jobsThisMonth).toBe(10);
    expect(result[0].plan).toBe('PRO');
  });

  it('returns empty array when no jobs this month', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const result = await listTopUsersThisMonth(5);
    expect(result).toHaveLength(0);
  });

  it('caps result at given limit', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { user_id: 'u1', job_count: BigInt(5) },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'u1@test.com', subscription: null },
    ]);
    const result = await listTopUsersThisMonth(5);
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

describe('listTopProjectsThisMonth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns top projects with key and ownerEmail', async () => {
    mockPrisma.job.groupBy.mockResolvedValue([
      { projectId: 1, _count: { id: 12 } },
    ]);
    mockPrisma.project.findMany.mockResolvedValue([
      { id: 1, key: 'AIB', user: { email: 'owner@test.com' } },
    ]);
    const result = await listTopProjectsThisMonth(5);
    expect(result).toHaveLength(1);
    expect(result[0].projectKey).toBe('AIB');
    expect(result[0].ownerEmail).toBe('owner@test.com');
    expect(result[0].jobsThisMonth).toBe(12);
  });

  it('returns empty array when no jobs', async () => {
    mockPrisma.job.groupBy.mockResolvedValue([]);
    const result = await listTopProjectsThisMonth(5);
    expect(result).toHaveLength(0);
  });
});
