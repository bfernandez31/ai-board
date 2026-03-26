import { describe, expect, it } from 'vitest';
import { ComparisonUnifiedMetrics } from '@/components/comparison/comparison-unified-metrics';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import type { ComparisonParticipantDetail } from '@/lib/types/comparison';

function makeParticipant(overrides?: Partial<ComparisonParticipantDetail>): ComparisonParticipantDetail {
  return {
    ticketId: 1,
    ticketKey: 'AIB-101',
    title: 'Ticket',
    stage: 'VERIFY' as const,
    workflowType: 'FULL' as const,
    agent: null,
    rank: 1,
    score: 90,
    rankRationale: 'Best',
    quality: { state: 'available', value: 88 },
    qualityBreakdown: { state: 'unavailable', value: null },
    telemetry: {
      inputTokens: { state: 'available', value: 5000 },
      outputTokens: { state: 'available', value: 3000 },
      totalTokens: { state: 'available', value: 8000 },
      durationMs: { state: 'available', value: 120000 },
      costUsd: { state: 'available', value: 1.50 },
      jobCount: { state: 'available', value: 2 },
      primaryModel: { state: 'available', value: 'claude-sonnet-4-6' },
    },
    metrics: {
      linesAdded: 100,
      linesRemoved: 20,
      linesChanged: 120,
      filesChanged: 8,
      testFilesChanged: 3,
      changedFiles: [],
      bestValueFlags: {},
    },
    ...overrides,
  };
}

describe('ComparisonUnifiedMetrics', () => {
  const p1 = makeParticipant();
  const p2 = makeParticipant({
    ticketId: 2,
    ticketKey: 'AIB-102',
    rank: 2,
    telemetry: {
      inputTokens: { state: 'available', value: 8000 },
      outputTokens: { state: 'available', value: 5000 },
      totalTokens: { state: 'available', value: 13000 },
      durationMs: { state: 'available', value: 200000 },
      costUsd: { state: 'available', value: 2.50 },
      jobCount: { state: 'available', value: 3 },
      primaryModel: { state: 'available', value: 'claude-sonnet-4-6' },
    },
    metrics: {
      linesAdded: 200,
      linesRemoved: 50,
      linesChanged: 250,
      filesChanged: 12,
      testFilesChanged: 5,
      changedFiles: [],
      bestValueFlags: {},
    },
  });

  it('renders all 9 metric rows', () => {
    renderWithProviders(<ComparisonUnifiedMetrics participants={[p1, p2]} />);

    expect(screen.getByText('Lines Changed')).toBeInTheDocument();
    expect(screen.getByText('Files Changed')).toBeInTheDocument();
    expect(screen.getByText('Test Files Changed')).toBeInTheDocument();
    expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    expect(screen.getByText('Input Tokens')).toBeInTheDocument();
    expect(screen.getByText('Output Tokens')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Job Count')).toBeInTheDocument();
  });

  it('renders participant column headers', () => {
    renderWithProviders(<ComparisonUnifiedMetrics participants={[p1, p2]} />);

    expect(screen.getAllByText('AIB-101').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AIB-102').length).toBeGreaterThan(0);
  });

  it('renders stacked participant bars for metrics', () => {
    const { container } = renderWithProviders(
      <ComparisonUnifiedMetrics participants={[p1, p2]} />
    );

    const bars = container.querySelectorAll('[data-testid="metric-bar"]');
    expect(bars.length).toBeGreaterThan(0);
  });

  it('renders a participant color legend', () => {
    renderWithProviders(<ComparisonUnifiedMetrics participants={[p1, p2]} />);

    expect(screen.getByTestId('metrics-legend')).toBeInTheDocument();
  });

  it('handles pending enrichment state', () => {
    const pendingP = makeParticipant({
      ticketId: 3,
      ticketKey: 'AIB-103',
      telemetry: {
        inputTokens: { state: 'pending', value: null },
        outputTokens: { state: 'pending', value: null },
        totalTokens: { state: 'pending', value: null },
        durationMs: { state: 'pending', value: null },
        costUsd: { state: 'pending', value: null },
        jobCount: { state: 'pending', value: null },
        primaryModel: { state: 'pending', value: null },
      },
    });

    renderWithProviders(<ComparisonUnifiedMetrics participants={[p1, pendingP]} />);

    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
  });

  it('handles unavailable enrichment state', () => {
    const unavailableP = makeParticipant({
      ticketId: 3,
      ticketKey: 'AIB-103',
      telemetry: {
        inputTokens: { state: 'unavailable', value: null },
        outputTokens: { state: 'unavailable', value: null },
        totalTokens: { state: 'unavailable', value: null },
        durationMs: { state: 'unavailable', value: null },
        costUsd: { state: 'unavailable', value: null },
        jobCount: { state: 'unavailable', value: null },
        primaryModel: { state: 'unavailable', value: null },
      },
    });

    renderWithProviders(<ComparisonUnifiedMetrics participants={[p1, unavailableP]} />);

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('has sticky first column', () => {
    const { container } = renderWithProviders(<ComparisonUnifiedMetrics participants={[p1, p2]} />);

    const stickyHeaders = container.querySelectorAll('.sticky.left-0');
    expect(stickyHeaders.length).toBe(0);
  });

  it('highlights best metric values with participant accent text', () => {
    renderWithProviders(<ComparisonUnifiedMetrics participants={[p1, p2]} />);

    expect(screen.getByTestId('metric-value-linesChanged-1').className).toContain('text-ctp-green');
  });
});
