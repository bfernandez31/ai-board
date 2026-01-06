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
import { TicketWithVersion } from '@/lib/types';

/**
 * Props for CloseConfirmationModal component
 */
export interface CloseConfirmationModalProps {
  /**
   * Ticket to be closed (null when modal closed)
   */
  ticket: TicketWithVersion | null;

  /**
   * Whether the modal is open
   */
  open: boolean;

  /**
   * Callback when modal open state changes
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Callback when user confirms closure
   */
  onConfirm: () => void;

  /**
   * Whether closure is in progress (for loading state)
   */
  isClosing?: boolean;
}

/**
 * Confirmation modal for ticket closure (VERIFY → CLOSED)
 *
 * Features:
 * - Explains consequences: ticket removed from board, PRs closed, branch preserved
 * - Displays ticket key and title
 * - Red destructive action button
 * - Cancel button to abort closure
 * - Loading state support
 *
 * Uses shadcn/ui AlertDialog component for consistent styling
 *
 * @param props - CloseConfirmationModalProps
 * @returns AlertDialog component or null if no ticket
 *
 * @example
 * ```typescript
 * <CloseConfirmationModal
 *   ticket={ticketToClose}
 *   open={closeModalOpen}
 *   onOpenChange={setCloseModalOpen}
 *   onConfirm={handleCloseConfirm}
 *   isClosing={closeTicket.isPending}
 * />
 * ```
 */
export function CloseConfirmationModal({
  ticket,
  open,
  onOpenChange,
  onConfirm,
  isClosing = false,
}: CloseConfirmationModalProps) {
  if (!ticket) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close Ticket Without Shipping?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              You are about to close ticket{' '}
              <strong className="text-foreground">{ticket.ticketKey}</strong> without shipping.
            </span>
            <span className="block text-sm text-muted-foreground">
              This will:
            </span>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Remove the ticket from the board</li>
              <li>Close any associated pull requests</li>
              <li>Preserve the branch for future reference</li>
            </ul>
            <span className="block text-sm text-muted-foreground mt-2">
              You can still find this ticket via search.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isClosing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault(); // Prevent default AlertDialog close behavior
              onConfirm();
            }}
            disabled={isClosing}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isClosing ? 'Closing...' : 'Close Ticket'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
