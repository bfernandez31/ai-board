import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Agent } from '@prisma/client';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/lib/types';
import type { Stage } from '@/lib/stage-transitions';

export type BulkFieldKind = 'agent' | 'model';

export interface BulkUpdateAgentResponse {
  success: true;
  updated: { count: number; ticketIds: number[]; agent: Agent | null };
}

export interface BulkUpdateModelResponse {
  success: true;
  updated: {
    count: number;
    ticketIds: number[];
    model: string | null;
    appliedFields: readonly string[];
  };
}

export type BulkUpdateResponse = BulkUpdateAgentResponse | BulkUpdateModelResponse;

export interface BulkUpdateError extends Error {
  code?: string;
  details?: Record<string, unknown>;
  status?: number;
}

export interface BulkUpdateAgentVariables {
  kind: 'agent';
  ticketIds: number[];
  value: Agent | null;
}

export interface BulkUpdateModelVariables {
  kind: 'model';
  ticketIds: number[];
  value: string | null;
}

export type BulkUpdateVariables = BulkUpdateAgentVariables | BulkUpdateModelVariables;

type TicketsByStage = Record<Stage, TicketWithVersion[]> & { _shipTotal?: number };

interface MutationContext {
  previous?: TicketsByStage;
}

const MODEL_FIELDS = [
  'specifyModel',
  'planModel',
  'implementModel',
  'quickImplModel',
  'verifyModel',
] as const;

export function useBulkUpdateTicketField(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<BulkUpdateResponse, BulkUpdateError, BulkUpdateVariables, MutationContext>({
    mutationFn: async (variables) => {
      const endpoint = variables.kind === 'agent' ? 'agent' : 'model';
      const body =
        variables.kind === 'agent'
          ? { ticketIds: variables.ticketIds, agent: variables.value }
          : { ticketIds: variables.ticketIds, model: variables.value };

      const response = await fetch(
        `/api/projects/${projectId}/tickets/bulk/${endpoint}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        }
      );
      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string; code?: string; details?: Record<string, unknown> };
        const err: BulkUpdateError = new Error(errorData.error || `Failed to update ${endpoint}`);
        if (errorData.code !== undefined) err.code = errorData.code;
        if (errorData.details !== undefined) err.details = errorData.details;
        err.status = response.status;
        throw err;
      }
      return response.json() as Promise<BulkUpdateResponse>;
    },

    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.tickets(projectId) });
      const previous = queryClient.getQueryData<TicketsByStage>(
        queryKeys.projects.tickets(projectId)
      );

      const targets = new Set(variables.ticketIds);

      queryClient.setQueryData<TicketsByStage>(
        queryKeys.projects.tickets(projectId),
        (old) => {
          if (!old) return old;
          const next = { ...old } as TicketsByStage;
          for (const key of Object.keys(next)) {
            const stage = key as Stage;
            const list = next[stage];
            if (!Array.isArray(list)) continue;
            next[stage] = list.map((t) => {
              if (!targets.has(t.id)) return t;
              if (variables.kind === 'agent') {
                return { ...t, agent: variables.value };
              }
              const patch: Record<string, unknown> = {};
              for (const field of MODEL_FIELDS) {
                patch[field] = variables.value;
              }
              return { ...t, ...patch } as TicketWithVersion;
            });
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
