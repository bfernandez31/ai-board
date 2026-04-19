'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { Stage } from '@/lib/types';

interface ToggleAutoModeVariables {
  ticketId: number;
  ticketKey: string;
  version: number;
  enable: boolean;
  /** When enabling with no running workflow job, dispatch this stage immediately. */
  immediateDispatchStage?: Stage | null;
}

interface ToggleAutoModeResponse {
  ok: boolean;
  autoMode: boolean;
}

/**
 * Toggle auto-transition mode on a ticket.
 *
 * When enabling and an immediateDispatchStage is provided, also POSTs the
 * transition to kick off the chain. Dispatch failures are swallowed here —
 * the server will disable autoMode on the failure path anyway.
 */
export function useToggleAutoMode(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<ToggleAutoModeResponse, Error, ToggleAutoModeVariables>({
    mutationFn: async ({ ticketId, version, enable, immediateDispatchStage }) => {
      const patchResponse = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ autoMode: enable, version }),
        }
      );

      if (!patchResponse.ok) {
        const error = await patchResponse.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to toggle auto-transition');
      }

      if (enable && immediateDispatchStage) {
        try {
          await fetch(
            `/api/projects/${projectId}/tickets/${ticketId}/transition`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ targetStage: immediateDispatchStage }),
            }
          );
        } catch (dispatchError) {
          console.error('[useToggleAutoMode] Dispatch error:', dispatchError);
        }
      }

      return { ok: true, autoMode: enable };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.jobsStatus(projectId) });
    },
    retry: false,
  });
}
