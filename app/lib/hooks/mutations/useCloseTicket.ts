'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion, OptimisticContext } from '@/app/lib/types/query-types';

/**
 * Variables for closing a ticket
 */
export interface CloseTicketVariables {
  ticketId: number;
  version: number;
}

/**
 * Response from close ticket API
 */
export interface CloseTicketResponse {
  id: number;
  ticketKey: string;
  stage: 'CLOSED';
  closedAt: string;
  version: number;
  prsClosed: number;
}

/**
 * Close a ticket (VERIFY → CLOSED)
 *
 * Features:
 * - Optimistic UI update (ticket removed from board immediately)
 * - Automatic rollback on error
 * - Cache invalidation on success
 * - Type-safe mutation variables
 * - Handles PR closure as side effect
 *
 * @param projectId - Project ID for the ticket
 * @returns Mutation hook for closing tickets
 */
export function useCloseTicket(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: CloseTicketVariables): Promise<CloseTicketResponse> => {
      const { ticketId, version } = variables;

      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/transition`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ targetStage: 'CLOSED', version }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to close ticket');
      }

      return response.json();
    },

    // Optimistic update: Remove ticket from board immediately
    onMutate: async (variables): Promise<OptimisticContext<TicketWithVersion[]>> => {
      const queryKey = queryKeys.projects.tickets(projectId);

      // Cancel outgoing queries to avoid race conditions
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous state for rollback
      const previousData =
        queryClient.getQueryData<TicketWithVersion[]>(queryKey) || [];

      // Remove ticket from cache (closed tickets don't appear on board)
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
      console.error('[useCloseTicket] Error:', error);
    },

    // Invalidate and refetch after success
    onSuccess: () => {
      // Invalidate tickets to ensure board state is correct
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(projectId),
      });
    },
  });
}
