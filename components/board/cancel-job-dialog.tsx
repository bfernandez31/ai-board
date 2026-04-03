'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface CancelJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  command: string;
  isPending: boolean;
}

/**
 * Cancel Job Confirmation Dialog
 * French confirmation text per spec.
 */
export function CancelJobDialog({
  open,
  onOpenChange,
  onConfirm,
  command,
  isPending,
}: CancelJobDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="cancel-job-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Annuler le workflow</AlertDialogTitle>
          <AlertDialogDescription>
            Annuler le workflow <strong>{command}</strong> en cours ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Non
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
            data-testid="cancel-job-confirm"
          >
            {isPending ? 'Annulation...' : 'Oui, annuler'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
