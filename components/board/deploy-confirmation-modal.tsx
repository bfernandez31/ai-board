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

interface DeployConfirmationModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal is closed */
  onOpenChange: (open: boolean) => void;
  /** Callback when user confirms deployment */
  onConfirm: () => void;
  /** Ticket key for display */
  ticketKey: string;
  /** Whether another ticket has an active preview (shows warning) */
  hasExistingPreview?: boolean | undefined;
  /** Ticket key of existing preview (if any) */
  existingPreviewTicket?: string | undefined;
  /** Whether this is a retry of a failed/cancelled deployment */
  isRetry?: boolean;
}

/**
 * Deploy Confirmation Modal
 *
 * Displays a confirmation dialog before triggering Vercel preview deployment.
 * Shows warning when an existing preview will be replaced (single-preview enforcement).
 *
 * @example
 * ```tsx
 * const [showModal, setShowModal] = useState(false);
 *
 * <DeployConfirmationModal
 *   open={showModal}
 *   onOpenChange={setShowModal}
 *   onConfirm={() => {
 *     deployPreview({ ticketId });
 *     setShowModal(false);
 *   }}
 *   ticketKey={ticket.ticketKey}
 *   hasExistingPreview={!!activePreview}
 *   existingPreviewTicket={activePreview?.ticketKey}
 * />
 * ```
 */
export const DeployConfirmationModal = React.memo(
  ({
    open,
    onOpenChange,
    onConfirm,
    ticketKey,
    hasExistingPreview = false,
    existingPreviewTicket,
    isRetry = false,
  }: DeployConfirmationModalProps) => {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              {isRetry ? 'Retry' : 'Deploy'} Preview for {ticketKey}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {isRetry ? (
                <>
                  <span className="block mb-2">
                    The previous deployment failed or was cancelled. This will retry the deployment to Vercel preview environment.
                  </span>
                  <span className="block">
                    The deployment process typically takes 3-5 minutes. You can monitor
                    progress via the job status indicator.
                  </span>
                </>
              ) : hasExistingPreview && existingPreviewTicket ? (
                <>
                  <span className="block mb-2 text-amber-400 font-semibold">
                    ⚠️ An existing preview deployment is active for {existingPreviewTicket}.
                  </span>
                  <span className="block mb-2">
                    Deploying this preview will replace the existing deployment.
                    Only one preview can be active at a time.
                  </span>
                  <span className="block">
                    The deployment process will:
                  </span>
                </>
              ) : (
                <>
                  <span className="block mb-2">
                    This will deploy the feature branch to Vercel preview environment.
                  </span>
                  <span className="block">
                    The deployment process typically takes 3-5 minutes. You can monitor
                    progress via the job status indicator.
                  </span>
                </>
              )}
            </AlertDialogDescription>
            {hasExistingPreview && existingPreviewTicket && (
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground text-sm">
                <li>Clear the existing preview URL</li>
                <li>Deploy the feature branch to Vercel</li>
                <li>Update this ticket with the new preview URL</li>
              </ul>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(e) => e.stopPropagation()}
              className="bg-secondary text-foreground hover:bg-accent"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.stopPropagation();
                onConfirm();
              }}
              className="bg-ctp-blue text-ctp-crust hover:bg-ctp-sapphire"
            >
              {isRetry ? 'Retry Deploy' : 'Deploy Preview'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
);

DeployConfirmationModal.displayName = 'DeployConfirmationModal';
