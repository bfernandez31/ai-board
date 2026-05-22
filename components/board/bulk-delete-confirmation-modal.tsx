'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface BulkDeleteConfirmationModalProps {
  open: boolean;
  count: number;
  isDeleting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function BulkDeleteConfirmationModal({
  open,
  count,
  isDeleting = false,
  onOpenChange,
  onConfirm,
}: BulkDeleteConfirmationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="bulk-delete-title">Delete {count} tickets?</DialogTitle>
          <DialogDescription>
            This will permanently delete {count} tickets and all their attachments, comments,
            and history. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            data-testid="bulk-delete-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            data-testid="bulk-delete-confirm"
          >
            {isDeleting ? 'Deleting...' : `Delete ${count} tickets`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
