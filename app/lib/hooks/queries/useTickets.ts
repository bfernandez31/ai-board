'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion, TicketsByStage } from '@/app/lib/types/query-types';
import { Stage } from '@prisma/client';

/**
 * Fetch all tickets for a project
 *
 * Features:
 * - 5-second stale time (balances freshness with performance)
 * - Automatic caching and deduplication
 * - Shared across all components that query tickets
 *
 * @param projectId - Project ID to fetch tickets for
 * @param options - Optional query options (enabled)
 * @returns Query result with tickets array
 */
export function useProjectTickets(projectId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.projects.tickets(projectId),
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/tickets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tickets: HTTP ${response.status}`);
      }

      return response.json() as Promise<TicketWithVersion[]>;
    },
    // Only fetch if enabled (defaults to true)
    enabled: options?.enabled ?? true,
    // Data is fresh for 5 seconds
    staleTime: 5000,
    // Keep in cache for 10 minutes after unmount
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Fetch tickets grouped by stage for board display
 *
 * Features:
 * - Transforms flat ticket list into stage-grouped structure
 * - Uses select() to avoid unnecessary re-renders
 * - Shares cache with useProjectTickets
 *
 * @param projectId - Project ID to fetch tickets for
 * @returns Query result with tickets grouped by stage
 */
export function useTicketsByStage(projectId: number) {
  return useQuery({
    queryKey: queryKeys.projects.tickets(projectId),
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/tickets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tickets: HTTP ${response.status}`);
      }

      return response.json() as Promise<TicketWithVersion[]>;
    },
    // Transform data into stage-grouped structure
    select: (tickets): TicketsByStage => {
      const grouped: TicketsByStage = {
        [Stage.INBOX]: [],
        [Stage.SPECIFY]: [],
        [Stage.PLAN]: [],
        [Stage.BUILD]: [],
        [Stage.VERIFY]: [],
        [Stage.SHIP]: [],
      };

      tickets.forEach((ticket) => {
        grouped[ticket.stage].push(ticket);
      });

      return grouped;
    },
    // Data is fresh for 5 seconds
    staleTime: 5000,
    // Keep in cache for 10 minutes after unmount
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Fetch a single ticket by ID
 *
 * @param projectId - Project ID
 * @param ticketId - Ticket ID
 * @returns Query result with single ticket
 */
export function useTicket(projectId: number, ticketId: number) {
  return useQuery({
    queryKey: queryKeys.projects.ticket(projectId, ticketId),
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch ticket: HTTP ${response.status}`);
      }

      return response.json() as Promise<TicketWithVersion>;
    },
    // Data is fresh for 5 seconds
    staleTime: 5000,
    // Keep in cache for 10 minutes after unmount
    gcTime: 10 * 60 * 1000,
  });
}
