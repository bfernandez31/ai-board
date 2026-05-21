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
import { ScrollArea } from '@/components/ui/scroll-area';

export interface BulkDeleteConfirmationModalProps {
  open: boolean;
  ticketKeys: string[];
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function BulkDeleteConfirmationModal({
  open,
  ticketKeys,
  onConfirm,
  onCancel,
  isPending = false,
}: BulkDeleteConfirmationModalProps) {
  const count = ticketKeys.length;

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {count} {count === 1 ? 'ticket' : 'tickets'}?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              You are about to permanently delete the following INBOX{' '}
              {count === 1 ? 'ticket' : 'tickets'}:
            </span>
            <ScrollArea className="max-h-40 rounded-md border border-border bg-muted/30 p-2">
              <ul className="space-y-1 font-mono text-xs">
                {ticketKeys.map((key) => (
                  <li key={key} data-testid="bulk-delete-ticket-key">{key}</li>
                ))}
              </ul>
            </ScrollArea>
            <span className="block text-sm text-destructive font-medium">
              This action cannot be undone.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isPending || count === 0}
            variant="destructive"
          >
            {isPending ? 'Deleting...' : `Delete ${count} ${count === 1 ? 'ticket' : 'tickets'}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
