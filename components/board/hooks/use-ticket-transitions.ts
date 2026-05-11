import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Stage } from '@/lib/stage-transitions';
import { TicketWithVersion } from '@/lib/types';
import {
  updateTicketStageOptimistically,
  revertTicketStage,
} from '@/lib/optimistic-updates';
import { queryKeys } from '@/app/lib/query-keys';
import { useToast } from '@/hooks/use-toast';
import { useDeleteTicket } from '@/lib/hooks/mutations/useDeleteTicket';
import { getCommandForTransition } from '@/lib/workflows/transition';
import { seedPendingJobIntoStatusCache } from '@/lib/utils/job-cache';
import {
  mergeTransitionFields,
  normalizeUpdatedTicket,
  type UpdatedModalTicket,
} from '../utils';

interface PendingTransition {
  ticket: TicketWithVersion;
  targetStage: Stage;
}

interface PendingCloseTransition {
  ticket: TicketWithVersion;
}

interface UseTicketTransitionsArgs {
  projectId: number;
  allTickets: TicketWithVersion[];
}

/**
 * Owns pending-transition state (quick-impl, verify rollback, extended
 * rollback, delete, close) and the confirm/cancel handlers that consume them.
 * Also exposes `performTransition` for direct DnD-driven transitions and
 * `handleTicketUpdate` for modal-edit reconciliation.
 */
export function useTicketTransitions({
  projectId,
  allTickets,
}: UseTicketTransitionsArgs) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteTicketMutation = useDeleteTicket(projectId);

  // Pending transitions for various confirmation modals
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const [pendingVerifyRollback, setPendingVerifyRollback] = useState<PendingTransition | null>(null);
  const [pendingRollback, setPendingRollback] = useState<PendingTransition | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<TicketWithVersion | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingCloseTransition, setPendingCloseTransition] = useState<PendingCloseTransition | null>(null);
  const [isClosingTicket, setIsClosingTicket] = useState(false);

  // Shared transition helper: optimistic update → API call → merge/rollback
  const performTransition = useCallback(
    async (
      ticket: TicketWithVersion,
      targetStage: Stage,
      config: {
        mergeServerData?: (serverData: Record<string, unknown>, current: TicketWithVersion) => TicketWithVersion;
        onApiError?: (error: { error?: string; message?: string }, status: number) => void;
        successToast: { title: string; description: string };
        networkErrorToast: { title: string; description: string };
      }
    ) => {
      const originalStage = ticket.stage;
      const originalVersion = ticket.version;

      const updatedTickets = updateTicketStageOptimistically(
        allTickets, ticket.id, targetStage
      );
      queryClient.setQueryData(queryKeys.projects.tickets(projectId), updatedTickets);

      const revert = () => {
        const reverted = revertTicketStage(updatedTickets, ticket.id, originalStage, originalVersion);
        queryClient.setQueryData(queryKeys.projects.tickets(projectId), reverted);
      };

      try {
        const response = await fetch(
          `/api/projects/${projectId}/tickets/${ticket.id}/transition`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetStage }),
          }
        );

        if (!response.ok) {
          const error = (await response.json()) as { error?: string; message?: string };
          revert();
          if (config.onApiError) {
            config.onApiError(error, response.status);
          } else {
            toast({
              variant: 'destructive',
              title: 'Failed to update ticket',
              description: error.error || error.message || 'An error occurred.',
            });
          }
          return;
        }

        const serverData = await response.json();
        const merge = config.mergeServerData ?? mergeTransitionFields;
        const finalTickets = updatedTickets.map((t) =>
          t.id === ticket.id ? merge(serverData, t) : t
        );
        queryClient.setQueryData(queryKeys.projects.tickets(projectId), finalTickets);

        const transitionCommand = getCommandForTransition(ticket.stage, targetStage);
        const jobId =
          typeof serverData === 'object' &&
          serverData !== null &&
          'jobId' in serverData &&
          typeof serverData.jobId === 'number'
            ? serverData.jobId
            : null;

        if (transitionCommand && jobId) {
          seedPendingJobIntoStatusCache(queryClient, projectId, {
            id: jobId,
            ticketId: ticket.id,
            status: 'PENDING',
            command: transitionCommand,
            updatedAt: new Date().toISOString(),
          });
        }

        queryClient.invalidateQueries({ queryKey: queryKeys.projects.jobsStatus(projectId) });
        toast(config.successToast);
      } catch (err) {
        console.error('Transition error:', err);
        revert();
        toast({ variant: 'destructive', ...config.networkErrorToast });
      }
    },
    [allTickets, projectId, queryClient, toast]
  );

  // T037: Handle quick-impl confirmation
  const handleQuickImplConfirm = useCallback(async () => {
    if (!pendingTransition) return;
    const { ticket, targetStage } = pendingTransition;
    setPendingTransition(null);

    await performTransition(ticket, targetStage, {
      successToast: {
        title: 'Quick implementation started',
        description: `Workflow dispatched for ticket ${ticket.ticketKey}`,
      },
      networkErrorToast: {
        title: 'Network error',
        description: 'Could not start workflow. Please check your connection.',
      },
    });
  }, [pendingTransition, performTransition]);

  const handleQuickImplCancel = useCallback(() => setPendingTransition(null), []);

  // AIB-75: VERIFY → PLAN rollback
  const handleVerifyRollbackConfirm = useCallback(async () => {
    if (!pendingVerifyRollback) return;
    const { ticket, targetStage } = pendingVerifyRollback;
    setPendingVerifyRollback(null);

    await performTransition(ticket, targetStage, {
      mergeServerData: (serverData, current): TicketWithVersion => {
        const data = serverData as Partial<TicketWithVersion>;
        return {
          ...current,
          stage: data.stage || current.stage,
          version: data.version || current.version,
          previewUrl: data.previewUrl ?? current.previewUrl ?? null,
          updatedAt: data.updatedAt || current.updatedAt,
        };
      },
      onApiError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Failed to rollback to PLAN',
          description: error.error || 'An error occurred while rolling back the ticket.',
        });
      },
      successToast: {
        title: 'Ticket rolled back to PLAN',
        description: `${ticket.ticketKey} has been moved to PLAN stage. Preview URL cleared.`,
      },
      networkErrorToast: {
        title: 'Network error',
        description: 'Could not rollback ticket. Please check your connection.',
      },
    });
  }, [pendingVerifyRollback, performTransition, toast]);

  const handleVerifyRollbackCancel = useCallback(() => setPendingVerifyRollback(null), []);

  // AIB-512: Extended rollback (SPECIFY→INBOX, PLAN→SPECIFY, BUILD→PLAN, VERIFY→BUILD)
  const handleRollbackConfirm = useCallback(async () => {
    if (!pendingRollback) return;
    const { ticket, targetStage } = pendingRollback;
    setPendingRollback(null);

    await performTransition(ticket, targetStage, {
      mergeServerData: (serverData, current): TicketWithVersion => {
        const data = serverData as Partial<TicketWithVersion>;
        return {
          ...current,
          stage: data.stage || current.stage,
          version: data.version || current.version,
          branch: data.branch !== undefined ? data.branch : current.branch,
          previewUrl: data.previewUrl ?? current.previewUrl ?? null,
          workflowType: data.workflowType || current.workflowType,
          updatedAt: data.updatedAt || current.updatedAt,
        };
      },
      onApiError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Rollback failed',
          description: error.error || 'An error occurred during rollback.',
        });
      },
      successToast: {
        title: 'Ticket rolled back',
        description: `${ticket.ticketKey} moved to ${targetStage}.`,
      },
      networkErrorToast: {
        title: 'Network error',
        description: 'Could not rollback ticket. Please check your connection.',
      },
    });
  }, [pendingRollback, performTransition, toast]);

  const handleRollbackCancel = useCallback(() => setPendingRollback(null), []);

  // T023: Delete confirmation
  const handleDeleteConfirm = useCallback(() => {
    if (!ticketToDelete) return;

    deleteTicketMutation.mutate(ticketToDelete.id, {
      onSuccess: () => {
        toast({
          title: 'Ticket deleted',
          description: `${ticketToDelete.ticketKey} has been permanently deleted.`,
        });
        setDeleteModalOpen(false);
        setTicketToDelete(null);
      },
      onError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Failed to delete ticket',
          description: error.message,
        });
        // Keep modal open on error to allow retry
      },
    });
  }, [ticketToDelete, deleteTicketMutation, toast]);

  // AIB-148: Handle close confirmation
  const handleCloseConfirm = useCallback(async () => {
    if (!pendingCloseTransition) return;
    const { ticket } = pendingCloseTransition;
    setIsClosingTicket(true);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticket.id}/close`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        toast({
          variant: 'destructive',
          title: 'Failed to close ticket',
          description: error.error || 'An error occurred while closing the ticket.',
        });
      } else {
        // Success - update ticket stage in cache (keep for modal access via search)
        const updatedTickets = allTickets.map(t =>
          t.id === ticket.id ? { ...t, stage: Stage.CLOSED } : t
        );
        queryClient.setQueryData(
          queryKeys.projects.tickets(projectId),
          updatedTickets
        );

        toast({
          title: 'Ticket closed',
          description: `${ticket.ticketKey} has been closed.`,
        });
      }
    } catch (error) {
      console.error('Error closing ticket:', error);
      toast({
        variant: 'destructive',
        title: 'Network error',
        description: 'Could not close ticket. Please check your connection.',
      });
    } finally {
      setIsClosingTicket(false);
      setPendingCloseTransition(null);
    }
  }, [pendingCloseTransition, allTickets, toast, projectId, queryClient]);

  const handleCloseCancel = useCallback(() => setPendingCloseTransition(null), []);

  // Modal-edit reconciliation: normalize and merge an updated ticket into the cache
  const handleTicketUpdate = useCallback(
    (updatedTicket?: UpdatedModalTicket) => {
      if (!updatedTicket) return;

      const existingTicket = allTickets.find(t => t.id === updatedTicket.id);
      const normalizedTicket = normalizeUpdatedTicket(updatedTicket, existingTicket);

      const ticketExists = allTickets.some(
        (ticket) => ticket.id === normalizedTicket.id
      );
      const updatedTickets = ticketExists
        ? allTickets.map((ticket) =>
            ticket.id === normalizedTicket.id ? normalizedTicket : ticket
          )
        : [...allTickets, normalizedTicket];

      queryClient.setQueryData(
        queryKeys.projects.tickets(projectId),
        updatedTickets
      );
    },
    [allTickets, projectId, queryClient]
  );

  return {
    // pending states (read)
    pendingTransition,
    pendingVerifyRollback,
    pendingRollback,
    pendingCloseTransition,
    ticketToDelete,
    deleteModalOpen,
    isClosingTicket,
    deleteTicketMutation,
    // pending state setters (write, used by drag-end)
    setPendingTransition,
    setPendingVerifyRollback,
    setPendingRollback,
    setPendingCloseTransition,
    setTicketToDelete,
    setDeleteModalOpen,
    // actions
    performTransition,
    handleQuickImplConfirm,
    handleQuickImplCancel,
    handleVerifyRollbackConfirm,
    handleVerifyRollbackCancel,
    handleRollbackConfirm,
    handleRollbackCancel,
    handleDeleteConfirm,
    handleCloseConfirm,
    handleCloseCancel,
    handleTicketUpdate,
  };
}
