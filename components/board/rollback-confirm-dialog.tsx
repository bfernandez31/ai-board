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

type RollbackPath = 'PLAN_TO_SPECIFY' | 'BUILD_TO_PLAN' | 'VERIFY_TO_BUILD';

const ROLLBACK_MESSAGES: Record<RollbackPath, { title: string; description: string }> = {
  PLAN_TO_SPECIFY: {
    title: 'Revenir à Specify',
    description: 'Revenir a Specify ? La specification sera conservee.',
  },
  BUILD_TO_PLAN: {
    title: 'Revenir à Plan',
    description: 'Revenir a Plan ? Le code sera reinitialise (backup cree).',
  },
  VERIFY_TO_BUILD: {
    title: 'Revenir à Build',
    description: 'Revenir a Build ? La verification sera relancee.',
  },
};

interface RollbackConfirmDialogProps {
  open: boolean;
  rollbackPath: RollbackPath | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export type { RollbackPath };

export function RollbackConfirmDialog({ open, rollbackPath, onConfirm, onCancel }: RollbackConfirmDialogProps) {
  const messages = rollbackPath ? ROLLBACK_MESSAGES[rollbackPath] : null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent data-testid="rollback-confirm-dialog" className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {messages?.title ?? 'Rollback'}
          </DialogTitle>
          <DialogDescription className="pt-2">
            {messages?.description ?? ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            onClick={onConfirm}
            variant="destructive"
            className="bg-amber-600 hover:bg-amber-700"
          >
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
