import { describe, expect, it } from 'vitest';
import { ComparisonOperationalMetrics } from '@/components/comparison/comparison-operational-metrics';
import { renderWithProviders, screen, within } from '@/tests/utils/component-test-utils';
import type { ComparisonParticipantDetail } from '@/lib/types/comparison';

function makeParticipant(
  overrides: Partial<ComparisonParticipantDetail> & { ticketId: number; ticketKey: string }
): ComparisonParticipantDetail {
  return {
    title: 'Test ticket',
    stage: 'VERIFY',
    workflowType: 'FULL',
    agent: null,
    rank: 1,
    score: 90,
    rankRationale: 'Good',
    quality: { state: 'available', value: 87 },
    qualityBreakdown: { state: 'unavailable', value: null },
    telemetry: {
      inputTokens: { state: 'available', value: 10000 },
      outputTokens: { state: 'available', value: 3000 },
      totalTokens: { state: 'available', value: 13000 },
      durationMs: { state: 'available', value: 154000 },
      costUsd: { state: 'available', value: 1.23 },
      jobCount: { state: 'available', value: 2 },
      primaryModel: { state: 'available', value: 'claude-sonnet-4-6' },
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
    ...overrides,
  };
}

describe('ComparisonOperationalMetrics', () => {
  it('renders all 7 metric rows with correct labels', () => {
    const participants = [makeParticipant({ ticketId: 1, ticketKey: 'AIB-1' })];
    renderWithProviders(<ComparisonOperationalMetrics participants={participants} />);

    expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    expect(screen.getByText('Input Tokens')).toBeInTheDocument();
    expect(screen.getByText('Output Tokens')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Job Count')).toBeInTheDocument();
    expect(screen.getByText('Quality Score')).toBeInTheDocument();
  });

  it('highlights best values on correct cells (lowest for cost/tokens/duration/jobs, highest for quality)', () => {
    const participants = [
      makeParticipant({
        ticketId: 1,
        ticketKey: 'AIB-1',
        quality: { state: 'available', value: 87 },
        telemetry: {
          inputTokens: { state: 'available', value: 10000 },
          outputTokens: { state: 'available', value: 3000 },
          totalTokens: { state: 'available', value: 13000 },
          durationMs: { state: 'available', value: 100000 },
          costUsd: { state: 'available', value: 2.0 },
          jobCount: { state: 'available', value: 3 },
          primaryModel: { state: 'available', value: 'claude-sonnet-4-6' },
        },
      }),
      makeParticipant({
        ticketId: 2,
        ticketKey: 'AIB-2',
        rank: 2,
        score: 80,
        quality: { state: 'available', value: 92 },
        telemetry: {
          inputTokens: { state: 'available', value: 8000 },
          outputTokens: { state: 'available', value: 2000 },
          totalTokens: { state: 'available', value: 10000 },
          durationMs: { state: 'available', value: 60000 },
          costUsd: { state: 'available', value: 1.0 },
          jobCount: { state: 'available', value: 1 },
          primaryModel: { state: 'available', value: 'claude-opus-4-6' },
        },
      }),
    ];

    renderWithProviders(<ComparisonOperationalMetrics participants={participants} />);

    // AIB-2 should have "Best" badges for all cost/tokens/duration metrics (lower values)
    // AIB-2 should have "Best" badge for quality (higher value: 92 > 87)
    const bestBadges = screen.getAllByText('Best');
    // 7 metric rows, AIB-2 wins all of them (lower tokens, lower cost, lower duration, higher quality)
    expect(bestBadges.length).toBe(7);
  });

  it('shows N/A for unavailable state and Pending for pending state', () => {
    const participants = [
      makeParticipant({
        ticketId: 1,
        ticketKey: 'AIB-1',
        quality: { state: 'unavailable', value: null },
        telemetry: {
          inputTokens: { state: 'pending', value: null },
          outputTokens: { state: 'pending', value: null },
          totalTokens: { state: 'pending', value: null },
          durationMs: { state: 'pending', value: null },
          costUsd: { state: 'pending', value: null },
          jobCount: { state: 'pending', value: null },
          primaryModel: { state: 'pending', value: null },
        },
      }),
    ];

    renderWithProviders(<ComparisonOperationalMetrics participants={participants} />);

    // 6 telemetry metrics are pending
    expect(screen.getAllByText('Pending')).toHaveLength(6);
    // Quality is unavailable
    expect(screen.getAllByText('N/A')).toHaveLength(1);
  });

  it('formats values correctly: tokens with commas, duration as Xm Ys, cost as $X.XX', () => {
    const participants = [
      makeParticipant({
        ticketId: 1,
        ticketKey: 'AIB-1',
        quality: { state: 'available', value: 87 },
        telemetry: {
          inputTokens: { state: 'available', value: 12345 },
          outputTokens: { state: 'available', value: 6789 },
          totalTokens: { state: 'available', value: 19134 },
          durationMs: { state: 'available', value: 154000 }, // 2m 34s
          costUsd: { state: 'available', value: 1.23 },
          jobCount: { state: 'available', value: 3 },
          primaryModel: { state: 'available', value: 'claude-sonnet-4-6' },
        },
      }),
    ];

    renderWithProviders(<ComparisonOperationalMetrics participants={participants} />);

    expect(screen.getByText('12,345')).toBeInTheDocument();
    expect(screen.getByText('6,789')).toBeInTheDocument();
    expect(screen.getByText('19,134')).toBeInTheDocument();
    expect(screen.getByText('2m 34s')).toBeInTheDocument();
    expect(screen.getByText('$1.23')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('87 Good')).toBeInTheDocument();
  });
});
