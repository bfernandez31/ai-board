'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  TicketWithVersion,
  StageTransitionVariables,
  OptimisticContext,
} from '@/app/lib/types/query-types';

/**
 * Transition a ticket to a different stage (drag-and-drop)
 *
 * Features:
 * - Optimistic UI update (ticket moves immediately)
 * - Automatic rollback on error (including validation errors)
 * - Cache invalidation on success
 * - Type-safe mutation variables
 * - Handles workflow validation and job creation
 *
 * @returns Mutation hook for stage transitions
 */
export function useStageTransition(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: StageTransitionVariables) => {
      const { ticketId, targetStage, version } = variables;

      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/transition`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ targetStage, version }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to transition ticket');
      }

      return response.json() as Promise<TicketWithVersion>;
    },

    // Optimistic update: Move ticket immediately to target stage
    onMutate: async (variables): Promise<OptimisticContext<TicketWithVersion[]>> => {
      const queryKey = queryKeys.projects.tickets(projectId);

      // Cancel outgoing queries to avoid race conditions
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous state for rollback
      const previousData =
        queryClient.getQueryData<TicketWithVersion[]>(queryKey) || [];

      // Update ticket stage in cache
      queryClient.setQueryData<TicketWithVersion[]>(queryKey, (old) =>
        (old || []).map((ticket) =>
          ticket.id === variables.ticketId
            ? { ...ticket, stage: variables.targetStage, updatedAt: new Date() }
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
      console.error('[useStageTransition] Error:', error);
    },

    // Invalidate and refetch after success
    onSuccess: () => {
      // Invalidate tickets to get updated workflow state and job creation
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(projectId),
      });
      // Invalidate jobs to show newly created job (if any)
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.jobsStatus(projectId),
      });
    },
  });
}
