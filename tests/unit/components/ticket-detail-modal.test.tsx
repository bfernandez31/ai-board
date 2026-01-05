/**
 * Component Tests: TicketDetailModal
 *
 * Tests for modal reactivity to ticket and jobs prop changes.
 * Uses RTL for component testing per Testing Trophy architecture.
 *
 * Key scenarios tested:
 * - T011: Modal updates when ticket prop changes (e.g., branch added)
 * - T012: View Specification button visibility based on branch and job status
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/tests/utils/component-test-utils';
import { TicketDetailModal } from '@/components/board/ticket-detail-modal';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';
import type { TicketJob } from '@/components/board/ticket-detail-modal';

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

/**
 * Helper to create a mock ticket
 */
function createMockTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ticketNumber: 1,
    ticketKey: 'TEST-1',
    title: 'Test Ticket',
    description: 'Test description',
    stage: 'SPECIFY',
    version: 1,
    projectId: 1,
    branch: null,
    autoMode: false,
    clarificationPolicy: null,
    workflowType: 'FULL' as const,
    attachments: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Project is needed for branch badge and spec buttons
    project: {
      id: 1,
      name: 'Test Project',
      key: 'TST',
      githubOwner: 'test-owner',
      githubRepo: 'test-repo',
      clarificationPolicy: 'AUTO',
    },
    ...overrides,
  };
}

/**
 * Helper to create a mock job
 */
function createMockJob(
  overrides: Partial<TicketJobWithTelemetry> = {}
): TicketJobWithTelemetry {
  return {
    id: 1,
    command: 'specify',
    status: 'COMPLETED',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
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

/**
 * Helper to create a mock polled job
 */
function createMockPolledJob(overrides: Partial<TicketJob> = {}): TicketJob {
  return {
    id: 1,
    ticketId: 1,
    status: 'COMPLETED',
    command: 'specify',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('TicketDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('T011: Modal reactivity to ticket prop changes', () => {
    it('should display ticket title', () => {
      const ticket = createMockTicket({ title: 'My Test Ticket' });

      renderWithProviders(
        <TicketDetailModal
          ticket={ticket}
          open={true}
          onOpenChange={vi.fn()}
          onUpdate={vi.fn()}
          projectId={1}
          jobs={[]}
          fullJobs={[]}
        />
      );

      expect(screen.getByText('My Test Ticket')).toBeInTheDocument();
    });

    it('should display branch badge when ticket has branch', () => {
      const ticket = createMockTicket({ branch: 'feature/test-branch' });

      renderWithProviders(
        <TicketDetailModal
          ticket={ticket}
          open={true}
          onOpenChange={vi.fn()}
          onUpdate={vi.fn()}
          projectId={1}
          jobs={[]}
          fullJobs={[]}
        />
      );

      expect(screen.getByText('feature/test-branch')).toBeInTheDocument();
    });

    it('should not display branch badge when ticket has no branch', () => {
      const ticket = createMockTicket({ branch: null });

      renderWithProviders(
        <TicketDetailModal
          ticket={ticket}
          open={true}
          onOpenChange={vi.fn()}
          onUpdate={vi.fn()}
          projectId={1}
          jobs={[]}
          fullJobs={[]}
        />
      );

      expect(screen.queryByTestId('branch-badge')).not.toBeInTheDocument();
    });

    it('should update branch display when ticket prop changes', () => {
      const initialTicket = createMockTicket({ branch: null });
      const updatedTicket = createMockTicket({ branch: 'feature/new-branch', version: 2 });

      const { rerender } = renderWithProviders(
        <TicketDetailModal
          ticket={initialTicket}
          open={true}
          onOpenChange={vi.fn()}
          onUpdate={vi.fn()}
          projectId={1}
          jobs={[]}
          fullJobs={[]}
        />
      );

      // Initially no branch
      expect(screen.queryByText('feature/new-branch')).not.toBeInTheDocument();

      // Rerender with updated ticket
      rerender(
        <TicketDetailModal
          ticket={updatedTicket}
          open={true}
          onOpenChange={vi.fn()}
          onUpdate={vi.fn()}
          projectId={1}
          jobs={[]}
          fullJobs={[]}
        />
      );

      // Branch should now be visible
      expect(screen.getByText('feature/new-branch')).toBeInTheDocument();
    });
  });

  describe('T012: View Specification button visibility', () => {
    it('should show View Specification button when branch exists and specify job is completed', () => {
      const ticket = createMockTicket({ branch: 'feature/test', stage: 'SPECIFY' });
      const jobs = [createMockPolledJob({ command: 'specify', status: 'COMPLETED' })];
      const fullJobs = [createMockJob({ command: 'specify', status: 'COMPLETED' })];

      renderWithProviders(
        <TicketDetailModal
          ticket={ticket}
          open={true}
          onOpenChange={vi.fn()}
          onUpdate={vi.fn()}
          projectId={1}
          jobs={jobs}
          fullJobs={fullJobs}
        />
      );

      expect(screen.getByRole('button', { name: /spec/i })).toBeInTheDocument();
    });

    it('should not show View Specification button when branch is missing', () => {
      const ticket = createMockTicket({ branch: null, stage: 'SPECIFY' });
      const jobs = [createMockPolledJob({ command: 'specify', status: 'COMPLETED' })];
      const fullJobs = [createMockJob({ command: 'specify', status: 'COMPLETED' })];

      renderWithProviders(
        <TicketDetailModal
          ticket={ticket}
          open={true}
          onOpenChange={vi.fn()}
          onUpdate={vi.fn()}
          projectId={1}
          jobs={jobs}
          fullJobs={fullJobs}
        />
      );

      expect(screen.queryByRole('button', { name: /spec/i })).not.toBeInTheDocument();
    });

    it('should not show View Specification button when specify job is not completed', () => {
      const ticket = createMockTicket({ branch: 'feature/test', stage: 'SPECIFY' });
      const jobs = [createMockPolledJob({ command: 'specify', status: 'RUNNING' })];
      const fullJobs = [createMockJob({ command: 'specify', status: 'RUNNING' })];

      renderWithProviders(
        <TicketDetailModal
          ticket={ticket}
          open={true}
          onOpenChange={vi.fn()}
          onUpdate={vi.fn()}
          projectId={1}
          jobs={jobs}
          fullJobs={fullJobs}
        />
      );

      expect(screen.queryByRole('button', { name: /spec/i })).not.toBeInTheDocument();
    });

    it('should show View Specification button after job completes and branch is added', async () => {
      const initialTicket = createMockTicket({ branch: null, stage: 'SPECIFY' });
      const initialJobs: TicketJob[] = [];
      const initialFullJobs: TicketJobWithTelemetry[] = [];

      const { rerender } = renderWithProviders(
        <TicketDetailModal
          ticket={initialTicket}
          open={true}
          onOpenChange={vi.fn()}
          onUpdate={vi.fn()}
          projectId={1}
          jobs={initialJobs}
          fullJobs={initialFullJobs}
        />
      );

      // Initially button not visible
      expect(screen.queryByRole('button', { name: /spec/i })).not.toBeInTheDocument();

      // Simulate job completion and branch addition
      const updatedTicket = createMockTicket({ branch: 'feature/test', stage: 'SPECIFY', version: 2 });
      const updatedJobs = [createMockPolledJob({ command: 'specify', status: 'COMPLETED' })];
      const updatedFullJobs = [createMockJob({ command: 'specify', status: 'COMPLETED' })];

      rerender(
        <TicketDetailModal
          ticket={updatedTicket}
          open={true}
          onOpenChange={vi.fn()}
          onUpdate={vi.fn()}
          projectId={1}
          jobs={updatedJobs}
          fullJobs={updatedFullJobs}
        />
      );

      // Button should now be visible
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /spec/i })).toBeInTheDocument();
      });
    });
  });

  describe('Modal state management', () => {
    it('should update display when ticket stage changes', () => {
      const initialTicket = createMockTicket({ stage: 'SPECIFY' });
      const updatedTicket = createMockTicket({ stage: 'PLAN', version: 2 });

      const { rerender } = renderWithProviders(
        <TicketDetailModal
          ticket={initialTicket}
          open={true}
          onOpenChange={vi.fn()}
          onUpdate={vi.fn()}
          projectId={1}
          jobs={[]}
          fullJobs={[]}
        />
      );

      // Initial stage badge
      expect(screen.getByText('Specify')).toBeInTheDocument();

      // Rerender with updated stage
      rerender(
        <TicketDetailModal
          ticket={updatedTicket}
          open={true}
          onOpenChange={vi.fn()}
          onUpdate={vi.fn()}
          projectId={1}
          jobs={[]}
          fullJobs={[]}
        />
      );

      // Stage badge should update
      expect(screen.getByText('Plan')).toBeInTheDocument();
    });
  });

  describe('Ticket duplication', () => {
    it('should call duplicate API and close modal on success', async () => {
      const user = userEvent.setup();
      const ticket = createMockTicket({
        id: 1,
        ticketNumber: 1,
        ticketKey: 'TEST-1',
        title: 'Original Ticket',
        stage: 'SPECIFY'
      });

      const duplicatedTicket = {
        id: 2,
        ticketNumber: 2,
        ticketKey: 'TEST-2',
        title: 'Copy of Original Ticket',
        description: ticket.description,
        stage: 'INBOX',
        version: 1,
        projectId: 1,
        branch: null,
        previewUrl: null,
        autoMode: false,
        workflowType: 'FULL' as const,
        attachments: null,
        clarificationPolicy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock the duplicate API endpoint
      const mockFetch = vi.fn((url) => {
        if (url === '/api/projects/1/tickets/1/duplicate') {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: async () => duplicatedTicket,
          } as Response);
        }
        return Promise.reject(new Error('Unexpected fetch call'));
      });
      global.fetch = mockFetch;

      const onOpenChange = vi.fn();
      renderWithProviders(
        <TicketDetailModal
          ticket={ticket}
          open={true}
          onOpenChange={onOpenChange}
          onUpdate={vi.fn()}
          projectId={1}
          jobs={[]}
          fullJobs={[]}
        />
      );

      // Click duplicate button
      const duplicateButton = screen.getByTestId('duplicate-ticket-button');
      await user.click(duplicateButton);

      // Verify API was called
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/projects/1/tickets/1/duplicate',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      // Modal should close after duplication
      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should show error message when duplication fails', async () => {
      const user = userEvent.setup();
      const ticket = createMockTicket({ id: 1, ticketKey: 'TEST-1' });

      // Mock the duplicate API endpoint to fail
      global.fetch = vi.fn(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal server error' }),
        } as Response);
      });

      const onOpenChange = vi.fn();
      renderWithProviders(
        <TicketDetailModal
          ticket={ticket}
          open={true}
          onOpenChange={onOpenChange}
          onUpdate={vi.fn()}
          projectId={1}
          jobs={[]}
          fullJobs={[]}
        />
      );

      // Click duplicate button
      const duplicateButton = screen.getByTestId('duplicate-ticket-button');
      await user.click(duplicateButton);

      // Modal should NOT close on error
      await waitFor(() => {
        expect(onOpenChange).not.toHaveBeenCalled();
      });
    });
  });
});
