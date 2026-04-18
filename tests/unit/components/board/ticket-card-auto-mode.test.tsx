/**
 * Component Tests: TicketCard auto-transition toggle (AIB-683)
 *
 * Covers visibility rules for the auto-mode fast-forward toggle — only on
 * FULL-workflow tickets currently in INBOX, SPECIFY, or PLAN.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { fireEvent } from '@testing-library/react';
import { TicketCard } from '@/components/board/ticket-card';
import type { TicketWithVersion } from '@/lib/types';
import { Agent } from '@prisma/client';

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

const autoModeMutate = vi.fn();
vi.mock('@/app/lib/hooks/mutations/useAutoMode', async () => {
  const actual = await vi.importActual<typeof import('@/app/lib/hooks/mutations/useAutoMode')>(
    '@/app/lib/hooks/mutations/useAutoMode'
  );
  return {
    ...actual,
    useAutoMode: () => ({ mutate: autoModeMutate, isPending: false }),
  };
});

vi.mock('@/lib/hooks/use-has-mounted', () => ({
  useHasMounted: () => true,
}));

vi.mock('@/app/lib/utils/deploy-preview-eligibility', () => ({
  isTicketDeployable: () => false,
}));

vi.mock('@/components/board/job-status-indicator', () => ({
  JobStatusIndicator: () => null,
}));

vi.mock('@/components/board/ticket-card-deploy-icon', () => ({
  TicketCardDeployIcon: () => null,
}));

vi.mock('@/components/board/ticket-card-preview-icon', () => ({
  TicketCardPreviewIcon: () => null,
}));

vi.mock('@/components/board/deploy-confirmation-modal', () => ({
  DeployConfirmationModal: () => null,
}));

vi.mock('@/components/board/cancel-confirmation-modal', () => ({
  CancelConfirmationModal: () => null,
}));

vi.mock('@/components/board/auto-mode-confirmation-modal', () => ({
  AutoModeConfirmationModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="auto-mode-modal-open" /> : null,
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
    agent: Agent.CLAUDE,
    specifyModel: null,
    planModel: null,
    implementModel: null,
    quickImplModel: null,
    verifyModel: null,
    workflowType: 'FULL',
    attachments: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    project: { clarificationPolicy: 'AUTO', defaultAgent: Agent.CLAUDE },
    jobs: [],
    ...overrides,
  };
}

describe('TicketCard — auto-mode toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the toggle on FULL tickets in INBOX', () => {
    renderWithProviders(<TicketCard ticket={createTicket({ stage: 'INBOX' })} />);
    expect(screen.getByTestId('auto-mode-toggle')).toBeInTheDocument();
  });

  it('renders the toggle on FULL tickets in SPECIFY', () => {
    renderWithProviders(<TicketCard ticket={createTicket({ stage: 'SPECIFY' })} />);
    expect(screen.getByTestId('auto-mode-toggle')).toBeInTheDocument();
  });

  it('renders the toggle on FULL tickets in PLAN', () => {
    renderWithProviders(<TicketCard ticket={createTicket({ stage: 'PLAN' })} />);
    expect(screen.getByTestId('auto-mode-toggle')).toBeInTheDocument();
  });

  it('does not render the toggle on BUILD', () => {
    renderWithProviders(<TicketCard ticket={createTicket({ stage: 'BUILD' })} />);
    expect(screen.queryByTestId('auto-mode-toggle')).not.toBeInTheDocument();
  });

  it('does not render the toggle on VERIFY', () => {
    renderWithProviders(<TicketCard ticket={createTicket({ stage: 'VERIFY' })} />);
    expect(screen.queryByTestId('auto-mode-toggle')).not.toBeInTheDocument();
  });

  it('does not render the toggle on SHIP', () => {
    renderWithProviders(<TicketCard ticket={createTicket({ stage: 'SHIP' })} />);
    expect(screen.queryByTestId('auto-mode-toggle')).not.toBeInTheDocument();
  });

  it('does not render the toggle on CLOSED', () => {
    renderWithProviders(<TicketCard ticket={createTicket({ stage: 'CLOSED' })} />);
    expect(screen.queryByTestId('auto-mode-toggle')).not.toBeInTheDocument();
  });

  it('does not render the toggle on QUICK-workflow tickets', () => {
    renderWithProviders(
      <TicketCard ticket={createTicket({ stage: 'INBOX', workflowType: 'QUICK' })} />
    );
    expect(screen.queryByTestId('auto-mode-toggle')).not.toBeInTheDocument();
  });

  it('exposes data-auto-mode="off" and hover-only styling when autoMode is false', () => {
    renderWithProviders(<TicketCard ticket={createTicket({ autoMode: false })} />);
    const toggle = screen.getByTestId('auto-mode-toggle');
    expect(toggle).toHaveAttribute('data-auto-mode', 'off');
    expect(toggle.className).toMatch(/group-hover:opacity-100/);
  });

  it('exposes data-auto-mode="on" and accent styling when autoMode is true', () => {
    renderWithProviders(<TicketCard ticket={createTicket({ autoMode: true })} />);
    const toggle = screen.getByTestId('auto-mode-toggle');
    expect(toggle).toHaveAttribute('data-auto-mode', 'on');
    expect(toggle.className).toMatch(/text-ctp-blue/);
    expect(toggle.className).not.toMatch(/group-hover:opacity-100/);
  });

  it('opens the confirmation modal when toggle is clicked while off', () => {
    renderWithProviders(<TicketCard ticket={createTicket({ autoMode: false })} />);
    const toggle = screen.getByTestId('auto-mode-toggle');
    expect(screen.queryByTestId('auto-mode-modal-open')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByTestId('auto-mode-modal-open')).toBeInTheDocument();
    expect(autoModeMutate).not.toHaveBeenCalled();
  });

  it('disables immediately without a modal when toggle is clicked while on', () => {
    renderWithProviders(
      <TicketCard
        ticket={createTicket({ autoMode: true, stage: 'SPECIFY', version: 4 })}
      />
    );
    const toggle = screen.getByTestId('auto-mode-toggle');
    fireEvent.click(toggle);
    expect(screen.queryByTestId('auto-mode-modal-open')).not.toBeInTheDocument();
    expect(autoModeMutate).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, ticketId: 1, version: 4, currentStage: 'SPECIFY' })
    );
  });
});
