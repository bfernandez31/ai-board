import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/app/lib/types/query-types';
import { BulkActionErrorResponse } from './useBulkDeleteTickets';

interface BulkUpdateModelConfigResponse {
  success: true;
  appliedModelId: string;
  updatedTickets: Array<{
    id: number;
    ticketKey: string;
    specifyModel: string | null;
    planModel: string | null;
    implementModel: string | null;
    quickImplModel: string | null;
    verifyModel: string | null;
  }>;
}

export function useBulkUpdateTicketModelConfig(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<
    BulkUpdateModelConfigResponse,
    BulkActionErrorResponse,
    { ticketIds: number[]; modelId: string },
    { previousTickets: TicketWithVersion[] }
  >({
    mutationFn: async (input) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/bulk/model-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new BulkActionErrorResponse(await response.json());
      }

      return response.json() as Promise<BulkUpdateModelConfigResponse>;
    },
    onMutate: async ({ ticketIds, modelId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.tickets(projectId) });
      const previousTickets =
        queryClient.getQueryData<TicketWithVersion[]>(queryKeys.projects.tickets(projectId)) ?? [];

      queryClient.setQueryData<TicketWithVersion[]>(
        queryKeys.projects.tickets(projectId),
        previousTickets.map((ticket) =>
          ticketIds.includes(ticket.id)
            ? {
                ...ticket,
                specifyModel: modelId,
                planModel: modelId,
                implementModel: modelId,
                quickImplModel: modelId,
                verifyModel: modelId,
              }
            : ticket
        )
      );

      return { previousTickets };
    },
    onError: (_error, _input, context) => {
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
