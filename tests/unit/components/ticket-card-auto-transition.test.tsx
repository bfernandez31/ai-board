/**
 * Component Tests: TicketCard auto-transition toggle (AIB-689)
 *
 * Verifies visibility rules (FULL workflow, INBOX/SPECIFY/PLAN only) and the
 * click behavior — enabling opens the confirmation modal, confirming calls
 * the toggle mutation, and disabling skips the modal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { TicketCard } from '@/components/board/ticket-card';
import type { TicketWithVersion } from '@/lib/types';
import type { Job } from '@prisma/client';

vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
}));

vi.mock('@/app/lib/hooks/mutations/useDeployPreview', () => ({
  useDeployPreview: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/lib/hooks/mutations/useCancelJob', () => ({
  useCancelJob: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/hooks/use-has-mounted', () => ({
  useHasMounted: () => true,
}));

vi.mock('@/app/lib/utils/deploy-preview-eligibility', () => ({
  isTicketDeployable: () => false,
}));

const toggleMutate = vi.fn();
vi.mock('@/app/lib/hooks/mutations/useToggleAutoMode', () => ({
  useToggleAutoMode: () => ({ mutate: toggleMutate, isPending: false }),
}));

vi.mock('@/components/board/job-status-indicator', () => ({
  JobStatusIndicator: () => <div data-testid="job-status-indicator" />,
}));

vi.mock('@/components/board/ticket-card-deploy-icon', () => ({
  TicketCardDeployIcon: () => <button data-testid="deploy-icon" />,
}));

vi.mock('@/components/board/ticket-card-preview-icon', () => ({
  TicketCardPreviewIcon: () => <div data-testid="preview-icon" />,
}));

vi.mock('@/components/board/deploy-confirmation-modal', () => ({
  DeployConfirmationModal: () => <div data-testid="deploy-modal" />,
}));

vi.mock('@/components/board/cancel-confirmation-modal', () => ({
  CancelConfirmationModal: () => <div data-testid="cancel-modal" />,
}));

vi.mock('@/components/ticket/quality-score-badge', () => ({
  QualityScoreBadge: () => null,
}));

vi.mock('@/lib/utils/job-type-classifier', () => ({
  classifyJobType: () => 'WORKFLOW',
}));

function createTicket(overrides: Partial<TicketWithVersion> = {}): TicketWithVersion {
  return {
    id: 1,
    ticketNumber: 1,
    ticketKey: 'AIB-1',
    title: 'Test ticket',
    description: null,
    stage: 'INBOX',
    version: 1,
    projectId: 1,
    branch: null,
    previewUrl: null,
    autoMode: false,
    clarificationPolicy: null,
    agent: null,
    specifyModel: null,
    planModel: null,
    implementModel: null,
    quickImplModel: null,
    verifyModel: null,
    workflowType: 'FULL',
    attachments: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function createWorkflowJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 100,
    ticketId: 1,
    projectId: 1,
    command: 'specify',
    status: 'RUNNING',
    branch: null,
    commitSha: null,
    logs: null,
    workflowRunId: null,
    startedAt: new Date(),
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    inputTokens: null,
    outputTokens: null,
    thinkingTokens: null,
    cacheReadTokens: null,
    cacheCreationTokens: null,
    costUsd: null,
    durationMs: null,
    model: null,
    toolsUsed: [],
    qualityScore: null,
    qualityScoreDetails: null,
    ...overrides,
  } as Job;
}

describe('TicketCard auto-transition toggle', () => {
  beforeEach(() => {
    toggleMutate.mockReset();
  });

  describe('visibility', () => {
    it('renders on FULL-workflow INBOX ticket', () => {
      renderWithProviders(<TicketCard ticket={createTicket({ stage: 'INBOX' })} />);
      expect(screen.getByTestId('auto-transition-toggle')).toBeInTheDocument();
    });

    it('renders on FULL-workflow SPECIFY ticket', () => {
      renderWithProviders(<TicketCard ticket={createTicket({ stage: 'SPECIFY' })} />);
      expect(screen.getByTestId('auto-transition-toggle')).toBeInTheDocument();
    });

    it('renders on FULL-workflow PLAN ticket', () => {
      renderWithProviders(<TicketCard ticket={createTicket({ stage: 'PLAN' })} />);
      expect(screen.getByTestId('auto-transition-toggle')).toBeInTheDocument();
    });

    it('does not render on BUILD tickets', () => {
      renderWithProviders(<TicketCard ticket={createTicket({ stage: 'BUILD' })} />);
      expect(screen.queryByTestId('auto-transition-toggle')).not.toBeInTheDocument();
    });

    it('does not render on VERIFY tickets', () => {
      renderWithProviders(<TicketCard ticket={createTicket({ stage: 'VERIFY' })} />);
      expect(screen.queryByTestId('auto-transition-toggle')).not.toBeInTheDocument();
    });

    it('does not render on SHIP tickets', () => {
      renderWithProviders(<TicketCard ticket={createTicket({ stage: 'SHIP' })} />);
      expect(screen.queryByTestId('auto-transition-toggle')).not.toBeInTheDocument();
    });

    it('does not render on QUICK-workflow tickets', () => {
      renderWithProviders(
        <TicketCard ticket={createTicket({ stage: 'INBOX', workflowType: 'QUICK' })} />
      );
      expect(screen.queryByTestId('auto-transition-toggle')).not.toBeInTheDocument();
    });

    it('reflects enabled state via data attribute', () => {
      renderWithProviders(<TicketCard ticket={createTicket({ autoMode: true })} />);
      expect(screen.getByTestId('auto-transition-toggle')).toHaveAttribute('data-enabled', 'true');
    });

    it('reflects disabled state via data attribute', () => {
      renderWithProviders(<TicketCard ticket={createTicket({ autoMode: false })} />);
      expect(screen.getByTestId('auto-transition-toggle')).toHaveAttribute('data-enabled', 'false');
    });
  });

  describe('interaction', () => {
    it('opens confirmation modal when clicking toggle with autoMode off', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TicketCard ticket={createTicket({ autoMode: false, stage: 'INBOX' })} />);

      await user.click(screen.getByTestId('auto-transition-toggle'));

      expect(screen.getByTestId('auto-transition-confirm-button')).toBeInTheDocument();
      expect(toggleMutate).not.toHaveBeenCalled();
    });

    it('dispatches enable with immediate stage when no workflow job is running', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TicketCard ticket={createTicket({ autoMode: false, stage: 'INBOX' })} />);

      await user.click(screen.getByTestId('auto-transition-toggle'));
      await user.click(screen.getByTestId('auto-transition-confirm-button'));

      expect(toggleMutate).toHaveBeenCalledWith(
        expect.objectContaining({ enable: true, immediateDispatchStage: 'SPECIFY' })
      );
    });

    it('dispatches enable without immediate stage when a workflow job is already running', async () => {
      const user = userEvent.setup();
      const ticket = createTicket({ autoMode: false, stage: 'SPECIFY' });
      const workflowJob = createWorkflowJob({ status: 'RUNNING' });
      renderWithProviders(<TicketCard ticket={ticket} workflowJob={workflowJob} />);

      await user.click(screen.getByTestId('auto-transition-toggle'));
      await user.click(screen.getByTestId('auto-transition-confirm-button'));

      expect(toggleMutate).toHaveBeenCalledWith(
        expect.objectContaining({ enable: true, immediateDispatchStage: null })
      );
    });

    it('disables immediately without modal when toggle is clicked while on', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TicketCard ticket={createTicket({ autoMode: true, stage: 'PLAN' })} />);

      await user.click(screen.getByTestId('auto-transition-toggle'));

      expect(toggleMutate).toHaveBeenCalledWith(
        expect.objectContaining({ enable: false })
      );
      expect(screen.queryByTestId('auto-transition-confirm-button')).not.toBeInTheDocument();
    });
  });
});
