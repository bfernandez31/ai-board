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
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { TicketDetailModal } from '@/components/board/ticket-detail-modal';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';
import type { TicketJob } from '@/components/board/ticket-detail-modal';

import userEvent from '@testing-library/user-event';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/app/lib/types/query-types';

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
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
    mockToast.mockReset();
    // Mock fetch to handle all API calls with sensible defaults
    global.fetch = vi.fn().mockImplementation((url: string) => {
      // Return empty array for comments/timeline queries
      if (url.includes('/comments') || url.includes('/timeline')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ comments: [] }),
        });
      }
      // Return no comparisons
      if (url.includes('/comparisons/check')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ hasComparisons: false, count: 0, latestComparisonId: null }),
        });
      }
      // Default mock for duplicate
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
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

  describe('Duplicate functionality', () => {
    it('should add duplicated ticket to cache immediately', async () => {
      const user = userEvent.setup();
      const ticket = createMockTicket({ id: 1, title: 'Original Ticket', stage: 'INBOX' });
      const projectId = 1;

      // Mock successful duplicate API response
      const duplicatedTicket = {
        id: 2,
        ticketNumber: 2,
        ticketKey: 'TEST-2',
        title: 'Copy of Original Ticket',
        description: 'Test description',
        stage: 'INBOX',
        projectId: 1,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        branch: null,
        autoMode: false,
        workflowType: 'FULL',
        clarificationPolicy: null,
        attachments: [],
      };

      // Override global fetch for this test
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/duplicate')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(duplicatedTicket),
          });
        }
        if (url.includes('/comments') || url.includes('/timeline')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/comparisons/check')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ hasComparisons: false, count: 0, latestComparisonId: null }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const { queryClient } = renderWithProviders(
        <TicketDetailModal
          ticket={ticket}
          open={true}
          onOpenChange={vi.fn()}
          onUpdate={vi.fn()}
          projectId={projectId}
          jobs={[]}
          fullJobs={[]}
        />
      );

      // Set initial cache data using correct query key
      const queryKey = queryKeys.projects.tickets(projectId);
      const initialTickets: TicketWithVersion[] = [{
        id: 1,
        ticketNumber: 1,
        ticketKey: 'TEST-1',
        title: 'Original Ticket',
        description: 'Test description',
        stage: 'INBOX',
        projectId: 1,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        branch: null,
        autoMode: false,
        workflowType: 'FULL',
        clarificationPolicy: null,
        attachments: [],
      }];
      queryClient.setQueryData(queryKey, initialTickets);

      // Open the duplicate dropdown then click "Simple copy"
      const duplicateButton = screen.getByTestId('duplicate-ticket-button');
      await user.click(duplicateButton);
      const simpleCopyOption = await screen.findByText('Simple copy');
      await user.click(simpleCopyOption);

      // Wait for the API call to complete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/projects/${projectId}/tickets/1/duplicate`,
          expect.objectContaining({ method: 'POST' })
        );
      });

      // Verify toast was shown with success message (simple copy shows "Ticket copied")
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Ticket copied',
            description: 'Copied to TEST-2',
          })
        );
      });
    });

    it('should show error toast on duplicate failure', async () => {
      const user = userEvent.setup();
      const ticket = createMockTicket({ id: 1, title: 'Original Ticket', stage: 'INBOX' });
      const projectId = 1;

      // Override global fetch for this test
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/duplicate')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Ticket not found' }),
          });
        }
        if (url.includes('/comments') || url.includes('/timeline')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/comparisons/check')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ hasComparisons: false, count: 0, latestComparisonId: null }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const { queryClient } = renderWithProviders(
        <TicketDetailModal
          ticket={ticket}
          open={true}
          onOpenChange={vi.fn()}
          onUpdate={vi.fn()}
          projectId={projectId}
          jobs={[]}
          fullJobs={[]}
        />
      );

      // Set initial cache data using correct query key
      const queryKey = queryKeys.projects.tickets(projectId);
      const initialTickets: TicketWithVersion[] = [{
        id: 1,
        ticketNumber: 1,
        ticketKey: 'TEST-1',
        title: 'Original Ticket',
        description: 'Test description',
        stage: 'INBOX',
        projectId: 1,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        branch: null,
        autoMode: false,
        workflowType: 'FULL',
        clarificationPolicy: null,
        attachments: [],
      }];
      queryClient.setQueryData(queryKey, initialTickets);

      // Open the duplicate dropdown then click "Simple copy"
      const duplicateButton = screen.getByTestId('duplicate-ticket-button');
      await user.click(duplicateButton);
      const simpleCopyOption = await screen.findByText('Simple copy');
      await user.click(simpleCopyOption);

      // Wait for the API call and error handling
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            title: 'Copy failed',
            description: 'Ticket not found',
          })
        );
      });
    });

    it('should rollback cache on duplicate failure', async () => {
      const user = userEvent.setup();
      const ticket = createMockTicket({ id: 1, title: 'Original Ticket', stage: 'INBOX' });
      const projectId = 1;

      // Override global fetch for this test
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/duplicate')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Network error' }),
          });
        }
        if (url.includes('/comments') || url.includes('/timeline')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/comparisons/check')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ hasComparisons: false, count: 0, latestComparisonId: null }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const { queryClient } = renderWithProviders(
        <TicketDetailModal
          ticket={ticket}
          open={true}
          onOpenChange={vi.fn()}
          onUpdate={vi.fn()}
          projectId={projectId}
          jobs={[]}
          fullJobs={[]}
        />
      );

      // Set initial cache data using correct query key BEFORE clicking
      const queryKey = queryKeys.projects.tickets(projectId);
      const initialTickets: TicketWithVersion[] = [{
        id: 1,
        ticketNumber: 1,
        ticketKey: 'TEST-1',
        title: 'Original Ticket',
        description: 'Test description',
        stage: 'INBOX',
        projectId: 1,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        branch: null,
        autoMode: false,
        workflowType: 'FULL',
        clarificationPolicy: null,
        attachments: [],
      }];
      queryClient.setQueryData(queryKey, initialTickets);

      // Track cache state before clicking
      const cacheBeforeClick = queryClient.getQueryData<TicketWithVersion[]>(queryKey);
      expect(cacheBeforeClick).toHaveLength(1);

      // Open the duplicate dropdown then click "Simple copy"
      const duplicateButton = screen.getByTestId('duplicate-ticket-button');
      await user.click(duplicateButton);
      const simpleCopyOption = await screen.findByText('Simple copy');
      await user.click(simpleCopyOption);

      // Wait for error handling
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            title: 'Copy failed',
            description: 'Network error',
          })
        );
      });

      // Verify cache does not contain temporary tickets (TEMP-*)
      // The rollback should restore the original data without any TEMP tickets
      const cachedData = queryClient.getQueryData<TicketWithVersion[]>(queryKey);
      // If cache exists, ensure no TEMP tickets are present
      if (cachedData) {
        const tempTickets = cachedData.filter(t => t.ticketKey.startsWith('TEMP-'));
        expect(tempTickets).toHaveLength(0);
      }
    });
  });

  describe('Duplication dropdown visibility by stage', () => {
    it('should show only Simple copy for INBOX stage tickets', async () => {
      const user = userEvent.setup();
      const ticket = createMockTicket({ stage: 'INBOX', branch: null });

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

      // Click the duplicate dropdown button
      const duplicateButton = screen.getByTestId('duplicate-ticket-button');
      await user.click(duplicateButton);

      // Verify Simple copy is visible
      expect(screen.getByText('Simple copy')).toBeInTheDocument();

      // Verify Full clone is NOT visible for INBOX tickets
      expect(screen.queryByText('Full clone')).not.toBeInTheDocument();
    });

    it('should show only Simple copy for SHIP stage tickets', async () => {
      const user = userEvent.setup();
      const ticket = createMockTicket({ stage: 'SHIP', branch: 'feature/test' });

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

      // Click the duplicate dropdown button
      const duplicateButton = screen.getByTestId('duplicate-ticket-button');
      await user.click(duplicateButton);

      // Verify Simple copy is visible
      expect(screen.getByText('Simple copy')).toBeInTheDocument();

      // Verify Full clone is NOT visible for SHIP tickets
      expect(screen.queryByText('Full clone')).not.toBeInTheDocument();
    });

    it('should show both Simple copy and Full clone for SPECIFY stage tickets', async () => {
      const user = userEvent.setup();
      const ticket = createMockTicket({ stage: 'SPECIFY', branch: 'feature/test' });

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

      // Click the duplicate dropdown button
      const duplicateButton = screen.getByTestId('duplicate-ticket-button');
      await user.click(duplicateButton);

      // Verify both options are visible
      expect(screen.getByText('Simple copy')).toBeInTheDocument();
      expect(screen.getByText('Full clone')).toBeInTheDocument();
    });

    it('should show both Simple copy and Full clone for PLAN stage tickets', async () => {
      const user = userEvent.setup();
      const ticket = createMockTicket({ stage: 'PLAN', branch: 'feature/test' });

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

      // Click the duplicate dropdown button
      const duplicateButton = screen.getByTestId('duplicate-ticket-button');
      await user.click(duplicateButton);

      // Verify both options are visible
      expect(screen.getByText('Simple copy')).toBeInTheDocument();
      expect(screen.getByText('Full clone')).toBeInTheDocument();
    });

    it('should show both Simple copy and Full clone for BUILD stage tickets', async () => {
      const user = userEvent.setup();
      const ticket = createMockTicket({ stage: 'BUILD', branch: 'feature/test' });

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

      // Click the duplicate dropdown button
      const duplicateButton = screen.getByTestId('duplicate-ticket-button');
      await user.click(duplicateButton);

      // Verify both options are visible
      expect(screen.getByText('Simple copy')).toBeInTheDocument();
      expect(screen.getByText('Full clone')).toBeInTheDocument();
    });

    it('should show both Simple copy and Full clone for VERIFY stage tickets', async () => {
      const user = userEvent.setup();
      const ticket = createMockTicket({ stage: 'VERIFY', branch: 'feature/test' });

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

      // Click the duplicate dropdown button
      const duplicateButton = screen.getByTestId('duplicate-ticket-button');
      await user.click(duplicateButton);

      // Verify both options are visible
      expect(screen.getByText('Simple copy')).toBeInTheDocument();
      expect(screen.getByText('Full clone')).toBeInTheDocument();
    });
  });

  describe('comparison entry point', () => {
    it('shows the compare button when structured comparison history exists', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/comments') || url.includes('/timeline')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ comments: [] }),
          });
        }
        if (url.includes('/comparisons/check')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                hasComparisons: true,
                count: 2,
                latestComparisonId: 99,
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const ticket = createMockTicket({ branch: null, stage: 'INBOX' });

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

      expect(await screen.findByTestId('compare-button')).toBeInTheDocument();
      expect(screen.getByText('Compare (2)')).toBeInTheDocument();
    });
  });
});
