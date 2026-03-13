'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Key, CheckCircle, XCircle, AlertTriangle, Loader2, Trash2 } from 'lucide-react';

interface ApiKeyStatus {
  provider: 'ANTHROPIC' | 'OPENAI';
  preview: string | null;
  configured: boolean;
  updatedAt: string | null;
}

interface ApiKeysCardProps {
  project: {
    id: number;
  };
  isOwner: boolean;
}

const PROVIDER_INFO: Record<string, { label: string; placeholder: string; prefix: string }> = {
  ANTHROPIC: {
    label: 'Anthropic (Claude)',
    placeholder: 'sk-ant-api03-...',
    prefix: 'sk-ant-',
  },
  OPENAI: {
    label: 'OpenAI (Codex)',
    placeholder: 'sk-proj-...',
    prefix: 'sk-',
  },
};

export function ApiKeysCard({ project, isOwner }: ApiKeysCardProps) {
  const [keys, setKeys] = useState<ApiKeyStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [validatingProvider, setValidatingProvider] = useState<string | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<
    Record<string, { valid: boolean | null; message: string } | null>
  >({});
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/api-keys`);
      if (!response.ok) throw new Error('Failed to load API keys');
      const data = await response.json() as { keys: ApiKeyStatus[] };
      setKeys(data.keys);
    } catch {
      setError('Failed to load API key status');
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void fetchKeys();
  }, [fetchKeys]);

  async function handleSave(provider: string) {
    const keyValue = inputValues[provider];
    if (!keyValue?.trim()) return;

    setSavingProvider(provider);
    setError(null);
    setValidationResults((prev) => ({ ...prev, [provider]: null }));

    try {
      const response = await fetch(`/api/projects/${project.id}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key: keyValue }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        setError(data.error ?? 'Failed to save API key');
        return;
      }

      setInputValues((prev) => ({ ...prev, [provider]: '' }));
      await fetchKeys();
    } catch {
      setError('Failed to save API key');
    } finally {
      setSavingProvider(null);
    }
  }

  async function handleValidate(provider: string) {
    setValidatingProvider(provider);
    setValidationResults((prev) => ({ ...prev, [provider]: null }));

    try {
      const response = await fetch(
        `/api/projects/${project.id}/api-keys/${provider}/validate`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        setError(data.error ?? 'Validation failed');
        return;
      }

      const result = await response.json() as { valid: boolean | null; message: string };
      setValidationResults((prev) => ({ ...prev, [provider]: result }));
    } catch {
      setError('Failed to validate API key');
    } finally {
      setValidatingProvider(null);
    }
  }

  async function handleDelete(provider: string) {
    setDeletingProvider(provider);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${project.id}/api-keys/${provider}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        setError(data.error ?? 'Failed to remove API key');
        return;
      }

      setValidationResults((prev) => ({ ...prev, [provider]: null }));
      await fetchKeys();
    } catch {
      setError('Failed to remove API key');
    } finally {
      setDeletingProvider(null);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>Loading API key configuration...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Keys (BYOK)
        </CardTitle>
        <CardDescription>
          {isOwner
            ? 'Configure API keys for AI providers. Keys are encrypted at rest and never displayed after saving.'
            : 'API key configuration status for this project. Only the project owner can manage keys.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive" data-testid="api-keys-error">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {keys.map((keyStatus) => {
          const info = PROVIDER_INFO[keyStatus.provider];
          if (!info) return null;
          const validation = validationResults[keyStatus.provider];

          return (
            <div
              key={keyStatus.provider}
              className="space-y-3 rounded-lg border p-4"
              data-testid={`provider-section-${keyStatus.provider}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{info.label}</span>
                <Badge variant={keyStatus.configured ? 'default' : 'secondary'}>
                  {keyStatus.configured ? 'Configured' : 'Not configured'}
                </Badge>
              </div>

              {keyStatus.configured && keyStatus.preview && (
                <p className="text-sm text-muted-foreground" data-testid={`key-preview-${keyStatus.provider}`}>
                  {info.prefix}...{keyStatus.preview}
                </p>
              )}

              {isOwner && (
                <>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder={info.placeholder}
                      value={inputValues[keyStatus.provider] ?? ''}
                      onChange={(e) =>
                        setInputValues((prev) => ({
                          ...prev,
                          [keyStatus.provider]: e.target.value,
                        }))
                      }
                      disabled={savingProvider === keyStatus.provider}
                      data-testid={`key-input-${keyStatus.provider}`}
                    />
                    <Button
                      onClick={() => handleSave(keyStatus.provider)}
                      disabled={
                        savingProvider === keyStatus.provider ||
                        !inputValues[keyStatus.provider]?.trim()
                      }
                      data-testid={`save-key-${keyStatus.provider}`}
                    >
                      {savingProvider === keyStatus.provider ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Save'
                      )}
                    </Button>
                  </div>

                  {keyStatus.configured && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleValidate(keyStatus.provider)}
                        disabled={validatingProvider === keyStatus.provider}
                        data-testid={`test-key-${keyStatus.provider}`}
                      >
                        {validatingProvider === keyStatus.provider ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : null}
                        Test Key
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            disabled={deletingProvider === keyStatus.provider}
                            data-testid={`remove-key-${keyStatus.provider}`}
                          >
                            {deletingProvider === keyStatus.provider ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-1" />
                            )}
                            Remove
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove API Key</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove the {info.label} API key?
                              Workflows requiring this provider will be blocked until a
                              new key is configured.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(keyStatus.provider)}
                              data-testid={`confirm-remove-${keyStatus.provider}`}
                            >
                              Remove Key
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </>
              )}

              {validation && (
                <div
                  className="flex items-center gap-2 text-sm"
                  data-testid={`validation-result-${keyStatus.provider}`}
                >
                  {validation.valid === true && (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                  {validation.valid === false && (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  {validation.valid === null && (
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  )}
                  <span>{validation.message}</span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
