import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ComparisonOperationalMetricsGrid } from '@/components/comparison/comparison-operational-metrics-grid';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';

const participants = [
  {
    ticketId: 1,
    ticketKey: 'AIB-1',
    title: 'Winner',
    stage: 'SHIP' as const,
    workflowType: 'FULL' as const,
    agent: 'CODEX',
    rank: 1,
    score: 92,
    rankRationale: 'Best coverage',
    quality: {
      state: 'available' as const,
      value: 92,
      threshold: 'Excellent' as const,
      details: {
        dimensions: [
          {
            name: 'Compliance',
            agentId: 'compliance',
            score: 95,
            weight: 0.4,
            weightedScore: 38,
          },
          {
            name: 'Bug Detection',
            agentId: 'bug-detection',
            score: 90,
            weight: 0.3,
            weightedScore: 27,
          },
          {
            name: 'Code Comments',
            agentId: 'code-comments',
            score: 88,
            weight: 0.2,
            weightedScore: 17.6,
          },
          {
            name: 'Historical Context',
            agentId: 'historical-context',
            score: 84,
            weight: 0.1,
            weightedScore: 8.4,
          },
          {
            name: 'Spec Sync',
            agentId: 'spec-sync',
            score: 80,
            weight: 0,
            weightedScore: 0,
          },
        ],
        threshold: 'Excellent' as const,
        computedAt: '2026-03-20T00:00:00.000Z',
      },
    },
    telemetry: {
      totalTokens: { state: 'available' as const, value: 1000 },
      inputTokens: { state: 'available' as const, value: 700 },
      outputTokens: { state: 'available' as const, value: 300 },
      durationMs: { state: 'available' as const, value: 120000 },
      costUsd: { state: 'available' as const, value: 0.08 },
      jobCount: { state: 'available' as const, value: 2 },
      primaryModel: { state: 'available' as const, value: 'gpt-5.4' },
      bestValueFlags: {
        totalTokens: true,
        inputTokens: true,
        outputTokens: true,
        durationMs: true,
        costUsd: true,
        jobCount: true,
        quality: true,
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
    stage: 'BUILD' as const,
    workflowType: 'QUICK' as const,
    agent: 'CLAUDE',
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
      jobCount: { state: 'available' as const, value: 1 },
      primaryModel: { state: 'available' as const, value: 'claude-3-7-sonnet' },
      bestValueFlags: {
        totalTokens: false,
        inputTokens: false,
        outputTokens: false,
        durationMs: false,
        costUsd: false,
        jobCount: false,
        quality: false,
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

describe('ComparisonOperationalMetricsGrid', () => {
  it('renders an operational metrics section with best-value markers and pending cells', () => {
    renderWithProviders(<ComparisonOperationalMetricsGrid participants={participants} />);

    expect(screen.getByText('Operational Metrics')).toBeInTheDocument();
    expect(screen.getByText('Total tokens')).toBeInTheDocument();
    expect(screen.getByText('AIB-1')).toBeInTheDocument();
    expect(screen.getByText('gpt-5.4')).toBeInTheDocument();
    expect(screen.getByText('claude-3-7-sonnet')).toBeInTheDocument();
    expect(screen.getAllByText('pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Best value').length).toBeGreaterThan(0);
  });

  it('shows the quality breakdown popover when a scored quality cell is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComparisonOperationalMetricsGrid participants={participants} />);

    await user.click(screen.getByRole('button', { name: /view quality breakdown for aib-1/i }));

    expect(screen.getByText('Quality breakdown')).toBeInTheDocument();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText('95 · 40%')).toBeInTheDocument();
    expect(screen.getAllByText('92 Excellent').length).toBeGreaterThan(0);
  });
});
