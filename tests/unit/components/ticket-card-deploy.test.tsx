/**
 * Component Tests: TicketCard deploy button logic
 *
 * Tests the deploy icon visibility conditions after the refactoring
 * that extracted isDeployJobActive and showDeployButton variables.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { TicketCard } from '@/components/board/ticket-card';
import type { TicketWithVersion } from '@/lib/types';
import type { Job } from '@prisma/client';

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
}));

// Mock deploy preview hook
vi.mock('@/app/lib/hooks/mutations/useDeployPreview', () => ({
  useDeployPreview: () => ({ mutate: vi.fn() }),
}));

// Mock has-mounted hook (always mounted in tests)
vi.mock('@/lib/hooks/use-has-mounted', () => ({
  useHasMounted: () => true,
}));

// Mock isTicketDeployable - controlled per test
const mockIsDeployable = vi.fn().mockReturnValue(false);
vi.mock('@/app/lib/utils/deploy-preview-eligibility', () => ({
  isTicketDeployable: (...args: unknown[]) => mockIsDeployable(...args),
}));

// Mock child components to isolate deploy logic testing
vi.mock('@/components/board/job-status-indicator', () => ({
  JobStatusIndicator: ({ status, command }: { status: string; command: string }) => (
    <div data-testid="job-status-indicator" data-status={status} data-command={command} />
  ),
}));

vi.mock('@/components/board/ticket-card-deploy-icon', () => ({
  TicketCardDeployIcon: ({ isDisabled }: { isDisabled?: boolean }) => (
    <button data-testid="deploy-icon" data-disabled={isDisabled ? 'true' : 'false'}>Deploy</button>
  ),
}));

vi.mock('@/components/board/ticket-card-preview-icon', () => ({
  TicketCardPreviewIcon: () => <div data-testid="preview-icon" />,
}));

vi.mock('@/components/board/deploy-confirmation-modal', () => ({
  DeployConfirmationModal: () => <div data-testid="deploy-modal" />,
}));

vi.mock('@/components/ticket/quality-score-badge', () => ({
  QualityScoreBadge: () => null,
}));

vi.mock('@/lib/utils/job-type-classifier', () => ({
  classifyJobType: () => 'DEPLOY',
}));

function createTicket(overrides: Partial<TicketWithVersion> = {}): TicketWithVersion {
  return {
    id: 1,
    ticketNumber: 1,
    ticketKey: 'AIB-1',
    title: 'Test ticket',
    description: null,
    stage: 'VERIFY',
    version: 1,
    projectId: 1,
    branch: 'feature/test',
    previewUrl: null,
    autoMode: false,
    clarificationPolicy: null,
    agent: null,
    workflowType: 'FULL',
    attachments: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    jobs: [{ status: 'COMPLETED', command: 'verify', createdAt: new Date() }],
    ...overrides,
  };
}

function createDeployJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 100,
    ticketId: 1,
    command: 'deploy-preview',
    status: 'PENDING',
    workflowRunId: null,
    startedAt: new Date(),
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
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
  } as Job;
}

describe('TicketCard deploy button logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDeployable.mockReturnValue(false);
  });

  describe('isDeployJobActive', () => {
    it('should show job status indicator when deploy job is PENDING', () => {
      const ticket = createTicket();
      const deployJob = createDeployJob({ status: 'PENDING' });

      renderWithProviders(
        <TicketCard ticket={ticket} deployJob={deployJob} />
      );

      const indicator = screen.getByTestId('job-status-indicator');
      expect(indicator).toHaveAttribute('data-status', 'PENDING');
      expect(screen.queryByTestId('deploy-icon')).not.toBeInTheDocument();
    });

    it('should show job status indicator when deploy job is RUNNING', () => {
      const ticket = createTicket();
      const deployJob = createDeployJob({ status: 'RUNNING' });

      renderWithProviders(
        <TicketCard ticket={ticket} deployJob={deployJob} />
      );

      const indicator = screen.getByTestId('job-status-indicator');
      expect(indicator).toHaveAttribute('data-status', 'RUNNING');
      expect(screen.queryByTestId('deploy-icon')).not.toBeInTheDocument();
    });
  });

  describe('showDeployButton', () => {
    it('should show deploy button when no deploy job and ticket is deployable', () => {
      mockIsDeployable.mockReturnValue(true);
      const ticket = createTicket();

      renderWithProviders(
        <TicketCard ticket={ticket} deployJob={null} />
      );

      expect(screen.getByTestId('deploy-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('job-status-indicator')).not.toBeInTheDocument();
    });

    it('should show deploy button for COMPLETED deploy job in VERIFY stage (retry)', () => {
      const ticket = createTicket({ stage: 'VERIFY' });
      const deployJob = createDeployJob({ status: 'COMPLETED' });

      renderWithProviders(
        <TicketCard ticket={ticket} deployJob={deployJob} />
      );

      expect(screen.getByTestId('deploy-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('job-status-indicator')).not.toBeInTheDocument();
    });

    it('should show deploy button for FAILED deploy job in VERIFY stage (retry)', () => {
      const ticket = createTicket({ stage: 'VERIFY' });
      const deployJob = createDeployJob({ status: 'FAILED' });

      renderWithProviders(
        <TicketCard ticket={ticket} deployJob={deployJob} />
      );

      expect(screen.getByTestId('deploy-icon')).toBeInTheDocument();
    });

    it('should NOT show deploy button for COMPLETED deploy job outside VERIFY stage', () => {
      const ticket = createTicket({ stage: 'SHIP' });
      const deployJob = createDeployJob({ status: 'COMPLETED' });

      renderWithProviders(
        <TicketCard ticket={ticket} deployJob={deployJob} />
      );

      expect(screen.queryByTestId('deploy-icon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('job-status-indicator')).not.toBeInTheDocument();
    });

    it('should NOT show anything when no deploy job and ticket is not deployable', () => {
      mockIsDeployable.mockReturnValue(false);
      const ticket = createTicket();

      renderWithProviders(
        <TicketCard ticket={ticket} deployJob={null} />
      );

      expect(screen.queryByTestId('deploy-icon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('job-status-indicator')).not.toBeInTheDocument();
    });
  });

  describe('checkbox rendering for selection', () => {
    it('should not render checkbox when onSelectToggle is not provided', () => {
      const ticket = createTicket({ stage: 'INBOX' });

      renderWithProviders(
        <TicketCard ticket={ticket} deployJob={null} />
      );

      expect(screen.queryByTestId('ticket-checkbox')).not.toBeInTheDocument();
    });

    it('should render checkbox when onSelectToggle is provided', () => {
      const ticket = createTicket({ stage: 'INBOX' });
      const onToggle = vi.fn();

      renderWithProviders(
        <TicketCard ticket={ticket} deployJob={null} onSelectToggle={onToggle} />
      );

      expect(screen.getByTestId('ticket-checkbox')).toBeInTheDocument();
    });

    it('should always be visible in select mode (opacity-100)', () => {
      const ticket = createTicket({ stage: 'INBOX' });
      const onToggle = vi.fn();

      renderWithProviders(
        <TicketCard ticket={ticket} deployJob={null} onSelectToggle={onToggle} isSelectMode={true} />
      );

      const checkbox = screen.getByTestId('ticket-checkbox');
      expect(checkbox.className).toContain('opacity-100');
      expect(checkbox.className).not.toContain('opacity-0');
    });

    it('should be hidden by default outside select mode (opacity-0, visible on hover)', () => {
      const ticket = createTicket({ stage: 'INBOX' });
      const onToggle = vi.fn();

      renderWithProviders(
        <TicketCard ticket={ticket} deployJob={null} onSelectToggle={onToggle} isSelectMode={false} />
      );

      const checkbox = screen.getByTestId('ticket-checkbox');
      expect(checkbox.className).toContain('opacity-0');
      expect(checkbox.className).toContain('group-hover:opacity-100');
    });

    it('should call onSelectToggle when checkbox is clicked', async () => {
      const ticket = createTicket({ stage: 'INBOX', id: 42 });
      const onToggle = vi.fn();

      renderWithProviders(
        <TicketCard ticket={ticket} deployJob={null} onSelectToggle={onToggle} />
      );

      screen.getByTestId('ticket-checkbox').click();
      expect(onToggle).toHaveBeenCalledWith(42);
    });

    it('should show ring-2 ring-primary when selected', () => {
      const ticket = createTicket({ stage: 'INBOX' });
      const onToggle = vi.fn();

      const { container } = renderWithProviders(
        <TicketCard ticket={ticket} deployJob={null} onSelectToggle={onToggle} isSelected={true} />
      );

      const card = container.querySelector('[role="article"]');
      expect(card?.className).toContain('ring-2');
      expect(card?.className).toContain('ring-primary');
    });
  });

  describe('isDeployDisabled', () => {
    it('should disable deploy button when another ticket has active deployment', () => {
      mockIsDeployable.mockReturnValue(true);
      const ticket = createTicket({ id: 1 });

      renderWithProviders(
        <TicketCard
          ticket={ticket}
          deployJob={null}
          activeDeploymentTicket={99}
        />
      );

      const deployIcon = screen.getByTestId('deploy-icon');
      expect(deployIcon).toHaveAttribute('data-disabled', 'true');
    });

    it('should NOT disable deploy button when this ticket has the active deployment', () => {
      mockIsDeployable.mockReturnValue(true);
      const ticket = createTicket({ id: 1 });

      renderWithProviders(
        <TicketCard
          ticket={ticket}
          deployJob={null}
          activeDeploymentTicket={1}
        />
      );

      const deployIcon = screen.getByTestId('deploy-icon');
      expect(deployIcon).toHaveAttribute('data-disabled', 'false');
    });

    it('should NOT disable deploy button when no active deployment exists', () => {
      mockIsDeployable.mockReturnValue(true);
      const ticket = createTicket({ id: 1 });

      renderWithProviders(
        <TicketCard
          ticket={ticket}
          deployJob={null}
          activeDeploymentTicket={null}
        />
      );

      const deployIcon = screen.getByTestId('deploy-icon');
      expect(deployIcon).toHaveAttribute('data-disabled', 'false');
    });
  });
});
