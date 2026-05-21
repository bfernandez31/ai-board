import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/lib/types';
import type { TicketAttachment } from '@/app/lib/types/ticket';
import type { TicketRef } from '@/lib/schemas/bulk-ticket';

interface FuseTicketsVariables {
  anchorId: number;
  anchorVersion: number;
  title: string;
  description: string;
  attachments: TicketAttachment[];
  absorbed: TicketRef[];
}

export interface FuseTicketsResponse {
  anchor: TicketWithVersion;
  deletedIds: number[];
}

export interface FusionConflictResponse {
  error: string;
  code: 'CONFLICT';
  conflicting: number[];
}

export class FusionConflict extends Error {
  readonly conflicting: number[];
  constructor(message: string, conflicting: number[]) {
    super(message);
    this.name = 'FusionConflict';
    this.conflicting = conflicting;
  }
}

export function useFuseTickets(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<FuseTicketsResponse, Error, FuseTicketsVariables>({
    mutationFn: async (vars) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/bulk/fusion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(vars),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 && Array.isArray((data as FusionConflictResponse).conflicting)) {
          const body = data as FusionConflictResponse;
          throw new FusionConflict(body.error, body.conflicting);
        }
        const message = (data as { error?: string }).error || 'Failed to fuse tickets';
        throw new Error(message);
      }
      return data as FuseTicketsResponse;
    },

    onSuccess: (data) => {
      const key = queryKeys.projects.tickets(projectId);
      const deletedSet = new Set(data.deletedIds);

      const byStage = queryClient.getQueryData<Record<string, TicketWithVersion[]>>(key);
      if (byStage && !Array.isArray(byStage)) {
        const next: Record<string, TicketWithVersion[]> = {};
        for (const [stage, list] of Object.entries(byStage)) {
          const filtered = list
            .filter((t) => !deletedSet.has(t.id))
            .map((t) => (t.id === data.anchor.id ? data.anchor : t));
          next[stage] = filtered;
        }
        queryClient.setQueryData(key, next);
        return;
      }
      const flat = queryClient.getQueryData<TicketWithVersion[]>(key);
      if (flat && Array.isArray(flat)) {
        queryClient.setQueryData(
          key,
          flat
            .filter((t) => !deletedSet.has(t.id))
            .map((t) => (t.id === data.anchor.id ? data.anchor : t)),
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) });
    },

    retry: false,
  });
}
