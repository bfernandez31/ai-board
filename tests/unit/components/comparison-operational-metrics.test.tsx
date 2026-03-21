import { describe, expect, it, vi } from 'vitest';
import { ComparisonOperationalMetrics } from '@/components/comparison/comparison-operational-metrics';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';

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
        dimensions: [
          { agentId: 'compliance', name: 'Compliance', score: 95, weight: 0.4 },
          { agentId: 'bug-detection', name: 'Bug Detection', score: 90, weight: 0.3 },
        ],
      },
      isBest: true,
    },
    operational: {
      totalTokens: { state: 'available' as const, value: 400, isBest: true },
      inputTokens: { state: 'available' as const, value: 250, isBest: true },
      outputTokens: { state: 'available' as const, value: 150, isBest: true },
      durationMs: { state: 'available' as const, value: 40000, isBest: true },
      costUsd: { state: 'available' as const, value: 0.02, isBest: true },
      jobCount: { state: 'available' as const, value: 2, isBest: true },
      model: {
        state: 'available' as const,
        label: 'gpt-5.4',
        dominantModel: 'gpt-5.4',
        completedJobCount: 2,
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
    title: 'Pending',
    stage: 'BUILD' as const,
    workflowType: 'FULL' as const,
    agent: 'CLAUDE' as const,
    rank: 2,
    score: 75,
    rankRationale: 'Still running',
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
  {
    ticketId: 3,
    ticketKey: 'AIB-3',
    title: 'Summary only',
    stage: 'PLAN' as const,
    workflowType: 'QUICK' as const,
    agent: null,
    rank: 3,
    score: 68,
    rankRationale: 'Limited verification',
    quality: {
      state: 'available' as const,
      score: 70,
      threshold: 'Good' as const,
      detailsState: 'summary_only' as const,
      details: null,
      isBest: false,
    },
    operational: {
      totalTokens: { state: 'unavailable' as const, value: null, isBest: false },
      inputTokens: { state: 'unavailable' as const, value: null, isBest: false },
      outputTokens: { state: 'unavailable' as const, value: null, isBest: false },
      durationMs: { state: 'unavailable' as const, value: null, isBest: false },
      costUsd: { state: 'unavailable' as const, value: null, isBest: false },
      jobCount: { state: 'unavailable' as const, value: null, isBest: false },
      model: {
        state: 'available' as const,
        label: 'Multiple models',
        dominantModel: null,
        completedJobCount: 2,
        mixedModels: true,
      },
    },
    metrics: {
      linesAdded: 20,
      linesRemoved: 5,
      linesChanged: 25,
      filesChanged: 3,
      testFilesChanged: 0,
      changedFiles: [],
      bestValueFlags: {},
    },
  },
];

describe('ComparisonOperationalMetrics', () => {
  it('renders operational rows with best badges plus pending and unavailable states', () => {
    renderWithProviders(
      <ComparisonOperationalMetrics
        participants={participants}
        selectedQualityTicketId={null}
        onQualityDetailSelect={() => {}}
      />
    );

    expect(screen.getByText('Operational Metrics')).toBeInTheDocument();
    expect(screen.getByText('Total tokens')).toBeInTheDocument();
    expect(screen.getAllByText('Best value').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not available').length).toBeGreaterThan(0);
  });

  it('renders ticket, workflow, agent, and model context in column headers', () => {
    renderWithProviders(
      <ComparisonOperationalMetrics
        participants={participants}
        selectedQualityTicketId={null}
        onQualityDetailSelect={() => {}}
      />
    );

    expect(screen.getByText('AIB-1')).toBeInTheDocument();
    expect(screen.getAllByText('FULL').length).toBeGreaterThan(0);
    expect(screen.getByText('Codex')).toBeInTheDocument();
    expect(screen.getByText('gpt-5.4')).toBeInTheDocument();
    expect(screen.getByText('Multiple models')).toBeInTheDocument();
  });

  it('opens the inline quality detail tray only for eligible cells', async () => {
    const user = userEvent.setup();
    const onQualityDetailSelect = vi.fn();

    renderWithProviders(
      <ComparisonOperationalMetrics
        participants={participants}
        selectedQualityTicketId={1}
        onQualityDetailSelect={onQualityDetailSelect}
      />
    );

    expect(
      screen.getByRole('button', { name: '92 (Excellent)' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('comparison-quality-detail-tray')).toBeInTheDocument();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '70 (Good)' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onQualityDetailSelect).toHaveBeenCalledWith(null);
  });
});
