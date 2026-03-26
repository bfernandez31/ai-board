import { describe, expect, it } from 'vitest';
import {
  aggregateParticipantOperationalMetrics,
  deriveComparisonQualitySummary,
  selectBestValueTicketIds,
  selectPrimaryModel,
} from '@/lib/comparison/comparison-detail';

function createJob(overrides: Partial<Parameters<typeof aggregateParticipantOperationalMetrics>[0][number]> = {}) {
  return {
    ticketId: 1,
    command: 'implement',
    status: 'COMPLETED',
    inputTokens: 100,
    outputTokens: 40,
    durationMs: 1500,
    costUsd: 0.12,
    model: 'gpt-5.4',
    qualityScore: null,
    qualityScoreDetails: null,
    startedAt: new Date('2026-03-20T10:00:00.000Z'),
    completedAt: new Date('2026-03-20T10:01:00.000Z'),
    ...overrides,
  };
}

describe('comparison-detail operational aggregation', () => {
  it('aggregates totals across all jobs and chooses the primary model by token share', () => {
    const aggregate = aggregateParticipantOperationalMetrics([
      createJob({
        model: 'gpt-5.4',
        inputTokens: 300,
        outputTokens: 120,
        durationMs: 2000,
        costUsd: 0.24,
      }),
      createJob({
        model: 'gpt-5.4-mini',
        inputTokens: 100,
        outputTokens: 50,
        durationMs: 500,
        costUsd: 0.03,
        startedAt: new Date('2026-03-20T11:00:00.000Z'),
        completedAt: new Date('2026-03-20T11:02:00.000Z'),
      }),
    ]);

    expect(aggregate.totalTokens).toEqual({ state: 'available', value: 570 });
    expect(aggregate.inputTokens).toEqual({ state: 'available', value: 400 });
    expect(aggregate.outputTokens).toEqual({ state: 'available', value: 170 });
    expect(aggregate.durationMs).toEqual({ state: 'available', value: 2500 });
    expect(aggregate.costUsd).toEqual({ state: 'available', value: 0.27 });
    expect(aggregate.jobCount).toEqual({ state: 'available', value: 2 });
    expect(aggregate.primaryModel).toBe('gpt-5.4');
  });

  it('marks metrics pending when any related job telemetry is incomplete and unavailable when no jobs exist', () => {
    expect(
      aggregateParticipantOperationalMetrics([
        createJob({ inputTokens: null, outputTokens: null, durationMs: null, costUsd: null }),
      ])
    ).toMatchObject({
      totalTokens: { state: 'pending', value: null },
      inputTokens: { state: 'pending', value: null },
      outputTokens: { state: 'pending', value: null },
      durationMs: { state: 'pending', value: null },
      costUsd: { state: 'pending', value: null },
      jobCount: { state: 'available', value: 1 },
    });

    expect(aggregateParticipantOperationalMetrics([])).toMatchObject({
      totalTokens: { state: 'unavailable', value: null },
      inputTokens: { state: 'unavailable', value: null },
      outputTokens: { state: 'unavailable', value: null },
      durationMs: { state: 'unavailable', value: null },
      costUsd: { state: 'unavailable', value: null },
      jobCount: { state: 'unavailable', value: null },
      primaryModel: null,
    });
  });

  it('selects best values for lowest metrics and highest quality scores, ignoring pending values', () => {
    expect(
      selectBestValueTicketIds(
        [
          { ticketId: 1, state: 'available', value: 120 },
          { ticketId: 2, state: 'available', value: 120 },
          { ticketId: 3, state: 'pending', value: null },
          { ticketId: 4, state: 'available', value: 180 },
        ],
        'lowest'
      )
    ).toEqual([1, 2]);

    expect(
      selectBestValueTicketIds(
        [
          { ticketId: 1, state: 'available', value: 82 },
          { ticketId: 2, state: 'unavailable', value: null },
          { ticketId: 3, state: 'available', value: 91 },
        ],
        'highest'
      )
    ).toEqual([3]);
  });

  it('breaks primary-model ties by the most recent completed contributing job', () => {
    expect(
      selectPrimaryModel([
        createJob({
          model: 'gpt-5.4',
          inputTokens: 100,
          outputTokens: 50,
          completedAt: new Date('2026-03-20T10:10:00.000Z'),
        }),
        createJob({
          model: 'gpt-5.4-mini',
          inputTokens: 90,
          outputTokens: 60,
          completedAt: new Date('2026-03-20T10:20:00.000Z'),
        }),
      ])
    ).toBe('gpt-5.4-mini');
  });
});

describe('comparison-detail quality eligibility', () => {
  const validQualityDetails = JSON.stringify({
    dimensions: [
      { name: 'Compliance', agentId: 'compliance', score: 92, weight: 0.4, weightedScore: 36.8 },
      { name: 'Bug Detection', agentId: 'bug-detection', score: 88, weight: 0.3, weightedScore: 26.4 },
      { name: 'Code Comments', agentId: 'code-comments', score: 76, weight: 0.2, weightedScore: 15.2 },
      { name: 'Historical Context', agentId: 'historical-context', score: 80, weight: 0.1, weightedScore: 8 },
      { name: 'Spec Sync', agentId: 'spec-sync', score: 100, weight: 0, weightedScore: 0 },
    ],
    threshold: 'Excellent',
    computedAt: '2026-03-20T10:30:00.000Z',
  });

  it('returns an eligible five-dimension quality breakdown only for FULL workflow completed verify results', () => {
    const quality = deriveComparisonQualitySummary('FULL', [
      createJob({
        command: 'verify',
        qualityScore: 91,
        qualityScoreDetails: validQualityDetails,
      }),
    ]);

    expect(quality.score).toEqual({ state: 'available', value: 91 });
    expect(quality.thresholdLabel).toBe('Excellent');
    expect(quality.detailAvailable).toBe(true);
    expect(quality.breakdown?.dimensions).toHaveLength(5);
  });

  it('keeps quality summary but disables inline details for ineligible workflows or incomplete dimensions', () => {
    expect(
      deriveComparisonQualitySummary('QUICK', [
        createJob({
          command: 'verify',
          qualityScore: 74,
          qualityScoreDetails: validQualityDetails,
        }),
      ])
    ).toMatchObject({
      score: { state: 'available', value: 74 },
      thresholdLabel: 'Good',
      detailAvailable: false,
      breakdown: null,
    });

    expect(
      deriveComparisonQualitySummary('FULL', [
        createJob({
          command: 'verify',
          qualityScore: 74,
          qualityScoreDetails: JSON.stringify({
            dimensions: [{ name: 'Compliance', agentId: 'compliance', score: 74, weight: 0.4 }],
            threshold: 'Good',
            computedAt: '2026-03-20T10:30:00.000Z',
          }),
        }),
      ])
    ).toMatchObject({
      score: { state: 'available', value: 74 },
      thresholdLabel: 'Good',
      detailAvailable: false,
      breakdown: null,
    });
  });

  it('returns pending or unavailable quality states when verify results are incomplete or absent', () => {
    expect(
      deriveComparisonQualitySummary('FULL', [
        createJob({ command: 'verify', status: 'RUNNING', qualityScore: null }),
      ])
    ).toMatchObject({
      score: { state: 'pending', value: null },
      thresholdLabel: null,
      detailAvailable: false,
      breakdown: null,
    });

    expect(deriveComparisonQualitySummary('FULL', [])).toMatchObject({
      score: { state: 'unavailable', value: null },
      thresholdLabel: null,
      detailAvailable: false,
      breakdown: null,
    });
  });
});
