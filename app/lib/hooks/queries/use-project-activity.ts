/**
 * TanStack Query hook for project activity feed
 * Feature: AIB-177-project-activity-feed
 *
 * Fetches unified activity timeline with polling and infinite scroll support
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { ActivityFeedResponse, ActivityEvent } from '@/app/lib/types/activity-event';

/**
 * Options for useProjectActivity hook
 */
interface UseProjectActivityOptions {
  projectId: number;
  limit?: number; // Events per page (default: 50)
  enabled?: boolean; // Conditional query enablement
  refetchInterval?: number | false; // Auto-refetch interval (default: 15000ms)
}

/**
 * Fetch project activity feed for a project
 *
 * Features:
 * - 15-second polling for real-time updates
 * - Infinite query support for "Load more" pagination
 * - Cursor-based pagination for stable results
 * - Refetch on window focus
 *
 * @param options - Hook configuration options
 * @returns TanStack infinite query result with activity data
 *
 * @example
 * const {
 *   data,
 *   isLoading,
 *   error,
 *   hasNextPage,
 *   fetchNextPage,
 *   isFetchingNextPage,
 * } = useProjectActivity({
 *   projectId: 1,
 *   enabled: true,
 * });
 *
 * // Get all events from all pages
 * const allEvents = data?.pages.flatMap(page => page.events) ?? [];
 */
export function useProjectActivity({
  projectId,
  limit = 50,
  enabled = true,
  refetchInterval = 15000, // Poll every 15 seconds
}: UseProjectActivityOptions) {
  return useInfiniteQuery({
    queryKey: queryKeys.projects.activity(projectId),
    queryFn: async ({ pageParam }): Promise<ActivityFeedResponse> => {
      const url = new URL(
        `/api/projects/${projectId}/activity`,
        window.location.origin
      );
      url.searchParams.set('limit', String(limit));

      if (pageParam) {
        url.searchParams.set('cursor', pageParam as string);
      }

      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch activity feed');
      }

      return response.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
    enabled,
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchInterval, // Poll every 15 seconds (or custom interval)
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}

/**
 * Helper function to flatten paginated activity data
 *
 * @param data - Infinite query data from useProjectActivity
 * @returns Flattened array of all events across all pages
 */
export function flattenActivityEvents(
  data: { pages: ActivityFeedResponse[] } | undefined
): ActivityEvent[] {
  return data?.pages.flatMap((page) => page.events) ?? [];
}
