'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion, TicketsByStage } from '@/app/lib/types/query-types';
import { Stage } from '@prisma/client';
import {
  SHIP_BATCH_SIZE,
  appendShipBatch,
  mergeRefreshedTickets,
} from '@/lib/tickets/ship-pagination';

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
    // Keep SHIP tickets loaded by infinite scroll across background refreshes
    const previous = queryClient.getQueryData<TicketWithVersion[]>(
      queryKeys.projects.tickets(projectId)
    );
    return mergeRefreshedTickets(previous, tickets, shipTotal);
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

export type ShipLoadStatus = 'idle' | 'loading' | 'error';

export interface ShipInfiniteLoad {
  status: ShipLoadStatus;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

function countShipTickets(tickets: TicketWithVersion[]): number {
  return tickets.filter((ticket) => ticket.stage === Stage.SHIP).length;
}

/**
 * Infinite loading of SHIP tickets (offset-based pagination).
 * Appends batches to the flat tickets cache, with at most one request in flight,
 * id-based dedupe, and an error state that pauses auto-loading until retry().
 */
export function useShipInfiniteLoad(
  projectId: number,
  loadedShipCount: number,
  shipTotal: number
): ShipInfiniteLoad {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ShipLoadStatus>('idle');
  // shipTotal at which the server ran out of new tickets; a changed total re-enables loading
  const [exhaustedAtTotal, setExhaustedAtTotal] = useState<number | null>(null);

  const hasMore = exhaustedAtTotal !== shipTotal && loadedShipCount < shipTotal;

  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const statusRef = useRef<ShipLoadStatus>('idle');
  const hasMoreRef = useRef(hasMore);
  const loadedShipCountRef = useRef(loadedShipCount);
  const shipTotalRef = useRef(shipTotal);

  useEffect(() => {
    hasMoreRef.current = hasMore;
    loadedShipCountRef.current = loadedShipCount;
    shipTotalRef.current = shipTotal;
  }, [hasMore, loadedShipCount, shipTotal]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const updateStatus = useCallback((next: ShipLoadStatus) => {
    statusRef.current = next;
    if (mountedRef.current) setStatus(next);
  }, []);

  const load = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const ticketsKey = queryKeys.projects.tickets(projectId);
    // Read the offset from the cache so a load fired before re-render still uses the latest count
    const cached = queryClient.getQueryData<TicketWithVersion[]>(ticketsKey);
    const offset = cached ? countShipTickets(cached) : loadedShipCountRef.current;
    const totalAtRequest = shipTotalRef.current;
    updateStatus('loading');

    try {
      const response = await fetch(
        `/api/projects/${projectId}/tickets?stage=SHIP&offset=${offset}&limit=${SHIP_BATCH_SIZE}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch more SHIP tickets: HTTP ${response.status}`);
      }
      const data = await response.json();
      const batch = (data.tickets ?? []) as TicketWithVersion[];
      if (!mountedRef.current) return;

      let addedCount = 0;
      queryClient.setQueryData<TicketWithVersion[]>(ticketsKey, (old) => {
        const result = appendShipBatch(old ?? [], batch);
        addedCount = result.addedCount;
        return result.tickets;
      });

      if (batch.length === 0 || addedCount === 0) {
        hasMoreRef.current = false;
        setExhaustedAtTotal(totalAtRequest);
      }
      updateStatus('idle');
    } catch (error) {
      if (!mountedRef.current) return;
      console.error('[useShipInfiniteLoad] failed to load SHIP batch', { projectId, offset, error });
      updateStatus('error');
    } finally {
      inFlightRef.current = false;
    }
  }, [projectId, queryClient, updateStatus]);

  const loadMore = useCallback(() => {
    if (statusRef.current === 'error' || !hasMoreRef.current) return;
    void load();
  }, [load]);

  const retry = useCallback(() => {
    if (statusRef.current !== 'error') return;
    void load();
  }, [load]);

  return { status, hasMore, loadMore, retry };
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
