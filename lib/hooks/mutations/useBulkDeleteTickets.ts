import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/app/lib/types/query-types';

interface BulkDeleteResponse {
  success: true;
  deletedTicketIds: number[];
  deletedTicketKeys: string[];
}

interface BulkActionError {
  error: string;
  code?: string;
  details?: {
    blockingTicketId?: number;
    blockingTicketKey?: string;
    reason?: string;
  };
}

export class BulkActionErrorResponse extends Error {
  code: string | undefined;
  details: BulkActionError['details'] | undefined;

  constructor(payload: BulkActionError) {
    super(payload.error || 'Bulk action failed');
    this.name = 'BulkActionErrorResponse';
    this.code = payload.code;
    this.details = payload.details;
  }
}

export function useBulkDeleteTickets(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<
    BulkDeleteResponse,
    BulkActionErrorResponse,
    number[],
    { previousTickets: TicketWithVersion[] }
  >({
    mutationFn: async (ticketIds) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/bulk/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ticketIds }),
      });

      if (!response.ok) {
        throw new BulkActionErrorResponse((await response.json()) as BulkActionError);
      }

      return response.json() as Promise<BulkDeleteResponse>;
    },
    onMutate: async (ticketIds) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.tickets(projectId) });
      const previousTickets =
        queryClient.getQueryData<TicketWithVersion[]>(queryKeys.projects.tickets(projectId)) ?? [];

      queryClient.setQueryData<TicketWithVersion[]>(
        queryKeys.projects.tickets(projectId),
        previousTickets.filter((ticket) => !ticketIds.includes(ticket.id))
      );

      return { previousTickets };
    },
    onError: (_error, _ticketIds, context) => {
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
