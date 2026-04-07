import { describe, expect, it } from 'vitest';
import { ComparisonHeroCard } from '@/components/comparison/comparison-hero-card';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import type { ComparisonParticipantDetail } from '@/lib/types/comparison';

const DEFAULT_RECOMMENDATION = 'Use AIB-101 for best results.';
const DEFAULT_SOURCE_TICKET_KEY = 'AIB-100';
const DEFAULT_GENERATED_AT = '2026-03-26T10:00:00Z';

function makeWinner(overrides?: Partial<ComparisonParticipantDetail>): ComparisonParticipantDetail {
  return {
    ticketId: 1,
    ticketKey: 'AIB-101',
    title: 'Winner ticket',
    stage: 'VERIFY' as const,
    workflowType: 'FULL' as const,
    agent: 'claude-sonnet',
    rank: 1,
    score: 92,
    rankRationale: 'Best overall',
    quality: { state: 'available', value: 88 },
    qualityBreakdown: { state: 'unavailable', value: null },
    telemetry: {
      inputTokens: { state: 'available', value: 5000 },
      outputTokens: { state: 'available', value: 3000 },
      totalTokens: { state: 'available', value: 8000 },
      durationMs: { state: 'available', value: 154000 },
      costUsd: { state: 'available', value: 1.25 },
      jobCount: { state: 'available', value: 2 },
      primaryModel: { state: 'available', value: 'claude-sonnet-4-6' },
    },
    metrics: {
      linesAdded: 120,
      linesRemoved: 30,
      linesChanged: 150,
      filesChanged: 8,
      testFilesChanged: 3,
      changedFiles: [],
      bestValueFlags: {},
    },
    ...overrides,
  };
}

function renderComparisonHeroCard(
  overrides?: Partial<ComparisonParticipantDetail>,
  keyDifferentiators: string[] = []
) {
  return renderWithProviders(
    <ComparisonHeroCard
      winner={makeWinner(overrides)}
      recommendation={DEFAULT_RECOMMENDATION}
      keyDifferentiators={keyDifferentiators}
      generatedAt={DEFAULT_GENERATED_AT}
      sourceTicketKey={DEFAULT_SOURCE_TICKET_KEY}
    />
  );
}

describe('ComparisonHeroCard', () => {
  it('renders winner ticket key prominently', () => {
    renderComparisonHeroCard(undefined, ['coverage', 'performance']);

    expect(screen.getByText('AIB-101')).toBeInTheDocument();
  });

  it('renders recommendation text', () => {
    renderComparisonHeroCard();

    expect(screen.getByText(DEFAULT_RECOMMENDATION)).toBeInTheDocument();
  });

  it('renders key differentiator badges', () => {
    renderComparisonHeroCard(undefined, ['coverage', 'performance']);

    expect(screen.getByText('coverage')).toBeInTheDocument();
    expect(screen.getByText('performance')).toBeInTheDocument();
  });

  it('displays metadata with source ticket key', () => {
    renderComparisonHeroCard();

    expect(screen.getByText(/AIB-100/)).toBeInTheDocument();
  });

  it('renders stat pills with available values', () => {
    renderComparisonHeroCard();

    expect(screen.getByText('$1.25')).toBeInTheDocument();
    expect(screen.getByText('2m 34s')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
  });

  it('shows Pending for pending enrichment values', () => {
    const winner = makeWinner({
      telemetry: {
        inputTokens: { state: 'pending', value: null },
        outputTokens: { state: 'pending', value: null },
        totalTokens: { state: 'pending', value: null },
        durationMs: { state: 'pending', value: null },
        costUsd: { state: 'pending', value: null },
        jobCount: { state: 'pending', value: null },
        primaryModel: { state: 'pending', value: null },
      },
      quality: { state: 'pending', value: null },
    });

    renderComparisonHeroCard(winner);

    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(3);
  });

  it('shows N/A for unavailable enrichment values', () => {
    const winner = makeWinner({
      telemetry: {
        inputTokens: { state: 'unavailable', value: null },
        outputTokens: { state: 'unavailable', value: null },
        totalTokens: { state: 'unavailable', value: null },
        durationMs: { state: 'unavailable', value: null },
        costUsd: { state: 'unavailable', value: null },
        jobCount: { state: 'unavailable', value: null },
        primaryModel: { state: 'unavailable', value: null },
      },
      quality: { state: 'unavailable', value: null },
    });

    renderComparisonHeroCard(winner);

    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(3);
  });

  it('renders score gauge with winner score', () => {
    renderComparisonHeroCard({ score: 92 });

    expect(screen.getByRole('img', { name: 'Score: 92' })).toBeInTheDocument();
  });

  it('renders gradient winner badge', () => {
    renderComparisonHeroCard();

    expect(screen.getByText('WINNER')).toBeInTheDocument();
  });

  it('renders glow orb element', () => {
    const { container } = renderComparisonHeroCard();

    const glowOrb = container.querySelector('[data-testid="glow-orb"]');
    expect(glowOrb).not.toBeNull();
  });

  it('renders bordered recommendation container', () => {
    const { container } = renderComparisonHeroCard();

    const recContainer = container.querySelector('[data-testid="recommendation-container"]');
    expect(recContainer).not.toBeNull();
  });

  it('renders colored differentiator pills with accent backgrounds', () => {
    const { container } = renderComparisonHeroCard(undefined, ['coverage', 'performance']);

    const pills = container.querySelectorAll('[data-testid="differentiator-pill"]');
    expect(pills.length).toBe(2);
  });

  it('renders winner metadata with full workflow badge and Claude tooltip', async () => {
    const user = userEvent.setup();

    renderComparisonHeroCard();

    expect(screen.getByTestId('comparison-workflow-badge')).toHaveTextContent('FULL');

    await user.hover(screen.getByTestId('comparison-agent-badge'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Claude');
    expect(screen.getByAltText('CLAUDE')).toHaveAttribute('width', '20');
  });

  it('omits the winner agent icon when agent data is missing', () => {
    renderWithProviders(
      <ComparisonHeroCard
        winner={makeWinner({ agent: null })}
        recommendation="Recommendation"
        keyDifferentiators={[]}
        generatedAt="2026-03-26T10:00:00Z"
        sourceTicketKey="AIB-100"
      />
    );

    expect(screen.queryByTestId('comparison-agent-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('comparison-workflow-badge')).toBeInTheDocument();
  });
});
