import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    user: { findMany: vi.fn() },
    job: { findMany: vi.fn() },
    subscription: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/db/client';
import { computeTrends } from '@/app/lib/admin/home/trends';

type MockedPrisma = {
  user: { findMany: ReturnType<typeof vi.fn> };
  job: { findMany: ReturnType<typeof vi.fn> };
  subscription: { findMany: ReturnType<typeof vi.fn> };
};

const mockedPrisma = prisma as unknown as MockedPrisma;
const NOW = new Date('2026-05-12T10:00:00.000Z');

beforeEach(() => {
  vi.resetAllMocks();
  mockedPrisma.user.findMany.mockResolvedValue([]);
  mockedPrisma.job.findMany.mockResolvedValue([]);
  mockedPrisma.subscription.findMany.mockResolvedValue([]);
});

describe('computeTrends', () => {
  it('returns 30-element signupsPerDay with zeros when no data', async () => {
    const trends = await computeTrends(NOW);
    expect(trends.signupsPerDay).toHaveLength(30);
    expect(trends.signupsPerDay.every((p) => p.value === 0)).toBe(true);
  });

  it('returns 30-element jobsPerDay with completed+failed columns', async () => {
    const trends = await computeTrends(NOW);
    expect(trends.jobsPerDay).toHaveLength(30);
    expect(trends.jobsPerDay[0]).toEqual({ date: expect.any(String), completed: 0, failed: 0 });
  });

  it('returns 12-element mrrPerMonth oldest-first', async () => {
    const trends = await computeTrends(NOW);
    expect(trends.mrrPerMonth).toHaveLength(12);
    const months = trends.mrrPerMonth.map((m) => m.month);
    const sorted = [...months].sort();
    expect(months).toEqual(sorted);
  });

  it('buckets signups by UTC day', async () => {
    mockedPrisma.user.findMany.mockResolvedValue([
      { createdAt: new Date('2026-05-12T01:00:00Z') },
      { createdAt: new Date('2026-05-12T05:30:00Z') },
      { createdAt: new Date('2026-05-11T08:00:00Z') },
    ]);
    const trends = await computeTrends(NOW);
    const today = trends.signupsPerDay.find((p) => p.date === '2026-05-12');
    const yesterday = trends.signupsPerDay.find((p) => p.date === '2026-05-11');
    expect(today?.value).toBe(2);
    expect(yesterday?.value).toBe(1);
  });

  it('FR-020: failed counts include FAILED and CANCELLED statuses', async () => {
    mockedPrisma.job.findMany.mockResolvedValue([
      { createdAt: new Date('2026-05-12T01:00:00Z'), status: 'COMPLETED' },
      { createdAt: new Date('2026-05-12T02:00:00Z'), status: 'FAILED' },
      { createdAt: new Date('2026-05-12T03:00:00Z'), status: 'CANCELLED' },
      { createdAt: new Date('2026-05-12T04:00:00Z'), status: 'PENDING' },
    ]);
    const trends = await computeTrends(NOW);
    const today = trends.jobsPerDay.find((p) => p.date === '2026-05-12');
    expect(today?.completed).toBe(1);
    expect(today?.failed).toBe(2); // FAILED + CANCELLED
  });

  it('dates ascend oldest-first', async () => {
    const trends = await computeTrends(NOW);
    const dates = trends.signupsPerDay.map((p) => p.date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });
});
