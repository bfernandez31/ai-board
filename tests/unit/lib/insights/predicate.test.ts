import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    job: { findMany: vi.fn() },
  },
}));

import {
  countEligibleUnanalyzedSessions,
  listEligibleUnanalyzedSessions,
  getEarliestEligibleSessionTimestamp,
} from '@/app/lib/insights/predicate';
import { prisma } from '@/lib/db/client';

type MockedPrisma = {
  job: { findMany: ReturnType<typeof vi.fn> };
};

const mockedPrisma = prisma as unknown as MockedPrisma;

/**
 * Build a Job row in the shape `queryEligibleSessions` selects: the eligibility
 * gate (status/ticketId/rawArtifactKey) is applied at the DB layer, so the mock
 * returns rows that already satisfy it unless a test deliberately omits a field.
 */
function makeJob(args: {
  jobId: number;
  ticketId: number | null;
  projectId: number;
  ticketAgent?: string | null;
  projectDefaultAgent?: string | null;
  startedAt?: Date;
  rawArtifactKey?: string | null;
}) {
  const {
    jobId,
    ticketId,
    projectId,
    ticketAgent = null,
    projectDefaultAgent = null,
    startedAt = new Date('2026-05-10T00:00:00Z'),
  } = args;
  const rawArtifactKey =
    args.rawArtifactKey !== undefined
      ? args.rawArtifactKey
      : ticketId !== null
        ? `raw-logs/${projectId}/${ticketId}/${jobId}.jsonl.gz`
        : null;
  return {
    id: jobId,
    projectId,
    ticketId,
    startedAt,
    log: rawArtifactKey ? { rawArtifactKey } : null,
    ticket:
      ticketId !== null
        ? {
            agent: ticketAgent,
            project: { defaultAgent: projectDefaultAgent },
          }
        : null,
  };
}

describe('insights predicate (AIB-856 eligible-session selection)', () => {
  beforeEach(() => {
    mockedPrisma.job.findMany.mockReset();
  });

  describe('effective-agent grid', () => {
    it('treats (ticket=CLAUDE, project=CODEX) as Claude', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob({
          jobId: 101,
          ticketId: 1,
          projectId: 10,
          ticketAgent: 'CLAUDE',
          projectDefaultAgent: 'CODEX',
        }),
      ]);
      expect(await countEligibleUnanalyzedSessions()).toBe(1);
    });

    it('treats (ticket=null, project=CLAUDE) as Claude', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob({
          jobId: 102,
          ticketId: 2,
          projectId: 10,
          ticketAgent: null,
          projectDefaultAgent: 'CLAUDE',
        }),
      ]);
      expect(await countEligibleUnanalyzedSessions()).toBe(1);
    });

    it('treats (ticket=CODEX, project=CLAUDE) as not Claude', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob({
          jobId: 103,
          ticketId: 3,
          projectId: 10,
          ticketAgent: 'CODEX',
          projectDefaultAgent: 'CLAUDE',
        }),
      ]);
      expect(await countEligibleUnanalyzedSessions()).toBe(0);
    });

    it('treats (ticket=null, project=null) as Claude (legacy fallback)', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob({
          jobId: 104,
          ticketId: 4,
          projectId: 10,
          ticketAgent: null,
          projectDefaultAgent: null,
        }),
      ]);
      expect(await countEligibleUnanalyzedSessions()).toBe(1);
    });
  });

  describe('all sessions per ticket — no earliest-per-ticket dedup (US1, FR-002/003)', () => {
    it('returns every eligible session of a ticket (specify/plan/implement/iterate/verify)', async () => {
      const ticketId = 42;
      const rows = [
        makeJob({ jobId: 201, ticketId, projectId: 10, projectDefaultAgent: 'CLAUDE', startedAt: new Date('2026-05-01T00:00:00Z') }),
        makeJob({ jobId: 202, ticketId, projectId: 10, projectDefaultAgent: 'CLAUDE', startedAt: new Date('2026-05-02T00:00:00Z') }),
        makeJob({ jobId: 203, ticketId, projectId: 10, projectDefaultAgent: 'CLAUDE', startedAt: new Date('2026-05-03T00:00:00Z') }),
        makeJob({ jobId: 204, ticketId, projectId: 10, projectDefaultAgent: 'CLAUDE', startedAt: new Date('2026-05-04T00:00:00Z') }),
        makeJob({ jobId: 205, ticketId, projectId: 10, projectDefaultAgent: 'CLAUDE', startedAt: new Date('2026-05-05T00:00:00Z') }),
      ];
      mockedPrisma.job.findMany.mockResolvedValue(rows);

      const list = await listEligibleUnanalyzedSessions();
      expect(list.map((j) => j.jobId)).toEqual([201, 202, 203, 204, 205]);
      expect(list).toHaveLength(5);
    });

    it('includes sessions across multiple projects', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob({ jobId: 301, ticketId: 1, projectId: 10, projectDefaultAgent: 'CLAUDE', startedAt: new Date('2026-05-01T00:00:00Z') }),
        makeJob({ jobId: 302, ticketId: 2, projectId: 20, projectDefaultAgent: 'CLAUDE', startedAt: new Date('2026-05-02T00:00:00Z') }),
      ]);
      const list = await listEligibleUnanalyzedSessions();
      expect(list.map((j) => j.projectId).sort()).toEqual([10, 20]);
    });
  });

  describe('count/list parity over the eligible set (P-2 no-drift)', () => {
    it('count and list return the same Claude session set for the same corpus', async () => {
      const rows = [
        makeJob({ jobId: 101, ticketId: 1, projectId: 10, ticketAgent: 'CLAUDE', projectDefaultAgent: 'CODEX' }),
        makeJob({ jobId: 102, ticketId: 2, projectId: 10, ticketAgent: null, projectDefaultAgent: 'CLAUDE' }),
        makeJob({ jobId: 103, ticketId: 3, projectId: 10, ticketAgent: 'CODEX', projectDefaultAgent: 'CLAUDE' }),
      ];
      mockedPrisma.job.findMany.mockResolvedValue(rows);
      const count = await countEligibleUnanalyzedSessions();

      mockedPrisma.job.findMany.mockResolvedValue(rows);
      const list = await listEligibleUnanalyzedSessions();

      expect(count).toBe(2);
      expect(list.map((j) => j.jobId).sort()).toEqual([101, 102]);
      expect(list.map((j) => j.rawArtifactKey)).toContain('raw-logs/10/1/101.jsonl.gz');
      expect(list.map((j) => j.rawArtifactKey)).toContain('raw-logs/10/2/102.jsonl.gz');
    });
  });

  describe('ordering', () => {
    it('returns sessions in ascending startedAt order', async () => {
      // The DB orders ascending; assert the param is passed and order preserved.
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob({ jobId: 401, ticketId: 1, projectId: 10, projectDefaultAgent: 'CLAUDE', startedAt: new Date('2026-05-01T00:00:00Z') }),
        makeJob({ jobId: 402, ticketId: 1, projectId: 10, projectDefaultAgent: 'CLAUDE', startedAt: new Date('2026-05-02T00:00:00Z') }),
      ]);
      const list = await listEligibleUnanalyzedSessions();
      expect(list.map((j) => j.jobId)).toEqual([401, 402]);
      expect(mockedPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { startedAt: 'asc' } })
      );
    });
  });

  describe('eligibility gates passed to the DB query', () => {
    it('filters COMPLETED + ticketId not-null + rawArtifactKey not-null', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([]);
      await listEligibleUnanalyzedSessions();
      expect(mockedPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED',
            ticketId: { not: null },
            log: { rawArtifactKey: { not: null } },
          }),
        })
      );
    });

    it('applies the marker anti-join (insightsAnalyzedSession: null) when unanalyzed', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([]);
      await countEligibleUnanalyzedSessions();
      expect(mockedPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            insightsAnalyzedSession: null,
          }),
        })
      );
    });
  });

  describe('getEarliestEligibleSessionTimestamp', () => {
    it('returns the earliest Claude session startedAt', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob({ jobId: 102, ticketId: 2, projectId: 10, projectDefaultAgent: 'CLAUDE', startedAt: new Date('2026-05-01T00:00:00Z') }),
        makeJob({ jobId: 101, ticketId: 1, projectId: 10, projectDefaultAgent: 'CLAUDE', startedAt: new Date('2026-05-03T00:00:00Z') }),
      ]);
      const earliest = await getEarliestEligibleSessionTimestamp();
      expect(earliest?.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    });

    it('returns null when there are no eligible Claude sessions', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([]);
      expect(await getEarliestEligibleSessionTimestamp()).toBeNull();
    });

    it('skips a non-Claude leading row to find the earliest Claude session', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob({ jobId: 501, ticketId: 1, projectId: 10, ticketAgent: 'CODEX', startedAt: new Date('2026-05-01T00:00:00Z') }),
        makeJob({ jobId: 502, ticketId: 2, projectId: 10, projectDefaultAgent: 'CLAUDE', startedAt: new Date('2026-05-02T00:00:00Z') }),
      ]);
      const earliest = await getEarliestEligibleSessionTimestamp();
      expect(earliest?.toISOString()).toBe('2026-05-02T00:00:00.000Z');
    });
  });
});
