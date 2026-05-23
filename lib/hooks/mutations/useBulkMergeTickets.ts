import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Prisma } from '@prisma/client';
import { isTicketAttachmentArray, type TicketAttachment } from '@/app/lib/types/ticket';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/app/lib/types/query-types';
import { BulkActionErrorResponse } from './useBulkDeleteTickets';

interface BulkMergeResponse {
  success: true;
  survivor: {
    id: number;
    ticketKey: string;
    title: string;
    description: string;
    attachments: Prisma.JsonValue;
    stage: string;
    version: number;
    projectId: number;
    agent: TicketWithVersion['agent'];
    specifyModel: string | null;
    planModel: string | null;
    implementModel: string | null;
    quickImplModel: string | null;
    verifyModel: string | null;
    createdAt: string;
    updatedAt: string;
  };
  deletedSourceTicketIds: number[];
}

function dedupeAttachments(attachments: TicketAttachment[]): TicketAttachment[] {
  const seenKeys = new Set<string>();
  const deduped: TicketAttachment[] = [];

  for (const attachment of attachments) {
    const stableKey = attachment.cloudinaryPublicId?.trim() || attachment.url.trim();
    if (!stableKey || seenKeys.has(stableKey)) {
      continue;
    }
    seenKeys.add(stableKey);
    deduped.push(attachment);
  }

  return deduped;
}

export function useBulkMergeTickets(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<
    BulkMergeResponse,
    BulkActionErrorResponse,
    { ticketIds: number[]; expectedBaseTicketId: number; title: string; description: string },
    { previousTickets: TicketWithVersion[] }
  >({
    mutationFn: async (input) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/bulk/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new BulkActionErrorResponse(await response.json());
      }

      return response.json() as Promise<BulkMergeResponse>;
    },
    onMutate: async ({ ticketIds, expectedBaseTicketId, title, description }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.tickets(projectId) });
      const previousTickets =
        queryClient.getQueryData<TicketWithVersion[]>(queryKeys.projects.tickets(projectId)) ?? [];

      const selectedTickets = previousTickets
        .filter((ticket) => ticketIds.includes(ticket.id))
        .sort((left, right) => left.ticketNumber - right.ticketNumber);
      const survivor = selectedTickets.find((ticket) => ticket.id === expectedBaseTicketId);

      if (survivor) {
        const mergedAttachments = dedupeAttachments(
          selectedTickets.flatMap((ticket) =>
            isTicketAttachmentArray(ticket.attachments) ? ticket.attachments : []
          )
        );

        queryClient.setQueryData<TicketWithVersion[]>(
          queryKeys.projects.tickets(projectId),
          previousTickets
            .filter((ticket) => ticket.id === expectedBaseTicketId || !ticketIds.includes(ticket.id))
            .map((ticket) =>
              ticket.id === expectedBaseTicketId
                ? {
                    ...ticket,
                    title,
                    description,
                    attachments: mergedAttachments as unknown as Prisma.JsonValue,
                  }
                : ticket
            )
        );
      }

      return { previousTickets };
    },
    onError: (_error, _input, context) => {
      if (context) {
        queryClient.setQueryData(queryKeys.projects.tickets(projectId), context.previousTickets);
      }
    },
    onSuccess: (result) => {
      queryClient.setQueryData<TicketWithVersion[]>(
        queryKeys.projects.tickets(projectId),
        (current = []) =>
          current
            .filter((ticket) => !result.deletedSourceTicketIds.includes(ticket.id))
            .map((ticket) =>
              ticket.id === result.survivor.id
                ? {
                    ...ticket,
                    ...result.survivor,
                    stage: result.survivor.stage as TicketWithVersion['stage'],
                    attachments: result.survivor.attachments,
                  }
                : ticket
            )
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) });
    },
    retry: false,
  });
}
