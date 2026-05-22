import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { Agent, Ticket } from '@prisma/client';
import type { BulkDeleteResult } from '@/lib/tickets/deletion';
import type { MergeResult } from '@/lib/tickets/merge';
import type { BulkUpdateResult } from '@/lib/tickets/bulk-update';

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

interface BulkUpdateAgentParams {
  ticketIds: number[];
  agent: Agent;
}

export function useBulkUpdateAgent(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<
    { action: 'update-agent' } & BulkUpdateResult,
    Error,
    BulkUpdateAgentParams,
    { previousTickets: Ticket[] }
  >({
    mutationFn: async ({ ticketIds, agent }) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'update-agent', ticketIds, agent }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update agent');
      }
      return response.json();
    },

    onMutate: async ({ ticketIds, agent }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.tickets(projectId) });
      const previousTickets = queryClient.getQueryData<Ticket[]>(
        queryKeys.projects.tickets(projectId)
      );
      const idsToUpdate = new Set(ticketIds);
      queryClient.setQueryData<Ticket[]>(
        queryKeys.projects.tickets(projectId),
        (old) => {
          if (!old || !Array.isArray(old)) return [];
          return old.map((t) => (idsToUpdate.has(t.id) ? { ...t, agent } : t));
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

interface BulkUpdateModelParams {
  ticketIds: number[];
  model: string;
}

export function useBulkUpdateModel(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<
    { action: 'update-model' } & BulkUpdateResult,
    Error,
    BulkUpdateModelParams,
    { previousTickets: Ticket[] }
  >({
    mutationFn: async ({ ticketIds, model }) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'update-model', ticketIds, model }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update model');
      }
      return response.json();
    },

    onMutate: async ({ ticketIds, model }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.tickets(projectId) });
      const previousTickets = queryClient.getQueryData<Ticket[]>(
        queryKeys.projects.tickets(projectId)
      );
      const idsToUpdate = new Set(ticketIds);
      queryClient.setQueryData<Ticket[]>(
        queryKeys.projects.tickets(projectId),
        (old) => {
          if (!old || !Array.isArray(old)) return [];
          return old.map((t) =>
            idsToUpdate.has(t.id)
              ? {
                  ...t,
                  specifyModel: model,
                  planModel: model,
                  implementModel: model,
                  quickImplModel: model,
                  verifyModel: model,
                }
              : t
          );
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
