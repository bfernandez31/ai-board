import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/db/client', () => ({ prisma: mockPrisma }));

import { computeSignupsDaily, computeJobsDaily, computeMrrMonthly } from '@/lib/admin/home/trends';

describe('computeSignupsDaily', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns exactly 30 points oldest-first', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const result = await computeSignupsDaily(30);
    expect(result).toHaveLength(30);
    expect(result[0].d < result[29].d).toBe(true);
  });

  it('fills missing days with zero', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const result = await computeSignupsDaily(30);
    expect(result.every((p) => p.v === 0)).toBe(true);
  });

  it('maps returned rows to correct day slots', async () => {
    const today = new Date();
    const key = today.toISOString().slice(0, 10);
    mockPrisma.$queryRaw.mockResolvedValue([{ d: key, v: BigInt(5) }]);
    const result = await computeSignupsDaily(30);
    const todayPoint = result.find((p) => p.d === key);
    expect(todayPoint?.v).toBe(5);
  });

  it('has {d, v} shape on each point', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const result = await computeSignupsDaily(30);
    expect(typeof result[0].d).toBe('string');
    expect(typeof result[0].v).toBe('number');
  });
});

describe('computeJobsDaily', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns exactly 30 points', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const result = await computeJobsDaily(30);
    expect(result).toHaveLength(30);
  });

  it('fills missing days with completed=0 and failed=0', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const result = await computeJobsDaily(30);
    expect(result.every((p) => p.completed === 0 && p.failed === 0)).toBe(true);
  });

  it('maps row counts correctly', async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockPrisma.$queryRaw.mockResolvedValue([{ d: today, completed: BigInt(8), failed: BigInt(2) }]);
    const result = await computeJobsDaily(30);
    const pt = result.find((p) => p.d === today);
    expect(pt?.completed).toBe(8);
    expect(pt?.failed).toBe(2);
  });

  it('has {d, completed, failed} shape', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const result = await computeJobsDaily(30);
    const pt = result[0];
    expect(typeof pt.d).toBe('string');
    expect(typeof pt.completed).toBe('number');
    expect(typeof pt.failed).toBe('number');
  });
});

describe('computeMrrMonthly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns at most 12 points', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    const result = await computeMrrMonthly(12);
    expect(result.length).toBeLessThanOrEqual(12);
  });

  it('current month is always included (even when no subs)', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    const result = await computeMrrMonthly(12);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const found = result.find((p) => p.m === thisMonth);
    expect(found).toBeDefined();
  });

  it('has {m, v} shape', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    const result = await computeMrrMonthly(12);
    if (result.length > 0) {
      expect(typeof result[0].m).toBe('string');
      expect(typeof result[0].v).toBe('number');
    }
  });
});
