import { describe, expect, it } from 'vitest';
import { ComparisonRanking } from '@/components/comparison/comparison-ranking';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';

const participants = [
  {
    ticketId: 1,
    ticketKey: 'AIB-1',
    title: 'Winner',
    stage: 'VERIFY' as const,
    workflowType: 'FULL' as const,
    agent: null,
    rank: 1,
    score: 92,
    rankRationale: 'Best coverage',
    quality: { state: 'available' as const, value: 92 },
    qualityDetails: { state: 'unavailable' as const, value: null },
    telemetry: {
      inputTokens: { state: 'available' as const, value: 100 },
      outputTokens: { state: 'available' as const, value: 50 },
      totalTokens: { state: 'available' as const, value: 150 },
      durationMs: { state: 'available' as const, value: 1000 },
      costUsd: { state: 'available' as const, value: 0.01 },
      jobCount: { state: 'available' as const, value: 1 },
      model: { state: 'available' as const, value: 'claude-sonnet-4-20250514' },
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
  },
  {
    ticketId: 2,
    ticketKey: 'AIB-2',
    title: 'Runner up',
    stage: 'PLAN' as const,
    workflowType: 'FULL' as const,
    agent: null,
    rank: 2,
    score: 75,
    rankRationale: 'More churn',
    quality: { state: 'pending' as const, value: null },
    qualityDetails: { state: 'pending' as const, value: null },
    telemetry: {
      inputTokens: { state: 'pending' as const, value: null },
      outputTokens: { state: 'pending' as const, value: null },
      totalTokens: { state: 'pending' as const, value: null },
      durationMs: { state: 'pending' as const, value: null },
      costUsd: { state: 'pending' as const, value: null },
      jobCount: { state: 'pending' as const, value: null },
      model: { state: 'pending' as const, value: null },
    },
    metrics: {
      linesAdded: 30,
      linesRemoved: 10,
      linesChanged: 40,
      filesChanged: 4,
      testFilesChanged: 0,
      changedFiles: [],
      bestValueFlags: {},
    },
  },
];

describe('ComparisonRanking', () => {
  it('renders ordered participants and the winner badge', () => {
    renderWithProviders(
      <ComparisonRanking
        participants={participants}
        recommendation="Use AIB-1."
        summary="AIB-1 had the strongest outcome."
        winnerTicketId={1}
        keyDifferentiators={['coverage']}
      />
    );

    expect(screen.getByText('Use AIB-1.')).toBeInTheDocument();
    expect(screen.getByText('#1 AIB-1')).toBeInTheDocument();
    expect(screen.getByText('#2 AIB-2')).toBeInTheDocument();
    expect(screen.getAllByText('Winner').length).toBeGreaterThan(0);
    expect(screen.getByText('coverage')).toBeInTheDocument();
  });
});
