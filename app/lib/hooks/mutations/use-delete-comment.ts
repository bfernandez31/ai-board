/**
 * TanStack Query mutation hook for deleting comments with optimistic updates
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { ConversationEvent } from '@/app/lib/types/conversation-event';

interface UseDeleteCommentOptions {
  projectId: number;
  ticketId: number;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface TimelineResponse {
  timeline: ConversationEvent[];
  mentionedUsers: Record<string, { id: string; name: string | null; email: string }>;
  currentUserId: string;
}

/**
 * Delete a comment with optimistic updates to the timeline cache
 */
export function useDeleteComment({
  projectId,
  ticketId,
  onSuccess,
  onError,
}: UseDeleteCommentOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: number): Promise<void> => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/comments/${commentId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete comment');
      }
    },

    // Optimistic update: Remove comment immediately from timeline cache
    onMutate: async (commentId) => {
      // Cancel ongoing queries for timeline
      await queryClient.cancelQueries({
        queryKey: queryKeys.projects.timeline(projectId, ticketId),
      });

      // Snapshot previous state
      const previousData = queryClient.getQueryData<TimelineResponse>(
        queryKeys.projects.timeline(projectId, ticketId)
      );

      // Optimistically remove comment from timeline cache
      queryClient.setQueryData<TimelineResponse>(
        queryKeys.projects.timeline(projectId, ticketId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            timeline: old.timeline.filter(
              (event) => !(event.type === 'comment' && event.data.id === commentId)
            ),
          };
        }
      );

      // Return context for rollback
      return { previousData };
    },

    // Rollback on error
    onError: (error, _commentId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.projects.timeline(projectId, ticketId),
          context.previousData
        );
      }
      onError?.(error as Error);
    },

    // Refetch to sync with server
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.timeline(projectId, ticketId),
      });
      onSuccess?.();
    },
  });
}
