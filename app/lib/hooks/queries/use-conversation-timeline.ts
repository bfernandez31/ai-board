/**
 * TanStack Query hook for conversation timeline
 * Feature: 065-915-conversations-je
 *
 * Fetches unified conversation timeline (comments + job events) with polling support
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { ConversationEvent } from '@/app/lib/types/conversation-event';

/**
 * Response interface for timeline API
 */
interface TimelineResponse {
  timeline: ConversationEvent[];
}

/**
 * Options for useConversationTimeline hook
 */
interface UseConversationTimelineOptions {
  projectId: number;
  ticketId: number;
  enabled?: boolean; // Conditional query enablement
  refetchInterval?: number | false; // Auto-refetch interval (ms)
}

/**
 * Fetch conversation timeline for a specific ticket
 *
 * Features:
 * - 10-second stale time and refetch interval for real-time feel
 * - Refetch on window focus for fresh data when user returns
 * - Conditional enablement for optimizing performance
 *
 * @param options - Hook configuration options
 * @returns TanStack Query result with timeline data
 *
 * @example
 * const { data, isLoading, error } = useConversationTimeline({
 *   projectId: 1,
 *   ticketId: 42,
 *   enabled: true, // Only fetch when ticket modal is open
 * });
 */
export function useConversationTimeline({
  projectId,
  ticketId,
  enabled = true,
  refetchInterval = 10000, // Auto-refetch every 10 seconds
}: UseConversationTimelineOptions) {
  return useQuery({
    queryKey: queryKeys.projects.timeline(projectId, ticketId),
    queryFn: async (): Promise<TimelineResponse> => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/timeline`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch conversation timeline');
      }

      return response.json();
    },
    enabled,
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchInterval, // Auto-refetch every 10 seconds when enabled
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}
