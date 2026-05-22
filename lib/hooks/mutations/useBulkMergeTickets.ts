import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export interface BulkMergeResponse {
  success: true;
  base: {
    id: number;
    ticketKey: string;
    title: string;
    description: string;
    version: number;
    attachmentCount: number;
    updatedAt: string;
  };
  deleted: { count: number; ticketKeys: string[] };
  notifiedCreatorIds: string[];
}

export interface BulkMergeError extends Error {
  code?: string;
  details?: Record<string, unknown>;
  status?: number;
}

export interface BulkMergeVariables {
  baseTicketId: number;
  sourceTicketIds: number[];
  title: string;
  description: string;
  expectedVersions: Record<string, number>;
}

export function useBulkMergeTickets(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<BulkMergeResponse, BulkMergeError, BulkMergeVariables>({
    mutationFn: async (variables) => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/bulk/merge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(variables),
        }
      );
      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string; code?: string; details?: Record<string, unknown> };
        const err: BulkMergeError = new Error(errorData.error || 'Failed to merge tickets');
        if (errorData.code !== undefined) err.code = errorData.code;
        if (errorData.details !== undefined) err.details = errorData.details;
        err.status = response.status;
        throw err;
      }
      return response.json() as Promise<BulkMergeResponse>;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) });
    },

    retry: false,
  });
}
