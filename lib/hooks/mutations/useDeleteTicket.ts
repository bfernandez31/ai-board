import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { Ticket } from '@prisma/client';

/**
 * Success response from DELETE endpoint
 */
interface DeleteTicketResponse {
  success: true;
  deleted: {
    ticketId: number;
    ticketKey: string;
    branch: string | null;
    prsClosed: number;
  };
}

/**
 * Error response from DELETE endpoint
 */
interface DeleteTicketError {
  error: string;
  code: string;
  details?: {
    operation: string;
    message: string;
  };
}

/**
 * TanStack Query mutation hook for deleting tickets
 *
 * Features:
 * - Optimistic update: Removes ticket from UI immediately
 * - Rollback on error: Restores ticket if deletion fails
 * - Query invalidation: Refetches tickets after success
 * - No automatic retry: User must manually retry after failures
 *
 * @param projectId - Project ID that owns the ticket
 * @returns Mutation object with mutate function and status
 *
 * @example
 * ```typescript
 * const deleteTicket = useDeleteTicket(projectId);
 *
 * const handleDelete = () => {
 *   deleteTicket.mutate(ticketId, {
 *     onSuccess: () => toast.success('Ticket deleted'),
 *     onError: (error) => toast.error(error.message),
 *   });
 * };
 * ```
 */
export function useDeleteTicket(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<DeleteTicketResponse, Error, number, { previousTickets?: Ticket[] | undefined }>({
    mutationFn: async (ticketId: number) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookie
      });

      if (!response.ok) {
        const errorData = (await response.json()) as DeleteTicketError;
        throw new Error(errorData.error || 'Failed to delete ticket');
      }

      return response.json() as Promise<DeleteTicketResponse>;
    },

    // Optimistic update: Remove ticket immediately from cache
    onMutate: async (ticketId: number) => {
      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.tickets(projectId) });

      // Snapshot previous state for rollback
      const previousTickets = queryClient.getQueryData<Ticket[]>(
        queryKeys.projects.tickets(projectId)
      );

      // Optimistically remove ticket from cache
      queryClient.setQueryData<Ticket[]>(
        queryKeys.projects.tickets(projectId),
        (old) => old?.filter((t) => t.id !== ticketId) ?? []
      );

      // Return snapshot for rollback context
      return { previousTickets };
    },

    // Rollback on error: Restore previous state
    onError: (_error, _ticketId, context) => {
      // Restore snapshot from onMutate context
      if (context?.previousTickets) {
        queryClient.setQueryData(queryKeys.projects.tickets(projectId), context.previousTickets);
      }

      // Toast notification will be handled by caller
    },

    // Always refetch after mutation (success or error) to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) });
    },

    // Don't retry GitHub API failures automatically
    // User should manually retry after resolving issues (permissions, rate limits)
    retry: false,
  });
}
