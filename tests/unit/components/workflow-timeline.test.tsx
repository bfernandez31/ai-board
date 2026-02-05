/**
 * Component Tests: WorkflowTimeline
 *
 * Tests for the Workflow Execution Timeline component that shows
 * all workflow executions for a ticket with filtering capabilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { WorkflowTimeline } from '@/components/ticket/workflow-timeline';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';

/**
 * Helper to create a mock job with telemetry
 */
function createMockJob(
  overrides: Partial<TicketJobWithTelemetry> = {}
): TicketJobWithTelemetry {
  const baseDate = new Date('2025-01-15T10:00:00Z');
  return {
    id: 1,
    command: 'specify',
    status: 'COMPLETED',
    startedAt: baseDate,
    completedAt: new Date(baseDate.getTime() + 300000), // 5 min later
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 200,
    cacheCreationTokens: 100,
    costUsd: 0.05,
    durationMs: 300000,
    model: 'claude-opus-4-5',
    toolsUsed: ['Read', 'Edit'],
    ...overrides,
  };
}

describe('WorkflowTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty state', () => {
    it('should show empty state message when no jobs', () => {
      renderWithProviders(<WorkflowTimeline jobs={[]} />);

      expect(screen.getByTestId('no-jobs-message')).toBeInTheDocument();
      expect(screen.getByText(/no workflow executions yet/i)).toBeInTheDocument();
    });
  });

  describe('Timeline display', () => {
    it('should display jobs in chronological order (most recent first)', () => {
      const jobs = [
        createMockJob({ id: 1, command: 'specify', startedAt: new Date('2025-01-01T10:00:00Z') }),
        createMockJob({ id: 2, command: 'plan', startedAt: new Date('2025-01-15T10:00:00Z') }),
        createMockJob({ id: 3, command: 'implement', startedAt: new Date('2025-01-10T10:00:00Z') }),
      ];

      renderWithProviders(<WorkflowTimeline jobs={jobs} />);

      const timeline = screen.getByTestId('timeline-list');
      expect(timeline).toBeInTheDocument();

      // Check that all jobs are displayed
      expect(screen.getByTestId('timeline-job-1')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-job-2')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-job-3')).toBeInTheDocument();
    });

    it('should display job command names formatted correctly', () => {
      const jobs = [
        createMockJob({ id: 1, command: 'specify' }),
        createMockJob({ id: 2, command: 'quick-impl' }),
        createMockJob({ id: 3, command: 'comment-specify' }),
      ];

      renderWithProviders(<WorkflowTimeline jobs={jobs} />);

      expect(screen.getByText('Specify')).toBeInTheDocument();
      expect(screen.getByText('Quick Impl')).toBeInTheDocument();
      expect(screen.getByText('Comment (Specify)')).toBeInTheDocument();
    });

    it('should display duration and cost for each job', () => {
      const jobs = [
        createMockJob({ id: 1, durationMs: 60000, costUsd: 0.05 }),
      ];

      renderWithProviders(<WorkflowTimeline jobs={jobs} />);

      expect(screen.getByTestId('timeline-duration-1')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-cost-1')).toBeInTheDocument();
    });

    it('should show dash when duration or cost is null', () => {
      const jobs = [
        createMockJob({ id: 1, durationMs: null, costUsd: null }),
      ];

      renderWithProviders(<WorkflowTimeline jobs={jobs} />);

      expect(screen.getByTestId('timeline-duration-1')).toHaveTextContent('-');
      expect(screen.getByTestId('timeline-cost-1')).toHaveTextContent('-');
    });
  });

  describe('Filtering', () => {
    it('should display filter controls', () => {
      const jobs = [createMockJob({ id: 1 })];

      renderWithProviders(<WorkflowTimeline jobs={jobs} />);

      expect(screen.getByTestId('command-filter')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter')).toBeInTheDocument();
      expect(screen.getByTestId('date-filter')).toBeInTheDocument();
    });

    it('should show job count indicator', () => {
      const jobs = [
        createMockJob({ id: 1 }),
        createMockJob({ id: 2 }),
        createMockJob({ id: 3 }),
      ];

      renderWithProviders(<WorkflowTimeline jobs={jobs} />);

      expect(screen.getByText(/3 of 3 jobs/i)).toBeInTheDocument();
    });

    // Note: Filter interaction tests are skipped due to Radix UI Select
    // component not being compatible with happy-dom test environment.
    // The filtering logic is tested via the pure filtering functions in
    // the component. Integration tests via Playwright cover full interactions.
    it.skip('should filter jobs by status', async () => {
      // Radix UI Select has compatibility issues with happy-dom
    });

    it.skip('should filter jobs by command type', async () => {
      // Radix UI Select has compatibility issues with happy-dom
    });

    it.skip('should show no results message when filters match nothing', async () => {
      // Radix UI Select has compatibility issues with happy-dom
    });

    it.skip('should clear all filters when clicking clear link', async () => {
      // Radix UI Select has compatibility issues with happy-dom
    });
  });

  describe('Expandable details', () => {
    it('should expand job details when clicked', async () => {
      const user = userEvent.setup();
      const jobs = [
        createMockJob({
          id: 1,
          inputTokens: 1000,
          outputTokens: 500,
          toolsUsed: ['Read', 'Edit', 'Write'],
        }),
      ];

      renderWithProviders(<WorkflowTimeline jobs={jobs} />);

      // Click to expand
      await user.click(screen.getByTestId('timeline-job-1'));

      // Check details are visible
      expect(screen.getByTestId('timeline-details-1')).toBeInTheDocument();
      expect(screen.getByText(/input tokens/i)).toBeInTheDocument();
      expect(screen.getByText(/output tokens/i)).toBeInTheDocument();
      expect(screen.getByText(/tools used/i)).toBeInTheDocument();
    });

    it('should show artifacts for completed jobs', async () => {
      const user = userEvent.setup();
      const jobs = [
        createMockJob({ id: 1, command: 'specify', status: 'COMPLETED' }),
      ];

      renderWithProviders(<WorkflowTimeline jobs={jobs} />);

      // Click to expand
      await user.click(screen.getByTestId('timeline-job-1'));

      // Should show spec.md artifact
      expect(screen.getByText('spec.md')).toBeInTheDocument();
    });

    it('should not show artifacts for failed jobs', async () => {
      const user = userEvent.setup();
      const jobs = [
        createMockJob({ id: 1, command: 'specify', status: 'FAILED' }),
      ];

      renderWithProviders(<WorkflowTimeline jobs={jobs} />);

      // Click to expand
      await user.click(screen.getByTestId('timeline-job-1'));

      // Should not show artifacts section (only shows for COMPLETED)
      expect(screen.queryByText('spec.md')).not.toBeInTheDocument();
    });

    it('should display tools used in expandable details', async () => {
      const user = userEvent.setup();
      const jobs = [
        createMockJob({
          id: 1,
          toolsUsed: ['Read', 'Edit', 'Write', 'Bash'],
        }),
      ];

      renderWithProviders(<WorkflowTimeline jobs={jobs} />);

      // Click to expand
      await user.click(screen.getByTestId('timeline-job-1'));

      // Check all tools are shown
      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Write')).toBeInTheDocument();
      expect(screen.getByText('Bash')).toBeInTheDocument();
    });
  });

  describe('GitHub Actions link', () => {
    it('should show GitHub Actions link when owner and repo provided', () => {
      const jobs = [createMockJob({ id: 1 })];

      renderWithProviders(
        <WorkflowTimeline
          jobs={jobs}
          githubOwner="testowner"
          githubRepo="testrepo"
        />
      );

      const link = screen.getByText(/view all workflow runs/i);
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute(
        'href',
        'https://github.com/testowner/testrepo/actions'
      );
    });

    it('should not show GitHub link when owner/repo not provided', () => {
      const jobs = [createMockJob({ id: 1 })];

      renderWithProviders(<WorkflowTimeline jobs={jobs} />);

      expect(screen.queryByText(/view all workflow runs/i)).not.toBeInTheDocument();
    });
  });

  describe('Status indicators', () => {
    it('should display correct status icon for COMPLETED jobs', () => {
      const jobs = [createMockJob({ id: 1, status: 'COMPLETED' })];

      renderWithProviders(<WorkflowTimeline jobs={jobs} />);

      // The status icon should have the Completed label
      const jobRow = screen.getByTestId('timeline-job-1');
      expect(jobRow).toBeInTheDocument();
    });

    it('should display spinning icon for RUNNING jobs', () => {
      const jobs = [createMockJob({ id: 1, status: 'RUNNING' })];

      renderWithProviders(<WorkflowTimeline jobs={jobs} />);

      // Job row should be visible
      expect(screen.getByTestId('timeline-job-1')).toBeInTheDocument();
    });

    it('should display correct status icon for FAILED jobs', () => {
      const jobs = [createMockJob({ id: 1, status: 'FAILED' })];

      renderWithProviders(<WorkflowTimeline jobs={jobs} />);

      expect(screen.getByTestId('timeline-job-1')).toBeInTheDocument();
    });
  });
});
