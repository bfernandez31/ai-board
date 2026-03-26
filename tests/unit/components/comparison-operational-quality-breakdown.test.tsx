import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ComparisonOperationalMetricsGrid } from '@/components/comparison/comparison-operational-metrics-grid';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';

const participants = [
  {
    ticketId: 1,
    ticketKey: 'AIB-1',
    title: 'Eligible',
    stage: 'VERIFY' as const,
    workflowType: 'FULL' as const,
    agent: 'CLAUDE',
    rank: 1,
    score: 91,
    rankRationale: 'Eligible quality details.',
    operational: {
      totalTokens: { state: 'available' as const, value: 140 },
      inputTokens: { state: 'available' as const, value: 100 },
      outputTokens: { state: 'available' as const, value: 40 },
      durationMs: { state: 'available' as const, value: 1000 },
      costUsd: { state: 'available' as const, value: 0.03 },
      jobCount: { state: 'available' as const, value: 2 },
      primaryModel: 'gpt-5.4',
      bestValueFlags: {
        totalTokens: true,
        inputTokens: true,
        outputTokens: true,
        durationMs: true,
        costUsd: true,
        jobCount: true,
      },
    },
    quality: {
      score: { state: 'available' as const, value: 91 },
      thresholdLabel: 'Excellent',
      detailAvailable: true,
      breakdown: {
        overallScore: 91,
        thresholdLabel: 'Excellent',
        dimensions: [
          { agentId: 'compliance', name: 'Compliance', score: 95, weight: 0.4 },
          { agentId: 'bug-detection', name: 'Bug Detection', score: 88, weight: 0.3 },
          { agentId: 'code-comments', name: 'Code Comments', score: 80, weight: 0.2 },
          { agentId: 'historical-context', name: 'Historical Context', score: 75, weight: 0.1 },
          { agentId: 'spec-sync', name: 'Spec Sync', score: 100, weight: 0 },
        ],
      },
      isBestValue: true,
    },
    metrics: {
      linesAdded: 12,
      linesRemoved: 4,
      linesChanged: 16,
      filesChanged: 2,
      testFilesChanged: 1,
      changedFiles: [],
      bestValueFlags: {},
    },
  },
  {
    ticketId: 2,
    ticketKey: 'AIB-2',
    title: 'Ineligible',
    stage: 'PLAN' as const,
    workflowType: 'QUICK' as const,
    agent: null,
    rank: 2,
    score: 70,
    rankRationale: 'No inline details.',
    operational: {
      totalTokens: { state: 'pending' as const, value: null },
      inputTokens: { state: 'pending' as const, value: null },
      outputTokens: { state: 'pending' as const, value: null },
      durationMs: { state: 'pending' as const, value: null },
      costUsd: { state: 'pending' as const, value: null },
      jobCount: { state: 'available' as const, value: 1 },
      primaryModel: null,
      bestValueFlags: {
        totalTokens: false,
        inputTokens: false,
        outputTokens: false,
        durationMs: false,
        costUsd: false,
        jobCount: false,
      },
    },
    quality: {
      score: { state: 'available' as const, value: 70 },
      thresholdLabel: 'Good',
      detailAvailable: false,
      breakdown: null,
      isBestValue: false,
    },
    metrics: {
      linesAdded: 20,
      linesRemoved: 10,
      linesChanged: 30,
      filesChanged: 5,
      testFilesChanged: 0,
      changedFiles: [],
      bestValueFlags: {},
    },
  },
];

describe('ComparisonOperationalMetricsGrid quality details', () => {
  it('toggles the inline quality breakdown for eligible participants only', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ComparisonOperationalMetricsGrid participants={participants} />);

    expect(screen.queryByTestId('quality-breakdown-1')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /view breakdown/i }));

    expect(screen.getByTestId('quality-breakdown-1')).toBeInTheDocument();
    expect(
      screen.getByTestId('quality-dimension-1-bug-detection')
    ).toHaveTextContent('Bug Detection (30%)');
    expect(screen.getByText('Highest quality')).toBeInTheDocument();
    expect(screen.getAllByText('Details unavailable')).toHaveLength(1);
  });
});
