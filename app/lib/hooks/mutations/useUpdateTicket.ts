'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  TicketWithVersion,
  TicketUpdateVariables,
  OptimisticContext,
} from '@/app/lib/types/query-types';

/**
 * Update an existing ticket with optimistic updates
 *
 * Features:
 * - Optimistic UI update (changes appear immediately)
 * - Automatic rollback on error (including version conflicts)
 * - Cache invalidation on success
 * - Type-safe mutation variables
 *
 * @returns Mutation hook for updating tickets
 */
export function useUpdateTicket(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: TicketUpdateVariables) => {
      const { ticketId, updates, version } = variables;

      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...updates, version }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update ticket');
      }

      return response.json() as Promise<TicketWithVersion>;
    },

    // Optimistic update: Apply changes immediately to cache
    onMutate: async (variables): Promise<OptimisticContext<TicketWithVersion[]>> => {
      const queryKey = queryKeys.projects.tickets(projectId);

      // Cancel outgoing queries to avoid race conditions
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous state for rollback
      const previousData =
        queryClient.getQueryData<TicketWithVersion[]>(queryKey) || [];

      // Update cache with optimistic changes
      queryClient.setQueryData<TicketWithVersion[]>(queryKey, (old) =>
        (old || []).map((ticket) =>
          ticket.id === variables.ticketId
            ? { ...ticket, ...variables.updates, updatedAt: new Date() }
            : ticket
        )
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
      console.error('[useUpdateTicket] Error:', error);
    },

    // Invalidate and refetch after success
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(projectId),
      });
      // Also invalidate specific ticket query if it exists
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.ticket(projectId, variables.ticketId),
      });
    },
  });
}
