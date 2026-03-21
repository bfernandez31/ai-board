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
    agent: 'CODEX',
    rank: 1,
    score: 92,
    rankRationale: 'Best coverage',
    quality: {
      state: 'available' as const,
      value: 92,
      threshold: 'Excellent' as const,
      details: null,
    },
    telemetry: {
      totalTokens: { state: 'available' as const, value: 150 },
      inputTokens: { state: 'available' as const, value: 100 },
      outputTokens: { state: 'available' as const, value: 50 },
      durationMs: { state: 'available' as const, value: 1000 },
      costUsd: { state: 'available' as const, value: 0.01 },
      jobCount: { state: 'available' as const, value: 2 },
      primaryModel: { state: 'available' as const, value: 'gpt-5.4' },
      bestValueFlags: {},
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
    quality: {
      state: 'pending' as const,
      value: null,
      threshold: null,
      details: null,
    },
    telemetry: {
      totalTokens: { state: 'pending' as const, value: null },
      inputTokens: { state: 'pending' as const, value: null },
      outputTokens: { state: 'pending' as const, value: null },
      durationMs: { state: 'pending' as const, value: null },
      costUsd: { state: 'pending' as const, value: null },
      jobCount: { state: 'pending' as const, value: null },
      primaryModel: { state: 'pending' as const, value: null },
      bestValueFlags: {},
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
  it('renders ordered participants with workflow, agent, and quality badges', () => {
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
    expect(screen.getAllByText('FULL').length).toBeGreaterThan(0);
    expect(screen.getByText('CODEX')).toBeInTheDocument();
    expect(screen.getByText('92 Excellent')).toBeInTheDocument();
    expect(screen.getByText('coverage')).toBeInTheDocument();
  });
});
