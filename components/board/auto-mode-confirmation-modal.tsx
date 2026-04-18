'use client';

import * as React from 'react';
import type { Stage } from '@/lib/stage-transitions';
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

interface AutoModeConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  currentStage: Stage;
  ticketKey: string;
}

const STAGES_AFTER: Record<Stage, string[]> = {
  INBOX: ['SPECIFY', 'PLAN', 'BUILD'],
  SPECIFY: ['PLAN', 'BUILD'],
  PLAN: ['BUILD'],
  BUILD: [],
  VERIFY: [],
  SHIP: [],
  CLOSED: [],
};

export function getAutoTransitionChainLabel(stage: Stage): string {
  const stages = STAGES_AFTER[stage] ?? [];
  return stages.join(' \u2192 ');
}

export const AutoModeConfirmationModal = React.memo(
  ({ open, onOpenChange, onConfirm, currentStage, ticketKey }: AutoModeConfirmationModalProps) => {
    const chain = getAutoTransitionChainLabel(currentStage);

    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Enable auto-transition for {ticketKey}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {chain ? (
                <>
                  <span className="block mb-2">
                    <span className="font-semibold text-foreground">{chain}</span> will run automatically.
                  </span>
                  <span className="block">
                    Each stage dispatches as soon as the previous one completes successfully.
                    A failed or cancelled job will turn auto-transition off.
                  </span>
                </>
              ) : (
                <span className="block">
                  Enable auto-transition for this ticket.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(e) => e.stopPropagation()}
              className="bg-secondary text-foreground hover:bg-accent"
              data-testid="auto-mode-cancel-button"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.stopPropagation();
                onConfirm();
              }}
              className="bg-ctp-blue text-ctp-crust hover:bg-ctp-sapphire"
              data-testid="auto-mode-confirm-button"
            >
              Enable auto-transition
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
);

AutoModeConfirmationModal.displayName = 'AutoModeConfirmationModal';
