import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    insightsReport: {
      findFirst: vi.fn(),
    },
    ticketOutcome: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    job: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/client';
import {
  buildInsightsReportArtifactKey,
  buildInsightsScope,
  findActiveInsightsReport,
  findLatestSuccessfulReport,
  previewInsightsScope,
} from '@/lib/admin/insights-scope';

const mockedReportFindFirst = prisma.insightsReport.findFirst as unknown as ReturnType<typeof vi.fn>;
const mockedOutcomeCount = prisma.ticketOutcome.count as unknown as ReturnType<typeof vi.fn>;
const mockedOutcomeFindMany = prisma.ticketOutcome.findMany as unknown as ReturnType<typeof vi.fn>;
const mockedJobFindMany = prisma.job.findMany as unknown as ReturnType<typeof vi.fn>;

describe('insights-scope helpers', () => {
  beforeEach(() => {
    mockedReportFindFirst.mockReset();
    mockedOutcomeCount.mockReset();
    mockedOutcomeFindMany.mockReset();
    mockedJobFindMany.mockReset();
  });

  describe('buildInsightsReportArtifactKey', () => {
    it('builds a deterministic blob key', () => {
      expect(buildInsightsReportArtifactKey(42)).toBe('insights/42.html');
    });
  });

  describe('findLatestSuccessfulReport / findActiveInsightsReport', () => {
    it('queries the latest COMPLETED report ordered by completedAt desc', async () => {
      mockedReportFindFirst.mockResolvedValueOnce({ id: 1, status: 'COMPLETED' });
      const result = await findLatestSuccessfulReport();
      expect(result).toEqual({ id: 1, status: 'COMPLETED' });
      expect(mockedReportFindFirst).toHaveBeenCalledWith({
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
      });
    });

    it('queries the active RUNNING report', async () => {
      mockedReportFindFirst.mockResolvedValueOnce({ id: 7, status: 'RUNNING' });
      const result = await findActiveInsightsReport();
      expect(result).toEqual({ id: 7, status: 'RUNNING' });
      expect(mockedReportFindFirst).toHaveBeenCalledWith({
        where: { status: 'RUNNING' },
        orderBy: { startedAt: 'desc' },
      });
    });
  });

  describe('previewInsightsScope', () => {
    it('counts all outcomes when no previous report exists', async () => {
      mockedReportFindFirst.mockResolvedValueOnce(null);
      mockedOutcomeCount.mockResolvedValueOnce(3);

      const result = await previewInsightsScope();
      expect(result).toEqual({
        previousRunAt: null,
        newTicketCount: 3,
        hasNewTickets: true,
      });
      expect(mockedOutcomeCount).toHaveBeenCalledWith({ where: {} });
    });

    it('counts outcomes shipped after the previous run', async () => {
      const previousEnd = new Date('2026-05-01T00:00:00Z');
      mockedReportFindFirst.mockResolvedValueOnce({
        periodEnd: previousEnd,
      });
      mockedOutcomeCount.mockResolvedValueOnce(0);

      const result = await previewInsightsScope();
      expect(result).toEqual({
        previousRunAt: previousEnd,
        newTicketCount: 0,
        hasNewTickets: false,
      });
      expect(mockedOutcomeCount).toHaveBeenCalledWith({
        where: { shippedAt: { gt: previousEnd } },
      });
    });
  });

  describe('buildInsightsScope', () => {
    it('returns the full scope including CLAUDE jobs with raw artifacts', async () => {
      const now = new Date('2026-05-10T12:00:00Z');
      mockedReportFindFirst.mockResolvedValueOnce(null);
      mockedOutcomeCount.mockResolvedValueOnce(2);
      mockedOutcomeFindMany.mockResolvedValueOnce([
        { ticketId: 100, shippedAt: new Date('2026-05-01') },
        { ticketId: 101, shippedAt: new Date('2026-05-05') },
      ]);
      mockedJobFindMany.mockResolvedValueOnce([
        {
          id: 9001,
          projectId: 3,
          ticketId: 100,
          log: { rawArtifactKey: 'raw-logs/3/100/9001.jsonl.gz' },
        },
        {
          id: 9002,
          projectId: 3,
          ticketId: 100,
          log: { rawArtifactKey: null }, // filtered out
        },
        {
          id: 9003,
          projectId: 3,
          ticketId: 101,
          log: null, // filtered out
        },
      ]);

      const scope = await buildInsightsScope(now);

      expect(scope.ticketIds).toEqual([100, 101]);
      expect(scope.periodStart).toEqual(new Date('2026-05-01'));
      expect(scope.periodEnd).toBe(now);
      expect(scope.jobs).toEqual([
        {
          jobId: 9001,
          projectId: 3,
          ticketId: 100,
          rawArtifactKey: 'raw-logs/3/100/9001.jsonl.gz',
        },
      ]);
      expect(mockedJobFindMany).toHaveBeenCalledWith({
        where: {
          ticketId: { in: [100, 101] },
          ticket: { agent: 'CLAUDE' },
          log: { captureStatus: 'CAPTURED', rawArtifactKey: { not: null } },
        },
        select: {
          id: true,
          projectId: true,
          ticketId: true,
          log: { select: { rawArtifactKey: true } },
        },
      });
    });

    it('returns an empty scope when no new tickets shipped', async () => {
      const previousEnd = new Date('2026-05-01T00:00:00Z');
      mockedReportFindFirst.mockResolvedValueOnce({ periodEnd: previousEnd });
      mockedOutcomeCount.mockResolvedValueOnce(0);
      mockedOutcomeFindMany.mockResolvedValueOnce([]);

      const scope = await buildInsightsScope(new Date('2026-05-10T00:00:00Z'));

      expect(scope.hasNewTickets).toBe(false);
      expect(scope.ticketIds).toEqual([]);
      expect(scope.periodStart).toEqual(previousEnd);
      expect(scope.jobs).toEqual([]);
      expect(mockedJobFindMany).not.toHaveBeenCalled();
    });
  });
});
