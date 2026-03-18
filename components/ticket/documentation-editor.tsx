'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useEditDocumentation } from '@/app/lib/hooks/mutations/useEditDocumentation';
import { useToast } from '@/hooks/use-toast';

interface DocumentationEditorProps {
  projectId: number;
  ticketId: number;
  docType: 'spec' | 'plan' | 'tasks';
  initialContent: string;
  onCancel: () => void;
  onSaveSuccess?: () => void;
}

/**
 * Documentation editor component with markdown editing capabilities
 *
 * Features:
 * - Textarea-based markdown editing
 * - Dirty state tracking (content changed from initial)
 * - Browser beforeunload warning for unsaved changes
 * - Optimistic UI updates with TanStack Query
 * - Error handling with toast notifications
 * - Save/Cancel buttons with loading states
 *
 * @example
 * <DocumentationEditor
 *   projectId={1}
 *   ticketId={42}
 *   docType="spec"
 *   initialContent="# Spec\n\nContent..."
 *   onCancel={() => setEditMode(false)}
 *   onSaveSuccess={() => showSuccessMessage()}
 * />
 */
export function DocumentationEditor({
  projectId,
  ticketId,
  docType,
  initialContent,
  onCancel,
  onSaveSuccess,
}: DocumentationEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isDirty, setIsDirty] = useState(false);
  const mutation = useEditDocumentation();
  const { toast } = useToast();

  // Track dirty state (content changed from original)
  useEffect(() => {
    setIsDirty(content !== initialContent);
  }, [content, initialContent]);

  // Warn user about unsaved changes on browser navigation/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        // Modern browsers display a generic message, returnValue is for legacy support
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleSave = async () => {
    try {
      await mutation.mutateAsync({
        projectId,
        ticketId,
        docType,
        content,
      });

      // Show success toast
      toast({
        title: 'Success',
        description: `${docType}.md saved successfully`,
        variant: 'default',
      });

      // Reset dirty state and close editor
      setIsDirty(false);
      onSaveSuccess?.();
      onCancel();
    } catch (error: unknown) {
      // Error is already handled by mutation.onError
      // Show user-friendly toast message
      toast({
        title: 'Save Failed',
        description:
          (error as { message?: string }).message ||
          'Failed to save changes. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to cancel?'
      );
      if (!confirmed) return;
    }
    onCancel();
  };

  return (
    <div className="flex flex-col h-full space-y-4" data-testid="documentation-editor">
      {/* Markdown textarea */}
      <Textarea
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 min-h-[500px] font-mono text-sm resize-none"
        placeholder={`Enter markdown content for ${docType}.md...`}
        disabled={mutation.isPending}
        data-testid="editor-textarea"
      />

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={mutation.isPending}
          data-testid="cancel-button"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!isDirty || mutation.isPending}
          data-testid="save-button"
        >
          {mutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Error message (shown below buttons for visibility) */}
      {mutation.isError && (
        <div className="text-sm text-red-600" data-testid="error-message">
          Error: {mutation.error instanceof Error ? mutation.error.message : 'Failed to save'}
        </div>
      )}
    </div>
  );
}
