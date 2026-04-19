'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  TicketWithVersion,
  OptimisticContext,
} from '@/app/lib/types/query-types';

export interface AutoModeMutationVariables {
  ticketId: number;
  enabled: boolean;
}

export interface AutoModeResponse {
  autoMode: boolean;
  ticketId: number;
  stage: string;
  jobId?: number | null;
}

/**
 * Mutation hook for toggling Ticket.autoMode.
 *
 * - Optimistically updates the ticket cache's `autoMode` field.
 * - Rolls back on error.
 * - On success, invalidates ticket and job queries so any freshly-dispatched
 *   PENDING job shows up immediately.
 */
export function useAutoMode(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: AutoModeMutationVariables): Promise<AutoModeResponse> => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${variables.ticketId}/auto-mode`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: variables.enabled }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Failed to toggle auto-mode');
      }

      return response.json() as Promise<AutoModeResponse>;
    },

    onMutate: async (variables): Promise<OptimisticContext<TicketWithVersion[]>> => {
      const queryKey = queryKeys.projects.tickets(projectId);
      await queryClient.cancelQueries({ queryKey });

      const previousData =
        queryClient.getQueryData<TicketWithVersion[]>(queryKey) || [];

      queryClient.setQueryData<TicketWithVersion[]>(queryKey, (old) =>
        (old || []).map((ticket) =>
          ticket.id === variables.ticketId
            ? { ...ticket, autoMode: variables.enabled }
            : ticket
        )
      );

      return {
        previousData,
        timestamp: Date.now(),
        queryKey,
      };
    },

    onError: (error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
      console.error('[useAutoMode] Error:', error);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.jobsStatus(projectId),
      });
    },
  });
}
