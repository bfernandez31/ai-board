import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { Board } from '@/components/board/board';
import type { TicketWithVersion } from '@/lib/types';
import { Agent } from '@prisma/client';
import { Stage } from '@/lib/stage-transitions';

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core');
  return {
    ...actual,
    DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
    useDraggable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      isDragging: false,
    }),
  };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/components/board/offline-indicator', () => ({
  OfflineIndicator: () => null,
}));

vi.mock('@/components/board/retro-spec-section', () => ({
  RetroSpecSection: () => null,
}));

vi.mock('@/components/board/board-modals', () => ({
  BoardModals: () => null,
}));

vi.mock('@/components/board/drag-overlay', () => ({
  DragOverlay: () => null,
}));

vi.mock('@/components/board/trash-zone', () => ({
  TrashZone: () => null,
}));

vi.mock('@/components/board/close-zone', () => ({
  CloseZone: () => null,
}));

vi.mock('@/components/board/new-ticket-button', () => ({
  NewTicketButton: () => null,
}));

vi.mock('@/components/board/mobile-scroll-button', () => ({
  MobileScrollButton: () => null,
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

vi.mock('@/components/board/auto-mode-icon', () => ({
  AutoModeIcon: () => null,
}));

vi.mock('@/components/board/auto-mode-confirmation-modal', () => ({
  AutoModeConfirmationModal: () => null,
}));

vi.mock('@/components/ticket/quality-score-badge', () => ({
  QualityScoreBadge: () => null,
}));

vi.mock('@/app/lib/hooks/mutations/useDeployPreview', () => ({
  useDeployPreview: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/lib/hooks/mutations/useCancelJob', () => ({
  useCancelJob: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/app/lib/hooks/mutations/useAutoMode', () => ({
  useAutoMode: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/hooks/use-has-mounted', () => ({
  useHasMounted: () => true,
}));

vi.mock('@/app/lib/utils/deploy-preview-eligibility', () => ({
  isTicketDeployable: () => false,
}));

vi.mock('@/app/lib/tickets/auto-mode-eligibility', () => ({
  isAutoModeEligible: () => false,
}));

vi.mock('@/lib/utils/job-type-classifier', () => ({
  classifyJobType: () => 'WORKFLOW',
}));

vi.mock('@/components/board/hooks/use-retro-spec-state', () => ({
  useRetroSpecState: () => ({
    isRetroSpecGenerating: false,
    isRetroSpecCompleted: false,
    isRetroSpecFailed: false,
    retroSpecJob: null,
    handleRetroSpecSuccess: vi.fn(),
    isBannerDismissed: false,
    isRetroSpecModalOpen: false,
    setIsRetroSpecModalOpen: vi.fn(),
  }),
}));

const handleTicketClick = vi.fn();

vi.mock('@/components/board/hooks/use-url-ticket-modal', () => ({
  useUrlTicketModal: () => ({
    selectedTicketId: null,
    isModalOpen: false,
    modalInitialTab: 'details' as const,
    handleTicketClick,
    handleModalClose: vi.fn(),
    fetchedTicket: null,
  }),
}));

vi.mock('@/components/board/hooks/use-job-snapshots', () => ({
  useJobSnapshots: () => ({
    polledJobs: [],
    selectedTicketJobs: [],
    jobSnapshots: new Map(),
    getTicketJobs: () => ({ workflow: null, aiBoard: null, deployJob: null }),
    getMergedTicketJobs: () => [],
  }),
}));

vi.mock('@/components/board/hooks/use-ticket-transitions', () => ({
  useTicketTransitions: () => ({
    handleTicketUpdate: vi.fn(),
    pendingTransition: null,
    handleQuickImplConfirm: vi.fn(),
    handleQuickImplCancel: vi.fn(),
    pendingVerifyRollback: null,
    handleVerifyRollbackConfirm: vi.fn(),
    handleVerifyRollbackCancel: vi.fn(),
    pendingRollback: null,
    handleRollbackConfirm: vi.fn(),
    handleRollbackCancel: vi.fn(),
    ticketToDelete: null,
    deleteModalOpen: false,
    setDeleteModalOpen: vi.fn(),
    handleDeleteConfirm: vi.fn(),
    deleteTicketMutation: { isPending: false },
    pendingCloseTransition: null,
    handleCloseConfirm: vi.fn(),
    handleCloseCancel: vi.fn(),
    isClosingTicket: false,
    performTransition: vi.fn(),
    setPendingTransition: vi.fn(),
    setPendingVerifyRollback: vi.fn(),
    setPendingRollback: vi.fn(),
    setPendingCloseTransition: vi.fn(),
    setTicketToDelete: vi.fn(),
  }),
}));

vi.mock('@/components/board/hooks/use-board-drag-state', () => ({
  useBoardDragState: () => ({
    isOnline: true,
    activeTicket: null,
    isDragging: false,
    dragSource: null,
    draggedTicketHasJob: false,
    validRollbackTargets: [],
    sensors: [],
    collisionDetection: vi.fn(),
    handleDragStart: vi.fn(),
    handleDragEnd: vi.fn(),
    handleDragCancel: vi.fn(),
  }),
}));

vi.mock('@/components/board/hooks/use-drop-zone-style', () => ({
  useDropZoneStyle: () => () => '',
}));

vi.mock('@/components/board/hooks/use-board-cache-seeding', () => ({
  useBoardCacheSeeding: () => undefined,
}));

vi.mock('@/components/board/hooks/use-board-keyboard-shortcuts', () => ({
  useBoardKeyboardShortcuts: () => ({
    isNewTicketModalOpen: false,
    setIsNewTicketModalOpen: vi.fn(),
    isShortcutsHelpOpen: false,
    handleShortcutsHelpChange: vi.fn(),
  }),
}));

vi.mock('@/components/board/hooks/use-zone-states', () => ({
  useZoneStates: () => ({
    trashZone: { isVisible: false, isDisabled: false, disabledReason: null },
    closeZone: { isVisible: false, isDisabled: false, disabledReason: null },
  }),
}));

vi.mock('@/app/lib/hooks/queries/useTickets', () => ({
  useTicketsByStage: vi.fn(),
  useShipTotal: () => ({ data: 0 }),
  useLoadMoreShipTickets: () => ({ loadMore: vi.fn(), isLoading: false }),
}));

const { useTicketsByStage } = await import('@/app/lib/hooks/queries/useTickets');

function createTicket(id: number, title: string): TicketWithVersion {
  return {
    id,
    ticketNumber: id,
    ticketKey: `AIB-${id}`,
    title,
    description: `Description ${id}`,
    stage: Stage.INBOX,
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
    createdAt: '2026-05-23T00:00:00.000Z',
    updatedAt: '2026-05-23T00:00:00.000Z',
    project: { clarificationPolicy: 'AUTO', defaultAgent: Agent.CLAUDE },
    jobs: [],
    qualityScore: null,
  };
}

function makeTicketsByStage() {
  return {
    [Stage.INBOX]: [createTicket(1, 'One'), createTicket(2, 'Two'), createTicket(3, 'Three')],
    [Stage.SPECIFY]: [],
    [Stage.PLAN]: [],
    [Stage.BUILD]: [],
    [Stage.VERIFY]: [],
    [Stage.SHIP]: [],
    [Stage.CLOSED]: [],
  };
}

function renderBoard() {
  vi.mocked(useTicketsByStage).mockReturnValue({ data: makeTicketsByStage() } as never);
  return renderWithProviders(
    <Board
      projectId={1}
      ticketsByStage={makeTicketsByStage()}
      initialJobs={new Map()}
      hasSpecs={true}
      defaultAgent={Agent.CLAUDE}
      shipTotal={0}
    />
  );
}

describe('Board bulk selection', () => {
  beforeEach(() => {
    handleTicketClick.mockReset();
  });

  it('enters selection mode from a checkbox click and keeps the action bar visible', async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(screen.getByRole('button', { name: 'Select AIB-1' }));

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByLabelText('Select AIB-2').closest('[data-selected]')).toHaveAttribute(
      'data-selection-mode',
      'true'
    );
    expect(handleTicketClick).not.toHaveBeenCalled();
  });

  it('supports shift range selection, ctrl toggle, and escape clear', async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(screen.getByRole('button', { name: 'Select AIB-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select AIB-3' }), { shiftKey: true });

    expect(screen.getByRole('article', { name: 'Ticket AIB-1: One' })).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('article', { name: 'Ticket AIB-2: Two' })).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('article', { name: 'Ticket AIB-3: Three' })).toHaveAttribute('data-selected', 'true');

    fireEvent.click(screen.getByText('Two').closest('[data-ticket-id="2"]') as HTMLElement, { ctrlKey: true });

    expect(screen.getByRole('article', { name: 'Ticket AIB-2: Two' })).toHaveAttribute('data-selected', 'false');
    expect(handleTicketClick).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByText(/^\d+ selected$/)).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Ticket AIB-1: One' })).toHaveAttribute('data-selection-mode', 'false');
  });
});
