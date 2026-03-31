"use client";

import { useState } from 'react';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CredentialList } from '@/components/ai-credentials/credential-list';
import { DeleteCredentialDialog } from '@/components/ai-credentials/delete-credential-dialog';
import { SaveCredentialDialog } from '@/components/ai-credentials/save-credential-dialog';
import {
  useAiCredentials,
  useDeleteAiCredential,
  useSaveAiCredential,
} from '@/lib/hooks/mutations/useAiCredentials';
import type { UpsertAiCredentialInput } from '@/lib/ai-credentials/types';

export function AiCredentialSettingsCard() {
  const { data, isLoading, error } = useAiCredentials();
  const saveCredential = useSaveAiCredential();
  const deleteCredential = useDeleteAiCredential('ANTHROPIC');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const credential = data?.credentials[0] ?? null;

  async function handleSave(input: UpsertAiCredentialInput) {
    try {
      setSaveError(null);
      await saveCredential.mutateAsync(input);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save credential');
      throw error;
    }
  }

  async function handleDelete() {
    try {
      setSaveError(null);
      await deleteCredential.mutateAsync();
      setDeleteDialogOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to delete credential');
    }
  }

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Anthropic BYOK</CardTitle>
          <CardDescription>
            Save one active Anthropic credential for your account. Workflows use the
            project owner&apos;s ready credential only.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {credential ? (
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleteCredential.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Credential
            </Button>
          ) : null}
          <SaveCredentialDialog
            credential={credential}
            isSaving={saveCredential.isPending}
            onSave={handleSave}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {saveError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Credential save failed</AlertTitle>
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Unable to load AI credentials</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : (
          <CredentialList credentials={data?.credentials ?? []} />
        )}

        {credential ? (
          <DeleteCredentialDialog
            label={credential.label}
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onConfirm={handleDelete}
            isDeleting={deleteCredential.isPending}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
