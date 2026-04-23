/**
 * Component tests for the log-preview additions on JobsTimeline (AIB-723).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { JobsTimeline } from '@/components/ticket/jobs-timeline';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';

function makeJob(overrides: Partial<TicketJobWithTelemetry> = {}): TicketJobWithTelemetry {
  return {
    id: 42,
    command: 'specify',
    status: 'COMPLETED',
    branch: null,
    startedAt: '2026-04-23T10:00:00Z',
    completedAt: '2026-04-23T10:01:00Z',
    inputTokens: null,
    outputTokens: null,
    cacheReadTokens: null,
    cacheCreationTokens: null,
    costUsd: null,
    durationMs: null,
    model: null,
    toolsUsed: [],
    qualityScore: null,
    qualityScoreDetails: null,
    ...overrides,
  };
}

describe('JobsTimeline log preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the log summary inline when present', () => {
    const job = makeJob({ hasLog: true, logSummary: 'Wrote 3 files · finished cleanly' });
    renderWithProviders(<JobsTimeline jobs={[job]} projectId={1} ticketId={10} />);
    expect(screen.getByTestId(`job-log-summary-${job.id}`)).toHaveTextContent(
      'Wrote 3 files · finished cleanly'
    );
  });

  it('shows the View full logs button only when logs exist and routing info is available', () => {
    const withLog = makeJob({ id: 1, hasLog: true, logSummary: 's' });
    const withoutLog = makeJob({ id: 2, hasLog: false, logSummary: null });
    renderWithProviders(<JobsTimeline jobs={[withLog, withoutLog]} projectId={1} ticketId={10} />);

    expect(screen.getByTestId('view-logs-1')).toBeInTheDocument();
    expect(screen.queryByTestId('view-logs-2')).not.toBeInTheDocument();
  });

  it('hides the View logs button when projectId / ticketId are not provided', () => {
    const job = makeJob({ id: 5, hasLog: true, logSummary: 's' });
    renderWithProviders(<JobsTimeline jobs={[job]} />);
    expect(screen.queryByTestId('view-logs-5')).not.toBeInTheDocument();
  });
});
