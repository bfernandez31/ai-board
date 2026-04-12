import { describe, expect, it } from 'vitest';
import { ComparisonParticipantGrid } from '@/components/comparison/comparison-participant-grid';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
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

function renderComparisonParticipantGrid(overrides: Partial<ComparisonParticipantDetail>[] = []) {
  const participants = overrides.map((participantOverrides, index) =>
    makeParticipant({
      rank: index + 2,
      ticketId: index + 2,
      ticketKey: `AIB-10${index + 2}`,
      ...participantOverrides,
    })
  );

  return renderWithProviders(<ComparisonParticipantGrid participants={participants} />);
}

describe('ComparisonParticipantGrid', () => {
  it('renders correct number of participant cards', () => {
    renderComparisonParticipantGrid([
      { ticketId: 2, ticketKey: 'AIB-102', rank: 2 },
      { ticketId: 3, ticketKey: 'AIB-103', rank: 3 },
    ]);

    expect(screen.getByText('AIB-102')).toBeInTheDocument();
    expect(screen.getByText('AIB-103')).toBeInTheDocument();
  });

  it('shows rank, ticket key, and title for each card', () => {
    renderComparisonParticipantGrid([{ ticketId: 2, ticketKey: 'AIB-102', rank: 2, title: 'Second place' }]);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('AIB-102')).toBeInTheDocument();
    expect(screen.getByText('Second place')).toBeInTheDocument();
  });

  it('renders score rings with correct colors per threshold', () => {
    const { container } = renderComparisonParticipantGrid([
      { ticketId: 2, score: 90 },
      { ticketId: 3, ticketKey: 'AIB-103', score: 45 },
    ]);

    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(2);

    // Score arcs now use gradient URL references
    const firstScoreCircle = svgs[0].querySelectorAll('circle')[1];
    expect(firstScoreCircle.getAttribute('stroke')).toContain('url(#');

    const secondScoreCircle = svgs[1].querySelectorAll('circle')[1];
    expect(secondScoreCircle.getAttribute('stroke')).toContain('url(#');
  });

  it('renders quick workflow badge and Claude tooltip', async () => {
    const user = userEvent.setup();
    renderComparisonParticipantGrid([{ ticketId: 2, workflowType: 'QUICK' as const, agent: 'claude-opus' }]);

    expect(screen.getByTestId('comparison-workflow-badge')).toHaveTextContent('Quick');

    await user.hover(screen.getByTestId('comparison-agent-badge'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Claude');
    expect(screen.getByAltText('CLAUDE')).toHaveAttribute('width', '16');
  });

  it('renders clean workflow badge and falls back to Claude for unknown agent identifiers', () => {
    renderComparisonParticipantGrid([{ ticketId: 2, workflowType: 'CLEAN' as const, agent: 'custom-runner' }]);

    expect(screen.getByTestId('comparison-workflow-badge')).toHaveTextContent('Clean');
    expect(screen.getByTestId('comparison-agent-badge')).toBeInTheDocument();
    expect(screen.getByAltText('CLAUDE')).toBeInTheDocument();
  });

  it('renders rationale text', () => {
    renderComparisonParticipantGrid([{ ticketId: 2, rankRationale: 'Solid but costly' }]);

    expect(screen.getByText('Solid but costly')).toBeInTheDocument();
  });

  it('renders empty state when no participants', () => {
    renderWithProviders(<ComparisonParticipantGrid participants={[]} />);
    // No cards rendered, no errors
    expect(screen.queryByText('AIB-')).not.toBeInTheDocument();
  });
});
