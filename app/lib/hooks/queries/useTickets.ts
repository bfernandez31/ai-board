'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion, TicketsByStage } from '@/app/lib/types/query-types';
import { Stage } from '@prisma/client';

async function fetchTicketsFromAPI(projectId: number): Promise<{ tickets: TicketWithVersion[]; shipTotal: number }> {
  const response = await fetch(`/api/projects/${projectId}/tickets`);

  if (!response.ok) {
    throw new Error(`Failed to fetch tickets: HTTP ${response.status}`);
  }

  const { _shipTotal, ...stages } = await response.json();
  const shipTotal: number = _shipTotal ?? stages.SHIP?.length ?? 0;
  const tickets = Object.values(stages).flat() as TicketWithVersion[];
  return { tickets, shipTotal };
}

/**
 * Re-attach SHIP tickets loaded via infinite scroll to a fresh board fetch.
 *
 * The default tickets endpoint only returns the first SHIP batch, so a plain
 * refetch (polling, invalidation) would drop every batch loaded afterwards.
 * Previously loaded SHIP tickets absent from the fresh response are appended
 * (in their existing order), capped so the SHIP count never exceeds `shipTotal`.
 */
export function mergeLoadedShipTickets(
  fresh: TicketWithVersion[],
  previous: TicketWithVersion[] | undefined,
  shipTotal: number
): TicketWithVersion[] {
  if (!previous || previous.length === 0) return fresh;

  const freshIds = new Set(fresh.map((t) => t.id));
  const freshShipCount = fresh.filter((t) => t.stage === Stage.SHIP).length;
  const room = Math.max(0, shipTotal - freshShipCount);
  if (room === 0) return fresh;

  const retained = previous
    .filter((t) => t.stage === Stage.SHIP && !freshIds.has(t.id))
    .slice(0, room);

  return retained.length > 0 ? [...fresh, ...retained] : fresh;
}

function makeTicketsQueryFn(projectId: number, queryClient: ReturnType<typeof useQueryClient>) {
  return async (): Promise<TicketWithVersion[]> => {
    const { tickets, shipTotal } = await fetchTicketsFromAPI(projectId);
    queryClient.setQueryData(queryKeys.projects.shipTotal(projectId), shipTotal);
    const previous = queryClient.getQueryData<TicketWithVersion[]>(
      queryKeys.projects.tickets(projectId)
    );
    return mergeLoadedShipTickets(tickets, previous, shipTotal);
  };
}

export function useProjectTickets(projectId: number) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.projects.tickets(projectId),
    queryFn: makeTicketsQueryFn(projectId, queryClient),
    staleTime: 5000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useTicketsByStage(projectId: number) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.projects.tickets(projectId),
    queryFn: makeTicketsQueryFn(projectId, queryClient),
    select: (tickets): TicketsByStage => {
      const grouped: TicketsByStage = {
        [Stage.INBOX]: [],
        [Stage.SPECIFY]: [],
        [Stage.PLAN]: [],
        [Stage.BUILD]: [],
        [Stage.VERIFY]: [],
        [Stage.SHIP]: [],
        [Stage.CLOSED]: [],
      };

      for (const ticket of tickets) {
        grouped[ticket.stage].push(ticket);
      }

      return grouped;
    },
    staleTime: 5000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Read the SHIP total count from its dedicated cache entry.
 * Populated by useTicketsByStage/useProjectTickets on fetch,
 * and seeded by the Board component on mount.
 */
export function useShipTotal(projectId: number) {
  return useQuery<number>({
    queryKey: queryKeys.projects.shipTotal(projectId),
    enabled: false, // Never fetches on its own — populated reactively
    staleTime: Infinity,
    initialData: 0,
  });
}

/**
 * Load the next batch of SHIP tickets (offset-based pagination, used by the
 * SHIP column infinite scroll). Appends results to the flat tickets cache.
 *
 * - Only one request in flight at a time (extra calls are ignored).
 * - Tickets already in the cache are never appended twice.
 * - Failures are exposed via `error`; callers retry explicitly with `loadMore`.
 */
export function useLoadMoreShipTickets(projectId: number) {
  const queryClient = useQueryClient();
  // Synchronous guard: mutation state only updates on the next render, so rapid
  // scroll events could otherwise fire several requests in the same tick.
  const inFlightRef = useRef(false);

  const mutation = useMutation({
    mutationFn: async ({ offset, limit = 50 }: { offset: number; limit?: number }) => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets?stage=SHIP&offset=${offset}&limit=${limit}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch more SHIP tickets: HTTP ${response.status}`);
      }
      const data = await response.json();
      return data.tickets as TicketWithVersion[];
    },
    onSuccess: (newTickets) => {
      if (newTickets.length === 0) return;

      queryClient.setQueryData<TicketWithVersion[]>(
        queryKeys.projects.tickets(projectId),
        (old) => {
          if (!old) return newTickets;
          const existingIds = new Set(old.map((t) => t.id));
          const unique = newTickets.filter((t) => !existingIds.has(t.id));
          return unique.length > 0 ? [...old, ...unique] : old;
        }
      );
    },
    onSettled: () => {
      inFlightRef.current = false;
    },
  });

  const { mutate } = mutation;
  const loadMore = useCallback(
    (currentShipCount: number) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      mutate({ offset: currentShipCount });
    },
    [mutate]
  );

  return {
    loadMore,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}

export function useTicket(projectId: number, ticketId: number) {
  return useQuery({
    queryKey: queryKeys.projects.ticket(projectId, ticketId),
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/tickets/${ticketId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch ticket: HTTP ${response.status}`);
      }

      return response.json() as Promise<TicketWithVersion>;
    },
    staleTime: 5000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useTicketByKey(
  projectId: number,
  ticketKey: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.projects.ticketByKey(projectId, ticketKey ?? ''),
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/tickets/${ticketKey}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to fetch ticket: HTTP ${response.status}`);
      }

      return response.json() as Promise<TicketWithVersion>;
    },
    enabled: enabled && !!ticketKey,
    staleTime: 5000,
    gcTime: 10 * 60 * 1000,
  });
}
