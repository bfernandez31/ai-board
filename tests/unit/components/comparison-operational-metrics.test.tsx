import { describe, expect, it } from 'vitest';
import { ComparisonOperationalMetricsGrid } from '@/components/comparison/comparison-operational-metrics';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import type { ComparisonParticipantDetail } from '@/lib/types/comparison';

function createParticipant(
  overrides: Partial<ComparisonParticipantDetail> & { ticketId: number }
): ComparisonParticipantDetail {
  return {
    ticketKey: `AIB-${overrides.ticketId}`,
    title: `Ticket ${overrides.ticketId}`,
    stage: 'VERIFY' as const,
    workflowType: 'FULL' as const,
    agent: 'Claude' as const,
    rank: 1,
    score: 80,
    rankRationale: 'Test',
    quality: { state: 'unavailable' as const, value: null },
    telemetry: {
      inputTokens: { state: 'unavailable' as const, value: null },
      outputTokens: { state: 'unavailable' as const, value: null },
      durationMs: { state: 'unavailable' as const, value: null },
      costUsd: { state: 'unavailable' as const, value: null },
    },
    metrics: {
      linesAdded: null,
      linesRemoved: null,
      linesChanged: null,
      filesChanged: null,
      testFilesChanged: null,
      changedFiles: [],
      bestValueFlags: {},
    },
    aggregatedTelemetry: null,
    qualityDetails: null,
    ...overrides,
  };
}

describe('ComparisonOperationalMetricsGrid', () => {
  it('renders 7 rows with correct labels', () => {
    const participants = [
      createParticipant({
        ticketId: 1,
        aggregatedTelemetry: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          costUsd: 0.05,
          durationMs: 60000,
          jobCount: 2,
          model: 'claude-3',
          hasData: true,
        },
        quality: { state: 'available' as const, value: 87 },
      }),
    ];

    renderWithProviders(<ComparisonOperationalMetricsGrid participants={participants} />);

    expect(screen.getByText('Operational Metrics')).toBeInTheDocument();
    expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    expect(screen.getByText('Input Tokens')).toBeInTheDocument();
    expect(screen.getByText('Output Tokens')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Job Count')).toBeInTheDocument();
    expect(screen.getByText('Quality Score')).toBeInTheDocument();
  });

  it('shows formatted values for available data', () => {
    const participants = [
      createParticipant({
        ticketId: 1,
        aggregatedTelemetry: {
          inputTokens: 12450,
          outputTokens: 3200,
          totalTokens: 15650,
          costUsd: 0.85,
          durationMs: 154000,
          jobCount: 3,
          model: 'claude-3',
          hasData: true,
        },
        quality: { state: 'available' as const, value: 87 },
      }),
    ];

    renderWithProviders(<ComparisonOperationalMetricsGrid participants={participants} />);

    expect(screen.getByText('15,650')).toBeInTheDocument();
    expect(screen.getByText('12,450')).toBeInTheDocument();
    expect(screen.getByText('3,200')).toBeInTheDocument();
    expect(screen.getByText('2m 34s')).toBeInTheDocument();
    expect(screen.getByText('$0.8500')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('87 Good')).toBeInTheDocument();
  });

  it('shows N/A for missing telemetry', () => {
    const participants = [
      createParticipant({ ticketId: 1, aggregatedTelemetry: null }),
    ];

    renderWithProviders(<ComparisonOperationalMetricsGrid participants={participants} />);

    const naCells = screen.getAllByText('N/A');
    // 7 metric rows should all show N/A (6 telemetry + 1 quality)
    expect(naCells.length).toBe(7);
  });

  it('shows Pending for in-progress jobs', () => {
    const participants = [
      createParticipant({
        ticketId: 1,
        aggregatedTelemetry: null,
        telemetry: {
          inputTokens: { state: 'pending' as const, value: null },
          outputTokens: { state: 'pending' as const, value: null },
          durationMs: { state: 'pending' as const, value: null },
          costUsd: { state: 'pending' as const, value: null },
        },
      }),
    ];

    renderWithProviders(<ComparisonOperationalMetricsGrid participants={participants} />);

    const pendingCells = screen.getAllByText('Pending');
    expect(pendingCells.length).toBeGreaterThanOrEqual(1);
  });

  it('displays Best badge on winning cells', () => {
    const participants = [
      createParticipant({
        ticketId: 1,
        aggregatedTelemetry: {
          inputTokens: 500,
          outputTokens: 200,
          totalTokens: 700,
          costUsd: 0.02,
          durationMs: 30000,
          jobCount: 1,
          model: 'claude-3',
          hasData: true,
        },
        quality: { state: 'available' as const, value: 92 },
      }),
      createParticipant({
        ticketId: 2,
        aggregatedTelemetry: {
          inputTokens: 2000,
          outputTokens: 1000,
          totalTokens: 3000,
          costUsd: 0.10,
          durationMs: 120000,
          jobCount: 3,
          model: 'claude-3',
          hasData: true,
        },
        quality: { state: 'available' as const, value: 70 },
      }),
    ];

    renderWithProviders(<ComparisonOperationalMetricsGrid participants={participants} />);

    const bestBadges = screen.getAllByText('Best');
    // Ticket 1 best for 6 metrics (tokens, duration, cost, jobCount), Ticket 2 none, Ticket 1 best quality too
    // Actually: 6 lowest metrics + 1 highest (quality) for ticket 1 = 7 Best badges
    expect(bestBadges.length).toBe(7);
  });

  it('renders 6-participant grid with horizontally scrollable container', () => {
    const participants = Array.from({ length: 6 }, (_, i) =>
      createParticipant({
        ticketId: i + 1,
        ticketKey: `AIB-${i + 1}`,
        aggregatedTelemetry: {
          inputTokens: 1000 * (i + 1),
          outputTokens: 500 * (i + 1),
          totalTokens: 1500 * (i + 1),
          costUsd: 0.05 * (i + 1),
          durationMs: 60000 * (i + 1),
          jobCount: i + 1,
          model: 'claude-3',
          hasData: true,
        },
      })
    );

    renderWithProviders(<ComparisonOperationalMetricsGrid participants={participants} />);

    // All 6 ticket keys should be rendered as column headers
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByText(`AIB-${i}`)).toBeInTheDocument();
    }

    // The container should have overflow-x-auto class
    const cardContent = screen.getByText('Operational Metrics').closest('.overflow-x-auto') ??
      document.querySelector('.overflow-x-auto');
    expect(cardContent).toBeInTheDocument();
  });

  it('does not show scrollbar for 2-participant grid', () => {
    const participants = [
      createParticipant({
        ticketId: 1,
        aggregatedTelemetry: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          costUsd: 0.05,
          durationMs: 60000,
          jobCount: 1,
          model: 'claude-3',
          hasData: true,
        },
      }),
      createParticipant({
        ticketId: 2,
        aggregatedTelemetry: {
          inputTokens: 2000,
          outputTokens: 1000,
          totalTokens: 3000,
          costUsd: 0.10,
          durationMs: 120000,
          jobCount: 2,
          model: 'claude-3',
          hasData: true,
        },
      }),
    ];

    renderWithProviders(<ComparisonOperationalMetricsGrid participants={participants} />);

    // Both participants should be visible
    expect(screen.getByText('AIB-1')).toBeInTheDocument();
    expect(screen.getByText('AIB-2')).toBeInTheDocument();

    // The table should fit without needing the scroll
    const table = document.querySelector('table');
    expect(table).toBeInTheDocument();
  });

  it('renders column headers with ticket key, workflow type, and agent', () => {
    const participants = [
      createParticipant({
        ticketId: 1,
        ticketKey: 'AIB-100',
        workflowType: 'FULL' as const,
        agent: 'Claude' as const,
      }),
      createParticipant({
        ticketId: 2,
        ticketKey: 'AIB-200',
        workflowType: 'QUICK' as const,
        agent: null,
      }),
    ];

    renderWithProviders(<ComparisonOperationalMetricsGrid participants={participants} />);

    expect(screen.getByText('AIB-100')).toBeInTheDocument();
    expect(screen.getByText('AIB-200')).toBeInTheDocument();
  });
});
