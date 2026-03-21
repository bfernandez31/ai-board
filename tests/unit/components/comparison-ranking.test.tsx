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
    agent: 'CODEX' as const,
    rank: 1,
    score: 92,
    rankRationale: 'Best coverage',
    quality: {
      state: 'available' as const,
      score: 92,
      threshold: 'Excellent' as const,
      detailsState: 'available' as const,
      details: {
        ticketId: 1,
        ticketKey: 'AIB-1',
        score: 92,
        threshold: 'Excellent' as const,
        dimensions: [],
      },
      isBest: true,
    },
    operational: {
      totalTokens: { state: 'available' as const, value: 150, isBest: true },
      inputTokens: { state: 'available' as const, value: 100, isBest: true },
      outputTokens: { state: 'available' as const, value: 50, isBest: true },
      durationMs: { state: 'available' as const, value: 1000, isBest: true },
      costUsd: { state: 'available' as const, value: 0.01, isBest: true },
      jobCount: { state: 'available' as const, value: 1, isBest: true },
      model: {
        state: 'available' as const,
        label: 'gpt-5.4',
        dominantModel: 'gpt-5.4',
        completedJobCount: 1,
        mixedModels: false,
      },
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
      score: null,
      threshold: null,
      detailsState: 'unavailable' as const,
      details: null,
      isBest: false,
    },
    operational: {
      totalTokens: { state: 'pending' as const, value: null, isBest: false },
      inputTokens: { state: 'pending' as const, value: null, isBest: false },
      outputTokens: { state: 'pending' as const, value: null, isBest: false },
      durationMs: { state: 'pending' as const, value: null, isBest: false },
      costUsd: { state: 'pending' as const, value: null, isBest: false },
      jobCount: { state: 'pending' as const, value: null, isBest: false },
      model: {
        state: 'pending' as const,
        label: null,
        dominantModel: null,
        completedJobCount: 0,
        mixedModels: false,
      },
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
  it('renders ordered participants and ranking context badges', () => {
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
    expect(screen.getByText('Codex')).toBeInTheDocument();
    expect(screen.getByText('Quality 92 · Excellent')).toBeInTheDocument();
    expect(screen.getByText('Quality pending')).toBeInTheDocument();
  });
});
