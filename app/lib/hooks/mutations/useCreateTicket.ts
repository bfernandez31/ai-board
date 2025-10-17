'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  TicketWithVersion,
  TicketCreateVariables,
  OptimisticContext,
} from '@/app/lib/types/query-types';

/**
 * Create a new ticket with optimistic updates
 *
 * Features:
 * - Optimistic UI update (ticket appears immediately)
 * - Automatic rollback on error
 * - Cache invalidation on success
 * - Type-safe mutation variables
 *
 * @returns Mutation hook for creating tickets
 */
export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: TicketCreateVariables) => {
      const { projectId, ...ticketData } = variables;

      const response = await fetch(`/api/projects/${projectId}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ticketData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create ticket');
      }

      return response.json() as Promise<TicketWithVersion>;
    },

    // Optimistic update: Add ticket immediately to cache
    onMutate: async (variables): Promise<OptimisticContext<TicketWithVersion[]>> => {
      const queryKey = queryKeys.projects.tickets(variables.projectId);

      // Cancel outgoing queries to avoid race conditions
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous state for rollback
      const previousData =
        queryClient.getQueryData<TicketWithVersion[]>(queryKey) || [];

      // Optimistically create a temporary ticket
      const optimisticTicket: TicketWithVersion = {
        id: Date.now(), // Temporary ID (will be replaced by server)
        title: variables.title,
        description: variables.description,
        stage: variables.stage,
        projectId: variables.projectId,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        branch: null,
        autoMode: variables.autoMode || false,
        workflowType: 'FULL',
        clarificationPolicy: variables.clarificationPolicy || null,
      };

      // Update cache with optimistic ticket
      queryClient.setQueryData<TicketWithVersion[]>(queryKey, (old) => [
        ...(old || []),
        optimisticTicket,
      ]);

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
      console.error('[useCreateTicket] Error:', error);
    },

    // Invalidate and refetch after success
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(variables.projectId),
      });
    },
  });
}
