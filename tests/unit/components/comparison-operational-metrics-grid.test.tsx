import { describe, expect, it } from 'vitest';
import { ComparisonOperationalMetricsGrid } from '@/components/comparison/comparison-operational-metrics-grid';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';

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
    quality: { state: 'available' as const, value: 92 },
    qualityDetails: {
      state: 'available' as const,
      value: {
        threshold: 'Excellent' as const,
        dimensions: [
          { agentId: 'compliance', name: 'Compliance', score: 95, weight: 0.4, weightedScore: 38 },
          { agentId: 'bug-detection', name: 'Bug Detection', score: 90, weight: 0.3, weightedScore: 27 },
          { agentId: 'code-comments', name: 'Code Comments', score: 80, weight: 0.2, weightedScore: 16 },
          { agentId: 'historical-context', name: 'Historical Context', score: 70, weight: 0.1, weightedScore: 7 },
          { agentId: 'spec-sync', name: 'Spec Sync', score: 60, weight: 0, weightedScore: 0 },
        ],
      },
    },
    telemetry: {
      totalTokens: { state: 'available' as const, value: 150 },
      inputTokens: { state: 'available' as const, value: 100 },
      outputTokens: { state: 'available' as const, value: 50 },
      durationMs: { state: 'available' as const, value: 1000 },
      costUsd: { state: 'available' as const, value: 0.01 },
      jobCount: { state: 'available' as const, value: 2 },
      model: { state: 'available' as const, value: 'gpt-5.4' },
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
    stage: 'BUILD' as const,
    workflowType: 'QUICK' as const,
    agent: 'CLAUDE',
    rank: 2,
    score: 75,
    rankRationale: 'More churn',
    quality: { state: 'pending' as const, value: null },
    qualityDetails: { state: 'pending' as const, value: null },
    telemetry: {
      totalTokens: { state: 'pending' as const, value: null },
      inputTokens: { state: 'pending' as const, value: null },
      outputTokens: { state: 'pending' as const, value: null },
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

describe('ComparisonOperationalMetricsGrid', () => {
  it('renders operational metrics, best-value badges, and quality popover details', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ComparisonOperationalMetricsGrid participants={participants} />);

    expect(screen.getByText('Operational Metrics')).toBeInTheDocument();
    expect(screen.getByText('AIB-1')).toBeInTheDocument();
    expect(screen.getByText('gpt-5.4')).toBeInTheDocument();
    expect(screen.getByText('Total tokens')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getAllByText('pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Best value').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /view quality breakdown for aib-1/i }));

    expect(screen.getByText('Quality Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText(/92 excellent/i)).toBeInTheDocument();
  });
});
