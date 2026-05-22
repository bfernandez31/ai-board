import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { Ticket } from '@prisma/client';
import type { BulkDeleteResult } from '@/lib/tickets/deletion';
import type { MergeResult } from '@/lib/tickets/merge';

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

interface MergeParams {
  ticketIds: number[];
  mergedTitle: string;
  mergedDescription: string;
  selectedAttachments: string[];
}

export function useMergeTickets(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<
    { action: 'merge' } & MergeResult,
    Error,
    MergeParams,
    { previousTickets: Ticket[] }
  >({
    mutationFn: async (params) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'merge', ...params }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to merge tickets');
      }
      return response.json();
    },

    onMutate: async ({ ticketIds }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.tickets(projectId) });
      const previousTickets = queryClient.getQueryData<Ticket[]>(
        queryKeys.projects.tickets(projectId)
      );
      const sortedIds = [...ticketIds].sort((a, b) => a - b);
      const baseId = sortedIds[0];
      const sourceIds = new Set(sortedIds.slice(1));
      queryClient.setQueryData<Ticket[]>(
        queryKeys.projects.tickets(projectId),
        (old) => {
          if (!old || !Array.isArray(old)) return [];
          return old.filter((t) => t.id === baseId || !sourceIds.has(t.id));
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
