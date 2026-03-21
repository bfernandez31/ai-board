import { describe, expect, it } from 'vitest';
import { ComparisonRanking } from '@/components/comparison/comparison-ranking';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import type { ComparisonParticipantDetail } from '@/lib/types/comparison';

function createParticipant(
  overrides: Partial<ComparisonParticipantDetail> = {}
): ComparisonParticipantDetail {
  return {
    ticketId: 1,
    ticketKey: 'AIB-1',
    title: 'Test ticket',
    stage: 'VERIFY',
    workflowType: 'FULL',
    agent: null,
    rank: 1,
    score: 90,
    rankRationale: 'Good implementation',
    quality: { state: 'available', value: 87 },
    qualityScoreDetails: null,
    telemetry: {
      inputTokens: { state: 'available', value: 1000 },
      outputTokens: { state: 'available', value: 500 },
      totalTokens: { state: 'available', value: 1500 },
      durationMs: { state: 'available', value: 60000 },
      costUsd: { state: 'available', value: 0.05 },
      jobCount: { state: 'available', value: 2 },
      hasPartialData: false,
    },
    metrics: {
      linesAdded: 10,
      linesRemoved: 2,
      linesChanged: 12,
      filesChanged: 2,
      testFilesChanged: 1,
      changedFiles: [],
      bestValueFlags: {},
    },
    model: null,
    ...overrides,
  };
}

const defaultProps = {
  recommendation: 'Use AIB-1.',
  summary: 'AIB-1 was better.',
  winnerTicketId: 1,
  keyDifferentiators: [],
};

describe('ComparisonRanking badges', () => {
  it('renders workflow type badge on each card', () => {
    const participants = [
      createParticipant({ ticketId: 1, ticketKey: 'AIB-1', workflowType: 'FULL', rank: 1 }),
      createParticipant({ ticketId: 2, ticketKey: 'AIB-2', workflowType: 'QUICK', rank: 2 }),
      createParticipant({ ticketId: 3, ticketKey: 'AIB-3', workflowType: 'CLEAN', rank: 3 }),
    ];

    renderWithProviders(
      <ComparisonRanking participants={participants} {...defaultProps} />
    );

    expect(screen.getByText('FULL')).toBeInTheDocument();
    expect(screen.getByText('QUICK')).toBeInTheDocument();
    expect(screen.getByText('CLEAN')).toBeInTheDocument();
  });

  it('renders agent badge when agent is present, omits when null', () => {
    const participants = [
      createParticipant({ ticketId: 1, ticketKey: 'AIB-1', agent: 'CLAUDE', rank: 1 }),
      createParticipant({ ticketId: 2, ticketKey: 'AIB-2', agent: null, rank: 2 }),
    ];

    renderWithProviders(
      <ComparisonRanking participants={participants} {...defaultProps} />
    );

    expect(screen.getByText('CLAUDE')).toBeInTheDocument();
    // Only one agent badge should exist
    expect(screen.queryAllByText('CLAUDE')).toHaveLength(1);
  });

  it('renders quality badge with score and threshold, omits when unavailable', () => {
    const participants = [
      createParticipant({
        ticketId: 1,
        ticketKey: 'AIB-1',
        quality: { state: 'available', value: 87 },
        rank: 1,
      }),
      createParticipant({
        ticketId: 2,
        ticketKey: 'AIB-2',
        quality: { state: 'unavailable', value: null },
        rank: 2,
      }),
    ];

    renderWithProviders(
      <ComparisonRanking participants={participants} {...defaultProps} />
    );

    expect(screen.getByText('87 Good')).toBeInTheDocument();
    // No quality badge for unavailable
    expect(screen.queryByText(/Poor|Fair|Excellent/, { selector: '[data-testid^="quality-badge"]' })).not.toBeInTheDocument();
  });
});
