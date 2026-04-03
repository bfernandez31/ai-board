'use client';

import * as React from 'react';

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

interface RollbackConfirmationModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
}

export const RollbackConfirmationModal = React.memo(
  ({ open, onConfirm, onCancel, title, description }: RollbackConfirmationModalProps) => {
    return (
      <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
        <AlertDialogContent className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={onCancel}
              className="bg-secondary text-foreground hover:bg-accent"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Confirmer le rollback
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
);

RollbackConfirmationModal.displayName = 'RollbackConfirmationModal';
