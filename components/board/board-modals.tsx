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
import { BulkChangeAgentDialog } from './bulk-change-agent-dialog';
import { BulkChangeModelDialog } from './bulk-change-model-dialog';
import { BulkMergeDialog } from './bulk-merge-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Agent } from '@prisma/client';
import type { JobStatusDto } from '@/app/lib/schemas/job-polling';
import type { useTicketJobs } from '@/app/lib/hooks/queries/useTicketJobs';
import type { useDeleteTicket } from '@/lib/hooks/mutations/useDeleteTicket';
import { convertTicketForModal, ROLLBACK_MESSAGES, type UpdatedModalTicket } from './utils';

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
  bulkDeleteOpen: boolean;
  setBulkDeleteOpen: (open: boolean) => void;
  onBulkDeleteConfirm: () => Promise<void>;
  isBulkDeleting: boolean;
  bulkChangeAgentOpen: boolean;
  setBulkChangeAgentOpen: (open: boolean) => void;
  onBulkAgentSave: (agent: Agent | null) => Promise<void>;
  bulkChangeModelOpen: boolean;
  setBulkChangeModelOpen: (open: boolean) => void;
  onBulkModelSave: (modelId: string) => Promise<void>;
  bulkSelectionCount: number;
  bulkMergeOpen: boolean;
  setBulkMergeOpen: (open: boolean) => void;
  selectedBulkTickets: TicketWithVersion[];
  onBulkMergeSave: (input: {
    ticketIds: number[];
    expectedBaseTicketId: number;
    title: string;
    description: string;
  }) => Promise<void>;
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
    bulkDeleteOpen,
    setBulkDeleteOpen,
    onBulkDeleteConfirm,
    isBulkDeleting,
    bulkChangeAgentOpen,
    setBulkChangeAgentOpen,
    onBulkAgentSave,
    bulkChangeModelOpen,
    setBulkChangeModelOpen,
    onBulkModelSave,
    bulkSelectionCount,
    bulkMergeOpen,
    setBulkMergeOpen,
    selectedBulkTickets,
    onBulkMergeSave,
  } = props;

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

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Delete {bulkSelectionCount} tickets?</DialogTitle>
            <DialogDescription>
              This permanently deletes the selected INBOX tickets. There is no undo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setBulkDeleteOpen(false)} disabled={isBulkDeleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void onBulkDeleteConfirm()} disabled={isBulkDeleting}>
              {isBulkDeleting ? 'Deleting...' : 'Delete tickets'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkChangeAgentDialog
        open={bulkChangeAgentOpen}
        onOpenChange={setBulkChangeAgentOpen}
        selectedCount={bulkSelectionCount}
        projectDefaultAgent={defaultAgent}
        onSave={onBulkAgentSave}
      />

      <BulkChangeModelDialog
        open={bulkChangeModelOpen}
        onOpenChange={setBulkChangeModelOpen}
        selectedCount={bulkSelectionCount}
        onSave={onBulkModelSave}
      />

      <BulkMergeDialog
        open={bulkMergeOpen}
        onOpenChange={setBulkMergeOpen}
        selectedTickets={selectedBulkTickets}
        onSave={onBulkMergeSave}
      />
    </>
  );
}
