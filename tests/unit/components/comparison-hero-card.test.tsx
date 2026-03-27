import { describe, expect, it } from 'vitest';
import { ComparisonHeroCard } from '@/components/comparison/comparison-hero-card';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import type { ComparisonParticipantDetail } from '@/lib/types/comparison';

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

describe('ComparisonHeroCard', () => {
  it('renders winner ticket key prominently', () => {
    renderWithProviders(
      <ComparisonHeroCard
        winner={makeWinner()}
        recommendation="Use AIB-101 for best results."
        keyDifferentiators={['coverage', 'performance']}
        generatedAt="2026-03-26T10:00:00Z"
        sourceTicketKey="AIB-100"
      />
    );

    expect(screen.getByText('AIB-101')).toBeInTheDocument();
  });

  it('renders recommendation text', () => {
    renderWithProviders(
      <ComparisonHeroCard
        winner={makeWinner()}
        recommendation="Use AIB-101 for best results."
        keyDifferentiators={[]}
        generatedAt="2026-03-26T10:00:00Z"
        sourceTicketKey="AIB-100"
      />
    );

    expect(screen.getByText('Use AIB-101 for best results.')).toBeInTheDocument();
  });

  it('renders key differentiator badges', () => {
    renderWithProviders(
      <ComparisonHeroCard
        winner={makeWinner()}
        recommendation="Recommendation"
        keyDifferentiators={['coverage', 'performance']}
        generatedAt="2026-03-26T10:00:00Z"
        sourceTicketKey="AIB-100"
      />
    );

    expect(screen.getByText('coverage')).toBeInTheDocument();
    expect(screen.getByText('performance')).toBeInTheDocument();
  });

  it('displays metadata with source ticket key', () => {
    renderWithProviders(
      <ComparisonHeroCard
        winner={makeWinner()}
        recommendation="Recommendation"
        keyDifferentiators={[]}
        generatedAt="2026-03-26T10:00:00Z"
        sourceTicketKey="AIB-100"
      />
    );

    expect(screen.getByText(/AIB-100/)).toBeInTheDocument();
  });

  it('renders stat pills with available values', () => {
    renderWithProviders(
      <ComparisonHeroCard
        winner={makeWinner()}
        recommendation="Recommendation"
        keyDifferentiators={[]}
        generatedAt="2026-03-26T10:00:00Z"
        sourceTicketKey="AIB-100"
      />
    );

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

    renderWithProviders(
      <ComparisonHeroCard
        winner={winner}
        recommendation="Recommendation"
        keyDifferentiators={[]}
        generatedAt="2026-03-26T10:00:00Z"
        sourceTicketKey="AIB-100"
      />
    );

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

    renderWithProviders(
      <ComparisonHeroCard
        winner={winner}
        recommendation="Recommendation"
        keyDifferentiators={[]}
        generatedAt="2026-03-26T10:00:00Z"
        sourceTicketKey="AIB-100"
      />
    );

    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(3);
  });

  it('renders score gauge with winner score', () => {
    renderWithProviders(
      <ComparisonHeroCard
        winner={makeWinner({ score: 92 })}
        recommendation="Recommendation"
        keyDifferentiators={[]}
        generatedAt="2026-03-26T10:00:00Z"
        sourceTicketKey="AIB-100"
      />
    );

    expect(screen.getByRole('img', { name: 'Score: 92' })).toBeInTheDocument();
  });

  it('renders gradient winner badge', () => {
    renderWithProviders(
      <ComparisonHeroCard
        winner={makeWinner()}
        recommendation="Recommendation"
        keyDifferentiators={[]}
        generatedAt="2026-03-26T10:00:00Z"
        sourceTicketKey="AIB-100"
      />
    );

    expect(screen.getByText('WINNER')).toBeInTheDocument();
  });

  it('renders glow orb element', () => {
    const { container } = renderWithProviders(
      <ComparisonHeroCard
        winner={makeWinner()}
        recommendation="Recommendation"
        keyDifferentiators={[]}
        generatedAt="2026-03-26T10:00:00Z"
        sourceTicketKey="AIB-100"
      />
    );

    const glowOrb = container.querySelector('[data-testid="glow-orb"]');
    expect(glowOrb).not.toBeNull();
  });

  it('renders bordered recommendation container', () => {
    const { container } = renderWithProviders(
      <ComparisonHeroCard
        winner={makeWinner()}
        recommendation="Use AIB-101 for best results."
        keyDifferentiators={[]}
        generatedAt="2026-03-26T10:00:00Z"
        sourceTicketKey="AIB-100"
      />
    );

    const recContainer = container.querySelector('[data-testid="recommendation-container"]');
    expect(recContainer).not.toBeNull();
  });

  it('renders colored differentiator pills with accent backgrounds', () => {
    const { container } = renderWithProviders(
      <ComparisonHeroCard
        winner={makeWinner()}
        recommendation="Recommendation"
        keyDifferentiators={['coverage', 'performance']}
        generatedAt="2026-03-26T10:00:00Z"
        sourceTicketKey="AIB-100"
      />
    );

    const pills = container.querySelectorAll('[data-testid="differentiator-pill"]');
    expect(pills.length).toBe(2);
  });
});
