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

  it('uses structured decisionPoints when present', () => {
    const structuredReport: ComparisonReport = {
      ...report,
      decisionPoints: [
        {
          title: 'State management approach',
          verdictTicketKey: 'AIB-2',
          verdictSummary: 'AIB-2 uses React context properly',
          rationale: 'Simpler and more maintainable state management',
          approaches: [
            { ticketKey: 'AIB-2', summary: 'React context with useReducer' },
            { ticketKey: 'AIB-3', summary: 'Custom pub-sub event bus' },
          ],
        },
        {
          title: 'Error handling',
          verdictTicketKey: 'AIB-3',
          verdictSummary: 'AIB-3 has better error boundaries',
          rationale: 'Comprehensive try-catch with structured responses',
          approaches: [
            { ticketKey: 'AIB-2', summary: 'Basic try-catch' },
            { ticketKey: 'AIB-3', summary: 'Middleware error handler' },
          ],
        },
      ],
    };

    const input = createComparisonRecordInput({
      projectId: 1,
      sourceTicket: {
        id: 1, ticketKey: 'AIB-1', title: 'Source',
        stage: 'BUILD', workflowType: 'FULL', agent: null,
      },
      participants: [
        { id: 2, ticketKey: 'AIB-2', title: 'Winner', stage: 'VERIFY', workflowType: 'FULL', agent: null },
        { id: 3, ticketKey: 'AIB-3', title: 'Runner up', stage: 'PLAN', workflowType: 'FULL', agent: null },
      ],
      compareRunKey: 'cmp_structured',
      markdownPath: 'specs/feature/comparisons/test.md',
      report: structuredReport,
    });

    const decisionPoints = input.decisionPoints?.create;
    expect(Array.isArray(decisionPoints)).toBe(true);
    const dps = decisionPoints as Array<Record<string, unknown>>;
    expect(dps).toHaveLength(2);
    expect(dps[0]).toMatchObject({
      title: 'State management approach',
      verdictTicketId: 2,
      verdictSummary: 'AIB-2 uses React context properly',
      rationale: 'Simpler and more maintainable state management',
      displayOrder: 0,
    });
    expect(dps[1]).toMatchObject({
      title: 'Error handling',
      verdictTicketId: 3,
      verdictSummary: 'AIB-3 has better error boundaries',
      displayOrder: 1,
    });
    // Each decision point has its own per-ticket approaches
    const approaches0 = dps[0].participantApproaches as Array<Record<string, unknown>>;
    expect(approaches0).toHaveLength(2);
    expect(approaches0[0]).toMatchObject({ ticketKey: 'AIB-2', summary: 'React context with useReducer' });
    expect(approaches0[1]).toMatchObject({ ticketKey: 'AIB-3', summary: 'Custom pub-sub event bus' });
  });

  it('falls back to matchingRequirements when decisionPoints is absent', () => {
    const input = createComparisonRecordInput({
      projectId: 1,
      sourceTicket: {
        id: 1, ticketKey: 'AIB-1', title: 'Source',
        stage: 'BUILD', workflowType: 'FULL', agent: null,
      },
      participants: [
        { id: 2, ticketKey: 'AIB-2', title: 'Winner', stage: 'VERIFY', workflowType: 'FULL', agent: null },
        { id: 3, ticketKey: 'AIB-3', title: 'Runner up', stage: 'PLAN', workflowType: 'FULL', agent: null },
      ],
      compareRunKey: 'cmp_fallback',
      markdownPath: 'specs/feature/comparisons/test.md',
      report, // no decisionPoints
    });

    const decisionPoints = input.decisionPoints?.create;
    expect(Array.isArray(decisionPoints)).toBe(true);
    const dps = decisionPoints as Array<Record<string, unknown>>;
    expect(dps).toHaveLength(1); // matchingRequirements has ['FR-001']
    expect(dps[0].title).toBe('FR-001');
    // Fallback uses global winner for all decision points
    expect(dps[0].verdictTicketId).toBe(2); // AIB-2 has higher compliance
  });

  it('falls back when decisionPoints is empty array', () => {
    const input = createComparisonRecordInput({
      projectId: 1,
      sourceTicket: {
        id: 1, ticketKey: 'AIB-1', title: 'Source',
        stage: 'BUILD', workflowType: 'FULL', agent: null,
      },
      participants: [
        { id: 2, ticketKey: 'AIB-2', title: 'Winner', stage: 'VERIFY', workflowType: 'FULL', agent: null },
        { id: 3, ticketKey: 'AIB-3', title: 'Runner up', stage: 'PLAN', workflowType: 'FULL', agent: null },
      ],
      compareRunKey: 'cmp_empty_dp',
      markdownPath: 'specs/feature/comparisons/test.md',
      report: { ...report, decisionPoints: [] },
    });

    const decisionPoints = input.decisionPoints?.create;
    expect(Array.isArray(decisionPoints)).toBe(true);
    const dps = decisionPoints as Array<Record<string, unknown>>;
    expect(dps[0].title).toBe('FR-001');
  });

  it('handles null verdictTicketKey in structured decision points', () => {
    const input = createComparisonRecordInput({
      projectId: 1,
      sourceTicket: {
        id: 1, ticketKey: 'AIB-1', title: 'Source',
        stage: 'BUILD', workflowType: 'FULL', agent: null,
      },
      participants: [
        { id: 2, ticketKey: 'AIB-2', title: 'Winner', stage: 'VERIFY', workflowType: 'FULL', agent: null },
      ],
      compareRunKey: 'cmp_null_verdict',
      markdownPath: 'specs/feature/comparisons/test.md',
      report: {
        ...report,
        metadata: { ...report.metadata, comparedTickets: ['AIB-2'] },
        compliance: { 'AIB-2': report.compliance['AIB-2'] },
        implementation: { 'AIB-2': report.implementation['AIB-2'] },
        decisionPoints: [
          {
            title: 'Tied decision',
            verdictTicketKey: null,
            verdictSummary: 'Both equally good',
            rationale: 'No clear winner',
            approaches: [{ ticketKey: 'AIB-2', summary: 'Approach A' }],
          },
        ],
      },
    });

    const dps = input.decisionPoints?.create as Array<Record<string, unknown>>;
    expect(dps[0].verdictTicketId).toBeNull();
  });

  it('skips invalid ticketKey references in approaches', () => {
    const input = createComparisonRecordInput({
      projectId: 1,
      sourceTicket: {
        id: 1, ticketKey: 'AIB-1', title: 'Source',
        stage: 'BUILD', workflowType: 'FULL', agent: null,
      },
      participants: [
        { id: 2, ticketKey: 'AIB-2', title: 'Winner', stage: 'VERIFY', workflowType: 'FULL', agent: null },
      ],
      compareRunKey: 'cmp_invalid_key',
      markdownPath: 'specs/feature/comparisons/test.md',
      report: {
        ...report,
        metadata: { ...report.metadata, comparedTickets: ['AIB-2'] },
        compliance: { 'AIB-2': report.compliance['AIB-2'] },
        implementation: { 'AIB-2': report.implementation['AIB-2'] },
        decisionPoints: [
          {
            title: 'Test',
            verdictTicketKey: 'AIB-2',
            verdictSummary: 'AIB-2 wins',
            rationale: 'Better',
            approaches: [
              { ticketKey: 'AIB-2', summary: 'Valid approach' },
              { ticketKey: 'AIB-999', summary: 'Invalid ticket key — should be skipped' },
            ],
          },
        ],
      },
    });

    const dps = input.decisionPoints?.create as Array<Record<string, unknown>>;
    const approaches = dps[0].participantApproaches as Array<Record<string, unknown>>;
    expect(approaches).toHaveLength(1);
    expect(approaches[0].ticketKey).toBe('AIB-2');
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
