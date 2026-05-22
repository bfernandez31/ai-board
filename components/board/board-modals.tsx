'use client';

import { TicketWithVersion } from '@/lib/types';
import { Stage } from '@/lib/stage-transitions';
import { TicketDetailModal } from './ticket-detail-modal';
import { QuickImplModal } from './quick-impl-modal';
import { RollbackVerifyModal } from './rollback-verify-modal';
import { RollbackConfirmationModal } from './rollback-confirmation-modal';
import { DeleteConfirmationModal } from './delete-confirmation-modal';
import { CloseConfirmationModal } from './close-confirmation-modal';
import { NewTicketModal } from './new-ticket-modal';
import { KeyboardShortcutsDialog } from './keyboard-shortcuts-dialog';
import { ShortcutsHelpButton } from './shortcuts-help-button';
import { RetroSpecModal } from './retro-spec-modal';
import type { JobStatusDto } from '@/app/lib/schemas/job-polling';
import type { useTicketJobs } from '@/app/lib/hooks/queries/useTicketJobs';
import type { useDeleteTicket } from '@/lib/hooks/mutations/useDeleteTicket';
import { convertTicketForModal, ROLLBACK_MESSAGES, type UpdatedModalTicket } from './utils';
import { TicketWithVersion as TWV } from '@/lib/types';
import { BulkDeleteConfirmationModal } from './bulk-delete-confirmation-modal';
import { MergePreviewModal } from './merge-preview-modal';
import { useBulkDeleteTickets, useMergeTickets } from '@/lib/hooks/mutations/useBulkTicketActions';
import { useToast } from '@/hooks/use-toast';
import { useMemo, useCallback, useEffect, useState } from 'react';

interface BoardModalsProps {
  projectId: number;
  defaultAgent: import('@prisma/client').Agent;

  // Ticket detail modal
  selectedTicket: TicketWithVersion | null;
  isModalOpen: boolean;
  modalInitialTab: 'details' | 'comments' | 'files';
  handleModalClose: (open: boolean) => void;
  handleTicketUpdate: (updatedTicket?: UpdatedModalTicket) => void;
  polledJobs: JobStatusDto[];
  selectedTicketJobs: NonNullable<ReturnType<typeof useTicketJobs>['data']>;

  // Quick-impl
  pendingTransition: { ticket: TicketWithVersion; targetStage: Stage } | null;
  handleQuickImplConfirm: () => void;
  handleQuickImplCancel: () => void;

  // Verify rollback
  pendingVerifyRollback: { ticket: TicketWithVersion; targetStage: Stage } | null;
  handleVerifyRollbackConfirm: () => void;
  handleVerifyRollbackCancel: () => void;

  // Extended rollback
  pendingRollback: { ticket: TicketWithVersion; targetStage: Stage } | null;
  handleRollbackConfirm: () => void;
  handleRollbackCancel: () => void;

  // Delete
  ticketToDelete: TicketWithVersion | null;
  deleteModalOpen: boolean;
  setDeleteModalOpen: (open: boolean) => void;
  handleDeleteConfirm: () => void;
  deleteTicketMutation: ReturnType<typeof useDeleteTicket>;

  // Close
  pendingCloseTransition: { ticket: TicketWithVersion } | null;
  handleCloseConfirm: () => void;
  handleCloseCancel: () => void;
  isClosingTicket: boolean;

  // Keyboard shortcuts
  isNewTicketModalOpen: boolean;
  setIsNewTicketModalOpen: (open: boolean) => void;
  isShortcutsHelpOpen: boolean;
  handleShortcutsHelpChange: (open: boolean) => void;

  // Retro-spec
  hasSpecs: boolean;
  isRetroSpecCompleted: boolean;
  isRetroSpecGenerating: boolean;
  isRetroSpecFailed: boolean;
  isBannerDismissed: boolean;
  isRetroSpecModalOpen: boolean;
  setIsRetroSpecModalOpen: (open: boolean) => void;
  handleRetroSpecSuccess: () => void;

  // Bulk actions
  selectedIds?: Set<number>;
  inboxTickets?: TWV[];
  bulkDeleteModalOpen?: boolean;
  setBulkDeleteModalOpen?: (open: boolean) => void;
  bulkMergeModalOpen?: boolean;
  setBulkMergeModalOpen?: (open: boolean) => void;
  clearSelection?: () => void;
}

/**
 * All board-level dialogs, confirmation modals, keyboard-shortcut UI, and the
 * retro-spec generation trigger button + modal. Kept in one file because they
 * all live as sibling overlays beside the kanban grid.
 */
export function BoardModals(props: BoardModalsProps) {
  const {
    projectId,
    defaultAgent,
    selectedTicket,
    isModalOpen,
    modalInitialTab,
    handleModalClose,
    handleTicketUpdate,
    polledJobs,
    selectedTicketJobs,
    pendingTransition,
    handleQuickImplConfirm,
    handleQuickImplCancel,
    pendingVerifyRollback,
    handleVerifyRollbackConfirm,
    handleVerifyRollbackCancel,
    pendingRollback,
    handleRollbackConfirm,
    handleRollbackCancel,
    ticketToDelete,
    deleteModalOpen,
    setDeleteModalOpen,
    handleDeleteConfirm,
    deleteTicketMutation,
    pendingCloseTransition,
    handleCloseConfirm,
    handleCloseCancel,
    isClosingTicket,
    isNewTicketModalOpen,
    setIsNewTicketModalOpen,
    isShortcutsHelpOpen,
    handleShortcutsHelpChange,
    hasSpecs,
    isRetroSpecCompleted,
    isRetroSpecGenerating,
    isRetroSpecFailed,
    isBannerDismissed,
    isRetroSpecModalOpen,
    setIsRetroSpecModalOpen,
    handleRetroSpecSuccess,
  } = props;

  const { toast } = useToast();
  const bulkDeleteMutation = useBulkDeleteTickets(projectId);
  const mergeMutation = useMergeTickets(projectId);

  const currentSelected = useMemo(() => {
    if (!props.selectedIds || !props.inboxTickets) return [];
    return props.inboxTickets.filter((t) => props.selectedIds!.has(t.id));
  }, [props.selectedIds, props.inboxTickets]);

  // Snapshot tickets when bulk modals open so the rendered list stays stable
  // even when optimistic mutations remove them from the upstream cache.
  const [deleteSnapshot, setDeleteSnapshot] = useState<TWV[]>([]);
  const [mergeSnapshot, setMergeSnapshot] = useState<TWV[]>([]);

  useEffect(() => {
    if (props.bulkDeleteModalOpen) setDeleteSnapshot(currentSelected);
  }, [props.bulkDeleteModalOpen, currentSelected]);

  useEffect(() => {
    if (props.bulkMergeModalOpen) setMergeSnapshot(currentSelected);
  }, [props.bulkMergeModalOpen, currentSelected]);

  const handleBulkDeleteConfirm = useCallback(() => {
    if (!props.selectedIds || props.selectedIds.size === 0) return;
    bulkDeleteMutation.mutate(
      { ticketIds: Array.from(props.selectedIds) },
      {
        onSuccess: (data) => {
          const { summary, results } = data;
          if (summary.skipped > 0) {
            const uniqueReasons = Array.from(new Set(results.skipped.map((s) => s.reason)));
            const noun = `ticket${summary.skipped !== 1 ? 's' : ''}`;
            const description =
              uniqueReasons.length === 1
                ? `${summary.skipped} ${noun} skipped: ${uniqueReasons[0]}`
                : `${summary.skipped} ${noun} skipped`;
            toast({
              title: `Deleted ${summary.succeeded} ticket${summary.succeeded !== 1 ? 's' : ''}`,
              description,
            });
          } else {
            toast({
              title: `Deleted ${summary.succeeded} ticket${summary.succeeded !== 1 ? 's' : ''}`,
            });
          }
          props.clearSelection?.();
          props.setBulkDeleteModalOpen?.(false);
        },
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: 'Bulk delete failed',
            description: error.message,
          });
        },
      }
    );
  }, [props, bulkDeleteMutation, toast]);

  const handleMergeConfirm = useCallback(
    (mergedTitle: string, mergedDescription: string, selectedAttachments: string[]) => {
      if (!props.selectedIds || props.selectedIds.size < 2) return;
      mergeMutation.mutate(
        {
          ticketIds: Array.from(props.selectedIds),
          mergedTitle,
          mergedDescription,
          selectedAttachments,
        },
        {
          onSuccess: (data) => {
            toast({
              title: `Merged ${data.summary.merged} tickets`,
              description: `Base ticket: ${data.baseTicket.ticketKey}`,
            });
            props.clearSelection?.();
            props.setBulkMergeModalOpen?.(false);
          },
          onError: (error) => {
            toast({
              variant: 'destructive',
              title: 'Merge failed',
              description: error.message,
            });
          },
        }
      );
    },
    [props, mergeMutation, toast]
  );

  const rollbackKey = pendingRollback
    ? `${pendingRollback.ticket.stage}→${pendingRollback.targetStage}`
    : '';

  return (
    <>
      <TicketDetailModal
        ticket={convertTicketForModal(selectedTicket)}
        open={isModalOpen}
        onOpenChange={handleModalClose}
        onUpdate={handleTicketUpdate}
        projectId={projectId}
        initialTab={modalInitialTab}
        jobs={selectedTicket ? polledJobs.filter(job => job.ticketId === selectedTicket.id) : []}
        fullJobs={selectedTicketJobs}
      />

      {/* T039: Quick Implementation Modal */}
      <QuickImplModal
        open={!!pendingTransition}
        onConfirm={handleQuickImplConfirm}
        onCancel={handleQuickImplCancel}
      />

      {/* AIB-75: Verify to Plan Rollback Modal */}
      <RollbackVerifyModal
        open={!!pendingVerifyRollback}
        onConfirm={handleVerifyRollbackConfirm}
        onCancel={handleVerifyRollbackCancel}
      />

      {/* AIB-512: Extended Rollback Confirmation Modal */}
      <RollbackConfirmationModal
        open={!!pendingRollback}
        onConfirm={handleRollbackConfirm}
        onCancel={handleRollbackCancel}
        title={pendingRollback ? (ROLLBACK_MESSAGES[rollbackKey]?.title ?? 'Confirmer le rollback ?') : ''}
        description={pendingRollback ? (ROLLBACK_MESSAGES[rollbackKey]?.description ?? '') : ''}
      />

      {/* T018, T023: Delete Confirmation Modal */}
      <DeleteConfirmationModal
        ticket={ticketToDelete}
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteTicketMutation.isPending}
      />

      {/* AIB-148: Close Confirmation Modal */}
      <CloseConfirmationModal
        ticketKey={pendingCloseTransition?.ticket.ticketKey || null}
        open={!!pendingCloseTransition}
        onOpenChange={(open) => !open && handleCloseCancel()}
        onConfirm={handleCloseConfirm}
        isClosing={isClosingTicket}
      />

      {/* AIB-299: Keyboard-triggered New Ticket Modal */}
      <NewTicketModal
        open={isNewTicketModalOpen}
        onOpenChange={setIsNewTicketModalOpen}
        projectId={projectId}
      />

      {/* AIB-299: Keyboard Shortcuts Help */}
      <KeyboardShortcutsDialog
        open={isShortcutsHelpOpen}
        onOpenChange={handleShortcutsHelpChange}
      />
      <ShortcutsHelpButton onClick={() => handleShortcutsHelpChange(!isShortcutsHelpOpen)} />

      {/* Bulk Delete Confirmation Modal */}
      <BulkDeleteConfirmationModal
        tickets={deleteSnapshot}
        open={props.bulkDeleteModalOpen ?? false}
        onOpenChange={(open) => props.setBulkDeleteModalOpen?.(open)}
        onConfirm={handleBulkDeleteConfirm}
        isDeleting={bulkDeleteMutation.isPending}
      />

      {/* Merge Preview Modal */}
      <MergePreviewModal
        tickets={mergeSnapshot}
        open={props.bulkMergeModalOpen ?? false}
        onOpenChange={(open) => props.setBulkMergeModalOpen?.(open)}
        onConfirm={handleMergeConfirm}
        isMerging={mergeMutation.isPending}
      />

      {/* AIB-585: Generate Specs trigger (FR-013) — only after banner is dismissed, hidden during failure (badge shows retry) */}
      {!hasSpecs && !isRetroSpecCompleted && !isRetroSpecGenerating && !isRetroSpecFailed && isBannerDismissed && (
        <>
          <button
            onClick={() => setIsRetroSpecModalOpen(true)}
            className="fixed bottom-4 right-14 z-30 flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground text-xs"
            aria-label="Generate project specs"
            data-testid="retro-spec-menu-btn"
          >
            Generate Specs
          </button>
          <RetroSpecModal
            open={isRetroSpecModalOpen}
            onOpenChange={setIsRetroSpecModalOpen}
            projectId={projectId}
            defaultAgent={defaultAgent}
            onSuccess={handleRetroSpecSuccess}
          />
        </>
      )}
    </>
  );
}

