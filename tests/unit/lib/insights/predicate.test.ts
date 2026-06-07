import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    job: { findMany: vi.fn() },
  },
}));

import {
  countAnalyzableClaudeSessions,
  countExpectedClaudeSessions,
  listAnalyzableClaudeSessions,
  getEarliestClaudeSessionCompletion,
} from '@/app/lib/insights/predicate';
import { prisma } from '@/lib/db/client';

type MockedPrisma = {
  job: { findMany: ReturnType<typeof vi.fn> };
};

const mockedPrisma = prisma as unknown as MockedPrisma;

interface JobOpts {
  id: number;
  ticketId?: number | null;
  projectId?: number;
  ticketAgent?: string | null;
  projectDefaultAgent?: string | null;
  completedAt?: Date | null;
  updatedAt?: Date;
  startedAt?: Date;
  captureStatus?: 'CAPTURED' | 'UNAVAILABLE' | 'PRUNED';
  rawArtifactKey?: string | null;
  hasLog?: boolean;
}

const DEFAULT_AT = new Date('2026-05-10T00:00:00Z');

function makeJob(opts: JobOpts) {
  const projectId = opts.projectId ?? 10;
  const ticketId = opts.ticketId === undefined ? 1 : opts.ticketId;
  const hasLog = opts.hasLog ?? true;
  const rawArtifactKey =
    opts.rawArtifactKey === undefined
      ? `raw-logs/${projectId}/${ticketId}/${opts.id}.jsonl.gz`
      : opts.rawArtifactKey;
  return {
    id: opts.id,
    projectId,
    ticketId,
    completedAt: opts.completedAt === undefined ? DEFAULT_AT : opts.completedAt,
    updatedAt: opts.updatedAt ?? DEFAULT_AT,
    startedAt: opts.startedAt ?? DEFAULT_AT,
    ticket: {
      agent: opts.ticketAgent ?? null,
      project: { defaultAgent: opts.projectDefaultAgent ?? null },
    },
    log: hasLog
      ? {
          captureStatus: opts.captureStatus ?? 'CAPTURED',
          rawArtifactKey,
        }
      : null,
  };
}

const FULL = { start: null, end: null };

describe('insights predicate (AIB-852)', () => {
  beforeEach(() => {
    mockedPrisma.job.findMany.mockReset();
  });

  describe('effective-agent grid (P2/FR-009)', () => {
    it.each([
      ['ticket=CLAUDE, project=CODEX', 'CLAUDE', 'CODEX', 1],
      ['ticket=null, project=CLAUDE', null, 'CLAUDE', 1],
      ['ticket=CODEX, project=CLAUDE', 'CODEX', 'CLAUDE', 0],
      ['ticket=null, project=null (legacy)', null, null, 1],
    ])('%s', async (_label, ticketAgent, projectDefaultAgent, expected) => {
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob({ id: 101, ticketAgent, projectDefaultAgent }),
      ]);
      expect(await countAnalyzableClaudeSessions(FULL)).toBe(expected);
    });
  });

  describe('all sessions per ticket (US1 AC1/AC2, FR-001/002)', () => {
    it('includes EVERY captured Claude session of a ticket, not just the earliest', async () => {
      // One ticket with three Claude sessions (implement, iterate, verify).
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob({ id: 201, ticketId: 1, startedAt: new Date('2026-05-01T00:00:00Z') }),
        makeJob({ id: 202, ticketId: 1, startedAt: new Date('2026-05-03T00:00:00Z') }),
        makeJob({ id: 203, ticketId: 1, startedAt: new Date('2026-05-05T00:00:00Z') }),
      ]);
      const list = await listAnalyzableClaudeSessions(FULL);
      expect(list.map((j) => j.jobId).sort()).toEqual([201, 202, 203]);
    });
  });

  describe('count == enumeration parity (FR-016/SC-006)', () => {
    it('countAnalyzable equals listAnalyzable length for the same corpus', async () => {
      const corpus = [
        makeJob({ id: 1, ticketId: 1, ticketAgent: 'CLAUDE' }),
        makeJob({ id: 2, ticketId: 2, ticketAgent: null, projectDefaultAgent: 'CLAUDE' }),
        makeJob({ id: 3, ticketId: 3, ticketAgent: 'CODEX', projectDefaultAgent: 'CLAUDE' }),
      ];
      mockedPrisma.job.findMany.mockResolvedValue(corpus);
      const count = await countAnalyzableClaudeSessions(FULL);
      mockedPrisma.job.findMany.mockResolvedValue(corpus);
      const list = await listAnalyzableClaudeSessions(FULL);
      expect(count).toBe(2);
      expect(list).toHaveLength(2);
    });
  });

  describe('completion-timestamp boundary placement (D3)', () => {
    it('uses completedAt and places it half-open: completion < end', async () => {
      const end = new Date('2026-05-10T00:00:00Z');
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob({ id: 1, ticketId: 1, completedAt: new Date('2026-05-09T23:59:59Z') }),
        makeJob({ id: 2, ticketId: 2, completedAt: end }), // exactly on the boundary → excluded
      ]);
      const list = await listAnalyzableClaudeSessions({ start: null, end });
      expect(list.map((j) => j.jobId)).toEqual([1]);
    });

    it('falls back completedAt ?? updatedAt ?? startedAt for legacy rows', async () => {
      const end = new Date('2026-05-10T00:00:00Z');
      mockedPrisma.job.findMany.mockResolvedValue([
        // completedAt null → uses updatedAt (before end) → included
        makeJob({
          id: 1,
          ticketId: 1,
          completedAt: null,
          updatedAt: new Date('2026-05-09T00:00:00Z'),
        }),
        // completedAt null + updatedAt after end → excluded
        makeJob({
          id: 2,
          ticketId: 2,
          completedAt: null,
          updatedAt: new Date('2026-05-11T00:00:00Z'),
        }),
      ]);
      const list = await listAnalyzableClaudeSessions({ start: null, end });
      expect(list.map((j) => j.jobId)).toEqual([1]);
    });
  });

  describe('coverage-exclusion filter (D1/FR-006)', () => {
    it('passes insightsCoverage: { is: null } to findMany for fresh selection', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([]);
      await listAnalyzableClaudeSessions(FULL);
      expect(mockedPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            insightsCoverage: { is: null },
          }),
        })
      );
    });

    it('omits the coverage filter when ignoreCoverage is set (retry, D8)', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([]);
      await listAnalyzableClaudeSessions(FULL, { ignoreCoverage: true });
      const where = mockedPrisma.job.findMany.mock.calls[0][0].where;
      expect(where.insightsCoverage).toBeUndefined();
    });
  });

  describe('no SHIP / no project filter (US3 + US5 selection guardrail)', () => {
    it('selects sessions of a non-shipped ticket (no TicketOutcome join)', async () => {
      // The query never references TicketOutcome; a ticket that never shipped
      // is still selected as long as it has a captured Claude session.
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob({ id: 301, ticketId: 99 }),
      ]);
      const list = await listAnalyzableClaudeSessions(FULL);
      expect(list).toHaveLength(1);
      expect(list[0].ticketId).toBe(99);
    });

    it('applies no projectId filter (spans all projects)', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([]);
      await listAnalyzableClaudeSessions(FULL);
      const where = mockedPrisma.job.findMany.mock.calls[0][0].where;
      expect(where.projectId).toBeUndefined();
      expect(JSON.stringify(where)).not.toContain('projectId');
    });
  });

  describe('expected vs analyzable split (D4/FR-011)', () => {
    it('counts transcript-pending sessions as expected but not analyzable', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob({ id: 1, ticketId: 1, captureStatus: 'CAPTURED' }),
        // transcript not uploaded yet → expected but not analyzable
        makeJob({ id: 2, ticketId: 2, captureStatus: 'UNAVAILABLE', rawArtifactKey: null }),
        // pruned → expected but not analyzable
        makeJob({ id: 3, ticketId: 3, captureStatus: 'PRUNED', rawArtifactKey: null }),
      ]);
      const expected = await countExpectedClaudeSessions(FULL);
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob({ id: 1, ticketId: 1, captureStatus: 'CAPTURED' }),
        makeJob({ id: 2, ticketId: 2, captureStatus: 'UNAVAILABLE', rawArtifactKey: null }),
        makeJob({ id: 3, ticketId: 3, captureStatus: 'PRUNED', rawArtifactKey: null }),
      ]);
      const analyzable = await countAnalyzableClaudeSessions(FULL);
      expect(expected).toBe(3);
      expect(analyzable).toBe(1);
    });

    it('requires a JobLog row (hasLog) at the query level', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([]);
      await countExpectedClaudeSessions(FULL);
      expect(mockedPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            log: { isNot: null },
            ticketId: { not: null },
            status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] },
          }),
        })
      );
    });
  });

  describe('getEarliestClaudeSessionCompletion', () => {
    it('returns the earliest completion across Claude sessions', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob({ id: 1, ticketId: 1, completedAt: new Date('2026-05-03T00:00:00Z') }),
        makeJob({ id: 2, ticketId: 2, completedAt: new Date('2026-05-01T00:00:00Z') }),
      ]);
      const earliest = await getEarliestClaudeSessionCompletion();
      expect(earliest?.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    });

    it('returns null when there are no Claude sessions', async () => {
      mockedPrisma.job.findMany.mockResolvedValue([]);
      expect(await getEarliestClaudeSessionCompletion()).toBeNull();
    });
  });
});
