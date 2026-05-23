import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Agent } from '@prisma/client';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/app/lib/types/query-types';
import { BulkActionErrorResponse } from './useBulkDeleteTickets';

interface BulkUpdateAgentResponse {
  success: true;
  updatedTickets: Array<{ id: number; ticketKey: string; agent: Agent | null }>;
}

export function useBulkUpdateTicketAgent(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<
    BulkUpdateAgentResponse,
    BulkActionErrorResponse,
    { ticketIds: number[]; agent: Agent | null },
    { previousTickets: TicketWithVersion[] }
  >({
    mutationFn: async (input) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/bulk/agent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new BulkActionErrorResponse(await response.json());
      }

      return response.json() as Promise<BulkUpdateAgentResponse>;
    },
    onMutate: async ({ ticketIds, agent }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.tickets(projectId) });
      const previousTickets =
        queryClient.getQueryData<TicketWithVersion[]>(queryKeys.projects.tickets(projectId)) ?? [];

      queryClient.setQueryData<TicketWithVersion[]>(
        queryKeys.projects.tickets(projectId),
        previousTickets.map((ticket) =>
          ticketIds.includes(ticket.id)
            ? { ...ticket, agent }
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
