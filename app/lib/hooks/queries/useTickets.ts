'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion, TicketsByStage } from '@/app/lib/types/query-types';
import { Stage } from '@prisma/client';
import {
  SHIP_BATCH_SIZE,
  appendUniqueTickets,
  computeShipRefetchLimit,
  countShipTickets,
} from '@/lib/tickets/ship-pagination';

async function fetchTicketsFromAPI(
  projectId: number,
  shipLimit: number
): Promise<{ tickets: TicketWithVersion[]; shipTotal: number }> {
  const response = await fetch(`/api/projects/${projectId}/tickets?shipLimit=${shipLimit}`);

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
    // Request at least as many SHIP tickets as are already loaded so a refetch
    // never drops batches loaded by infinite scroll.
    const loadedShipCount = countShipTickets(
      queryClient.getQueryData<TicketWithVersion[]>(queryKeys.projects.tickets(projectId))
    );
    const { tickets, shipTotal } = await fetchTicketsFromAPI(
      projectId,
      computeShipRefetchLimit(loadedShipCount)
    );
    queryClient.setQueryData(queryKeys.projects.shipTotal(projectId), shipTotal);
    return tickets;
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
 * Load the next batch of SHIP tickets (offset-based infinite scroll).
 * - At most one request in flight (synchronous ref guard).
 * - Offset is the number of SHIP tickets in the cache at call time.
 * - Appends only tickets not already in the cache (any stage).
 * - An empty/duplicate-only batch reconciles the SHIP total to the loaded count.
 */
export function useLoadMoreShipTickets(projectId: number) {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);

  const { mutate, isPending, error } = useMutation({
    mutationFn: async ({ offset }: { offset: number }) => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets?stage=SHIP&offset=${offset}&limit=${SHIP_BATCH_SIZE}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch more SHIP tickets: HTTP ${response.status}`);
      }
      const data = await response.json();
      return data.tickets as TicketWithVersion[];
    },
    onSuccess: (newTickets) => {
      const ticketsKey = queryKeys.projects.tickets(projectId);
      let addedCount = 0;

      const updated = queryClient.setQueryData<TicketWithVersion[]>(ticketsKey, (old) => {
        const result = appendUniqueTickets(old ?? [], newTickets);
        addedCount = result.addedCount;
        return result.tickets;
      });

      if (addedCount === 0) {
        queryClient.setQueryData(
          queryKeys.projects.shipTotal(projectId),
          countShipTickets(updated)
        );
      }
    },
    onSettled: () => {
      inFlightRef.current = false;
    },
  });

  const loadMore = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const offset = countShipTickets(
      queryClient.getQueryData<TicketWithVersion[]>(queryKeys.projects.tickets(projectId))
    );
    mutate({ offset });
  }, [mutate, queryClient, projectId]);

  return {
    loadMore,
    isLoading: isPending,
    error: error ?? null,
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
