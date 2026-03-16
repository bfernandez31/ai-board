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
import { getConfirmationMessage } from '@/lib/utils/stage-confirmation-messages';
import type { Ticket } from '@prisma/client';
import { TicketWithVersion } from '@/lib/types';

export interface DeleteConfirmationModalProps {
  ticket: TicketWithVersion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteConfirmationModal({
  ticket,
  open,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: DeleteConfirmationModalProps) {
  if (!ticket) return null;

  // Get stage-specific confirmation message (cast to expected type)
  const message = getConfirmationMessage(ticket as unknown as Ticket);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Ticket?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              You are about to permanently delete ticket{' '}
              <strong className="text-foreground">{ticket.ticketKey}</strong>.
            </span>
            <span className="block text-sm text-muted-foreground whitespace-pre-line">{message}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault(); // Prevent default AlertDialog close behavior
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting ? 'Deleting...' : 'Delete Permanently'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
