/**
 * CommentList component
 * Displays list of comments with form, loading states, and real-time updates
 */

'use client';

import { CommentForm } from './comment-form';
import { CommentItem } from './comment-item';
import { useComments } from '@/app/lib/hooks/queries/use-comments';
import { useDeleteComment } from '@/app/lib/hooks/mutations/use-delete-comment';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { CommentWithUser } from '@/app/lib/types/comment';

interface CommentListProps {
  projectId: number;
  ticketId: number;
  isActive?: boolean; // Whether the Comments tab is active (for polling control)
}

export function CommentList({ projectId, ticketId, isActive = true }: CommentListProps) {
  const { toast } = useToast();

  const {
    data,
    isLoading,
    error,
  } = useComments({
    projectId,
    ticketId,
    enabled: isActive,
    refetchInterval: isActive ? 10000 : false, // Poll every 10 seconds when active
  });

  const { mutate: deleteComment } = useDeleteComment({
    projectId,
    ticketId,
    onSuccess: () => {
      toast({
        title: 'Comment deleted',
        description: 'Your comment has been removed successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete comment. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleDelete = (commentId: number) => {
    deleteComment(commentId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red">
        <p>Failed to load comments</p>
        <p className="text-sm text-subtext0 mt-1">{error.message}</p>
      </div>
    );
  }

  const comments = data?.comments || [];
  const mentionedUsers = data?.mentionedUsers || {};
  const isEmpty = comments.length === 0;

  // Get current user ID from API response header (works in both production and test mode)
  const currentUserId = data?.currentUserId || '';

  return (
    <div className="space-y-4" data-testid="comment-list">
      <CommentForm projectId={projectId} ticketId={ticketId} />

      <div className="border-t border-surface0 pt-4">
        {isEmpty ? (
          <div className="text-center py-8 text-subtext0">
            <p>No comments</p>
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-surface0">
            {comments.map((comment: CommentWithUser) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                mentionedUsers={mentionedUsers}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
