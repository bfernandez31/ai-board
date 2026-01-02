'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { Job } from '@prisma/client';

/**
 * Fetch full job data with telemetry for a specific ticket
 *
 * This hook fetches complete job information including telemetry fields
 * (totalCost, totalDuration, totalTokens, etc.) which are needed for
 * displaying job stats in the ticket modal.
 *
 * Features:
 * - Fetches on modal open to ensure fresh data
 * - Includes all telemetry fields for stats display
 * - Automatic caching and deduplication
 * - Refetches when ticket changes
 *
 * @param projectId - Project ID
 * @param ticketId - Ticket ID
 * @param enabled - Whether to fetch (should be true when modal is open)
 * @returns Query result with full job array
 */
export function useTicketJobs(
  projectId: number,
  ticketId: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.projects.ticketJobs(projectId, ticketId),
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/jobs/full`,
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

      return response.json() as Promise<Job[]>;
    },
    // Only fetch when modal is open
    enabled,
    // Data is fresh for 3 seconds (balance between freshness and API calls)
    staleTime: 3000,
    // Keep in cache for 5 minutes after modal closes
    gcTime: 5 * 60 * 1000,
  });
}
