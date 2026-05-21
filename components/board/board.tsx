'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Job } from '@prisma/client';
import { OfflineIndicator } from './offline-indicator';
import { BoardModals } from './board-modals';
import { BoardGrid } from './board-grid';
import { RetroSpecSection } from './retro-spec-section';
import { BulkActionBar } from './bulk-action-bar';
import { BulkDeleteConfirmationModal } from './bulk-delete-confirmation-modal';
import { BulkAgentDialog } from './bulk-agent-dialog';
import { BulkModelDialog } from './bulk-model-dialog';
import { Stage } from '@/lib/stage-transitions';
import { TicketWithVersion } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useTicketsByStage, useLoadMoreShipTickets, useShipTotal } from '@/app/lib/hooks/queries/useTickets';
import { useBulkDeleteTickets } from '@/lib/hooks/mutations/useBulkDeleteTickets';
import { computeRangeSelection } from '@/lib/board/selection';
import { formatBulkResultToast } from '@/lib/board/bulk-result-toast';
import { useRetroSpecState } from './hooks/use-retro-spec-state';
import { useJobSnapshots } from './hooks/use-job-snapshots';
import { useUrlTicketModal } from './hooks/use-url-ticket-modal';
import { useTicketTransitions } from './hooks/use-ticket-transitions';
import { useBoardDragState } from './hooks/use-board-drag-state';
import { useDropZoneStyle } from './hooks/use-drop-zone-style';
import { useBoardCacheSeeding } from './hooks/use-board-cache-seeding';
import { useBoardKeyboardShortcuts } from './hooks/use-board-keyboard-shortcuts';
import { useZoneStates } from './hooks/use-zone-states';

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

  // AIB-820: INBOX bulk selection state.
  const inboxTickets = useMemo(
    () => ticketsByStage[Stage.INBOX] ?? [],
    [ticketsByStage],
  );
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<number>>(() => new Set());
  const lastClickedTicketIdRef = useRef<number | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkAgentOpen, setIsBulkAgentOpen] = useState(false);
  const [isBulkModelOpen, setIsBulkModelOpen] = useState(false);

  // Drop any ids that have transitioned out of INBOX (FR-014 client mirror).
  useEffect(() => {
    setSelectedTicketIds((current) => {
      if (current.size === 0) return current;
      const validIds = new Set(inboxTickets.map((t) => t.id));
      let changed = false;
      const next = new Set<number>();
      for (const id of current) {
        if (validIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : current;
    });
  }, [inboxTickets]);

  const handleTicketSelectToggle = useCallback(
    (ticketId: number, event: React.MouseEvent) => {
      setSelectedTicketIds((current) =>
        computeRangeSelection(
          inboxTickets,
          lastClickedTicketIdRef.current,
          ticketId,
          current,
          event.shiftKey,
        ),
      );
      lastClickedTicketIdRef.current = ticketId;
    },
    [inboxTickets],
  );

  const clearSelection = useCallback(() => {
    setSelectedTicketIds(new Set());
    lastClickedTicketIdRef.current = null;
  }, []);

  const selectedInboxTickets = useMemo(
    () => inboxTickets.filter((t) => selectedTicketIds.has(t.id)),
    [inboxTickets, selectedTicketIds],
  );

  const bulkDeleteMutation = useBulkDeleteTickets(projectId);

  const handleBulkDeleteConfirm = useCallback(() => {
    const tickets = selectedInboxTickets.map((t) => ({ id: t.id, version: t.version }));
    if (tickets.length === 0) return;
    bulkDeleteMutation.mutate(
      { tickets },
      {
        onSuccess: (data) => {
          const summary = formatBulkResultToast({
            successCount: data.affected.length,
            skipped: data.skipped,
            verbPast: 'deleted',
          });
          toast({ title: summary.title, ...(summary.description ? { description: summary.description } : {}) });
          if (data.skipped.length === 0) clearSelection();
          else {
            setSelectedTicketIds(new Set(data.skipped.map((s) => s.ticketId)));
          }
          setIsBulkDeleteOpen(false);
        },
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: 'Bulk delete failed',
            description: error.message ?? 'Please try again.',
          });
        },
      },
    );
  }, [bulkDeleteMutation, clearSelection, selectedInboxTickets, toast]);

  const showBulkDeleteConfirm = useCallback(() => {
    if (selectedInboxTickets.length > 0) setIsBulkDeleteOpen(true);
  }, [selectedInboxTickets.length]);

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
        selectedTicketIds={selectedTicketIds}
        onTicketSelectToggle={handleTicketSelectToggle}
      />

      <BulkActionBar
        selectionCount={selectedTicketIds.size}
        onChangeAgent={() => selectedInboxTickets.length > 0 && setIsBulkAgentOpen(true)}
        onChangeModel={() => selectedInboxTickets.length > 0 && setIsBulkModelOpen(true)}
        onFusion={() => toast({ title: 'Coming soon', description: 'Ticket fusion is under construction.' })}
        onDelete={showBulkDeleteConfirm}
        onClear={clearSelection}
      />

      <BulkDeleteConfirmationModal
        open={isBulkDeleteOpen}
        ticketKeys={selectedInboxTickets.map((t) => t.ticketKey)}
        onCancel={() => setIsBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        isPending={bulkDeleteMutation.isPending}
      />

      <BulkAgentDialog
        open={isBulkAgentOpen}
        onOpenChange={setIsBulkAgentOpen}
        projectId={projectId}
        projectDefaultAgent={defaultAgent}
        tickets={selectedInboxTickets.map((t) => ({ id: t.id, version: t.version }))}
        onSuccess={(skippedIds) => {
          if (skippedIds.length === 0) clearSelection();
          else setSelectedTicketIds(new Set(skippedIds));
        }}
      />

      <BulkModelDialog
        open={isBulkModelOpen}
        onOpenChange={setIsBulkModelOpen}
        projectId={projectId}
        tickets={selectedInboxTickets.map((t) => ({ id: t.id, version: t.version }))}
        onSuccess={(skippedIds) => {
          if (skippedIds.length === 0) clearSelection();
          else setSelectedTicketIds(new Set(skippedIds));
        }}
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
      />
    </div>
  );
}
