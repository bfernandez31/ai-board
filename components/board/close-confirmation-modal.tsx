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
import { Archive } from 'lucide-react';

interface CloseConfirmationModalProps {
  ticketKey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isClosing?: boolean;
}

/**
 * CloseConfirmationModal Component
 * Feature: AIB-148 Close Ticket
 *
 * Modal confirmation for closing a ticket from VERIFY stage.
 * Warns user about PR closure and branch preservation.
 */
export function CloseConfirmationModal({
  ticketKey,
  open,
  onOpenChange,
  onConfirm,
  isClosing = false,
}: CloseConfirmationModalProps) {
  if (!ticketKey) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="close-confirmation-modal">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-red-500" />
            Close Ticket {ticketKey}?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              This will close the ticket without shipping it.
            </span>
            <span className="block text-sm text-muted-foreground">
              - Associated GitHub PR(s) will be closed
              <br />
              - Git branch will be preserved for reference
              <br />
              - Ticket will be removed from the board but remains searchable
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isClosing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isClosing}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            data-testid="close-confirm-button"
          >
            {isClosing ? 'Closing...' : 'Close Ticket'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
