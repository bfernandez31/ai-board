import { describe, expect, it } from 'vitest';
import { ComparisonOperationalMetrics } from '@/components/comparison/comparison-operational-metrics';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import type {
  ComparisonDashboardMetricRow,
  ComparisonParticipantDetail,
} from '@/lib/types/comparison';

function makeParticipant(
  overrides: Partial<ComparisonParticipantDetail> & { ticketId: number; ticketKey: string; rank: number }
): ComparisonParticipantDetail {
  return {
    ticketId: overrides.ticketId,
    ticketKey: overrides.ticketKey,
    title: 'Test ticket',
    stage: 'VERIFY',
    workflowType: 'FULL',
    agent: null,
    rank: overrides.rank,
    score: 90,
    scoreBand: overrides.rank === 1 ? 'strong' : 'moderate',
    isWinner: overrides.rank === 1,
    rankRationale: 'Good',
    quality: { state: 'available', value: overrides.rank === 1 ? 87 : 92 },
    qualityBreakdown: { state: 'unavailable', value: null },
    telemetry: {
      inputTokens: { state: 'available', value: overrides.rank === 1 ? 10000 : 8000 },
      outputTokens: { state: 'available', value: overrides.rank === 1 ? 3000 : 2000 },
      totalTokens: { state: 'available', value: overrides.rank === 1 ? 13000 : 10000 },
      durationMs: { state: 'available', value: overrides.rank === 1 ? 154000 : 120000 },
      costUsd: { state: 'available', value: overrides.rank === 1 ? 1.23 : 1.0 },
      jobCount: { state: 'available', value: overrides.rank === 1 ? 2 : 1 },
      primaryModel: { state: 'available', value: 'claude-sonnet-4-6' },
    },
    metrics: {
      linesAdded: 10,
      linesRemoved: 2,
      linesChanged: overrides.rank === 1 ? 12 : 16,
      filesChanged: overrides.rank === 1 ? 2 : 3,
      testFilesChanged: overrides.rank === 1 ? 1 : 0,
      changedFiles: [],
      bestValueFlags: {},
    },
    ...overrides,
  };
}

function makeMetricRows(participants: ComparisonParticipantDetail[]): ComparisonDashboardMetricRow[] {
  return [
    {
      key: 'totalTokens',
      label: 'Total Tokens',
      category: 'detail',
      bestDirection: 'lowest',
      cells: participants.map((participant) => ({
        ticketId: participant.ticketId,
        ticketKey: participant.ticketKey,
        state: participant.telemetry.totalTokens.state,
        value: participant.telemetry.totalTokens.value,
        displayValue: participant.telemetry.totalTokens.value!.toLocaleString(),
        isBest: participant.rank === 2,
        isWinner: participant.isWinner,
        supportsPopover: false,
      })),
    },
    {
      key: 'qualityScore',
      label: 'Quality Score',
      category: 'detail',
      bestDirection: 'highest',
      cells: participants.map((participant) => ({
        ticketId: participant.ticketId,
        ticketKey: participant.ticketKey,
        state: participant.quality.state,
        value: participant.quality.value,
        displayValue: `${participant.quality.value}`,
        isBest: participant.rank === 2,
        isWinner: participant.isWinner,
        supportsPopover: true,
      })),
    },
  ];
}

describe('ComparisonOperationalMetrics', () => {
  it('renders a unified relative matrix with sticky metric labels', () => {
    const participants = [
      makeParticipant({ ticketId: 1, ticketKey: 'AIB-1', rank: 1 }),
      makeParticipant({ ticketId: 2, ticketKey: 'AIB-2', rank: 2 }),
    ];

    renderWithProviders(
      <ComparisonOperationalMetrics
        participants={participants}
        metricRows={makeMetricRows(participants)}
      />
    );

    expect(screen.getByText('Relative Metrics Matrix')).toBeInTheDocument();
    expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    expect(screen.getByText('Quality Score')).toBeInTheDocument();
    expect(screen.getByText('13,000')).toBeInTheDocument();
    expect(screen.getByText('10,000')).toBeInTheDocument();
  });

  it('shows winner and best-value badges without hiding non-winner participants', () => {
    const participants = [
      makeParticipant({ ticketId: 1, ticketKey: 'AIB-1', rank: 1 }),
      makeParticipant({ ticketId: 2, ticketKey: 'AIB-2', rank: 2 }),
    ];

    renderWithProviders(
      <ComparisonOperationalMetrics
        participants={participants}
        metricRows={makeMetricRows(participants)}
      />
    );

    expect(screen.getAllByText('Winner')).toHaveLength(2);
    expect(screen.getAllByText('Best')).toHaveLength(2);
    expect(screen.getByText('AIB-1')).toBeInTheDocument();
    expect(screen.getByText('AIB-2')).toBeInTheDocument();
  });
});
