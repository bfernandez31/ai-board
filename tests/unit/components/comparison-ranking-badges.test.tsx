import { describe, expect, it } from 'vitest';
import { ComparisonRanking } from '@/components/comparison/comparison-ranking';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
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
    rankRationale: 'Test rationale',
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

const defaultProps = {
  recommendation: 'Use AIB-1.',
  summary: 'Summary text',
  winnerTicketId: 1,
  keyDifferentiators: [],
};

describe('ComparisonRanking badges', () => {
  it('always shows workflow type badge', () => {
    const participants = [
      createParticipant({ ticketId: 1, workflowType: 'FULL' as const }),
    ];

    renderWithProviders(
      <ComparisonRanking {...defaultProps} participants={participants} />
    );

    expect(screen.getByTestId('workflow-badge-1')).toHaveTextContent('FULL');
  });

  it('shows agent badge when agent is non-null', () => {
    const participants = [
      createParticipant({ ticketId: 1, agent: 'Claude' as const }),
    ];

    renderWithProviders(
      <ComparisonRanking {...defaultProps} participants={participants} />
    );

    expect(screen.getByTestId('agent-badge-1')).toHaveTextContent('Claude');
  });

  it('does not show agent badge when agent is null', () => {
    const participants = [
      createParticipant({ ticketId: 1, agent: null }),
    ];

    renderWithProviders(
      <ComparisonRanking {...defaultProps} participants={participants} />
    );

    expect(screen.queryByTestId('agent-badge-1')).not.toBeInTheDocument();
  });

  it('shows quality score badge with threshold label when quality is available', () => {
    const participants = [
      createParticipant({
        ticketId: 1,
        quality: { state: 'available' as const, value: 87 },
      }),
    ];

    renderWithProviders(
      <ComparisonRanking {...defaultProps} participants={participants} />
    );

    expect(screen.getByTestId('quality-badge-1')).toHaveTextContent('87 Good');
  });

  it('does not show quality badge for QUICK ticket without quality score', () => {
    const participants = [
      createParticipant({
        ticketId: 1,
        workflowType: 'QUICK' as const,
        quality: { state: 'unavailable' as const, value: null },
      }),
    ];

    renderWithProviders(
      <ComparisonRanking {...defaultProps} participants={participants} />
    );

    expect(screen.queryByTestId('quality-badge-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('workflow-badge-1')).toHaveTextContent('QUICK');
  });
});
