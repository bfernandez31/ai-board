/**
 * RTL Component Tests: TicketDetailModal
 *
 * Tests for the ticket detail modal component.
 * Verifies button visibility based on job status, localTicket sync behavior,
 * and proper updates when ticket props change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { TicketDetailModal, type TicketJob } from '@/components/board/ticket-detail-modal';
import type { Job, ClarificationPolicy } from '@prisma/client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Create a base ticket for testing
const createBaseTicket = (overrides = {}) => ({
  id: 1,
  ticketNumber: 1,
  ticketKey: 'TEST-1',
  title: 'Test Ticket',
  description: 'Test description',
  stage: 'SPECIFY',
  version: 1,
  projectId: 1,
  branch: 'test-branch',
  autoMode: true,
  clarificationPolicy: null as ClarificationPolicy | null,
  workflowType: 'FULL' as const,
  attachments: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  project: {
    clarificationPolicy: 'AUTO' as ClarificationPolicy,
    githubOwner: 'test-owner',
    githubRepo: 'test-repo',
  },
  ...overrides,
});

// Create a job for testing
const createJob = (overrides = {}): TicketJob => ({
  id: 1,
  command: 'specify',
  status: 'COMPLETED',
  ...overrides,
});

// Create a full job for Stats tab
const createFullJob = (overrides = {}): Job => ({
  id: 1,
  ticketId: 1,
  projectId: 1,
  command: 'specify',
  status: 'COMPLETED',
  githubRunId: 123,
  inputTokens: 1000,
  outputTokens: 500,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  totalTokens: 1500,
  apiCalls: 5,
  costUsd: 0.015,
  createdAt: new Date(),
  updatedAt: new Date(),
  startedAt: new Date(),
  completedAt: new Date(),
  ...overrides,
} as Job);

describe('TicketDetailModal', () => {
  const defaultProps = {
    ticket: createBaseTicket(),
    open: true,
    onOpenChange: vi.fn(),
    projectId: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Mock comments API
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/comments')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ comments: [] }),
        });
      }
      if (url.includes('/comparisons')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ hasComparisons: false, count: 0 }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  describe('T004: Spec button visibility based on job status', () => {
    it('should NOT show Spec button when no jobs are present', () => {
      renderWithProviders(
        <TicketDetailModal {...defaultProps} jobs={[]} fullJobs={[]} />
      );

      expect(screen.queryByRole('button', { name: /spec/i })).not.toBeInTheDocument();
    });

    it('should NOT show Spec button when specify job is PENDING', () => {
      const jobs = [createJob({ status: 'PENDING' })];
      renderWithProviders(
        <TicketDetailModal {...defaultProps} jobs={jobs} fullJobs={[]} />
      );

      expect(screen.queryByRole('button', { name: /spec/i })).not.toBeInTheDocument();
    });

    it('should NOT show Spec button when specify job is RUNNING', () => {
      const jobs = [createJob({ status: 'RUNNING' })];
      renderWithProviders(
        <TicketDetailModal {...defaultProps} jobs={jobs} fullJobs={[]} />
      );

      expect(screen.queryByRole('button', { name: /spec/i })).not.toBeInTheDocument();
    });

    it('should show Spec button when specify job is COMPLETED and branch exists', () => {
      const jobs = [createJob({ command: 'specify', status: 'COMPLETED' })];
      renderWithProviders(
        <TicketDetailModal {...defaultProps} jobs={jobs} fullJobs={[]} />
      );

      expect(screen.getByRole('button', { name: /spec/i })).toBeInTheDocument();
    });

    it('should NOT show Spec button when specify job COMPLETED but branch is null', () => {
      const ticketWithoutBranch = createBaseTicket({ branch: null });
      const jobs = [createJob({ command: 'specify', status: 'COMPLETED' })];
      renderWithProviders(
        <TicketDetailModal
          {...defaultProps}
          ticket={ticketWithoutBranch}
          jobs={jobs}
          fullJobs={[]}
        />
      );

      expect(screen.queryByRole('button', { name: /spec/i })).not.toBeInTheDocument();
    });
  });

  describe('T005: Plan button visibility based on job status', () => {
    it('should NOT show Plan button when no plan job exists', () => {
      const jobs = [createJob({ command: 'specify', status: 'COMPLETED' })];
      renderWithProviders(
        <TicketDetailModal {...defaultProps} jobs={jobs} fullJobs={[]} />
      );

      expect(screen.queryByRole('button', { name: /plan/i })).not.toBeInTheDocument();
    });

    it('should NOT show Plan button when plan job is RUNNING', () => {
      const jobs = [
        createJob({ command: 'specify', status: 'COMPLETED' }),
        createJob({ id: 2, command: 'plan', status: 'RUNNING' }),
      ];
      renderWithProviders(
        <TicketDetailModal {...defaultProps} jobs={jobs} fullJobs={[]} />
      );

      expect(screen.queryByRole('button', { name: /plan/i })).not.toBeInTheDocument();
    });

    it('should show Plan button when plan job is COMPLETED for FULL workflow', () => {
      const jobs = [
        createJob({ command: 'specify', status: 'COMPLETED' }),
        createJob({ id: 2, command: 'plan', status: 'COMPLETED' }),
      ];
      renderWithProviders(
        <TicketDetailModal {...defaultProps} jobs={jobs} fullJobs={[]} />
      );

      expect(screen.getByRole('button', { name: /plan/i })).toBeInTheDocument();
    });

    it('should NOT show Plan button when plan job is COMPLETED but workflow is QUICK', () => {
      const quickTicket = createBaseTicket({ workflowType: 'QUICK' });
      const jobs = [
        createJob({ id: 2, command: 'plan', status: 'COMPLETED' }),
      ];
      renderWithProviders(
        <TicketDetailModal
          {...defaultProps}
          ticket={quickTicket}
          jobs={jobs}
          fullJobs={[]}
        />
      );

      expect(screen.queryByRole('button', { name: /plan/i })).not.toBeInTheDocument();
    });
  });

  describe('T006: Summary button visibility based on job status', () => {
    it('should NOT show Summary button when no implement job exists', () => {
      const jobs = [
        createJob({ command: 'specify', status: 'COMPLETED' }),
        createJob({ id: 2, command: 'plan', status: 'COMPLETED' }),
      ];
      renderWithProviders(
        <TicketDetailModal {...defaultProps} jobs={jobs} fullJobs={[]} />
      );

      expect(screen.queryByRole('button', { name: /summary/i })).not.toBeInTheDocument();
    });

    it('should NOT show Summary button when implement job is RUNNING', () => {
      const jobs = [
        createJob({ command: 'specify', status: 'COMPLETED' }),
        createJob({ id: 2, command: 'plan', status: 'COMPLETED' }),
        createJob({ id: 3, command: 'implement', status: 'RUNNING' }),
      ];
      renderWithProviders(
        <TicketDetailModal {...defaultProps} jobs={jobs} fullJobs={[]} />
      );

      expect(screen.queryByRole('button', { name: /summary/i })).not.toBeInTheDocument();
    });

    it('should show Summary button when implement job is COMPLETED for FULL workflow', () => {
      const jobs = [
        createJob({ command: 'specify', status: 'COMPLETED' }),
        createJob({ id: 2, command: 'plan', status: 'COMPLETED' }),
        createJob({ id: 3, command: 'implement', status: 'COMPLETED' }),
      ];
      renderWithProviders(
        <TicketDetailModal {...defaultProps} jobs={jobs} fullJobs={[]} />
      );

      expect(screen.getByRole('button', { name: /summary/i })).toBeInTheDocument();
    });

    it('should NOT show Summary button when implement job is COMPLETED but workflow is QUICK', () => {
      const quickTicket = createBaseTicket({ workflowType: 'QUICK' });
      const jobs = [
        createJob({ id: 3, command: 'implement', status: 'COMPLETED' }),
      ];
      renderWithProviders(
        <TicketDetailModal
          {...defaultProps}
          ticket={quickTicket}
          jobs={jobs}
          fullJobs={[]}
        />
      );

      expect(screen.queryByRole('button', { name: /summary/i })).not.toBeInTheDocument();
    });
  });

  describe('T007: localTicket sync with incoming ticket prop', () => {
    it('should update button visibility when ticket prop changes with new branch', async () => {
      const ticketWithoutBranch = createBaseTicket({ branch: null });
      const jobs = [createJob({ command: 'specify', status: 'COMPLETED' })];

      const { rerender } = renderWithProviders(
        <TicketDetailModal
          {...defaultProps}
          ticket={ticketWithoutBranch}
          jobs={jobs}
          fullJobs={[]}
        />
      );

      // Initially no Spec button (no branch)
      expect(screen.queryByRole('button', { name: /spec/i })).not.toBeInTheDocument();

      // Rerender with branch now present
      const ticketWithBranch = createBaseTicket({ branch: 'new-branch' });
      rerender(
        <TicketDetailModal
          {...defaultProps}
          ticket={ticketWithBranch}
          jobs={jobs}
          fullJobs={[]}
        />
      );

      // Now Spec button should appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /spec/i })).toBeInTheDocument();
      });
    });

    it('should update displayed branch when ticket prop changes', async () => {
      const initialTicket = createBaseTicket({ branch: 'initial-branch' });
      const jobs = [createJob({ command: 'specify', status: 'COMPLETED' })];

      const { rerender } = renderWithProviders(
        <TicketDetailModal
          {...defaultProps}
          ticket={initialTicket}
          jobs={jobs}
          fullJobs={[]}
        />
      );

      // Check initial branch is displayed
      expect(screen.getByText('initial-branch')).toBeInTheDocument();

      // Rerender with updated branch
      const updatedTicket = createBaseTicket({ branch: 'updated-branch' });
      rerender(
        <TicketDetailModal
          {...defaultProps}
          ticket={updatedTicket}
          jobs={jobs}
          fullJobs={[]}
        />
      );

      // Now updated branch should be displayed
      await waitFor(() => {
        expect(screen.getByText('updated-branch')).toBeInTheDocument();
      });
    });

    it('should sync localTicket when ticket prop changes even if version and branch are same', async () => {
      // This test captures the real bug: when ticket refetched after cache invalidation
      // but version/branch unchanged, the title update should still reflect
      const initialTicket = createBaseTicket({
        title: 'Original Title',
        version: 1,
        branch: 'test-branch',
      });

      const { rerender } = renderWithProviders(
        <TicketDetailModal
          {...defaultProps}
          ticket={initialTicket}
          jobs={[]}
          fullJobs={[]}
        />
      );

      // Initial title shown
      expect(screen.getByText('Original Title')).toBeInTheDocument();

      // Rerender with updated title but SAME version and branch
      // This simulates what happens when ticket is refetched from server
      // after a workflow updates something else (like adding a file)
      const updatedTicket = createBaseTicket({
        title: 'Updated Title',
        version: 1, // Same version
        branch: 'test-branch', // Same branch
      });
      rerender(
        <TicketDetailModal
          {...defaultProps}
          ticket={updatedTicket}
          jobs={[]}
          fullJobs={[]}
        />
      );

      // Title should be updated (this tests the fix)
      await waitFor(() => {
        expect(screen.getByText('Updated Title')).toBeInTheDocument();
      });
    });
  });

  describe('T008: Branch field update on ticket prop change', () => {
    it('should show branch link when branch is assigned via prop update', async () => {
      const ticketWithoutBranch = createBaseTicket({ branch: null });

      const { rerender } = renderWithProviders(
        <TicketDetailModal
          {...defaultProps}
          ticket={ticketWithoutBranch}
          jobs={[]}
          fullJobs={[]}
        />
      );

      // Initially no branch link
      expect(screen.queryByTestId('github-branch-link')).not.toBeInTheDocument();

      // Rerender with branch assigned
      const ticketWithBranch = createBaseTicket({ branch: '128-update-ticket-on' });
      rerender(
        <TicketDetailModal
          {...defaultProps}
          ticket={ticketWithBranch}
          jobs={[]}
          fullJobs={[]}
        />
      );

      // Branch link should now appear
      await waitFor(() => {
        expect(screen.getByTestId('github-branch-link')).toBeInTheDocument();
        expect(screen.getByText('128-update-ticket-on')).toBeInTheDocument();
      });
    });
  });

  describe('T011: Stats tab receives updated job data', () => {
    it('should show Stats tab when fullJobs array has jobs', () => {
      const fullJobs = [createFullJob()];
      renderWithProviders(
        <TicketDetailModal
          {...defaultProps}
          jobs={[createJob()]}
          fullJobs={fullJobs}
        />
      );

      expect(screen.getByTestId('stats-tab-trigger')).toBeInTheDocument();
    });

    it('should NOT show Stats tab when fullJobs is empty', () => {
      renderWithProviders(
        <TicketDetailModal
          {...defaultProps}
          jobs={[]}
          fullJobs={[]}
        />
      );

      expect(screen.queryByTestId('stats-tab-trigger')).not.toBeInTheDocument();
    });

    it('should update Stats badge count when fullJobs changes', async () => {
      const initialJobs = [createFullJob()];

      const { rerender } = renderWithProviders(
        <TicketDetailModal
          {...defaultProps}
          jobs={[createJob()]}
          fullJobs={initialJobs}
        />
      );

      // Initial count is 1
      expect(screen.getByTestId('stats-tab-trigger')).toHaveTextContent('1');

      // Rerender with more jobs
      const moreJobs = [
        createFullJob(),
        createFullJob({ id: 2, command: 'plan' }),
      ];
      rerender(
        <TicketDetailModal
          {...defaultProps}
          jobs={[createJob(), createJob({ id: 2, command: 'plan' })]}
          fullJobs={moreJobs}
        />
      );

      // Count should update to 2
      await waitFor(() => {
        expect(screen.getByTestId('stats-tab-trigger')).toHaveTextContent('2');
      });
    });
  });

  describe('T013: Data consistency when switching tabs', () => {
    it('should maintain consistent ticket data when switching between tabs', async () => {
      const ticket = createBaseTicket({ branch: 'consistency-test' });
      const fullJobs = [createFullJob()];

      renderWithProviders(
        <TicketDetailModal
          {...defaultProps}
          ticket={ticket}
          jobs={[createJob()]}
          fullJobs={fullJobs}
        />
      );

      // Verify branch shown in Details tab
      expect(screen.getByText('consistency-test')).toBeInTheDocument();

      // Stats tab should be visible with jobs
      expect(screen.getByTestId('stats-tab-trigger')).toBeInTheDocument();
    });
  });

  describe('T016: Job failure updates UI same as completion', () => {
    it('should NOT show Spec button when job status is FAILED', () => {
      const jobs = [createJob({ command: 'specify', status: 'FAILED' })];
      renderWithProviders(
        <TicketDetailModal {...defaultProps} jobs={jobs} fullJobs={[]} />
      );

      expect(screen.queryByRole('button', { name: /spec/i })).not.toBeInTheDocument();
    });

    it('should NOT show Spec button when job status is CANCELLED', () => {
      const jobs = [createJob({ command: 'specify', status: 'CANCELLED' })];
      renderWithProviders(
        <TicketDetailModal {...defaultProps} jobs={jobs} fullJobs={[]} />
      );

      expect(screen.queryByRole('button', { name: /spec/i })).not.toBeInTheDocument();
    });
  });
});
