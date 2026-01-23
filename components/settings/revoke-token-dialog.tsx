'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface RevokeTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenId: number;
  tokenName: string;
  onTokenRevoked: () => void;
}

export function RevokeTokenDialog({
  open,
  onOpenChange,
  tokenId,
  tokenName,
  onTokenRevoked,
}: RevokeTokenDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleRevoke() {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/tokens/${tokenId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onTokenRevoked();
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Failed to revoke token:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke Token</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to revoke &quot;{tokenName}&quot;? This action cannot be
            undone and any applications using this token will immediately lose
            access.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRevoke}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? 'Revoking...' : 'Revoke Token'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
