import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { Agent, Ticket } from '@prisma/client';
import type { BulkDeleteResult } from '@/lib/tickets/deletion';
import type { MergeResult } from '@/lib/tickets/merge';
import type { BulkUpdateResult } from '@/lib/tickets/bulk-update';

async function postBulkAction<T>(
  projectId: number,
  body: Record<string, unknown>,
  fallbackError: string
): Promise<T> {
  const response = await fetch(`/api/projects/${projectId}/tickets/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || fallbackError);
  }
  return response.json();
}

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
    mutationFn: ({ ticketIds }) =>
      postBulkAction(projectId, { action: 'delete', ticketIds }, 'Failed to delete tickets'),

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

    onSuccess: (data, _vars, context) => {
      // The optimistic onMutate removed every selected ticket from the cache,
      // but the server may have skipped some (active jobs, not-in-INBOX, etc.).
      // Re-insert the skipped ones from the snapshot so the user doesn't see
      // them vanish and then reappear when onSettled refetches.
      const skippedIds = new Set(data.results.skipped.map((s) => s.ticketId));
      if (skippedIds.size === 0 || !context) return;
      const toRestore = context.previousTickets.filter((t) => skippedIds.has(t.id));
      if (toRestore.length === 0) return;
      queryClient.setQueryData<Ticket[]>(
        queryKeys.projects.tickets(projectId),
        (current) => {
          if (!current || !Array.isArray(current)) return current;
          const existing = new Set(current.map((t) => t.id));
          const additions = toRestore.filter((t) => !existing.has(t.id));
          return additions.length > 0 ? [...current, ...additions] : current;
        }
      );
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
    mutationFn: (params) =>
      postBulkAction(projectId, { action: 'merge', ...params }, 'Failed to merge tickets'),

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
    mutationFn: ({ ticketIds, agent }) =>
      postBulkAction(
        projectId,
        { action: 'update-agent', ticketIds, agent },
        'Failed to update agent'
      ),

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
    mutationFn: ({ ticketIds, model }) =>
      postBulkAction(
        projectId,
        { action: 'update-model', ticketIds, model },
        'Failed to update model'
      ),

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
