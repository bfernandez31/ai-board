/**
 * Comment Timeline Item Component
 * Feature: 065-915-conversations-je
 *
 * Displays user comment in timeline with bordered box styling
 */

'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { Avatar } from '@/components/comments/avatar';
import { MentionDisplay } from '@/components/comments/mention-display';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TimelineBadge } from './timeline-badge';
import { TimelineContent } from './timeline-content';
import { useDeleteComment } from '@/app/lib/hooks/mutations/use-delete-comment';
import type { CommentWithUser } from '@/app/lib/types/comment';
import type { User } from '@/app/lib/types/mention';

interface CommentTimelineItemProps {
  comment: CommentWithUser;
  timestamp: string;
  mentionedUsers: Record<string, User>;
  projectId: number;
  currentUserId: string;
}

/**
 * Comment timeline item with bordered box design
 *
 * Displays:
 * - User avatar in badge
 * - Author name and timestamp
 * - Comment content with markdown-like styling
 *
 * Memoized for performance (prevents re-renders when other events update)
 */
export const CommentTimelineItem = React.memo(
  function CommentTimelineItem({ comment, timestamp, mentionedUsers, projectId, currentUserId }: CommentTimelineItemProps) {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const deleteComment = useDeleteComment({
      projectId,
      ticketId: comment.ticketId,
    });

    const isAuthor = comment.userId === currentUserId;
    const relativeTime = formatDistanceToNow(new Date(comment.createdAt), {
      addSuffix: true,
    });

    const handleDelete = () => {
      deleteComment.mutate(comment.id);
      setShowDeleteDialog(false);
    };

    return (
      <>
        <li
          id={`comment-${comment.id}`}
          className="group relative pl-12"
          data-testid="comment-item"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <TimelineBadge variant="avatar">
            <Avatar name={comment.user.name} image={comment.user.image} />
          </TimelineBadge>
          <TimelineContent>
            {/* Speech bubble with tail pointing to avatar */}
            <div className="relative border border-surface0 rounded-lg bg-mantle p-4 shadow-sm">
              {/* Speech bubble tail (triangle pointing left) */}
              <div className="absolute -left-2 top-3 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-surface0 border-b-8 border-b-transparent" />
              <div className="absolute -left-[7px] top-3 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-mantle border-b-8 border-b-transparent" />

              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-text">
                  {comment.user.name || comment.user.email}
                </span>
                <time className="text-xs text-subtext0" dateTime={timestamp}>
                  {relativeTime}
                </time>
                {isAuthor && isHovered && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                    className="ml-auto h-6 w-6 p-0 text-red hover:text-red hover:bg-red/10"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span className="sr-only">Delete comment</span>
                  </Button>
                )}
              </div>
              <div className="prose prose-sm prose-invert max-w-none">
                <MentionDisplay content={comment.content} mentionedUsers={mentionedUsers} />
              </div>
            </div>
          </TimelineContent>
        </li>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete comment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this comment? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red hover:bg-red/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }
);
