import { describe, expect, it } from 'vitest';
import { ComparisonOperationalMetrics } from '@/components/comparison/comparison-operational-metrics';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import type { ComparisonParticipantDetail } from '@/lib/types/comparison';

function makeParticipant(
  overrides: Partial<ComparisonParticipantDetail> & { ticketId: number; ticketKey: string }
): ComparisonParticipantDetail {
  return {
    title: 'Test ticket',
    stage: 'VERIFY' as const,
    workflowType: 'FULL' as const,
    agent: null,
    rank: 1,
    score: 80,
    rankRationale: 'Good',
    quality: { state: 'unavailable', value: null },
    qualityDetails: { state: 'unavailable', value: null },
    telemetry: {
      inputTokens: { state: 'unavailable', value: null },
      outputTokens: { state: 'unavailable', value: null },
      totalTokens: { state: 'unavailable', value: null },
      durationMs: { state: 'unavailable', value: null },
      costUsd: { state: 'unavailable', value: null },
      jobCount: { state: 'unavailable', value: null },
      model: { state: 'unavailable', value: null },
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
    ...overrides,
  };
}

const participantA = makeParticipant({
  ticketId: 1,
  ticketKey: 'AIB-10',
  workflowType: 'FULL',
  agent: 'CLAUDE',
  quality: { state: 'available', value: 87 },
  telemetry: {
    inputTokens: { state: 'available', value: 5000 },
    outputTokens: { state: 'available', value: 2000 },
    totalTokens: { state: 'available', value: 7000 },
    durationMs: { state: 'available', value: 120000 },
    costUsd: { state: 'available', value: 0.15 },
    jobCount: { state: 'available', value: 3 },
    model: { state: 'available', value: 'claude-sonnet-4-20250514' },
  },
});

const participantB = makeParticipant({
  ticketId: 2,
  ticketKey: 'AIB-11',
  workflowType: 'QUICK',
  agent: 'CODEX',
  rank: 2,
  quality: { state: 'available', value: 72 },
  telemetry: {
    inputTokens: { state: 'available', value: 8000 },
    outputTokens: { state: 'available', value: 3000 },
    totalTokens: { state: 'available', value: 11000 },
    durationMs: { state: 'available', value: 200000 },
    costUsd: { state: 'available', value: 0.25 },
    jobCount: { state: 'available', value: 5 },
    model: { state: 'available', value: 'codex-mini-latest' },
  },
});

describe('ComparisonOperationalMetrics', () => {
  it('renders the section title and ticket columns', () => {
    renderWithProviders(
      <ComparisonOperationalMetrics participants={[participantA, participantB]} />
    );

    expect(screen.getByText('Operational Metrics')).toBeInTheDocument();
    expect(screen.getByText('AIB-10')).toBeInTheDocument();
    expect(screen.getByText('AIB-11')).toBeInTheDocument();
  });

  it('renders metric row labels', () => {
    renderWithProviders(
      <ComparisonOperationalMetrics participants={[participantA, participantB]} />
    );

    expect(screen.getByText('Total tokens')).toBeInTheDocument();
    expect(screen.getByText('Input tokens')).toBeInTheDocument();
    expect(screen.getByText('Output tokens')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Job count')).toBeInTheDocument();
    expect(screen.getByText('Quality')).toBeInTheDocument();
  });

  it('highlights best values when multiple participants have data', () => {
    renderWithProviders(
      <ComparisonOperationalMetrics participants={[participantA, participantB]} />
    );

    // participantA has lower totals on all metrics and higher quality
    const bestBadges = screen.getAllByText('Best value');
    expect(bestBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows N/A for unavailable telemetry', () => {
    const unavailable = makeParticipant({
      ticketId: 3,
      ticketKey: 'AIB-12',
    });

    renderWithProviders(
      <ComparisonOperationalMetrics participants={[unavailable]} />
    );

    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThanOrEqual(6);
  });

  it('shows pending state for pending telemetry', () => {
    const pending = makeParticipant({
      ticketId: 4,
      ticketKey: 'AIB-13',
      quality: { state: 'pending', value: null },
      telemetry: {
        inputTokens: { state: 'pending', value: null },
        outputTokens: { state: 'pending', value: null },
        totalTokens: { state: 'pending', value: null },
        durationMs: { state: 'pending', value: null },
        costUsd: { state: 'pending', value: null },
        jobCount: { state: 'pending', value: null },
        model: { state: 'pending', value: null },
      },
    });

    renderWithProviders(
      <ComparisonOperationalMetrics participants={[pending]} />
    );

    const pendingElements = screen.getAllByText('Pending');
    expect(pendingElements.length).toBeGreaterThanOrEqual(6);
  });
});
