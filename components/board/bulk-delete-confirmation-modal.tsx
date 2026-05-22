'use client';

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
import type { TicketWithVersion } from '@/lib/types';

export interface BulkDeleteConfirmationModalProps {
  tickets: TicketWithVersion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function BulkDeleteConfirmationModal({
  tickets,
  open,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: BulkDeleteConfirmationModalProps) {
  if (tickets.length === 0) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {tickets.length} tickets?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This action is <strong className="text-foreground">irreversible</strong>. Jobs,
                comments, and notifications will be permanently removed.
              </p>
              <ul className="max-h-40 overflow-y-auto space-y-1 text-sm">
                {tickets.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{t.ticketKey}</span>
                    <span className="truncate">{t.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            variant="destructive"
          >
            {isDeleting ? 'Deleting...' : `Delete ${tickets.length} tickets`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
