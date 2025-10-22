/**
 * TanStack Query hook for fetching comments with polling support
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { ListCommentsResponse } from '@/app/lib/types/comment';

interface UseCommentsOptions {
  projectId: number;
  ticketId: number;
  enabled?: boolean;
  refetchInterval?: number | false;
}

/**
 * Fetch comments for a specific ticket
 * Supports real-time polling and conditional enablement
 */
export function useComments({
  projectId,
  ticketId,
  enabled = true,
  refetchInterval = false,
}: UseCommentsOptions) {
  return useQuery({
    queryKey: queryKeys.comments.list(ticketId),
    queryFn: async (): Promise<ListCommentsResponse & { currentUserId: string }> => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/comments`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch comments');
      }

      const data: ListCommentsResponse = await response.json();
      const currentUserId = response.headers.get('X-Current-User-Id') || '';

      return { ...data, currentUserId };
    },
    enabled,
    refetchInterval,
    staleTime: 0, // Always consider data stale to enable polling
  });
}
