import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { count: vi.fn(), findMany: vi.fn() },
    subscription: { findMany: vi.fn() },
    job: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/db/client', () => ({ prisma: mockPrisma }));

import { computePulseKpis } from '@/lib/admin/home/kpis';

describe('computePulseKpis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([]);
  });

  describe('total users and deltas', () => {
    it('returns total users count with 7d and 30d deltas', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(5)   // 7d delta
        .mockResolvedValueOnce(20); // 30d delta
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(5) }]) // mauCurrent
        .mockResolvedValueOnce([{ count: BigInt(3) }]) // mauPrev
        .mockResolvedValueOnce([]); // userSpark
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const result = await computePulseKpis();
      expect(result.users.value).toBe(100);
      expect(result.users.delta7d).toBe(5);
      expect(result.users.delta30d).toBe(20);
    });
  });

  describe('MAU calculation', () => {
    it('counts distinct project owners who ran jobs in 30d', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(20);
      // $queryRaw calls: mauCurrent, mauPrev, userSpark
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(2) }]) // mauCurrent
        .mockResolvedValueOnce([{ count: BigInt(1) }]) // mauPrev
        .mockResolvedValueOnce([]); // userSpark
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const result = await computePulseKpis();
      expect(result.mau.value).toBe(2); // 2 distinct users
    });

    it('returns shareOfBase as null when totalUsers is 0', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([]);
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const result = await computePulseKpis();
      expect(result.mau.shareOfBase).toBeNull();
    });
  });

  describe('MRR calculation', () => {
    it('sums PRO and TEAM priceMonthly for active/trialing subs', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(20);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([]);
      const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      mockPrisma.subscription.findMany.mockResolvedValue([
        { plan: 'PRO', status: 'ACTIVE', cancelAt: null, createdAt: oldDate },   // 1500
        { plan: 'PRO', status: 'TRIALING', cancelAt: null, createdAt: oldDate }, // 1500
        { plan: 'TEAM', status: 'ACTIVE', cancelAt: null, createdAt: oldDate },  // 3000
      ]);

      const result = await computePulseKpis();
      expect(result.mrr.valueUsd).toBe(6000); // 1500 + 1500 + 3000
      expect(result.mrr.proCount).toBe(2);
      expect(result.mrr.teamCount).toBe(1);
    });
  });

  describe('active paying', () => {
    it('counts PRO/TEAM ACTIVE/TRIALING subs without future cancelAt', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(30);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([]);
      const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      mockPrisma.subscription.findMany.mockResolvedValue([
        { plan: 'PRO', status: 'ACTIVE', cancelAt: null, createdAt: oldDate },
        { plan: 'TEAM', status: 'TRIALING', cancelAt: null, createdAt: oldDate },
        { plan: 'FREE', status: 'ACTIVE', cancelAt: null, createdAt: oldDate }, // excluded by filter
      ]);

      const result = await computePulseKpis();
      expect(result.activePaying.value).toBe(2);
    });
  });

  describe('sparkline series', () => {
    it('returns spark arrays of length 30 (padded with zeros for young platforms)', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(5);
      // $queryRaw order: mauCurrent, mauPrev, userSpark
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([
          { d: '2026-05-01', v: BigInt(1) },
          { d: '2026-05-02', v: BigInt(2) },
          { d: '2026-05-03', v: BigInt(3) },
        ]);
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const result = await computePulseKpis();
      expect(result.users.spark).toHaveLength(30);
    });
  });
});
