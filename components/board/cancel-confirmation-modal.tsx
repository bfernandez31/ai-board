'use client';

import * as React from 'react';
import { formatCommandName } from '@/lib/utils/format-command';

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

interface CancelConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  jobCommand: string;
  isCancelling: boolean;
}

export const CancelConfirmationModal = React.memo(
  ({ open, onOpenChange, onConfirm, jobCommand, isCancelling }: CancelConfirmationModalProps) => {
    const formattedCommand = formatCommandName(jobCommand);

    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Annuler le workflow ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Annuler le workflow <span className="font-semibold text-foreground">{formattedCommand}</span> en cours ?
              Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(e) => e.stopPropagation()}
              className="bg-secondary text-foreground hover:bg-accent"
              disabled={isCancelling}
            >
              Garder le workflow
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.stopPropagation();
                onConfirm();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isCancelling}
            >
              {isCancelling ? 'Annulation...' : "Confirmer l'annulation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
);

CancelConfirmationModal.displayName = 'CancelConfirmationModal';
