'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Job } from '@prisma/client';
import { OfflineIndicator } from './offline-indicator';
import { BoardModals } from './board-modals';
import { BoardGrid } from './board-grid';
import { BulkActionBar } from './bulk-action-bar';
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
import { useBulkDeleteTickets, BulkActionErrorResponse } from '@/lib/hooks/mutations/useBulkDeleteTickets';
import { useBulkUpdateTicketAgent } from '@/lib/hooks/mutations/useBulkUpdateTicketAgent';
import { useBulkUpdateTicketModelConfig } from '@/lib/hooks/mutations/useBulkUpdateTicketModelConfig';
import { useBulkMergeTickets } from '@/lib/hooks/mutations/useBulkMergeTickets';

interface BulkSelectionGesture {
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

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
  const inboxVisibleOrder = useMemo(
    () => (ticketsByStage[Stage.INBOX] ?? []).map((ticket) => ticket.id),
    [ticketsByStage]
  );
  const [selectedInboxTicketIds, setSelectedInboxTicketIds] = useState<number[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<number | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkChangeAgentOpen, setBulkChangeAgentOpen] = useState(false);
  const [bulkChangeModelOpen, setBulkChangeModelOpen] = useState(false);
  const [bulkMergeOpen, setBulkMergeOpen] = useState(false);

  const allTickets = useMemo(() => Object.values(ticketsByStage).flat(), [ticketsByStage]);
  const isSelectionMode = selectedInboxTicketIds.length > 0;
  const selectedInboxTicketCount = selectedInboxTicketIds.length;
  const selectedInboxTicketIdSet = useMemo(
    () => new Set(selectedInboxTicketIds),
    [selectedInboxTicketIds]
  );
  const selectedInboxTickets = useMemo(
    () => (ticketsByStage[Stage.INBOX] ?? []).filter((ticket) => selectedInboxTicketIdSet.has(ticket.id)),
    [selectedInboxTicketIdSet, ticketsByStage]
  );
  const bulkDeleteTickets = useBulkDeleteTickets(projectId);
  const bulkUpdateTicketAgent = useBulkUpdateTicketAgent(projectId);
  const bulkUpdateTicketModelConfig = useBulkUpdateTicketModelConfig(projectId);
  const bulkMergeTickets = useBulkMergeTickets(projectId);

  const clearBulkSelection = useCallback(() => {
    setSelectedInboxTicketIds([]);
    setSelectionAnchorId(null);
    setBulkDeleteOpen(false);
    setBulkChangeAgentOpen(false);
    setBulkChangeModelOpen(false);
    setBulkMergeOpen(false);
  }, []);

  const formatBulkError = useCallback((error: unknown) => {
    if (error instanceof BulkActionErrorResponse && error.details?.blockingTicketKey) {
      return `${error.details.blockingTicketKey}: ${error.details.reason ?? error.message}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Bulk action failed';
  }, []);

  const showBulkSuccessToast = useCallback((title: string, count: number, action: string) => {
    toast({
      title,
      description: `${count} INBOX tickets were ${action}.`,
    });
  }, [toast]);

  const showBulkFailureToast = useCallback((title: string, error: unknown) => {
    toast({
      variant: 'destructive',
      title,
      description: formatBulkError(error),
    });
  }, [formatBulkError, toast]);

  const handleSelectionChange = useCallback((
    ticket: TicketWithVersion,
    selected: boolean,
    gesture: BulkSelectionGesture
  ) => {
    setSelectedInboxTicketIds((current) => {
      const currentSet = new Set(current);
      const anchorId = selectionAnchorId ?? ticket.id;

      if (gesture.shiftKey && current.length > 0) {
        const anchorIndex = inboxVisibleOrder.indexOf(anchorId);
        const targetIndex = inboxVisibleOrder.indexOf(ticket.id);
        if (anchorIndex >= 0 && targetIndex >= 0) {
          const [start, end] = anchorIndex < targetIndex
            ? [anchorIndex, targetIndex]
            : [targetIndex, anchorIndex];
          for (const rangedTicketId of inboxVisibleOrder.slice(start, end + 1)) {
            currentSet.add(rangedTicketId);
          }
          return inboxVisibleOrder.filter((ticketId) => currentSet.has(ticketId));
        }
      }

      if (selected) {
        currentSet.add(ticket.id);
      } else {
        currentSet.delete(ticket.id);
      }

      return inboxVisibleOrder.filter((ticketId) => currentSet.has(ticketId));
    });
    setSelectionAnchorId(ticket.id);
  }, [inboxVisibleOrder, selectionAnchorId]);

  useEffect(() => {
    setSelectedInboxTicketIds((current) => current.filter((ticketId) => inboxVisibleOrder.includes(ticketId)));
    setSelectionAnchorId((current) => (current != null && inboxVisibleOrder.includes(current) ? current : null));
  }, [inboxVisibleOrder]);

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
  });

  useEffect(() => {
    if (!isSelectionMode) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearBulkSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearBulkSelection, isSelectionMode]);

  const handleBulkDeleteConfirm = useCallback(async () => {
    try {
      await bulkDeleteTickets.mutateAsync(selectedInboxTicketIds);
      showBulkSuccessToast('Tickets deleted', selectedInboxTicketCount, 'deleted');
      clearBulkSelection();
    } catch (error) {
      showBulkFailureToast('Bulk delete failed', error);
    }
  }, [bulkDeleteTickets, clearBulkSelection, selectedInboxTicketCount, selectedInboxTicketIds, showBulkFailureToast, showBulkSuccessToast]);

  const handleBulkAgentSave = useCallback(async (agent: import('@prisma/client').Agent | null) => {
    try {
      await bulkUpdateTicketAgent.mutateAsync({ ticketIds: selectedInboxTicketIds, agent });
      showBulkSuccessToast('Agent updated', selectedInboxTicketCount, 'updated');
      clearBulkSelection();
    } catch (error) {
      showBulkFailureToast('Bulk agent update failed', error);
      throw error;
    }
  }, [bulkUpdateTicketAgent, clearBulkSelection, selectedInboxTicketCount, selectedInboxTicketIds, showBulkFailureToast, showBulkSuccessToast]);

  const handleBulkModelSave = useCallback(async (modelId: string) => {
    try {
      await bulkUpdateTicketModelConfig.mutateAsync({ ticketIds: selectedInboxTicketIds, modelId });
      showBulkSuccessToast('Model updated', selectedInboxTicketCount, 'updated');
      clearBulkSelection();
    } catch (error) {
      showBulkFailureToast('Bulk model update failed', error);
      throw error;
    }
  }, [bulkUpdateTicketModelConfig, clearBulkSelection, selectedInboxTicketCount, selectedInboxTicketIds, showBulkFailureToast, showBulkSuccessToast]);

  const handleBulkMergeSave = useCallback(async (input: {
    ticketIds: number[];
    expectedBaseTicketId: number;
    title: string;
    description: string;
  }) => {
    try {
      await bulkMergeTickets.mutateAsync(input);
      if (selectedTicket && input.ticketIds.includes(selectedTicket.id)) {
        urlModal.handleModalClose(false);
      }
      showBulkSuccessToast('Tickets merged', input.ticketIds.length, 'merged');
      clearBulkSelection();
    } catch (error) {
      showBulkFailureToast('Bulk merge failed', error);
      throw error;
    }
  }, [bulkMergeTickets, clearBulkSelection, selectedTicket, showBulkFailureToast, showBulkSuccessToast, urlModal]);

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
        isSelectionMode={isSelectionMode}
        selectedInboxTicketIds={selectedInboxTicketIdSet}
        selectionAnchorId={selectionAnchorId}
        onSelectionChange={handleSelectionChange}
      />

      <BulkActionBar
        isVisible={isSelectionMode}
        selectedCount={selectedInboxTicketCount}
        onCancel={clearBulkSelection}
        canMerge={selectedInboxTicketCount >= 2}
        onDelete={() => setBulkDeleteOpen(true)}
        onChangeAgent={() => setBulkChangeAgentOpen(true)}
        onChangeModel={() => setBulkChangeModelOpen(true)}
        onMerge={() => setBulkMergeOpen(true)}
        isBusy={
          bulkDeleteTickets.isPending ||
          bulkUpdateTicketAgent.isPending ||
          bulkUpdateTicketModelConfig.isPending ||
          bulkMergeTickets.isPending
        }
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
        bulkDeleteOpen={bulkDeleteOpen}
        setBulkDeleteOpen={setBulkDeleteOpen}
        onBulkDeleteConfirm={handleBulkDeleteConfirm}
        isBulkDeleting={bulkDeleteTickets.isPending}
        bulkChangeAgentOpen={bulkChangeAgentOpen}
        setBulkChangeAgentOpen={setBulkChangeAgentOpen}
        onBulkAgentSave={handleBulkAgentSave}
        bulkChangeModelOpen={bulkChangeModelOpen}
        setBulkChangeModelOpen={setBulkChangeModelOpen}
        onBulkModelSave={handleBulkModelSave}
        bulkSelectionCount={selectedInboxTickets.length}
        bulkMergeOpen={bulkMergeOpen}
        setBulkMergeOpen={setBulkMergeOpen}
        selectedBulkTickets={selectedInboxTickets}
        onBulkMergeSave={handleBulkMergeSave}
      />
    </div>
  );
}
