import { describe, expect, it } from 'vitest';
import { ComparisonParticipantGrid } from '@/components/comparison/comparison-participant-grid';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import type { ComparisonParticipantDetail } from '@/lib/types/comparison';

function makeParticipant(overrides?: Partial<ComparisonParticipantDetail>): ComparisonParticipantDetail {
  return {
    ticketId: 2,
    ticketKey: 'AIB-102',
    title: 'Runner up ticket',
    stage: 'VERIFY' as const,
    workflowType: 'FULL' as const,
    agent: null,
    rank: 2,
    score: 75,
    rankRationale: 'Good but more churn',
    quality: { state: 'available', value: 72 },
    qualityBreakdown: { state: 'unavailable', value: null },
    telemetry: {
      inputTokens: { state: 'available', value: 6000 },
      outputTokens: { state: 'available', value: 4000 },
      totalTokens: { state: 'available', value: 10000 },
      durationMs: { state: 'available', value: 200000 },
      costUsd: { state: 'available', value: 2.50 },
      jobCount: { state: 'available', value: 3 },
      primaryModel: { state: 'available', value: 'claude-sonnet-4-6' },
    },
    metrics: {
      linesAdded: 200,
      linesRemoved: 50,
      linesChanged: 250,
      filesChanged: 12,
      testFilesChanged: 4,
      changedFiles: [],
      bestValueFlags: {},
    },
    ...overrides,
  };
}

describe('ComparisonParticipantGrid', () => {
  it('renders correct number of participant cards', () => {
    const participants = [
      makeParticipant({ ticketId: 2, ticketKey: 'AIB-102', rank: 2 }),
      makeParticipant({ ticketId: 3, ticketKey: 'AIB-103', rank: 3 }),
    ];

    renderWithProviders(<ComparisonParticipantGrid participants={participants} />);

    expect(screen.getByText('AIB-102')).toBeInTheDocument();
    expect(screen.getByText('AIB-103')).toBeInTheDocument();
  });

  it('shows rank, ticket key, and title for each card', () => {
    const participants = [
      makeParticipant({ ticketId: 2, ticketKey: 'AIB-102', rank: 2, title: 'Second place' }),
    ];

    renderWithProviders(<ComparisonParticipantGrid participants={participants} />);

    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('AIB-102')).toBeInTheDocument();
    expect(screen.getByText('Second place')).toBeInTheDocument();
  });

  it('renders score rings for each participant', () => {
    const participants = [
      makeParticipant({ ticketId: 2, score: 90 }),
      makeParticipant({ ticketId: 3, ticketKey: 'AIB-103', score: 45 }),
    ];

    const { container } = renderWithProviders(<ComparisonParticipantGrid participants={participants} />);

    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(2);

    // Each gauge should have a gradient definition and two circles (track + arc)
    svgs.forEach((svg) => {
      expect(svg.querySelector('linearGradient')).toBeTruthy();
      expect(svg.querySelectorAll('circle').length).toBe(2);
    });
  });

  it('renders workflow type and agent badges', () => {
    const participants = [
      makeParticipant({ ticketId: 2, workflowType: 'QUICK' as const, agent: 'claude-opus' }),
    ];

    renderWithProviders(<ComparisonParticipantGrid participants={participants} />);

    expect(screen.getByText('QUICK')).toBeInTheDocument();
    expect(screen.getByText('claude-opus')).toBeInTheDocument();
  });

  it('renders rationale text', () => {
    const participants = [
      makeParticipant({ ticketId: 2, rankRationale: 'Solid but costly' }),
    ];

    renderWithProviders(<ComparisonParticipantGrid participants={participants} />);

    expect(screen.getByText('Solid but costly')).toBeInTheDocument();
  });

  it('renders empty state when no participants', () => {
    renderWithProviders(<ComparisonParticipantGrid participants={[]} />);
    // No cards rendered, no errors
    expect(screen.queryByText('AIB-')).not.toBeInTheDocument();
  });

  it('applies unique color per participant rank', () => {
    const participants = [
      makeParticipant({ ticketId: 2, ticketKey: 'AIB-102', rank: 2 }),
      makeParticipant({ ticketId: 3, ticketKey: 'AIB-103', rank: 3 }),
    ];

    const { container } = renderWithProviders(<ComparisonParticipantGrid participants={participants} />);

    // Rank 2 card should have blue tint, rank 3 should have mauve tint
    const cards = container.querySelectorAll('.border-ctp-blue\\/20');
    expect(cards.length).toBe(1);
    const mauveCards = container.querySelectorAll('.border-ctp-mauve\\/20');
    expect(mauveCards.length).toBe(1);
  });
});
