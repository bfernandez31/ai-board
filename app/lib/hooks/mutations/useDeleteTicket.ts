'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  TicketWithVersion,
  TicketDeleteVariables,
  OptimisticContext,
} from '@/app/lib/types/query-types';

/**
 * Delete a ticket with optimistic updates
 *
 * Features:
 * - Optimistic UI update (ticket disappears immediately)
 * - Automatic rollback on error
 * - Cache invalidation on success
 * - Type-safe mutation variables
 *
 * @returns Mutation hook for deleting tickets
 */
export function useDeleteTicket(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: TicketDeleteVariables) => {
      const { ticketId } = variables;

      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete ticket');
      }

      // DELETE may return 204 No Content
      if (response.status === 204) {
        return { success: true };
      }

      return response.json();
    },

    // Optimistic update: Remove ticket immediately from cache
    onMutate: async (variables): Promise<OptimisticContext<TicketWithVersion[]>> => {
      const queryKey = queryKeys.projects.tickets(projectId);

      // Cancel outgoing queries to avoid race conditions
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous state for rollback
      const previousData =
        queryClient.getQueryData<TicketWithVersion[]>(queryKey) || [];

      // Remove ticket from cache
      queryClient.setQueryData<TicketWithVersion[]>(queryKey, (old) =>
        (old || []).filter((ticket) => ticket.id !== variables.ticketId)
      );

      return {
        previousData,
        timestamp: Date.now(),
        queryKey,
      };
    },

    // Rollback on error
    onError: (error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
      console.error('[useDeleteTicket] Error:', error);
    },

    // Invalidate and refetch after success
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(projectId),
      });
      // Remove specific ticket query from cache
      queryClient.removeQueries({
        queryKey: queryKeys.projects.ticket(projectId, variables.ticketId),
      });
    },
  });
}
