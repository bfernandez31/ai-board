import { describe, expect, it } from 'vitest';
import { ComparisonStatCards } from '@/components/comparison/comparison-stat-cards';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import type { ComparisonParticipantDetail } from '@/lib/types/comparison';

function makeParticipant(overrides?: Partial<ComparisonParticipantDetail>): ComparisonParticipantDetail {
  return {
    ticketId: 1,
    ticketKey: 'AIB-101',
    title: 'Ticket',
    stage: 'VERIFY' as const,
    workflowType: 'FULL' as const,
    agent: null,
    rank: 1,
    score: 90,
    rankRationale: 'Best',
    quality: { state: 'available', value: 88 },
    qualityBreakdown: { state: 'unavailable', value: null },
    telemetry: {
      inputTokens: { state: 'available', value: 5000 },
      outputTokens: { state: 'available', value: 3000 },
      totalTokens: { state: 'available', value: 8000 },
      durationMs: { state: 'available', value: 120000 },
      costUsd: { state: 'available', value: 1.50 },
      jobCount: { state: 'available', value: 2 },
      primaryModel: { state: 'available', value: 'claude-sonnet-4-6' },
    },
    metrics: {
      linesAdded: 100,
      linesRemoved: 20,
      linesChanged: 120,
      filesChanged: 8,
      testFilesChanged: 3,
      changedFiles: [],
      bestValueFlags: {},
    },
    ...overrides,
  };
}

describe('ComparisonStatCards', () => {
  const winner = makeParticipant();
  const runner = makeParticipant({
    ticketId: 2,
    ticketKey: 'AIB-102',
    rank: 2,
    score: 72,
    quality: { state: 'available', value: 70 },
    telemetry: {
      inputTokens: { state: 'available', value: 8000 },
      outputTokens: { state: 'available', value: 5000 },
      totalTokens: { state: 'available', value: 13000 },
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
  });

  it('renders four stat card labels', () => {
    renderWithProviders(
      <ComparisonStatCards winner={winner} participants={[winner, runner]} />
    );

    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Quality Score')).toBeInTheDocument();
    expect(screen.getByText('Files Changed')).toBeInTheDocument();
  });

  it('shows winner values prominently', () => {
    renderWithProviders(
      <ComparisonStatCards winner={winner} participants={[winner, runner]} />
    );

    expect(screen.getByText('$1.50')).toBeInTheDocument();
    expect(screen.getByText('2m')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders micro-bar markers for each participant', () => {
    const { container } = renderWithProviders(
      <ComparisonStatCards winner={winner} participants={[winner, runner]} />
    );

    // Each stat card should have markers for each participant
    const markers = container.querySelectorAll('[data-testid="micro-bar-marker"]');
    // 4 stat cards x 2 participants = 8 markers
    expect(markers.length).toBe(8);
  });

  it('handles pending enrichment values', () => {
    const pendingWinner = makeParticipant({
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
      <ComparisonStatCards winner={pendingWinner} participants={[pendingWinner]} />
    );

    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(2);
  });

  it('handles unavailable enrichment values', () => {
    const unavailableWinner = makeParticipant({
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
      <ComparisonStatCards winner={unavailableWinner} participants={[unavailableWinner]} />
    );

    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(2);
  });

  it('renders per-card color themes for each stat', () => {
    const { container } = renderWithProviders(
      <ComparisonStatCards winner={winner} participants={[winner, runner]} />
    );

    const themedCards = container.querySelectorAll('[data-testid="stat-card"]');
    expect(themedCards.length).toBe(4);
  });

  it('renders score values with extrabold styling', () => {
    const { container } = renderWithProviders(
      <ComparisonStatCards winner={winner} participants={[winner, runner]} />
    );

    const valueElements = container.querySelectorAll('.font-extrabold');
    expect(valueElements.length).toBe(4);
  });
});
