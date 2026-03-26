import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComparisonReport, ReportDecisionPoint } from '@/lib/types/comparison';
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

const structuredDecisionPoints: ReportDecisionPoint[] = [
  {
    title: 'State Management Strategy',
    winner: 'AIB-2',
    rationale: 'AIB-2 uses TanStack Query with proper cache invalidation',
    approaches: {
      'AIB-2': 'Uses TanStack Query with queryClient.invalidateQueries on mutations',
      'AIB-3': 'Uses useState with manual refetch, no cache invalidation',
    },
  },
  {
    title: 'Error Handling Pattern',
    winner: 'AIB-3',
    rationale: 'AIB-3 uses Zod validation at API boundaries',
    approaches: {
      'AIB-2': 'Basic try-catch with generic 500 responses',
      'AIB-3': 'Zod schemas validate all inputs, typed error union returned',
    },
  },
];

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
        ticketId: 1,
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        durationMs: 30,
        costUsd: 0.5,
        jobCount: 1,
        primaryModel: 'claude-sonnet-4-6',
      })
    ).toEqual({
      inputTokens: { state: 'available', value: 10 },
      outputTokens: { state: 'available', value: 20 },
      totalTokens: { state: 'available', value: 30 },
      durationMs: { state: 'available', value: 30 },
      costUsd: { state: 'available', value: 0.5 },
      jobCount: { state: 'available', value: 1 },
      primaryModel: { state: 'available', value: 'claude-sonnet-4-6' },
    });
  });

  it('uses fallback decision points when report has no structured decisionPoints', () => {
    const input = createComparisonRecordInput({
      projectId: 1,
      sourceTicket: {
        id: 1, ticketKey: 'AIB-1', title: 'Source', stage: 'BUILD', workflowType: 'FULL', agent: null,
      },
      participants: [
        { id: 2, ticketKey: 'AIB-2', title: 'Winner', stage: 'VERIFY', workflowType: 'FULL', agent: null },
        { id: 3, ticketKey: 'AIB-3', title: 'Runner up', stage: 'PLAN', workflowType: 'FULL', agent: null },
      ],
      compareRunKey: 'cmp_fallback',
      markdownPath: 'specs/feature/comparisons/test.md',
      report,
    });

    const decisionPoints = input.decisionPoints?.create;
    expect(Array.isArray(decisionPoints)).toBe(true);
    const points = decisionPoints as Array<Record<string, unknown>>;
    // Fallback uses matchingRequirements as titles
    expect(points[0]?.title).toBe('FR-001');
    // Fallback copies the global recommendation as verdictSummary
    expect(points[0]?.verdictSummary).toBe('Pick AIB-2.');
    // Fallback uses generic "X files changed" summaries
    const approaches = points[0]?.participantApproaches as Array<{ summary: string }>;
    expect(approaches[0]?.summary).toBe('2 files changed');
  });

  it('uses structured decision points when report includes them', () => {
    const reportWithDecisionPoints: ComparisonReport = {
      ...report,
      decisionPoints: structuredDecisionPoints,
    };

    const input = createComparisonRecordInput({
      projectId: 1,
      sourceTicket: {
        id: 1, ticketKey: 'AIB-1', title: 'Source', stage: 'BUILD', workflowType: 'FULL', agent: null,
      },
      participants: [
        { id: 2, ticketKey: 'AIB-2', title: 'Winner', stage: 'VERIFY', workflowType: 'FULL', agent: null },
        { id: 3, ticketKey: 'AIB-3', title: 'Runner up', stage: 'PLAN', workflowType: 'FULL', agent: null },
      ],
      compareRunKey: 'cmp_structured',
      markdownPath: 'specs/feature/comparisons/test.md',
      report: reportWithDecisionPoints,
    });

    const decisionPoints = input.decisionPoints?.create;
    expect(Array.isArray(decisionPoints)).toBe(true);
    const points = decisionPoints as Array<Record<string, unknown>>;
    expect(points).toHaveLength(2);

    // First point: State Management Strategy
    expect(points[0]?.title).toBe('State Management Strategy');
    expect(points[0]?.verdictTicketId).toBe(2); // AIB-2 -> id 2
    expect(points[0]?.rationale).toBe('AIB-2 uses TanStack Query with proper cache invalidation');
    expect(points[0]?.displayOrder).toBe(0);
    const approaches0 = points[0]?.participantApproaches as Array<{ ticketKey: string; summary: string }>;
    expect(approaches0).toHaveLength(2);
    expect(approaches0.find((a) => a.ticketKey === 'AIB-2')?.summary).toBe(
      'Uses TanStack Query with queryClient.invalidateQueries on mutations'
    );
    expect(approaches0.find((a) => a.ticketKey === 'AIB-3')?.summary).toBe(
      'Uses useState with manual refetch, no cache invalidation'
    );

    // Second point: Error Handling Pattern (winner is AIB-3)
    expect(points[1]?.title).toBe('Error Handling Pattern');
    expect(points[1]?.verdictTicketId).toBe(3); // AIB-3 -> id 3
    expect(points[1]?.rationale).toBe('AIB-3 uses Zod validation at API boundaries');
    expect(points[1]?.displayOrder).toBe(1);
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
