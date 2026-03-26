import { describe, expect, it } from 'vitest';
import {
  buildOperationalMetricRows,
  determineBestValues,
  METRIC_DEFINITIONS,
} from '@/lib/comparison/operational-metrics';
import type { ComparisonParticipantDetail } from '@/lib/types/comparison';

function createParticipant(
  overrides: Partial<ComparisonParticipantDetail> & { ticketId: number }
): ComparisonParticipantDetail {
  return {
    ticketKey: `AIB-${overrides.ticketId}`,
    title: `Ticket ${overrides.ticketId}`,
    stage: 'VERIFY' as const,
    workflowType: 'FULL' as const,
    agent: null,
    rank: 1,
    score: 80,
    rankRationale: 'Test',
    quality: { state: 'unavailable' as const, value: null },
    telemetry: {
      inputTokens: { state: 'unavailable' as const, value: null },
      outputTokens: { state: 'unavailable' as const, value: null },
      durationMs: { state: 'unavailable' as const, value: null },
      costUsd: { state: 'unavailable' as const, value: null },
    },
    metrics: {
      linesAdded: null,
      linesRemoved: null,
      linesChanged: null,
      filesChanged: null,
      testFilesChanged: null,
      changedFiles: [],
      bestValueFlags: {},
    },
    aggregatedTelemetry: null,
    qualityDetails: null,
    ...overrides,
  };
}

describe('determineBestValues', () => {
  it('returns the index with the lowest value for direction=lowest', () => {
    const result = determineBestValues(
      [
        { index: 0, value: 100 },
        { index: 1, value: 50 },
        { index: 2, value: 200 },
      ],
      'lowest'
    );
    expect(result).toEqual(new Set([1]));
  });

  it('returns the index with the highest value for direction=highest', () => {
    const result = determineBestValues(
      [
        { index: 0, value: 70 },
        { index: 1, value: 90 },
        { index: 2, value: 80 },
      ],
      'highest'
    );
    expect(result).toEqual(new Set([1]));
  });

  it('returns all tied indices', () => {
    const result = determineBestValues(
      [
        { index: 0, value: 50 },
        { index: 1, value: 50 },
        { index: 2, value: 100 },
      ],
      'lowest'
    );
    expect(result).toEqual(new Set([0, 1]));
  });

  it('ignores null values', () => {
    const result = determineBestValues(
      [
        { index: 0, value: null },
        { index: 1, value: 100 },
        { index: 2, value: 50 },
      ],
      'lowest'
    );
    expect(result).toEqual(new Set([2]));
  });

  it('returns empty set when all values are null', () => {
    const result = determineBestValues(
      [
        { index: 0, value: null },
        { index: 1, value: null },
      ],
      'lowest'
    );
    expect(result).toEqual(new Set());
  });
});

describe('METRIC_DEFINITIONS', () => {
  it('defines 7 metrics', () => {
    expect(METRIC_DEFINITIONS).toHaveLength(7);
  });

  it('formats tokens with locale separators', () => {
    const tokenDef = METRIC_DEFINITIONS.find((d) => d.key === 'totalTokens');
    expect(tokenDef!.format(12450)).toBe('12,450');
  });

  it('formats cost as $X.XXXX', () => {
    const costDef = METRIC_DEFINITIONS.find((d) => d.key === 'costUsd');
    expect(costDef!.format(0.85)).toBe('$0.8500');
  });

  it('formats duration via formatDurationMs', () => {
    const durationDef = METRIC_DEFINITIONS.find((d) => d.key === 'durationMs');
    expect(durationDef!.format(154000)).toBe('2m 34s');
  });

  it('formats quality score with threshold label', () => {
    const qualityDef = METRIC_DEFINITIONS.find((d) => d.key === 'qualityScore');
    expect(qualityDef!.format(87)).toBe('87 Good');
    expect(qualityDef!.format(95)).toBe('95 Excellent');
    expect(qualityDef!.format(55)).toBe('55 Fair');
    expect(qualityDef!.format(30)).toBe('30 Poor');
  });

  it('formats job count as plain integer', () => {
    const jobDef = METRIC_DEFINITIONS.find((d) => d.key === 'jobCount');
    expect(jobDef!.format(3)).toBe('3');
  });
});

describe('buildOperationalMetricRows', () => {
  it('returns 7 rows with correct labels', () => {
    const participants = [
      createParticipant({
        ticketId: 1,
        aggregatedTelemetry: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          costUsd: 0.05,
          durationMs: 60000,
          jobCount: 2,
          model: 'claude-3',
          hasData: true,
        },
      }),
    ];
    const rows = buildOperationalMetricRows(participants);
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.definition.label)).toEqual([
      'Total Tokens',
      'Input Tokens',
      'Output Tokens',
      'Duration',
      'Cost',
      'Job Count',
      'Quality Score',
    ]);
  });

  it('shows N/A state for participants with no telemetry', () => {
    const participants = [
      createParticipant({ ticketId: 1, aggregatedTelemetry: null }),
    ];
    const rows = buildOperationalMetricRows(participants);
    for (const row of rows.slice(0, 6)) {
      expect(row.cells[0]!.state).toBe('unavailable');
      expect(row.cells[0]!.formattedValue).toBeNull();
    }
  });

  it('shows pending state for participants with in-progress jobs', () => {
    const participants = [
      createParticipant({
        ticketId: 1,
        aggregatedTelemetry: null,
        telemetry: {
          inputTokens: { state: 'pending' as const, value: null },
          outputTokens: { state: 'pending' as const, value: null },
          durationMs: { state: 'pending' as const, value: null },
          costUsd: { state: 'pending' as const, value: null },
        },
      }),
    ];
    const rows = buildOperationalMetricRows(participants);
    // Telemetry metrics should be pending
    expect(rows[0]!.cells[0]!.state).toBe('pending');
  });

  it('highlights best values correctly across two participants', () => {
    const participants = [
      createParticipant({
        ticketId: 1,
        aggregatedTelemetry: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          costUsd: 0.05,
          durationMs: 60000,
          jobCount: 2,
          model: 'claude-3',
          hasData: true,
        },
        quality: { state: 'available' as const, value: 87 },
      }),
      createParticipant({
        ticketId: 2,
        aggregatedTelemetry: {
          inputTokens: 2000,
          outputTokens: 1000,
          totalTokens: 3000,
          costUsd: 0.10,
          durationMs: 120000,
          jobCount: 3,
          model: 'claude-3',
          hasData: true,
        },
        quality: { state: 'available' as const, value: 92 },
      }),
    ];
    const rows = buildOperationalMetricRows(participants);

    // Ticket 1 should be best for tokens/cost/duration/jobCount (lowest)
    const totalTokensRow = rows.find((r) => r.definition.key === 'totalTokens');
    expect(totalTokensRow!.cells[0]!.isBest).toBe(true);
    expect(totalTokensRow!.cells[1]!.isBest).toBe(false);

    // Ticket 2 should be best for quality (highest)
    const qualityRow = rows.find((r) => r.definition.key === 'qualityScore');
    expect(qualityRow!.cells[0]!.isBest).toBe(false);
    expect(qualityRow!.cells[1]!.isBest).toBe(true);
  });

  it('handles ties: both get best flag', () => {
    const participants = [
      createParticipant({
        ticketId: 1,
        aggregatedTelemetry: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          costUsd: 0.05,
          durationMs: 60000,
          jobCount: 2,
          model: 'claude-3',
          hasData: true,
        },
      }),
      createParticipant({
        ticketId: 2,
        aggregatedTelemetry: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          costUsd: 0.05,
          durationMs: 60000,
          jobCount: 2,
          model: 'claude-3',
          hasData: true,
        },
      }),
    ];
    const rows = buildOperationalMetricRows(participants);
    const totalTokensRow = rows.find((r) => r.definition.key === 'totalTokens');
    expect(totalTokensRow!.cells[0]!.isBest).toBe(true);
    expect(totalTokensRow!.cells[1]!.isBest).toBe(true);
  });
});
