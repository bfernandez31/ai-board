/**
 * Component Tests: TicketStats
 *
 * Tests for the Stats tab component reactivity when jobs data changes.
 * Uses RTL for component testing per Testing Trophy architecture.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { TicketStats } from '@/components/ticket/ticket-stats';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';
import type { TicketJob } from '@/components/board/ticket-detail-modal';

/**
 * Helper to create a mock job with telemetry
 */
function createMockJob(
  overrides: Partial<TicketJobWithTelemetry> = {}
): TicketJobWithTelemetry {
  return {
    id: 1,
    command: 'specify',
    status: 'COMPLETED',
    branch: null,
    startedAt: '2025-01-01T10:00:00Z',
    completedAt: '2025-01-01T10:05:00Z',
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 200,
    cacheCreationTokens: 100,
    costUsd: 0.05,
    durationMs: 300000, // 5 minutes
    model: 'claude-opus-4-5',
    toolsUsed: ['Read', 'Edit'],
    qualityScore: null,
    qualityScoreDetails: null,
    log: null,
    ...overrides,
  };
}

/**
 * Helper to create a mock polled job
 */
function createMockPolledJob(
  overrides: Partial<TicketJob> = {}
): TicketJob {
  return {
    id: 1,
    ticketId: 1,
    status: 'COMPLETED',
    command: 'specify',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('TicketStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Stats display', () => {
    it('should display cost when jobs have telemetry data', () => {
      const jobs = [
        createMockJob({ id: 1, costUsd: 0.05 }),
        createMockJob({ id: 2, costUsd: 0.10 }),
      ];
      const polledJobs: TicketJob[] = [];

      renderWithProviders(
        <TicketStats jobs={jobs} polledJobs={polledJobs} />
      );

      // Total cost: $0.05 + $0.10 = $0.15
      expect(screen.getByTestId('total-cost')).toBeInTheDocument();
    });

    it('should display N/A when no telemetry data', () => {
      const jobs = [
        createMockJob({
          id: 1,
          costUsd: null,
          durationMs: null,
          inputTokens: null,
          outputTokens: null,
        }),
      ];
      const polledJobs: TicketJob[] = [];

      renderWithProviders(
        <TicketStats jobs={jobs} polledJobs={polledJobs} />
      );

      expect(screen.getByTestId('total-cost')).toHaveTextContent('N/A');
    });

    it('should display duration when jobs have timing data', () => {
      const jobs = [
        createMockJob({ id: 1, durationMs: 60000 }), // 1 minute
        createMockJob({ id: 2, durationMs: 120000 }), // 2 minutes
      ];
      const polledJobs: TicketJob[] = [];

      renderWithProviders(
        <TicketStats jobs={jobs} polledJobs={polledJobs} />
      );

      // Total duration: 3 minutes
      expect(screen.getByTestId('total-duration')).toBeInTheDocument();
    });

    it('should display token count when jobs have token data', () => {
      const jobs = [
        createMockJob({ id: 1, inputTokens: 1000, outputTokens: 500 }),
        createMockJob({ id: 2, inputTokens: 2000, outputTokens: 1000 }),
      ];
      const polledJobs: TicketJob[] = [];

      renderWithProviders(
        <TicketStats jobs={jobs} polledJobs={polledJobs} />
      );

      // Total tokens: (1000+500) + (2000+1000) = 4500
      expect(screen.getByTestId('total-tokens')).toBeInTheDocument();
    });
  });

  describe('Reactivity to prop changes', () => {
    it('should update stats when jobs prop changes', () => {
      const initialJobs = [
        createMockJob({ id: 1, costUsd: 0.05 }),
      ];
      const polledJobs: TicketJob[] = [];

      const { rerender } = renderWithProviders(
        <TicketStats jobs={initialJobs} polledJobs={polledJobs} />
      );

      // Initial render - check stats cards are displayed
      expect(screen.getByTestId('stats-summary-cards')).toBeInTheDocument();

      // Update with new job
      const updatedJobs = [
        createMockJob({ id: 1, costUsd: 0.05 }),
        createMockJob({ id: 2, costUsd: 0.20 }),
      ];

      rerender(<TicketStats jobs={updatedJobs} polledJobs={polledJobs} />);

      // Stats should still be displayed (with updated values)
      expect(screen.getByTestId('stats-summary-cards')).toBeInTheDocument();
    });

    it('should display jobs timeline', () => {
      const jobs = [
        createMockJob({ id: 1, command: 'specify' }),
        createMockJob({ id: 2, command: 'plan' }),
      ];
      const polledJobs: TicketJob[] = [
        createMockPolledJob({ id: 1, command: 'specify', status: 'COMPLETED' }),
        createMockPolledJob({ id: 2, command: 'plan', status: 'RUNNING' }),
      ];

      renderWithProviders(
        <TicketStats jobs={jobs} polledJobs={polledJobs} />
      );

      // Jobs timeline should be displayed
      expect(screen.getByTestId('jobs-timeline')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should handle empty jobs array gracefully', () => {
      const jobs: TicketJobWithTelemetry[] = [];
      const polledJobs: TicketJob[] = [];

      renderWithProviders(
        <TicketStats jobs={jobs} polledJobs={polledJobs} />
      );

      // Should display N/A for all stats
      expect(screen.getByTestId('total-cost')).toHaveTextContent('N/A');
      expect(screen.getByTestId('total-duration')).toHaveTextContent('N/A');
      expect(screen.getByTestId('total-tokens')).toHaveTextContent('N/A');
    });
  });

  describe('JobLog preview rendering (AIB-715 US2)', () => {
    it('renders distinct preview text across FAILED / COMPLETED / CANCELLED / UNAVAILABLE / PRUNED', () => {
      const jobs: TicketJobWithTelemetry[] = [
        createMockJob({
          id: 101,
          status: 'FAILED',
          log: { captureStatus: 'CAPTURED', preview: 'Bash command failed: exit 1' },
        }),
        createMockJob({
          id: 102,
          status: 'COMPLETED',
          log: { captureStatus: 'CAPTURED', preview: 'All tasks complete.' },
        }),
        createMockJob({
          id: 103,
          status: 'CANCELLED',
          log: { captureStatus: 'CAPTURED', preview: 'Cancelled (user-cancelled).' },
        }),
        createMockJob({
          id: 104,
          status: 'FAILED',
          log: { captureStatus: 'UNAVAILABLE', preview: 'Logs unavailable — capture failed.' },
        }),
        createMockJob({
          id: 105,
          status: 'COMPLETED',
          log: { captureStatus: 'PRUNED', preview: 'Logs no longer retained (30-day window expired).' },
        }),
      ];
      const polledJobs: TicketJob[] = [];

      renderWithProviders(
        <TicketStats jobs={jobs} polledJobs={polledJobs} projectId={1} ticketId={42} />
      );

      expect(screen.getByTestId('job-log-preview-101')).toHaveTextContent('Bash command failed');
      expect(screen.getByTestId('job-log-preview-102')).toHaveTextContent('All tasks complete');
      expect(screen.getByTestId('job-log-preview-103')).toHaveTextContent('user-cancelled');
      expect(screen.getByTestId('job-log-preview-104')).toHaveTextContent('Logs unavailable');
      expect(screen.getByTestId('job-log-preview-105')).toHaveTextContent('no longer retained');

      // CAPTURED rows expose the enabled trigger; UNAVAILABLE/PRUNED expose the disabled variant.
      expect(screen.getByTestId('view-full-logs-101')).toBeInTheDocument();
      expect(screen.getByTestId('view-full-logs-disabled-104')).toBeInTheDocument();
      expect(screen.getByTestId('view-full-logs-disabled-105')).toBeInTheDocument();
    });
  });
});
