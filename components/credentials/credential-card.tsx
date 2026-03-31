'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, KeyRound, Loader2 } from 'lucide-react';
import { useDeleteCredential, type CredentialListItem } from '@/lib/hooks/mutations/useCredentials';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface CredentialCardProps {
  credential: CredentialListItem;
}

export function CredentialCard({ credential }: CredentialCardProps) {
  const deleteCredential = useDeleteCredential();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteCredential.mutateAsync(credential.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{credential.label}</span>
              <Badge variant="secondary">{credential.provider}</Badge>
              <Badge variant="outline">
                {credential.credentialType === 'API_KEY' ? 'API Key' : 'OAuth Token'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              ****{credential.preview} &middot; Added{' '}
              {new Date(credential.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete credential?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove your {credential.provider} credential. Workflows will
                not be able to run until you add a new one.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
