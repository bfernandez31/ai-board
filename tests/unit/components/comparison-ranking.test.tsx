import { describe, expect, it } from 'vitest';
import { ComparisonRanking } from '@/components/comparison/comparison-ranking';
import type { ComparisonDashboardMetricRow, ComparisonParticipantDetail } from '@/lib/types/comparison';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';

function makeParticipant(
  overrides: Partial<ComparisonParticipantDetail> & { ticketId: number; ticketKey: string; rank: number }
): ComparisonParticipantDetail {
  return {
    ticketId: overrides.ticketId,
    ticketKey: overrides.ticketKey,
    title: `Ticket ${overrides.ticketKey}`,
    stage: 'VERIFY',
    workflowType: 'FULL',
    agent: null,
    rank: overrides.rank,
    score: 92 - overrides.rank * 6,
    scoreBand: overrides.rank === 1 ? 'strong' : overrides.rank < 4 ? 'moderate' : 'weak',
    isWinner: overrides.rank === 1,
    rankRationale: `Rationale for ${overrides.ticketKey}`,
    quality: { state: 'available', value: 92 - overrides.rank * 5 },
    qualityBreakdown: { state: 'unavailable', value: null },
    telemetry: {
      inputTokens: { state: 'available', value: 1000 + overrides.rank * 100 },
      outputTokens: { state: 'available', value: 400 + overrides.rank * 50 },
      totalTokens: { state: 'available', value: 1400 + overrides.rank * 150 },
      durationMs: { state: 'available', value: 90000 + overrides.rank * 10000 },
      costUsd: { state: 'available', value: 0.1 + overrides.rank * 0.02 },
      jobCount: { state: 'available', value: overrides.rank },
      primaryModel: { state: 'available', value: 'claude-sonnet-4-6' },
    },
    metrics: {
      linesAdded: 10,
      linesRemoved: 2,
      linesChanged: 12 + overrides.rank,
      filesChanged: overrides.rank,
      testFilesChanged: overrides.rank === 1 ? 2 : 1,
      changedFiles: [],
      bestValueFlags: {
        filesChanged: overrides.rank === 1,
      },
    },
    ...overrides,
  };
}

function makeHeadlineMetrics(participants: ComparisonParticipantDetail[]): ComparisonDashboardMetricRow[] {
  return [
    {
      key: 'costUsd',
      label: 'Cost',
      category: 'headline',
      bestDirection: 'lowest',
      cells: participants.map((participant) => ({
        ticketId: participant.ticketId,
        ticketKey: participant.ticketKey,
        state: 'available',
        value: participant.telemetry.costUsd.value,
        displayValue: `$${participant.telemetry.costUsd.value?.toFixed(2)}`,
        isBest: participant.rank === 1,
        isWinner: participant.isWinner,
        supportsPopover: false,
      })),
    },
    {
      key: 'durationMs',
      label: 'Duration',
      category: 'headline',
      bestDirection: 'lowest',
      cells: participants.map((participant) => ({
        ticketId: participant.ticketId,
        ticketKey: participant.ticketKey,
        state: 'available',
        value: participant.telemetry.durationMs.value,
        displayValue: '1m 30s',
        isBest: participant.rank === 1,
        isWinner: participant.isWinner,
        supportsPopover: false,
      })),
    },
    {
      key: 'qualityScore',
      label: 'Quality Score',
      category: 'headline',
      bestDirection: 'highest',
      cells: participants.map((participant) => ({
        ticketId: participant.ticketId,
        ticketKey: participant.ticketKey,
        state: 'available',
        value: participant.quality.value,
        displayValue: `${participant.quality.value}`,
        isBest: participant.rank === 1,
        isWinner: participant.isWinner,
        supportsPopover: true,
      })),
    },
    {
      key: 'filesChanged',
      label: 'Files Changed',
      category: 'headline',
      bestDirection: 'lowest',
      cells: participants.map((participant) => ({
        ticketId: participant.ticketId,
        ticketKey: participant.ticketKey,
        state: 'available',
        value: participant.metrics.filesChanged,
        displayValue: `${participant.metrics.filesChanged}`,
        isBest: participant.rank === 1,
        isWinner: participant.isWinner,
        supportsPopover: false,
      })),
    },
  ];
}

describe('ComparisonRanking', () => {
  it('renders the winner hero with absorbed metadata and headline metrics', () => {
    const participants = [makeParticipant({ ticketId: 1, ticketKey: 'AIB-1', rank: 1 }), makeParticipant({ ticketId: 2, ticketKey: 'AIB-2', rank: 2 })];

    renderWithProviders(
      <ComparisonRanking
        participants={participants}
        recommendation="Use AIB-1."
        summary="AIB-1 had the strongest outcome."
        winnerTicketId={1}
        keyDifferentiators={['coverage', 'smaller diff']}
        generatedAt="2026-03-20T09:00:00.000Z"
        sourceTicketKey="AIB-100"
        winnerTicketKey="AIB-1"
        headlineMetrics={makeHeadlineMetrics(participants)}
      />
    );

    expect(screen.getByText('Use AIB-1.')).toBeInTheDocument();
    expect(screen.getByText('Comparison context')).toBeInTheDocument();
    expect(screen.getByText(/Generated/)).toBeInTheDocument();
    expect(screen.getByText('Source AIB-100')).toBeInTheDocument();
    expect(screen.getByText('Selected winner AIB-1')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Quality Score')).toBeInTheDocument();
    expect(screen.getByText('coverage')).toBeInTheDocument();
  });

  it('renders ranked non-winner cards for a six-participant comparison', () => {
    const participants = Array.from({ length: 6 }, (_, index) =>
      makeParticipant({
        ticketId: index + 1,
        ticketKey: `AIB-${index + 1}`,
        rank: index + 1,
        workflowType: index % 2 === 0 ? 'FULL' : 'QUICK',
      })
    );

    renderWithProviders(
      <ComparisonRanking
        participants={participants}
        recommendation="Use AIB-1."
        summary="Summary"
        winnerTicketId={1}
        keyDifferentiators={[]}
        generatedAt="2026-03-20T09:00:00.000Z"
        sourceTicketKey="AIB-100"
        winnerTicketKey="AIB-1"
        headlineMetrics={makeHeadlineMetrics(participants)}
      />
    );

    expect(screen.getByText('AIB-2')).toBeInTheDocument();
    expect(screen.getByText('AIB-6')).toBeInTheDocument();
    expect(screen.getAllByText(/^#2$/)).toHaveLength(1);
    expect(screen.getAllByText(/^#6$/)).toHaveLength(1);
    expect(screen.getAllByText('moderate').length).toBeGreaterThan(0);
    expect(screen.getAllByText('weak').length).toBeGreaterThan(0);
  });
});
