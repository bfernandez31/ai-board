import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { Ticket } from '@prisma/client';
import type { BulkDeleteResult } from '@/lib/tickets/deletion';

interface BulkDeleteParams {
  ticketIds: number[];
}

export function useBulkDeleteTickets(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<
    { action: 'delete' } & BulkDeleteResult,
    Error,
    BulkDeleteParams,
    { previousTickets: Ticket[] }
  >({
    mutationFn: async ({ ticketIds }) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'delete', ticketIds }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete tickets');
      }
      return response.json();
    },

    onMutate: async ({ ticketIds }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.tickets(projectId) });
      const previousTickets = queryClient.getQueryData<Ticket[]>(
        queryKeys.projects.tickets(projectId)
      );
      const idsToRemove = new Set(ticketIds);
      queryClient.setQueryData<Ticket[]>(
        queryKeys.projects.tickets(projectId),
        (old) => {
          if (!old || !Array.isArray(old)) return [];
          return old.filter((t) => !idsToRemove.has(t.id));
        }
      );
      return { previousTickets: previousTickets ?? [] };
    },

    onError: (_error, _vars, context) => {
      if (context) {
        queryClient.setQueryData(queryKeys.projects.tickets(projectId), context.previousTickets);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) });
    },

    retry: false,
  });
}
