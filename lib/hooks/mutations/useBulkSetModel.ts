import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/lib/types';
import type { TicketRef } from '@/lib/schemas/bulk-ticket';
import type { StageModelKey } from '@/lib/models/claude-models';

export interface BulkModelAffected {
  ticketId: number;
  version: number;
  specifyModel: string | null;
  planModel: string | null;
  implementModel: string | null;
  quickImplModel: string | null;
  verifyModel: string | null;
}

export interface BulkModelResponse {
  affected: BulkModelAffected[];
  skipped: Array<{ ticketId: number; reason: string }>;
}

interface Variables {
  stage: StageModelKey;
  model: string | null;
  tickets: TicketRef[];
}

function applyModelUpdate(
  ticket: TicketWithVersion,
  update: BulkModelAffected,
): TicketWithVersion {
  return {
    ...ticket,
    version: update.version,
    specifyModel: update.specifyModel,
    planModel: update.planModel,
    implementModel: update.implementModel,
    quickImplModel: update.quickImplModel,
    verifyModel: update.verifyModel,
  };
}

export function useBulkSetModel(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<BulkModelResponse, Error, Variables>({
    mutationFn: async (vars) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/bulk/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(vars),
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'Failed to update ticket models');
      }
      return response.json() as Promise<BulkModelResponse>;
    },

    onSuccess: (data) => {
      const key = queryKeys.projects.tickets(projectId);
      const affectedById = new Map(data.affected.map((a) => [a.ticketId, a] as const));

      const byStage = queryClient.getQueryData<Record<string, TicketWithVersion[]>>(key);
      if (byStage && !Array.isArray(byStage)) {
        const next: Record<string, TicketWithVersion[]> = {};
        for (const [stage, list] of Object.entries(byStage)) {
          next[stage] = list.map((t) => {
            const update = affectedById.get(t.id);
            return update ? applyModelUpdate(t, update) : t;
          });
        }
        queryClient.setQueryData(key, next);
        return;
      }
      const flat = queryClient.getQueryData<TicketWithVersion[]>(key);
      if (flat && Array.isArray(flat)) {
        queryClient.setQueryData(
          key,
          flat.map((t) => {
            const update = affectedById.get(t.id);
            return update ? applyModelUpdate(t, update) : t;
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
