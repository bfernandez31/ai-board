import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/lib/types';
import type { Stage } from '@/lib/stage-transitions';

export interface BulkDeleteResponse {
  success: true;
  deleted: { count: number; ticketKeys: string[] };
  notifiedCreatorIds: string[];
}

export interface BulkDeleteError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

export interface BulkDeleteVariables {
  ticketIds: number[];
  expectedVersions: Record<string, number>;
}

type TicketsByStage = Record<Stage, TicketWithVersion[]> & { _shipTotal?: number };

interface MutationContext {
  previous?: TicketsByStage;
}

export function useBulkDeleteTickets(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<BulkDeleteResponse, Error, BulkDeleteVariables, MutationContext>({
    mutationFn: async ({ ticketIds, expectedVersions }) => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/bulk/delete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ticketIds, expectedVersions }),
        }
      );
      if (!response.ok) {
        const errorData = (await response.json()) as BulkDeleteError;
        const err = new Error(errorData.error || 'Failed to delete tickets');
        Object.assign(err, { code: errorData.code, details: errorData.details, status: response.status });
        throw err;
      }
      return response.json() as Promise<BulkDeleteResponse>;
    },

    onMutate: async ({ ticketIds }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.tickets(projectId) });
      const previous = queryClient.getQueryData<TicketsByStage>(
        queryKeys.projects.tickets(projectId)
      );
      const toRemove = new Set(ticketIds);
      queryClient.setQueryData<TicketsByStage>(
        queryKeys.projects.tickets(projectId),
        (old) => {
          if (!old) return old;
          const next = { ...old } as TicketsByStage;
          for (const key of Object.keys(next)) {
            const stage = key as Stage;
            const list = next[stage];
            if (Array.isArray(list)) {
              next[stage] = list.filter((t) => !toRemove.has(t.id));
            }
          }
          return next;
        }
      );
      return previous ? { previous } : {};
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.projects.tickets(projectId), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) });
    },

    retry: false,
  });
}
