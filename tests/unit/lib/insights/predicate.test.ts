import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    ticketOutcome: { findMany: vi.fn() },
    job: { findMany: vi.fn() },
  },
}));

import {
  countShippedClaudeTicketsSince,
  listShippedClaudeJobsForWindow,
  getEarliestClaudeJobTimestamp,
} from '@/app/lib/insights/predicate';
import { prisma } from '@/lib/db/client';

type MockedPrisma = {
  ticketOutcome: { findMany: ReturnType<typeof vi.fn> };
  job: { findMany: ReturnType<typeof vi.fn> };
};

const mockedPrisma = prisma as unknown as MockedPrisma;

function makeOutcome(args: {
  ticketId: number;
  projectId: number;
  ticketAgent: string | null;
  projectDefaultAgent: string | null;
  shippedAt: Date;
}) {
  return {
    ticketId: args.ticketId,
    projectId: args.projectId,
    shippedAt: args.shippedAt,
    ticket: {
      agent: args.ticketAgent,
      project: { defaultAgent: args.projectDefaultAgent },
    },
  };
}

function makeJob(jobId: number, ticketId: number | null, projectId: number) {
  return { id: jobId, projectId, ticketId };
}

describe('insights predicate (AIB-791)', () => {
  beforeEach(() => {
    mockedPrisma.ticketOutcome.findMany.mockReset();
    mockedPrisma.job.findMany.mockReset();
  });

  describe('effective-agent grid', () => {
    it('treats (ticket=CLAUDE, project=CODEX) as Claude', async () => {
      mockedPrisma.ticketOutcome.findMany.mockResolvedValue([
        makeOutcome({
          ticketId: 1,
          projectId: 10,
          ticketAgent: 'CLAUDE',
          projectDefaultAgent: 'CODEX',
          shippedAt: new Date('2026-05-10T00:00:00Z'),
        }),
      ]);
      mockedPrisma.job.findMany.mockResolvedValue([makeJob(101, 1, 10)]);

      expect(await countShippedClaudeTicketsSince(null)).toBe(1);
    });

    it('treats (ticket=null, project=CLAUDE) as Claude', async () => {
      mockedPrisma.ticketOutcome.findMany.mockResolvedValue([
        makeOutcome({
          ticketId: 2,
          projectId: 10,
          ticketAgent: null,
          projectDefaultAgent: 'CLAUDE',
          shippedAt: new Date('2026-05-10T00:00:00Z'),
        }),
      ]);
      mockedPrisma.job.findMany.mockResolvedValue([makeJob(102, 2, 10)]);

      expect(await countShippedClaudeTicketsSince(null)).toBe(1);
    });

    it('treats (ticket=CODEX, project=CLAUDE) as not Claude', async () => {
      mockedPrisma.ticketOutcome.findMany.mockResolvedValue([
        makeOutcome({
          ticketId: 3,
          projectId: 10,
          ticketAgent: 'CODEX',
          projectDefaultAgent: 'CLAUDE',
          shippedAt: new Date('2026-05-10T00:00:00Z'),
        }),
      ]);
      mockedPrisma.job.findMany.mockResolvedValue([makeJob(103, 3, 10)]);

      expect(await countShippedClaudeTicketsSince(null)).toBe(0);
    });

    it('treats (ticket=null, project=null) as Claude (legacy fallback)', async () => {
      mockedPrisma.ticketOutcome.findMany.mockResolvedValue([
        makeOutcome({
          ticketId: 4,
          projectId: 10,
          ticketAgent: null,
          projectDefaultAgent: null,
          shippedAt: new Date('2026-05-10T00:00:00Z'),
        }),
      ]);
      mockedPrisma.job.findMany.mockResolvedValue([makeJob(104, 4, 10)]);

      expect(await countShippedClaudeTicketsSince(null)).toBe(1);
    });
  });

  describe('count vs list agreement (FR-025)', () => {
    it('returns the same Claude ticket set from count and list for one window', async () => {
      const outcomes = [
        makeOutcome({
          ticketId: 1,
          projectId: 10,
          ticketAgent: 'CLAUDE',
          projectDefaultAgent: 'CODEX',
          shippedAt: new Date('2026-05-09T00:00:00Z'),
        }),
        makeOutcome({
          ticketId: 2,
          projectId: 10,
          ticketAgent: null,
          projectDefaultAgent: 'CLAUDE',
          shippedAt: new Date('2026-05-09T01:00:00Z'),
        }),
        makeOutcome({
          ticketId: 3,
          projectId: 10,
          ticketAgent: 'CODEX',
          projectDefaultAgent: 'CLAUDE',
          shippedAt: new Date('2026-05-09T02:00:00Z'),
        }),
      ];
      const jobs = [
        makeJob(101, 1, 10),
        makeJob(102, 2, 10),
        makeJob(103, 3, 10),
      ];

      mockedPrisma.ticketOutcome.findMany.mockResolvedValue(outcomes);
      mockedPrisma.job.findMany.mockResolvedValue(jobs);

      const count = await countShippedClaudeTicketsSince(
        new Date('2026-05-01T00:00:00Z')
      );

      mockedPrisma.ticketOutcome.findMany.mockResolvedValue(outcomes);
      mockedPrisma.job.findMany.mockResolvedValue(jobs);
      const list = await listShippedClaudeJobsForWindow(
        new Date('2026-05-01T00:00:00Z'),
        new Date('2026-05-11T00:00:00Z')
      );

      expect(count).toBe(2);
      expect(list.map((j) => j.ticketId).sort()).toEqual([1, 2]);
      expect(list.map((j) => j.rawArtifactKey)).toContain('raw-logs/10/1/101.jsonl.gz');
      expect(list.map((j) => j.rawArtifactKey)).toContain('raw-logs/10/2/102.jsonl.gz');
    });
  });

  describe('getEarliestClaudeJobTimestamp', () => {
    it('returns the earliest Claude shippedAt', async () => {
      const outcomes = [
        makeOutcome({
          ticketId: 1,
          projectId: 10,
          ticketAgent: 'CLAUDE',
          projectDefaultAgent: 'CODEX',
          shippedAt: new Date('2026-05-09T00:00:00Z'),
        }),
        makeOutcome({
          ticketId: 2,
          projectId: 10,
          ticketAgent: 'CLAUDE',
          projectDefaultAgent: 'CODEX',
          shippedAt: new Date('2026-05-01T00:00:00Z'),
        }),
      ];
      mockedPrisma.ticketOutcome.findMany.mockResolvedValue(outcomes);
      mockedPrisma.job.findMany.mockResolvedValue([
        makeJob(101, 1, 10),
        makeJob(102, 2, 10),
      ]);
      const earliest = await getEarliestClaudeJobTimestamp();
      expect(earliest?.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    });

    it('returns null when there are no Claude shipped tickets', async () => {
      mockedPrisma.ticketOutcome.findMany.mockResolvedValue([]);
      mockedPrisma.job.findMany.mockResolvedValue([]);
      expect(await getEarliestClaudeJobTimestamp()).toBeNull();
    });
  });
});
