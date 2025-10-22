/**
 * CommentItem component
 * Displays a single comment with author info, content, and delete button
 */

'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Avatar } from './avatar';
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
import type { CommentWithUser } from '@/app/lib/types/comment';

interface CommentItemProps {
  comment: CommentWithUser;
  currentUserId: string;
  onDelete: (commentId: number) => void;
}

export function CommentItem({ comment, currentUserId, onDelete }: CommentItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isAuthor = comment.userId === currentUserId;
  const authorName = comment.user.name || 'Anonymous';
  const relativeTime = formatDistanceToNow(new Date(comment.createdAt), {
    addSuffix: true,
  });

  const handleDelete = () => {
    onDelete(comment.id);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div
        className="group flex gap-3 py-3"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Avatar name={comment.user.name} image={comment.user.image} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-text">{authorName}</span>
            <span className="text-xs text-subtext0">{relativeTime}</span>
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
            <ReactMarkdown
              disallowedElements={['script', 'iframe', 'embed', 'object']}
              unwrapDisallowed
            >
              {comment.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>

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
