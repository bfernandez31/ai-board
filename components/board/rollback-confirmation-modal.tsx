'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface RollbackConfirmationModalProps {
  open: boolean;
  message: string;
  fromStage: string;
  toStage: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * RollbackConfirmationModal Component
 * Feature: AIB-514 - Generic rollback confirmation
 *
 * Modal confirmation for any rollback transition.
 * Shows a contextual message based on the specific transition.
 */
export function RollbackConfirmationModal({
  open,
  message,
  fromStage,
  toStage,
  onConfirm,
  onCancel,
}: RollbackConfirmationModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent
        data-testid="rollback-confirmation-modal"
        className="sm:max-w-[450px]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Rollback {fromStage} → {toStage}
          </DialogTitle>
          <DialogDescription className="pt-2">
            {message}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onCancel}
            data-action="cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            data-action="confirm"
            variant="destructive"
            className="bg-amber-600 hover:bg-amber-700"
          >
            Confirm Rollback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
