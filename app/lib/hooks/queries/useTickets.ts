'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
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

function makeTicketsQueryFn(projectId: number, queryClient: ReturnType<typeof useQueryClient>) {
  return async (): Promise<TicketWithVersion[]> => {
    const { tickets, shipTotal } = await fetchTicketsFromAPI(projectId);
    queryClient.setQueryData(queryKeys.projects.shipTotal(projectId), shipTotal);
    return mergeLoadedShipTickets(
      tickets,
      queryClient.getQueryData<TicketWithVersion[]>(queryKeys.projects.tickets(projectId)) ?? [],
      shipTotal
    );
  };
}

/**
 * The board endpoint only returns the first SHIP batch. Keep SHIP tickets that
 * infinite scroll already loaded so a polling refetch does not drop them.
 * Fresh data wins for any id present in both; extras are capped at the total.
 */
function mergeLoadedShipTickets(
  fresh: TicketWithVersion[],
  previous: TicketWithVersion[],
  shipTotal: number
): TicketWithVersion[] {
  const freshShipCount = fresh.filter((t) => t.stage === Stage.SHIP).length;
  if (freshShipCount >= shipTotal) return fresh;

  const freshIds = new Set(fresh.map((t) => t.id));
  const extras = previous
    .filter((t) => t.stage === Stage.SHIP && !freshIds.has(t.id))
    .slice(0, shipTotal - freshShipCount);
  return extras.length > 0 ? [...fresh, ...extras] : fresh;
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

export const SHIP_BATCH_SIZE = 50;

export interface LoadMoreShipTickets {
  /** Request the batch at `offset`. No-op while in flight, in error, or exhausted. */
  loadMore: (offset: number) => void;
  /** Clear the error and re-request the batch at `offset`. */
  retry: (offset: number) => void;
  isLoading: boolean;
  isError: boolean;
  isExhausted: boolean;
}

/**
 * Load more SHIP tickets (offset-based pagination) for the SHIP column infinite scroll.
 * Appends results to the flat tickets cache array, deduplicated by id across all stages.
 * At most one request is in flight; failures are not retried automatically.
 * Exhaustion (short/empty/all-duplicate batch) is cleared when `shipTotal` grows.
 */
export function useLoadMoreShipTickets(projectId: number, shipTotal: number): LoadMoreShipTickets {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);
  // SHIP total at the moment the server ran out of tickets (null = not exhausted)
  const [exhaustedAtTotal, setExhaustedAtTotal] = useState<number | null>(null);
  const isExhausted = exhaustedAtTotal !== null && shipTotal <= exhaustedAtTotal;

  const mutation = useMutation({
    mutationFn: async ({ offset, limit }: { offset: number; limit: number }) => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets?stage=SHIP&offset=${offset}&limit=${limit}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch more SHIP tickets: HTTP ${response.status}`);
      }
      const data = await response.json();
      return data.tickets as TicketWithVersion[];
    },
    retry: 0,
    onSuccess: (newTickets, { limit }) => {
      let added = 0;
      queryClient.setQueryData<TicketWithVersion[]>(
        queryKeys.projects.tickets(projectId),
        (old) => {
          const base = old ?? [];
          const seenIds = new Set(base.map((t) => t.id));
          const unseen = newTickets.filter((t) => {
            if (seenIds.has(t.id)) return false;
            seenIds.add(t.id);
            return true;
          });
          added = unseen.length;
          return added > 0 ? [...base, ...unseen] : old;
        }
      );

      if (newTickets.length < limit || added === 0) {
        setExhaustedAtTotal(
          queryClient.getQueryData<number>(queryKeys.projects.shipTotal(projectId)) ?? 0
        );
      }
    },
    onSettled: () => {
      inFlightRef.current = false;
    },
  });

  const { mutate, reset, isPending, isError } = mutation;

  const request = useCallback(
    (offset: number) => {
      inFlightRef.current = true;
      mutate({ offset, limit: SHIP_BATCH_SIZE });
    },
    [mutate]
  );

  const loadMore = useCallback(
    (offset: number) => {
      if (inFlightRef.current || isError || isExhausted) return;
      request(offset);
    },
    [request, isError, isExhausted]
  );

  const retry = useCallback(
    (offset: number) => {
      if (inFlightRef.current) return;
      reset();
      request(offset);
    },
    [request, reset]
  );

  return {
    loadMore,
    retry,
    isLoading: isPending,
    isError,
    isExhausted,
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
