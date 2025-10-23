/**
 * TanStack Query mutation hook for creating comments with optimistic updates
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { CreateCommentRequest, CreateCommentResponse, ListCommentsResponse, CommentWithUser } from '@/app/lib/types/comment';

interface UseCreateCommentOptions {
  projectId: number;
  ticketId: number;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Create a new comment with optimistic updates
 */
export function useCreateComment({
  projectId,
  ticketId,
  onSuccess,
  onError,
}: UseCreateCommentOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCommentRequest): Promise<CreateCommentResponse> => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create comment');
      }

      return response.json();
    },

    // Optimistic update: Add comment immediately to cache
    onMutate: async (newComment) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.comments.list(ticketId),
      });

      // Snapshot previous state
      const previousData = queryClient.getQueryData<{ comments: ListCommentsResponse; currentUserId: string }>(
        queryKeys.comments.list(ticketId)
      );

      // Optimistically update cache with temporary comment
      queryClient.setQueryData<ListCommentsResponse & { currentUserId: string }>(
        queryKeys.comments.list(ticketId),
        (old) => {
          if (!old) return old;

          // Create optimistic comment with temporary ID
          const optimisticComment: CommentWithUser = {
            id: Date.now(), // Temporary ID
            ticketId,
            userId: 'current-user', // Will be replaced with real data
            content: newComment.content,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            user: {
              id: 'current-user',
              name: 'You', // Placeholder
              email: '',
              image: null,
            },
          };

          // Add to top (newest first)
          return {
            comments: [optimisticComment, ...old.comments],
            mentionedUsers: old.mentionedUsers, // Preserve mentioned users
            currentUserId: old.currentUserId,
          };
        }
      );

      // Return context for rollback
      return { previousData };
    },

    // Rollback on error
    onError: (error, _newComment, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.comments.list(ticketId),
          context.previousData
        );
      }
      onError?.(error as Error);
    },

    // Refetch to sync with server
    onSuccess: (_data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.list(ticketId),
      });

      // Invalidate job status to restart polling if @ai-board was mentioned
      // This ensures the polling hook detects the new PENDING job and resumes polling
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.jobsStatus(projectId),
      });

      onSuccess?.();
    },
  });
}
