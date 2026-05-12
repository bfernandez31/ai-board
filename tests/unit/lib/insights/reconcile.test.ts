import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    insightsReport: { updateMany: vi.fn() },
  },
}));

import { reconcileOrphanedRunningReports } from '@/app/lib/insights/reconcile';
import { prisma } from '@/lib/db/client';

type MockedPrisma = {
  insightsReport: { updateMany: ReturnType<typeof vi.fn> };
};
const mockedPrisma = prisma as unknown as MockedPrisma;

describe('reconcileOrphanedRunningReports (AIB-791)', () => {
  const originalEnv = process.env.INSIGHTS_RUN_TIMEOUT_MINUTES;

  beforeEach(() => {
    mockedPrisma.insightsReport.updateMany.mockReset();
    delete process.env.INSIGHTS_RUN_TIMEOUT_MINUTES;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.INSIGHTS_RUN_TIMEOUT_MINUTES;
    } else {
      process.env.INSIGHTS_RUN_TIMEOUT_MINUTES = originalEnv;
    }
  });

  it('uses 60-minute default timeout and atomic updateMany on RUNNING rows', async () => {
    mockedPrisma.insightsReport.updateMany.mockResolvedValue({ count: 1 });

    const now = new Date('2026-05-11T12:00:00Z');
    const result = await reconcileOrphanedRunningReports(now);

    expect(result).toEqual({ failed: 1 });

    const call = mockedPrisma.insightsReport.updateMany.mock.calls[0][0];
    expect(call.where.status).toBe('RUNNING');
    const cutoff = call.where.createdAt.lt as Date;
    expect(cutoff.toISOString()).toBe('2026-05-11T11:00:00.000Z');
    expect(call.data.status).toBe('FAILED');
    expect(call.data.errorReason).toMatch(/timed out/i);
    expect(call.data.completedAt).toEqual(now);
  });

  it('honors INSIGHTS_RUN_TIMEOUT_MINUTES override (fresh read each call)', async () => {
    process.env.INSIGHTS_RUN_TIMEOUT_MINUTES = '5';
    mockedPrisma.insightsReport.updateMany.mockResolvedValue({ count: 2 });

    const now = new Date('2026-05-11T12:00:00Z');
    await reconcileOrphanedRunningReports(now);

    const call = mockedPrisma.insightsReport.updateMany.mock.calls[0][0];
    const cutoff = call.where.createdAt.lt as Date;
    expect(cutoff.toISOString()).toBe('2026-05-11T11:55:00.000Z');
  });

  it('returns count=0 on second invocation against the same idle row (idempotent)', async () => {
    mockedPrisma.insightsReport.updateMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.insightsReport.updateMany.mockResolvedValueOnce({ count: 0 });

    const now = new Date('2026-05-11T12:00:00Z');
    const first = await reconcileOrphanedRunningReports(now);
    const second = await reconcileOrphanedRunningReports(now);

    expect(first.failed).toBe(1);
    expect(second.failed).toBe(0);
  });

  it.each([
    ['NaN', 'bogus'],
    ['zero', '0'],
    ['negative', '-5'],
  ])(
    'clamps invalid (%s) timeouts up to the 1-minute floor or default',
    async (_label, raw) => {
      process.env.INSIGHTS_RUN_TIMEOUT_MINUTES = raw;
      mockedPrisma.insightsReport.updateMany.mockResolvedValue({ count: 0 });

      const now = new Date('2026-05-11T12:00:00Z');
      await reconcileOrphanedRunningReports(now);

      const cutoff = mockedPrisma.insightsReport.updateMany.mock.calls[0][0]
        .where.createdAt.lt as Date;
      // NaN/non-finite falls back to the 60-min default; finite-but-≤0 values
      // are clamped up to the 1-minute floor by readTimeoutMinutes.
      const expected = Number.isFinite(Number(raw))
        ? '2026-05-11T11:59:00.000Z'
        : '2026-05-11T11:00:00.000Z';
      expect(cutoff.toISOString()).toBe(expected);
    }
  );
});
