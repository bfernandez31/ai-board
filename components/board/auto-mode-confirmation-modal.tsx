'use client';

import * as React from 'react';
import type { Stage } from '@prisma/client';
import { computeChainedStages } from '@/lib/utils/auto-mode-stage-preview';

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
}

export const AutoModeConfirmationModal = React.memo(
  ({ open, onOpenChange, onConfirm, currentStage }: AutoModeConfirmationModalProps) => {
    const chain = computeChainedStages(currentStage);
    const previewText = chain.length > 0
      ? `${chain.join(' → ')} will run automatically.`
      : 'No further stages will run.';

    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Enable auto-transition?
            </AlertDialogTitle>
            <AlertDialogDescription
              className="text-muted-foreground"
              data-testid="auto-mode-preview"
            >
              {previewText}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.stopPropagation();
                onConfirm();
              }}
              data-testid="auto-mode-confirm"
            >
              Enable auto-mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
);

AutoModeConfirmationModal.displayName = 'AutoModeConfirmationModal';
