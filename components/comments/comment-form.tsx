/**
 * CommentForm component
 * Form for creating new comments with validation, keyboard shortcuts, and user mentions
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useCreateComment } from '@/app/lib/hooks/mutations/use-create-comment';
import { useProjectMembers } from '@/app/lib/hooks/queries/useProjectMembers';
import { useToast } from '@/hooks/use-toast';
import { MentionInput } from './mention-input';

interface CommentFormProps {
  projectId: number;
  ticketId: number;
}

const MAX_LENGTH = 2000;

export function CommentForm({ projectId, ticketId }: CommentFormProps) {
  const [content, setContent] = useState('');
  const { toast } = useToast();

  // Fetch project members for mention autocomplete
  const { data: membersData, isLoading: isMembersLoading } = useProjectMembers(projectId);
  const projectMembers = membersData?.members || [];

  const { mutate: createComment, isPending } = useCreateComment({
    projectId,
    ticketId,
    onSuccess: () => {
      setContent('');
      toast({
        title: 'Comment added',
        description: 'Your comment has been posted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to post comment. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Keyboard shortcut: Cmd/Ctrl+Enter to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (content.trim() && content.length <= MAX_LENGTH) {
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const handleSubmit = () => {
    if (!content.trim() || content.length > MAX_LENGTH || isPending) {
      return;
    }

    createComment({ content: content.trim() });
  };

  const isValid = content.trim().length > 0 && content.length <= MAX_LENGTH;
  const characterCount = content.length;

  return (
    <div className="space-y-2">
      <MentionInput
        value={content}
        onChange={setContent}
        projectMembers={projectMembers}
        placeholder="Write a comment... (@ to mention, Markdown supported)"
        className="min-h-[100px] resize-none"
        disabled={isPending || isMembersLoading}
      />

      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${
            characterCount > MAX_LENGTH ? 'text-red' : 'text-subtext0'
          }`}
        >
          {characterCount} / {MAX_LENGTH}
        </span>

        <Button
          onClick={handleSubmit}
          disabled={!isValid || isPending}
          size="sm"
        >
          {isPending ? 'Submitting...' : 'Comment'}
        </Button>
      </div>

      <p className="text-xs text-subtext0">
        Press <kbd className="px-1 py-0.5 bg-surface0 rounded">Cmd+Enter</kbd> to submit
      </p>
    </div>
  );
}
