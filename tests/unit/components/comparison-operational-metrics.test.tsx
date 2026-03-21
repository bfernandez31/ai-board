import { describe, expect, it } from 'vitest';
import { ComparisonOperationalMetrics } from '@/components/comparison/comparison-operational-metrics';
import { renderWithProviders, screen, within } from '@/tests/utils/component-test-utils';
import type { ComparisonParticipantDetail } from '@/lib/types/comparison';

function createParticipant(
  overrides: Partial<ComparisonParticipantDetail> = {}
): ComparisonParticipantDetail {
  return {
    ticketId: 1,
    ticketKey: 'AIB-1',
    title: 'Test ticket',
    stage: 'VERIFY',
    workflowType: 'FULL',
    agent: null,
    rank: 1,
    score: 90,
    rankRationale: 'Good implementation',
    quality: { state: 'available', value: 87 },
    qualityScoreDetails: null,
    telemetry: {
      inputTokens: { state: 'available', value: 500000 },
      outputTokens: { state: 'available', value: 200000 },
      totalTokens: { state: 'available', value: 700000 },
      durationMs: { state: 'available', value: 154000 },
      costUsd: { state: 'available', value: 1.25 },
      jobCount: { state: 'available', value: 3 },
      hasPartialData: false,
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
    model: 'claude-sonnet-4-6',
    ...overrides,
  };
}

describe('ComparisonOperationalMetrics', () => {
  it('renders 7 metric rows with correct labels', () => {
    const participants = [createParticipant()];
    renderWithProviders(<ComparisonOperationalMetrics participants={participants} />);

    expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    expect(screen.getByText('Input Tokens')).toBeInTheDocument();
    expect(screen.getByText('Output Tokens')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Job Count')).toBeInTheDocument();
    expect(screen.getByText('Quality')).toBeInTheDocument();
  });

  it('displays formatted token values (compact notation)', () => {
    const participants = [
      createParticipant({
        telemetry: {
          inputTokens: { state: 'available', value: 1200000 },
          outputTokens: { state: 'available', value: 300000 },
          totalTokens: { state: 'available', value: 1500000 },
          durationMs: { state: 'available', value: 154000 },
          costUsd: { state: 'available', value: 1.25 },
          jobCount: { state: 'available', value: 3 },
          hasPartialData: false,
        },
      }),
    ];
    renderWithProviders(<ComparisonOperationalMetrics participants={participants} />);

    expect(screen.getByText('1.5M')).toBeInTheDocument();
    expect(screen.getByText('1.2M')).toBeInTheDocument();
    expect(screen.getByText('300K')).toBeInTheDocument();
    expect(screen.getByText('$1.25')).toBeInTheDocument();
    expect(screen.getByText('2m 34s')).toBeInTheDocument();
  });

  it('highlights best value per row (lowest for cost/tokens/duration, highest for quality)', () => {
    const participants = [
      createParticipant({
        ticketId: 1,
        ticketKey: 'AIB-1',
        telemetry: {
          inputTokens: { state: 'available', value: 500 },
          outputTokens: { state: 'available', value: 200 },
          totalTokens: { state: 'available', value: 700 },
          durationMs: { state: 'available', value: 60000 },
          costUsd: { state: 'available', value: 0.50 },
          jobCount: { state: 'available', value: 1 },
          hasPartialData: false,
        },
        quality: { state: 'available', value: 92 },
      }),
      createParticipant({
        ticketId: 2,
        ticketKey: 'AIB-2',
        rank: 2,
        telemetry: {
          inputTokens: { state: 'available', value: 1000 },
          outputTokens: { state: 'available', value: 400 },
          totalTokens: { state: 'available', value: 1400 },
          durationMs: { state: 'available', value: 120000 },
          costUsd: { state: 'available', value: 1.00 },
          jobCount: { state: 'available', value: 2 },
          hasPartialData: false,
        },
        quality: { state: 'available', value: 75 },
      }),
    ];
    renderWithProviders(<ComparisonOperationalMetrics participants={participants} />);

    const bestBadges = screen.getAllByText('Best');
    // Each metric row should have 1 best badge (7 rows total, each with a winner)
    expect(bestBadges.length).toBe(7);
  });

  it('shows "Pending" for pending telemetry and "N/A" for unavailable', () => {
    const participants = [
      createParticipant({
        ticketId: 1,
        ticketKey: 'AIB-1',
        telemetry: {
          inputTokens: { state: 'pending', value: null },
          outputTokens: { state: 'pending', value: null },
          totalTokens: { state: 'pending', value: null },
          durationMs: { state: 'pending', value: null },
          costUsd: { state: 'pending', value: null },
          jobCount: { state: 'pending', value: null },
          hasPartialData: false,
        },
        quality: { state: 'unavailable', value: null },
      }),
    ];
    renderWithProviders(<ComparisonOperationalMetrics participants={participants} />);

    const pendingCells = screen.getAllByText('Pending');
    expect(pendingCells.length).toBe(6); // 6 telemetry fields
    expect(screen.getByText('N/A')).toBeInTheDocument(); // quality unavailable
  });

  it('renders column headers with ticket key + workflow type badge + agent + model', () => {
    const participants = [
      createParticipant({
        ticketKey: 'AIB-10',
        workflowType: 'FULL',
        agent: 'CLAUDE',
        model: 'claude-sonnet-4-6',
      }),
    ];
    renderWithProviders(<ComparisonOperationalMetrics participants={participants} />);

    expect(screen.getByText('AIB-10')).toBeInTheDocument();
    // The header has its own FULL badge separate from metric rows
    const header = screen.getByText('AIB-10').closest('th');
    expect(header).toBeTruthy();
    expect(within(header!).getByText('FULL')).toBeInTheDocument();
    expect(within(header!).getByText('CLAUDE')).toBeInTheDocument();
    expect(within(header!).getByText('claude-sonnet-4-6')).toBeInTheDocument();
  });

  it('handles 6 participants without truncation', () => {
    const participants = Array.from({ length: 6 }, (_, i) =>
      createParticipant({
        ticketId: i + 1,
        ticketKey: `AIB-${i + 1}`,
        rank: i + 1,
      })
    );
    renderWithProviders(<ComparisonOperationalMetrics participants={participants} />);

    for (let i = 1; i <= 6; i++) {
      expect(screen.getByText(`AIB-${i}`)).toBeInTheDocument();
    }
    // All 7 metric rows should still render
    expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    expect(screen.getByText('Quality')).toBeInTheDocument();
  });
});
