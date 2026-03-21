import { describe, expect, it } from 'vitest';
import { ComparisonOperationalMetrics } from '@/components/comparison/comparison-operational-metrics';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
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
      linesAdded: 0,
      linesRemoved: 0,
      linesChanged: 0,
      filesChanged: 0,
      testFilesChanged: 0,
      changedFiles: [],
      bestValueFlags: {},
    },
    ...overrides,
  };
}

const participantA = makeParticipant({
  ticketId: 1,
  ticketKey: 'AIB-1',
  workflowType: 'FULL',
  agent: 'CLAUDE',
  quality: { state: 'available', value: 87 },
  qualityDetails: { state: 'unavailable', value: null },
  telemetry: {
    inputTokens: { state: 'available', value: 50000 },
    outputTokens: { state: 'available', value: 25000 },
    totalTokens: { state: 'available', value: 75000 },
    durationMs: { state: 'available', value: 120000 },
    costUsd: { state: 'available', value: 0.08 },
    jobCount: { state: 'available', value: 2 },
    model: { state: 'available', value: 'claude-sonnet-4-6' },
  },
});

const participantB = makeParticipant({
  ticketId: 2,
  ticketKey: 'AIB-2',
  workflowType: 'QUICK',
  rank: 2,
  score: 60,
  quality: { state: 'available', value: 72 },
  qualityDetails: { state: 'unavailable', value: null },
  telemetry: {
    inputTokens: { state: 'available', value: 80000 },
    outputTokens: { state: 'available', value: 30000 },
    totalTokens: { state: 'available', value: 110000 },
    durationMs: { state: 'available', value: 180000 },
    costUsd: { state: 'available', value: 0.12 },
    jobCount: { state: 'available', value: 3 },
    model: { state: 'available', value: 'claude-sonnet-4-6' },
  },
});

describe('ComparisonOperationalMetrics', () => {
  it('renders the section title', () => {
    renderWithProviders(
      <ComparisonOperationalMetrics participants={[participantA, participantB]} />
    );
    expect(screen.getByText('Operational Metrics')).toBeInTheDocument();
  });

  it('renders ticket key column headers', () => {
    renderWithProviders(
      <ComparisonOperationalMetrics participants={[participantA, participantB]} />
    );
    expect(screen.getByText('AIB-1')).toBeInTheDocument();
    expect(screen.getByText('AIB-2')).toBeInTheDocument();
  });

  it('renders all metric row labels', () => {
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

  it('highlights best values with badge', () => {
    renderWithProviders(
      <ComparisonOperationalMetrics participants={[participantA, participantB]} />
    );
    // AIB-1 has lower cost, duration, tokens, job count -> should have best value badges
    const bestBadges = screen.getAllByText('Best value');
    expect(bestBadges.length).toBeGreaterThan(0);
  });

  it('shows N/A for unavailable metrics', () => {
    const participantNoData = makeParticipant({
      ticketId: 3,
      ticketKey: 'AIB-3',
    });
    renderWithProviders(
      <ComparisonOperationalMetrics participants={[participantA, participantNoData]} />
    );
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('shows Pending for pending metrics', () => {
    const participantPending = makeParticipant({
      ticketId: 3,
      ticketKey: 'AIB-3',
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
      <ComparisonOperationalMetrics participants={[participantA, participantPending]} />
    );
    const pendingElements = screen.getAllByText('Pending');
    expect(pendingElements.length).toBeGreaterThan(0);
  });

  it('shows quality score with label for highest-is-best', () => {
    renderWithProviders(
      <ComparisonOperationalMetrics participants={[participantA, participantB]} />
    );
    // AIB-1 quality 87 is higher than AIB-2 quality 72 - should be best
    expect(screen.getByText(/87 Good/)).toBeInTheDocument();
  });
});
