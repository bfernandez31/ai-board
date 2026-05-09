'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { isActiveStatus } from '@/app/lib/schemas/job-polling';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';

/**
 * Fetch full job data with telemetry for a specific ticket
 *
 * Features:
 * - Returns complete job telemetry (tokens, cost, duration, model)
 * - 5-second stale time (balances freshness with performance)
 * - Polls every 5s while any job is PENDING/RUNNING so mid-run telemetry
 *   (plugin/CLI versions, tokens) becomes visible without waiting for terminal
 * - Can be conditionally enabled (e.g., only when modal is open)
 * - Invalidated by useJobPolling on terminal job transitions
 *
 * @param projectId - Project ID
 * @param ticketId - Ticket ID (null to disable query)
 * @param enabled - Whether to enable the query (default: true)
 * @returns Query result with jobs array including telemetry
 */
export function useTicketJobs(
  projectId: number,
  ticketId: number | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.projects.ticketJobs(projectId, ticketId ?? 0),
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/jobs`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: HTTP ${response.status}`);
      }

      return response.json() as Promise<TicketJobWithTelemetry[]>;
    },
    // Only enable when ticketId is provided and enabled flag is true
    enabled: enabled && ticketId !== null,
    // Data is fresh for 5 seconds
    staleTime: 5000,
    // Keep in cache for 10 minutes after unmount
    gcTime: 10 * 60 * 1000,
    refetchInterval: (query) => {
      const jobs = query.state.data ?? [];
      return jobs.some((job) => isActiveStatus(job.status)) ? 5000 : false;
    },
  });
}
