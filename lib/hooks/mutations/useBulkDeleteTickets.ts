import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/lib/types';
import type { TicketRef } from '@/lib/schemas/bulk-ticket';

export interface BulkDeleteResponse {
  affected: number[];
  skipped: Array<{ ticketId: number; reason: string }>;
  prsClosed: number;
}

interface BulkDeleteVariables {
  tickets: TicketRef[];
}

interface MutationContext {
  previousByStage: Record<string, TicketWithVersion[]> | undefined;
  previousFlat: TicketWithVersion[] | undefined;
}

export function useBulkDeleteTickets(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<BulkDeleteResponse, Error, BulkDeleteVariables, MutationContext>({
    mutationFn: async ({ tickets }) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/bulk/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tickets }),
      });
      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorData.error || 'Failed to delete tickets');
      }
      return response.json() as Promise<BulkDeleteResponse>;
    },

    onMutate: async ({ tickets }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.tickets(projectId) });

      const ids = new Set(tickets.map((t) => t.id));
      const key = queryKeys.projects.tickets(projectId);

      const previousByStage = queryClient.getQueryData<Record<string, TicketWithVersion[]>>(key);
      const previousFlat = queryClient.getQueryData<TicketWithVersion[]>(key);

      if (previousByStage && !Array.isArray(previousByStage)) {
        const next: Record<string, TicketWithVersion[]> = {};
        for (const [stage, list] of Object.entries(previousByStage)) {
          next[stage] = list.filter((t) => !ids.has(t.id));
        }
        queryClient.setQueryData(key, next);
      } else if (previousFlat && Array.isArray(previousFlat)) {
        queryClient.setQueryData(
          key,
          previousFlat.filter((t) => !ids.has(t.id)),
        );
      }

      return { previousByStage, previousFlat };
    },

    onError: (_error, _vars, context) => {
      if (!context) return;
      const key = queryKeys.projects.tickets(projectId);
      if (context.previousByStage) queryClient.setQueryData(key, context.previousByStage);
      else if (context.previousFlat) queryClient.setQueryData(key, context.previousFlat);
    },

    onSuccess: (data, _vars, context) => {
      if (!data.skipped || data.skipped.length === 0) return;
      // Re-insert skipped tickets from snapshot so the user sees what survived.
      const key = queryKeys.projects.tickets(projectId);
      const skippedIds = new Set(data.skipped.map((s) => s.ticketId));

      if (context?.previousByStage) {
        const current = queryClient.getQueryData<Record<string, TicketWithVersion[]>>(key);
        if (!current) return;
        const merged: Record<string, TicketWithVersion[]> = { ...current };
        for (const [stage, prevList] of Object.entries(context.previousByStage)) {
          const restored = prevList.filter((t) => skippedIds.has(t.id));
          if (restored.length === 0) continue;
          const existing = merged[stage] ?? [];
          const existingIds = new Set(existing.map((t) => t.id));
          merged[stage] = [...existing, ...restored.filter((t) => !existingIds.has(t.id))];
        }
        queryClient.setQueryData(key, merged);
      } else if (context?.previousFlat) {
        const current = queryClient.getQueryData<TicketWithVersion[]>(key) ?? [];
        const existingIds = new Set(current.map((t) => t.id));
        const restored = context.previousFlat.filter(
          (t) => skippedIds.has(t.id) && !existingIds.has(t.id),
        );
        if (restored.length > 0) queryClient.setQueryData(key, [...current, ...restored]);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) });
    },

    retry: false,
  });
}
