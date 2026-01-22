/**
 * TanStack Query hook for activity feed
 * Feature: AIB-172 Project Activity Feed
 *
 * Fetches project activity feed with 15-second polling and pagination support
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { ActivityFeedResponse } from '@/app/lib/types/activity-event';

/**
 * Options for useActivityFeed hook
 */
interface UseActivityFeedOptions {
  projectId: number;
  offset?: number;
  limit?: number;
  enabled?: boolean;
  refetchInterval?: number | false;
}

/**
 * Fetch activity feed for a specific project
 *
 * Features:
 * - 15-second stale time and refetch interval for real-time feel
 * - Refetch on window focus for fresh data when user returns
 * - Pagination support via offset and limit params
 * - Conditional enablement for optimizing performance
 *
 * @param options - Hook configuration options
 * @returns TanStack Query result with activity feed data
 *
 * @example
 * const { data, isLoading, error } = useActivityFeed({
 *   projectId: 1,
 *   enabled: true,
 * });
 *
 * // With pagination
 * const { data } = useActivityFeed({
 *   projectId: 1,
 *   offset: 50,
 *   limit: 50,
 * });
 */
export function useActivityFeed({
  projectId,
  offset = 0,
  limit = 50,
  enabled = true,
  refetchInterval = 15000, // Auto-refetch every 15 seconds
}: UseActivityFeedOptions) {
  return useQuery({
    queryKey: [...queryKeys.projects.activity(projectId), offset, limit],
    queryFn: async (): Promise<ActivityFeedResponse> => {
      const params = new URLSearchParams();
      if (offset > 0) params.set('offset', offset.toString());
      if (limit !== 50) params.set('limit', limit.toString());

      const url = `/api/projects/${projectId}/activity${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch activity feed');
      }

      return response.json();
    },
    enabled,
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchInterval, // Auto-refetch every 15 seconds when enabled
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}
