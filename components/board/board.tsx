'use client';

import { useCallback, useMemo, useState } from 'react';
import { Job } from '@prisma/client';
import { OfflineIndicator } from './offline-indicator';
import { BoardModals } from './board-modals';
import { BoardGrid } from './board-grid';
import { RetroSpecSection } from './retro-spec-section';
import { Stage } from '@/lib/stage-transitions';
import { TicketWithVersion } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useTicketsByStage, useLoadMoreShipTickets, useShipTotal } from '@/app/lib/hooks/queries/useTickets';
import { useRetroSpecState } from './hooks/use-retro-spec-state';
import { useJobSnapshots } from './hooks/use-job-snapshots';
import { useUrlTicketModal } from './hooks/use-url-ticket-modal';
import { useTicketTransitions } from './hooks/use-ticket-transitions';
import { useBoardDragState } from './hooks/use-board-drag-state';
import { useDropZoneStyle } from './hooks/use-drop-zone-style';
import { useBoardCacheSeeding } from './hooks/use-board-cache-seeding';
import { useBoardKeyboardShortcuts } from './hooks/use-board-keyboard-shortcuts';
import { useZoneStates } from './hooks/use-zone-states';
import { useTicketSelection } from './hooks/use-ticket-selection';
import { FloatingActionBar } from './floating-action-bar';

interface BoardProps {
  ticketsByStage: Record<Stage, TicketWithVersion[]>;
  projectId: number;
  initialJobs?: Map<number, Job[]>; // Array of jobs per ticket for dual job display
  hasSpecs?: boolean;
  defaultAgent?: import('@prisma/client').Agent;
  shipTotal?: number; // Total SHIP tickets count (for pagination)
}

export function Board({
  ticketsByStage: initialTicketsByStage,
  projectId,
  initialJobs = new Map(),
  hasSpecs = false,
  defaultAgent = 'CLAUDE',
  shipTotal: initialShipTotal = 0,
}: BoardProps) {
  const { toast } = useToast();

  useBoardCacheSeeding({ projectId, initialTicketsByStage, initialJobs, initialShipTotal });

  const { data: ticketsByStage = initialTicketsByStage } = useTicketsByStage(projectId);

  // SHIP stage "Load More" pagination
  const { data: shipTotal = initialShipTotal } = useShipTotal(projectId);
  const { loadMore: loadMoreShip, isLoading: isLoadingMoreShip } = useLoadMoreShipTickets(projectId);
  const shipTicketCount = ticketsByStage[Stage.SHIP]?.length ?? 0;
  const hasMoreShipTickets = shipTicketCount < shipTotal;
  const handleLoadMoreShip = useCallback(() => loadMoreShip(shipTicketCount), [loadMoreShip, shipTicketCount]);

  const allTickets = useMemo(() => Object.values(ticketsByStage).flat(), [ticketsByStage]);

  const selection = useTicketSelection(ticketsByStage[Stage.INBOX] ?? []);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkMergeModalOpen, setBulkMergeModalOpen] = useState(false);
  const inboxTicketIds = useMemo(
    () => (ticketsByStage[Stage.INBOX] ?? []).map((t) => t.id),
    [ticketsByStage]
  );
  const handleRangeSelect = useCallback(
    (id: number) => selection.rangeSelect(id, inboxTicketIds),
    [selection, inboxTicketIds]
  );

  const retroSpec = useRetroSpecState({ projectId, hasSpecs });
  const urlModal = useUrlTicketModal({ projectId, allTickets });

  const jobsHook = useJobSnapshots({
    projectId,
    initialJobs,
    allTickets,
    selectedTicketId: urlModal.selectedTicketId,
    isModalOpen: urlModal.isModalOpen,
  });

  const transitions = useTicketTransitions({ projectId, allTickets });

  // Derive selected ticket from cache, with fallback to fetched ticket for closed tickets — AIB-156.
  // This ensures fresh data after cache invalidation (e.g., updated branch).
  const selectedTicket = useMemo(() => {
    if (!urlModal.selectedTicketId) return null;
    const boardTicket = allTickets.find(t => t.id === urlModal.selectedTicketId);
    if (boardTicket) return boardTicket;
    if (urlModal.fetchedTicket && urlModal.fetchedTicket.id === urlModal.selectedTicketId) {
      return urlModal.fetchedTicket;
    }
    return null;
  }, [urlModal.selectedTicketId, urlModal.fetchedTicket, allTickets]);

  // Ticket with active preview URL (for single-preview warning)
  const activePreviewTicket = useMemo(() => {
    const ticketWithPreview = allTickets.find(t => t.previewUrl != null);
    return ticketWithPreview ? { ticketKey: ticketWithPreview.ticketKey } : null;
  }, [allTickets]);

  // Ticket with active deployment (PENDING or RUNNING deploy job) — disables deploy buttons elsewhere
  const activeDeploymentTicket = useMemo(() => {
    const ticketIds = new Set([
      ...allTickets.map(t => t.id),
      ...Array.from(jobsHook.jobSnapshots.keys()),
    ]);
    for (const ticketId of ticketIds) {
      const { deployJob } = jobsHook.getTicketJobs(ticketId);
      if (deployJob && (deployJob.status === 'PENDING' || deployJob.status === 'RUNNING')) {
        return ticketId;
      }
    }
    return null;
  }, [allTickets, jobsHook]);

  // Drag/drop wiring — delegates each drop scenario to the matching pending-state setter
  // or to performTransition with scenario-specific error mapping.
  const drag = useBoardDragState({
    getTicketJobs: jobsHook.getTicketJobs,
    onTrashDrop: (ticket) => {
      transitions.setTicketToDelete(ticket);
      transitions.setDeleteModalOpen(true);
    },
    onCloseDrop: (ticket) => transitions.setPendingCloseTransition({ ticket }),
    onQuickImpl: (ticket, targetStage) => transitions.setPendingTransition({ ticket, targetStage }),
    onVerifyRollback: (ticket, targetStage) => transitions.setPendingVerifyRollback({ ticket, targetStage }),
    onNewRollback: (ticket, targetStage) => transitions.setPendingRollback({ ticket, targetStage }),
    onTransition: async (ticket, targetStage) => {
      await transitions.performTransition(ticket, targetStage, {
        onApiError: (error, status) => {
          if (status === 423) {
            toast({
              variant: 'destructive',
              title: 'Transition blocked',
              description: 'Project cleanup is in progress. Please wait for it to complete. You can still update ticket descriptions, documents, and preview deployments.',
            });
          } else if (status === 409) {
            toast({
              variant: 'destructive',
              title: 'Ticket modified by another user',
              description: 'Please refresh the page and try again.',
            });
          } else if (status === 500 && error.error) {
            toast({ variant: 'destructive', title: 'Cannot move ticket', description: error.error });
          } else {
            toast({
              variant: 'destructive',
              title: 'Failed to update ticket',
              description: error.error || error.message || 'An error occurred while updating the ticket.',
            });
          }
        },
        successToast: { title: 'Ticket updated', description: `Moved to ${targetStage}` },
        networkErrorToast: {
          title: 'Network error',
          description: 'Could not update ticket. Please check your connection.',
        },
      });
    },
  });

  const getDropZoneStyle = useDropZoneStyle({
    isDragging: drag.isDragging,
    dragSource: drag.dragSource,
    draggedTicketHasJob: drag.draggedTicketHasJob,
    activeTicket: drag.activeTicket,
    initialJobs,
    polledJobs: jobsHook.polledJobs,
    validRollbackTargets: drag.validRollbackTargets,
  });

  const { trashZone, closeZone } = useZoneStates({
    activeTicket: drag.activeTicket,
    isDragging: drag.isDragging,
    getMergedTicketJobs: jobsHook.getMergedTicketJobs,
  });

  const isAnyTransitionPending =
    !!transitions.pendingTransition ||
    !!transitions.pendingVerifyRollback ||
    !!transitions.pendingRollback ||
    !!transitions.pendingCloseTransition;

  const keyboard = useBoardKeyboardShortcuts({
    isAnyModalOpen:
      urlModal.isModalOpen ||
      transitions.deleteModalOpen ||
      isAnyTransitionPending ||
      retroSpec.isRetroSpecModalOpen,
    isSelectMode: selection.isSelectMode,
    onClearSelection: selection.clearSelection,
  });

  return (
    <div className="w-full h-full bg-background">
      <OfflineIndicator />

      <RetroSpecSection
        projectId={projectId}
        hasSpecs={hasSpecs}
        defaultAgent={defaultAgent}
        isRetroSpecGenerating={retroSpec.isRetroSpecGenerating}
        isRetroSpecCompleted={retroSpec.isRetroSpecCompleted}
        isRetroSpecFailed={retroSpec.isRetroSpecFailed}
        retroSpecJob={retroSpec.retroSpecJob}
        onRetroSpecSuccess={retroSpec.handleRetroSpecSuccess}
      />

      <BoardGrid
        projectId={projectId}
        ticketsByStage={ticketsByStage}
        isOnline={drag.isOnline}
        onTicketClick={urlModal.handleTicketClick}
        getTicketJobs={jobsHook.getTicketJobs}
        getDropZoneStyle={getDropZoneStyle}
        activePreviewTicket={activePreviewTicket}
        activeDeploymentTicket={activeDeploymentTicket}
        hasMoreShipTickets={hasMoreShipTickets}
        shipTotal={shipTotal}
        onLoadMoreShip={handleLoadMoreShip}
        isLoadingMoreShip={isLoadingMoreShip}
        activeTicket={drag.activeTicket}
        isDragging={drag.isDragging}
        dragSource={drag.dragSource}
        draggedTicketHasJob={drag.draggedTicketHasJob}
        validRollbackTargets={drag.validRollbackTargets}
        sensors={drag.sensors}
        collisionDetection={drag.collisionDetection}
        onDragStart={drag.handleDragStart}
        onDragEnd={drag.handleDragEnd}
        onDragCancel={drag.handleDragCancel}
        trashZone={trashZone}
        closeZone={closeZone}
        isSelectMode={selection.isSelectMode}
        selectedIds={selection.selectedIds}
        onSelectToggle={selection.toggleSelect}
        onRangeSelect={handleRangeSelect}
      />

      <FloatingActionBar
        selectedCount={selection.selectedCount}
        onDelete={() => setBulkDeleteModalOpen(true)}
        onMerge={() => setBulkMergeModalOpen(true)}
        onCancel={selection.clearSelection}
      />

      <BoardModals
        projectId={projectId}
        defaultAgent={defaultAgent}
        selectedTicket={selectedTicket}
        isModalOpen={urlModal.isModalOpen}
        modalInitialTab={urlModal.modalInitialTab}
        handleModalClose={urlModal.handleModalClose}
        handleTicketUpdate={transitions.handleTicketUpdate}
        polledJobs={jobsHook.polledJobs}
        selectedTicketJobs={jobsHook.selectedTicketJobs}
        pendingTransition={transitions.pendingTransition}
        handleQuickImplConfirm={transitions.handleQuickImplConfirm}
        handleQuickImplCancel={transitions.handleQuickImplCancel}
        pendingVerifyRollback={transitions.pendingVerifyRollback}
        handleVerifyRollbackConfirm={transitions.handleVerifyRollbackConfirm}
        handleVerifyRollbackCancel={transitions.handleVerifyRollbackCancel}
        pendingRollback={transitions.pendingRollback}
        handleRollbackConfirm={transitions.handleRollbackConfirm}
        handleRollbackCancel={transitions.handleRollbackCancel}
        ticketToDelete={transitions.ticketToDelete}
        deleteModalOpen={transitions.deleteModalOpen}
        setDeleteModalOpen={transitions.setDeleteModalOpen}
        handleDeleteConfirm={transitions.handleDeleteConfirm}
        deleteTicketMutation={transitions.deleteTicketMutation}
        pendingCloseTransition={transitions.pendingCloseTransition}
        handleCloseConfirm={transitions.handleCloseConfirm}
        handleCloseCancel={transitions.handleCloseCancel}
        isClosingTicket={transitions.isClosingTicket}
        isNewTicketModalOpen={keyboard.isNewTicketModalOpen}
        setIsNewTicketModalOpen={keyboard.setIsNewTicketModalOpen}
        isShortcutsHelpOpen={keyboard.isShortcutsHelpOpen}
        handleShortcutsHelpChange={keyboard.handleShortcutsHelpChange}
        hasSpecs={hasSpecs}
        isRetroSpecCompleted={retroSpec.isRetroSpecCompleted}
        isRetroSpecGenerating={retroSpec.isRetroSpecGenerating}
        isRetroSpecFailed={retroSpec.isRetroSpecFailed}
        isBannerDismissed={retroSpec.isBannerDismissed}
        isRetroSpecModalOpen={retroSpec.isRetroSpecModalOpen}
        setIsRetroSpecModalOpen={retroSpec.setIsRetroSpecModalOpen}
        handleRetroSpecSuccess={retroSpec.handleRetroSpecSuccess}
        selectedIds={selection.selectedIds}
        inboxTickets={ticketsByStage[Stage.INBOX] ?? []}
        bulkDeleteModalOpen={bulkDeleteModalOpen}
        setBulkDeleteModalOpen={setBulkDeleteModalOpen}
        bulkMergeModalOpen={bulkMergeModalOpen}
        setBulkMergeModalOpen={setBulkMergeModalOpen}
        clearSelection={selection.clearSelection}
      />
    </div>
  );
}
