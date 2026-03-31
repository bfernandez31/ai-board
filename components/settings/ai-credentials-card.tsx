'use client';

import { useState } from 'react';
import { Bot, CheckCircle2, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  type AiCredentialType,
  useAiCredentials,
  useDeleteAiCredential,
  useSaveAiCredential,
  useValidateAiCredential,
} from '@/lib/hooks/use-ai-credentials';
import { getCredentialFormatError } from '@/lib/ai/credentials';

const PROVIDER = 'ANTHROPIC';
const DEFAULT_LABEL = 'Anthropic credential';

function getCredentialTypeLabel(credentialType: AiCredentialType): string {
  if (credentialType === 'API_KEY') {
    return 'API Key';
  }

  return 'OAuth Token';
}

function getSecretLabel(credentialType: AiCredentialType): string {
  if (credentialType === 'API_KEY') {
    return 'Anthropic API Key';
  }

  return 'Claude OAuth Token';
}

function getSecretPlaceholder(credentialType: AiCredentialType): string {
  if (credentialType === 'API_KEY') {
    return 'sk-ant-...';
  }

  return 'CLAUDE_CODE_OAUTH_TOKEN';
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

export function AiCredentialsCard(): JSX.Element {
  const [label, setLabel] = useState('');
  const [secret, setSecret] = useState('');
  const [credentialType, setCredentialType] = useState<AiCredentialType>('API_KEY');
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const credentialsQuery = useAiCredentials();
  const saveMutation = useSaveAiCredential();
  const validateMutation = useValidateAiCredential();
  const deleteMutation = useDeleteAiCredential();

  const existingCredential = credentialsQuery.data?.credentials.find(
    (credential) => credential.provider === PROVIDER
  );

  const formatError = getCredentialFormatError(PROVIDER, credentialType, secret);

  function resetServerState(): void {
    setServerMessage(null);
    setServerError(null);
  }

  async function handleValidate(): Promise<void> {
    resetServerState();

    try {
      await validateMutation.mutateAsync({
        provider: PROVIDER,
        credentialType,
        secret,
      });
      setServerMessage('Credential validated successfully.');
    } catch (error) {
      setServerError(getErrorMessage(error, 'Validation failed'));
    }
  }

  async function handleSave(): Promise<void> {
    resetServerState();

    try {
      await saveMutation.mutateAsync({
        provider: PROVIDER,
        credentialType,
        label: label.trim() || DEFAULT_LABEL,
        secret,
      });
      setServerMessage(existingCredential ? 'Credential replaced successfully.' : 'Credential saved successfully.');
      setSecret('');
    } catch (error) {
      setServerError(getErrorMessage(error, 'Save failed'));
    }
  }

  async function handleDelete(): Promise<void> {
    resetServerState();

    try {
      await deleteMutation.mutateAsync(PROVIDER);
      setServerMessage('Credential deleted successfully.');
    } catch (error) {
      setServerError(getErrorMessage(error, 'Delete failed'));
    }
  }

  const isBusy = saveMutation.isPending || validateMutation.isPending || deleteMutation.isPending;

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          AI Credentials
        </CardTitle>
        <CardDescription>
          Store your Anthropic credential once and let project workflows fetch it just in time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {existingCredential ? (
          <div className="rounded-lg border bg-card/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{existingCredential.label}</p>
                <p className="text-sm text-muted-foreground">
                  {existingCredential.preview} | {getCredentialTypeLabel(existingCredential.credentialType)}
                </p>
              </div>
              <Badge variant="secondary">Anthropic</Badge>
            </div>
          </div>
        ) : (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>No Anthropic credential configured</AlertTitle>
            <AlertDescription>
              Workflow launches are blocked until the project owner saves a valid credential.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-label">Label</Label>
            <Input
              id="ai-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ma cle pro"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-credential-type">Credential Type</Label>
            <Select
              value={credentialType}
              onValueChange={(value) => setCredentialType(value as AiCredentialType)}
              disabled={isBusy}
            >
              <SelectTrigger id="ai-credential-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="API_KEY">API Key</SelectItem>
                <SelectItem value="OAUTH_TOKEN">OAuth Token</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-secret">{getSecretLabel(credentialType)}</Label>
          <Input
            id="ai-secret"
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder={getSecretPlaceholder(credentialType)}
            autoComplete="off"
          />
          <p className={`text-sm ${formatError ? 'text-destructive' : 'text-muted-foreground'}`}>
            {formatError ?? 'Client-side format validation passed.'}
          </p>
        </div>

        {serverError ? (
          <Alert variant="destructive">
            <AlertTitle>Credential error</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        {serverMessage ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{serverMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={handleValidate}
            disabled={Boolean(formatError) || !secret.trim() || isBusy}
          >
            {validateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Test Credential
          </Button>

          <Button
            onClick={handleSave}
            disabled={Boolean(formatError) || !secret.trim() || isBusy}
          >
            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {existingCredential ? 'Replace Credential' : 'Save Credential'}
          </Button>

          {existingCredential ? (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isBusy}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Credential
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
