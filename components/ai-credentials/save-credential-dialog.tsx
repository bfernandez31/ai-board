"use client";

import * as React from 'react';
import { KeyRound } from 'lucide-react';
import { AiCredentialProvider, AiCredentialType } from '@prisma/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UpsertAiCredentialInput, UserAiCredentialSummary } from '@/lib/ai-credentials/types';
import { AI_CREDENTIAL_TYPE_LABELS } from '@/lib/ai-credentials/types';
import { validateAnthropicSecretFormat } from '@/lib/ai-credentials/providers/anthropic';

interface SaveCredentialDialogProps {
  credential?: UserAiCredentialSummary | null;
  isSaving?: boolean;
  onSave: (input: UpsertAiCredentialInput) => Promise<void>;
}

export function SaveCredentialDialog({
  credential,
  isSaving = false,
  onSave,
}: SaveCredentialDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState(credential?.label ?? '');
  const [credentialType, setCredentialType] = React.useState<AiCredentialType>(
    credential?.credentialType ?? AiCredentialType.ANTHROPIC_API_KEY
  );
  const [secret, setSecret] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const localValidation = secret
    ? validateAnthropicSecretFormat(credentialType, secret)
    : { valid: false, error: null };

  async function handleSubmit() {
    if (!label.trim()) {
      setError('Label is required');
      return;
    }

    if (!localValidation.valid) {
      setError(localValidation.error);
      return;
    }

    setError(null);
    await onSave({
      provider: AiCredentialProvider.ANTHROPIC,
      credentialType,
      label: label.trim(),
      secret: secret.trim(),
    });
    setOpen(false);
    setSecret('');
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setLabel(credential?.label ?? '');
      setCredentialType(credential?.credentialType ?? AiCredentialType.ANTHROPIC_API_KEY);
      setSecret('');
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <KeyRound className="mr-2 h-4 w-4" />
          {credential ? 'Replace Credential' : 'Add Credential'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{credential ? 'Replace AI Credential' : 'Save AI Credential'}</DialogTitle>
          <DialogDescription>
            The full secret is only used at save time. Later views stay masked.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="ai-credential-provider">Provider</Label>
            <Input id="ai-credential-provider" value="Anthropic" disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ai-credential-type">Credential type</Label>
            <Select
              value={credentialType}
              onValueChange={(value) => setCredentialType(value as AiCredentialType)}
            >
              <SelectTrigger id="ai-credential-type">
                <SelectValue placeholder="Select a credential type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AiCredentialType.ANTHROPIC_API_KEY}>
                  {AI_CREDENTIAL_TYPE_LABELS[AiCredentialType.ANTHROPIC_API_KEY]}
                </SelectItem>
                <SelectItem value={AiCredentialType.ANTHROPIC_OAUTH}>
                  {AI_CREDENTIAL_TYPE_LABELS[AiCredentialType.ANTHROPIC_OAUTH]}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ai-credential-label">Label</Label>
            <Input
              id="ai-credential-label"
              value={label}
              onChange={(event) => {
                setLabel(event.target.value);
                setError(null);
              }}
              placeholder="Primary Anthropic"
              maxLength={100}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ai-credential-secret">Secret</Label>
            <Input
              id="ai-credential-secret"
              type="password"
              value={secret}
              onChange={(event) => {
                setSecret(event.target.value);
                setError(null);
              }}
              placeholder={
                credentialType === AiCredentialType.ANTHROPIC_API_KEY
                  ? 'sk-ant-...'
                  : 'anthropic-oauth-...'
              }
            />
            {!localValidation.valid && secret ? (
              <p className="text-sm text-destructive">{localValidation.error}</p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !label.trim() || !secret.trim() || !localValidation.valid}
          >
            {isSaving ? 'Saving...' : credential ? 'Replace Credential' : 'Save Credential'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
