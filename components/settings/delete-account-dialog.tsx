'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { signOut } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

interface AccountSummary {
  projectCount: number;
  credentialCount: number;
  tokenCount: number;
  hasActiveSubscription: boolean;
  plan: string;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  userEmail,
}: DeleteAccountDialogProps) {
  const [emailInput, setEmailInput] = useState('');
  const { toast } = useToast();

  const { data: summary, isLoading: isSummaryLoading } = useQuery<AccountSummary>({
    queryKey: ['account', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/account/summary');
      if (!res.ok) throw new Error('Failed to fetch account summary');
      return res.json();
    },
    enabled: open,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/account', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete account');
      }
      return res.json();
    },
    onSuccess: () => {
      signOut({ callbackUrl: '/' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete account',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const emailMatches =
    emailInput.toLowerCase() === userEmail.toLowerCase();

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && deleteMutation.isPending) return;
    if (!nextOpen) setEmailInput('');
    onOpenChange(nextOpen);
  }

  function handleCancel() {
    setEmailInput('');
    onOpenChange(false);
  }

  function handleDelete() {
    if (!emailMatches || deleteMutation.isPending) return;
    deleteMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-destructive">
            Delete your account
          </DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isSummaryLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading account data...
            </div>
          ) : summary ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm space-y-1">
              <p className="font-medium text-foreground">
                The following will be permanently deleted:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                <li>{summary.projectCount} project{summary.projectCount !== 1 ? 's' : ''}</li>
                <li>{summary.credentialCount} AI credential{summary.credentialCount !== 1 ? 's' : ''}</li>
                <li>{summary.tokenCount} personal access token{summary.tokenCount !== 1 ? 's' : ''}</li>
                {summary.hasActiveSubscription && (
                  <li>Active {summary.plan} subscription (will be cancelled)</li>
                )}
              </ul>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="confirm-email">
              Type <span className="font-semibold">{userEmail}</span> to confirm
            </Label>
            <Input
              id="confirm-email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Enter your email address"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={handleCancel}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!emailMatches || deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete permanently'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
