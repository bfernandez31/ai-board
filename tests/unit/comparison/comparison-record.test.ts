import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComparisonReport } from '@/lib/types/comparison';
import { prisma } from '@/lib/db/client';
import {
  createAvailableEnrichment,
  createComparisonRecordInput,
  createPendingEnrichment,
  createUnavailableEnrichment,
  normalizeTelemetryEnrichment,
  persistComparisonRecord,
} from '@/lib/comparison/comparison-record';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

const report: ComparisonReport = {
  metadata: {
    generatedAt: new Date('2026-03-20T10:00:00.000Z'),
    sourceTicket: 'AIB-1',
    comparedTickets: ['AIB-2', 'AIB-3'],
    filePath: 'specs/feature/comparisons/test.md',
  },
  summary: 'AIB-2 is the stronger implementation.',
  alignment: {
    overall: 88,
    dimensions: {
      requirements: 90,
      scenarios: 80,
      entities: 85,
      keywords: 95,
    },
    isAligned: true,
    matchingRequirements: ['FR-001'],
    matchingEntities: ['Ticket'],
  },
  implementation: {
    'AIB-2': {
      ticketKey: 'AIB-2',
      linesAdded: 10,
      linesRemoved: 4,
      linesChanged: 14,
      filesChanged: 2,
      changedFiles: ['app/a.ts'],
      testFilesChanged: 1,
      hasData: true,
    },
    'AIB-3': {
      ticketKey: 'AIB-3',
      linesAdded: 40,
      linesRemoved: 10,
      linesChanged: 50,
      filesChanged: 5,
      changedFiles: ['app/b.ts'],
      testFilesChanged: 0,
      hasData: true,
    },
  },
  compliance: {
    'AIB-2': {
      overall: 92,
      totalPrinciples: 1,
      passedPrinciples: 1,
      principles: [{ name: 'TypeScript-First Development', section: 'I', passed: true, notes: '' }],
    },
    'AIB-3': {
      overall: 60,
      totalPrinciples: 1,
      passedPrinciples: 0,
      principles: [{ name: 'TypeScript-First Development', section: 'I', passed: false, notes: 'Gap' }],
    },
  },
  telemetry: {},
  recommendation: 'Pick AIB-2.',
  warnings: [],
};

describe('comparison-record helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps a comparison report into Prisma create input', () => {
    const input = createComparisonRecordInput({
      projectId: 1,
      sourceTicket: {
        id: 1,
        ticketKey: 'AIB-1',
        title: 'Source',
        stage: 'BUILD',
        workflowType: 'FULL',
        agent: null,
      },
      participants: [
        {
          id: 2,
          ticketKey: 'AIB-2',
          title: 'Winner',
          stage: 'VERIFY',
          workflowType: 'FULL',
          agent: null,
        },
        {
          id: 3,
          ticketKey: 'AIB-3',
          title: 'Runner up',
          stage: 'PLAN',
          workflowType: 'FULL',
          agent: null,
        },
      ],
      compareRunKey: 'cmp_existing_run',
      markdownPath: 'specs/feature/comparisons/test.md',
      report,
    });

    expect(input.compareRunKey).toBe('cmp_existing_run');
    expect(input.markdownPath).toBe('specs/feature/comparisons/test.md');
    expect(input.participants?.create).toHaveLength(2);
    const participants = input.participants?.create;
    expect(Array.isArray(participants) && participants[0]).toMatchObject({
      rank: 1,
      score: 92,
    });
  });

  it('builds available, pending, and unavailable enrichment states', () => {
    expect(createAvailableEnrichment(5)).toEqual({ state: 'available', value: 5 });
    expect(createPendingEnrichment<number>()).toEqual({ state: 'pending', value: null });
    expect(createUnavailableEnrichment<number>()).toEqual({
      state: 'unavailable',
      value: null,
    });
    expect(
      normalizeTelemetryEnrichment({
        totalTokens: 10,
        inputTokens: 10,
        outputTokens: null,
        durationMs: 30,
        costUsd: null,
        jobCount: 2,
        model: 'gpt-5.4',
      })
    ).toEqual({
      totalTokens: { state: 'available', value: 10 },
      inputTokens: { state: 'available', value: 10 },
      outputTokens: { state: 'pending', value: null },
      durationMs: { state: 'available', value: 30 },
      costUsd: { state: 'pending', value: null },
      jobCount: { state: 'available', value: 2 },
      model: { state: 'available', value: 'gpt-5.4' },
    });
  });

  it('reuses the existing record for a duplicate compare-run key', async () => {
    const existingRecord = {
      id: 42,
      participants: [],
      decisionPoints: [],
    };
    const findFirst = vi.fn().mockResolvedValue(existingRecord);
    const create = vi.fn();

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({
        comparisonRecord: {
          findFirst,
          create,
        },
      } as never)
    );

    const result = await persistComparisonRecord({
      projectId: 1,
      sourceTicket: {
        id: 1,
        ticketKey: 'AIB-1',
        title: 'Source',
        stage: 'BUILD',
        workflowType: 'FULL',
        agent: null,
      },
      participants: [
        {
          id: 2,
          ticketKey: 'AIB-2',
          title: 'Winner',
          stage: 'VERIFY',
          workflowType: 'FULL',
          agent: null,
        },
      ],
      compareRunKey: 'cmp_existing_run',
      markdownPath: 'specs/feature/comparisons/test.md',
      report: {
        ...report,
        metadata: {
          ...report.metadata,
          comparedTickets: ['AIB-2'],
        },
        compliance: {
          'AIB-2': report.compliance['AIB-2'],
        },
        implementation: {
          'AIB-2': report.implementation['AIB-2'],
        },
      },
    });

    expect(findFirst).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
    expect(result).toEqual({ record: existingRecord, isDuplicate: true });
  });
});
