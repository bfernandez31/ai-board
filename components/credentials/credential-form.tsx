'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';
import { useSaveCredential, useValidateCredential } from '@/lib/hooks/mutations/useCredentials';

interface CredentialFormProps {
  existingCredential?: {
    id: number;
    provider: string;
    credentialType: string;
    label: string;
    preview: string;
  } | null;
  onSuccess?: () => void;
}

export function CredentialForm({ existingCredential, onSuccess }: CredentialFormProps) {
  const [credentialType, setCredentialType] = useState(
    existingCredential?.credentialType || 'API_KEY'
  );
  const [label, setLabel] = useState(existingCredential?.label || '');
  const [apiKey, setApiKey] = useState('');
  const [formatError, setFormatError] = useState<string | null>(null);

  const saveCredential = useSaveCredential();
  const validateCredential = useValidateCredential();

  const validateFormat = (key: string, type: string) => {
    if (!key) {
      setFormatError(null);
      return;
    }
    if (type === 'API_KEY' && !key.startsWith('sk-ant-')) {
      setFormatError('Anthropic API key must start with "sk-ant-"');
    } else if (key.length < 10) {
      setFormatError('Key is too short');
    } else {
      setFormatError(null);
    }
  };

  const handleKeyChange = (value: string) => {
    setApiKey(value);
    validateFormat(value, credentialType);
  };

  const handleTypeChange = (value: string) => {
    setCredentialType(value);
    validateFormat(apiKey, value);
  };

  const handleValidate = () => {
    if (!apiKey) return;
    validateCredential.mutate({
      provider: 'ANTHROPIC',
      credentialType,
      apiKey,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !label.trim()) return;

    await saveCredential.mutateAsync({
      provider: 'ANTHROPIC',
      credentialType,
      label: label.trim(),
      apiKey,
    });

    setApiKey('');
    onSuccess?.();
  };

  const isValid = apiKey.length > 0 && label.trim().length > 0 && !formatError;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          {existingCredential ? 'Replace Anthropic Credential' : 'Add Anthropic Credential'}
        </CardTitle>
        <CardDescription>
          {existingCredential
            ? 'Replace your existing key. The old key will be permanently removed.'
            : 'Your key will be encrypted at rest and never visible after saving.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="credentialType">Credential Type</Label>
            <Select value={credentialType} onValueChange={handleTypeChange}>
              <SelectTrigger id="credentialType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="API_KEY">API Key (sk-ant-...)</SelectItem>
                <SelectItem value="OAUTH_TOKEN">OAuth Token</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My Anthropic key"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">
              {credentialType === 'API_KEY' ? 'API Key' : 'OAuth Token'}
            </Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder={
                credentialType === 'API_KEY' ? 'sk-ant-api03-...' : 'Paste your OAuth token'
              }
            />
            {formatError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {formatError}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleValidate}
              disabled={!apiKey || !!formatError || validateCredential.isPending}
            >
              {validateCredential.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Test Key
            </Button>

            {validateCredential.isSuccess && (
              <span
                className={`text-sm flex items-center gap-1 ${
                  validateCredential.data.valid ? 'text-green-600' : 'text-destructive'
                }`}
              >
                {validateCredential.data.valid ? (
                  <>
                    <CheckCircle className="h-3 w-3" /> Valid
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" /> {validateCredential.data.error}
                  </>
                )}
              </span>
            )}
          </div>

          <Button type="submit" disabled={!isValid || saveCredential.isPending}>
            {saveCredential.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {existingCredential ? 'Replace Credential' : 'Save Credential'}
          </Button>

          {saveCredential.isError && (
            <p className="text-sm text-destructive">{saveCredential.error.message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
