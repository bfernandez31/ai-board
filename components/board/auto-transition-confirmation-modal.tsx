'use client';

import * as React from 'react';
import type { Stage } from '@/lib/types';
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

interface AutoTransitionConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  currentStage: Stage;
  isPending: boolean;
}

const CHAIN_BY_STAGE: Record<string, string[]> = {
  INBOX: ['SPECIFY', 'PLAN', 'BUILD'],
  SPECIFY: ['PLAN', 'BUILD'],
  PLAN: ['BUILD'],
};

export function getAutoTransitionChain(stage: Stage): string[] {
  return CHAIN_BY_STAGE[stage] ?? [];
}

export const AutoTransitionConfirmationModal = React.memo(
  ({ open, onOpenChange, onConfirm, currentStage, isPending }: AutoTransitionConfirmationModalProps) => {
    const chain = getAutoTransitionChain(currentStage);
    const chainText = chain.join(' → ');

    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Enable auto-transition?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {chain.length > 0 ? (
                <>
                  <span className="font-semibold text-foreground">{chainText}</span>{' '}
                  will run automatically as each stage completes successfully.
                </>
              ) : (
                'The next stages will run automatically as each stage completes successfully.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(e) => e.stopPropagation()}
              className="bg-secondary text-foreground hover:bg-accent"
              disabled={isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.stopPropagation();
                onConfirm();
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isPending}
              data-testid="auto-transition-confirm-button"
            >
              {isPending ? 'Enabling...' : 'Enable auto-transition'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
);

AutoTransitionConfirmationModal.displayName = 'AutoTransitionConfirmationModal';
