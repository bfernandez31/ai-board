'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Sparkles } from 'lucide-react';

interface CleanupConfirmDialogProps {
  projectId: number;
  onClose: () => void;
  onSuccess?: () => void | undefined;
}

/**
 * T020: CleanupConfirmDialog component
 * Dialog to confirm project cleanup operation
 */
export function CleanupConfirmDialog({
  projectId,
  onClose,
  onSuccess,
}: CleanupConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // T021: POST /api/projects/{projectId}/clean API call handler
  const handleTriggerCleanup = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/clean`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger cleanup');
      }

      // T022: Success toast notification
      toast({
        title: 'Cleanup started',
        description: `Analyzing ${data.analysis.changes.ticketsShipped} shipped ticket(s) for technical debt...`,
        variant: 'default',
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      toast({
        title: 'Cleanup failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Start Project Cleanup?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will analyze technical debt from recently shipped features and create fixes for:
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
              <li>Code quality improvements</li>
              <li>Test coverage enhancements</li>
              <li>Documentation updates</li>
            </ul>
            <p className="mt-3 text-sm font-medium">
              All changes will be submitted as a pull request for your review.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleTriggerCleanup} disabled={loading}>
            {loading ? 'Starting...' : 'Start Cleanup'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
