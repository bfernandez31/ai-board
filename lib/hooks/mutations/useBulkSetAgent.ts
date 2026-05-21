import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Agent } from '@prisma/client';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/lib/types';
import type { TicketRef } from '@/lib/schemas/bulk-ticket';

export interface BulkAgentResponse {
  affected: Array<{ ticketId: number; version: number; agent: Agent | null }>;
  skipped: Array<{ ticketId: number; reason: string }>;
}

interface Variables {
  agent: Agent | null;
  tickets: TicketRef[];
}

function mergeAgentIntoStageMap(
  byStage: Record<string, TicketWithVersion[]>,
  affectedById: Map<number, { version: number; agent: Agent | null }>,
): Record<string, TicketWithVersion[]> {
  const next: Record<string, TicketWithVersion[]> = {};
  for (const [stage, list] of Object.entries(byStage)) {
    next[stage] = list.map((t) => {
      const update = affectedById.get(t.id);
      return update ? { ...t, version: update.version, agent: update.agent } : t;
    });
  }
  return next;
}

export function useBulkSetAgent(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<BulkAgentResponse, Error, Variables>({
    mutationFn: async ({ agent, tickets }) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/bulk/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ agent, tickets }),
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'Failed to update ticket agents');
      }
      return response.json() as Promise<BulkAgentResponse>;
    },

    onSuccess: (data) => {
      const key = queryKeys.projects.tickets(projectId);
      const affectedById = new Map(
        data.affected.map((a) => [a.ticketId, { version: a.version, agent: a.agent }]),
      );
      const byStage = queryClient.getQueryData<Record<string, TicketWithVersion[]>>(key);
      if (byStage && !Array.isArray(byStage)) {
        queryClient.setQueryData(key, mergeAgentIntoStageMap(byStage, affectedById));
        return;
      }
      const flat = queryClient.getQueryData<TicketWithVersion[]>(key);
      if (flat && Array.isArray(flat)) {
        queryClient.setQueryData(
          key,
          flat.map((t) => {
            const update = affectedById.get(t.id);
            return update ? { ...t, version: update.version, agent: update.agent } : t;
          }),
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) });
    },

    retry: false,
  });
}
