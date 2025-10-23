/**
 * TanStack Query mutation hook for deleting comments with optimistic updates
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { ListCommentsResponse } from '@/app/lib/types/comment';

interface UseDeleteCommentOptions {
  projectId: number;
  ticketId: number;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Delete a comment with optimistic updates
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

    // Optimistic update: Remove comment immediately from cache
    onMutate: async (commentId) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.comments.list(ticketId),
      });

      // Snapshot previous state
      const previousData = queryClient.getQueryData<{ comments: ListCommentsResponse; currentUserId: string }>(
        queryKeys.comments.list(ticketId)
      );

      // Optimistically remove comment from cache
      queryClient.setQueryData<ListCommentsResponse & { currentUserId: string }>(
        queryKeys.comments.list(ticketId),
        (old) => {
          if (!old) return old;
          return {
            comments: old.comments.filter((comment) => comment.id !== commentId),
            mentionedUsers: old.mentionedUsers, // Preserve mentioned users
            currentUserId: old.currentUserId,
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
          queryKeys.comments.list(ticketId),
          context.previousData
        );
      }
      onError?.(error as Error);
    },

    // Refetch to sync with server
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.list(ticketId),
      });
      onSuccess?.();
    },
  });
}
