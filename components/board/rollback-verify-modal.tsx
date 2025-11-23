'use client';

import React from 'react';
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

interface RollbackVerifyModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * RollbackVerifyModal Component
 * Feature: AIB-75 - Rollback VERIFY to PLAN
 *
 * Modal confirmation for VERIFY to PLAN rollback workflow.
 * Warns user about reverting implementation changes while preserving spec files.
 */
export function RollbackVerifyModal({ open, onConfirm, onCancel }: RollbackVerifyModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent
        data-testid="rollback-verify-modal"
        className="sm:max-w-[500px]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Rollback to PLAN Stage
          </DialogTitle>
          <DialogDescription className="pt-2">
            You&apos;re about to roll back this ticket from VERIFY to PLAN stage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">This will:</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Reset the ticket to PLAN stage</li>
              <li>Clear the preview deployment URL</li>
              <li>Delete the current verification job</li>
              <li>Preserve specification and planning documents</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">When to use:</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Implementation needs to be reconsidered</li>
              <li>Planning decisions need revision</li>
              <li>Feature approach needs to change</li>
            </ul>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Note:</strong> Implementation changes will be reverted when the workflow runs.
              Specification files in the feature folder will be preserved.
            </p>
          </div>
        </div>

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
