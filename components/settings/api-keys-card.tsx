'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Key, Trash2, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
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
import type { APIKeyStatus, APIProvider, ValidateAPIKeyResponse } from '@/lib/types/api-keys';

interface APIKeysCardProps {
  project: {
    id: number;
    isOwner: boolean;
  };
}

interface KeysResponse {
  keys: APIKeyStatus[];
}

const PROVIDER_LABELS: Record<APIProvider, string> = {
  ANTHROPIC: 'Anthropic',
  OPENAI: 'OpenAI',
};

const PROVIDER_PREFIXES: Record<APIProvider, string> = {
  ANTHROPIC: 'sk-ant-...',
  OPENAI: 'sk-...',
};

function ValidationIcon({ result }: { result: ValidateAPIKeyResponse }) {
  if (result.valid) return <CheckCircle className="h-4 w-4" />;
  if (result.unreachable) return <AlertCircle className="h-4 w-4 text-yellow-600" />;
  return <XCircle className="h-4 w-4" />;
}

export function APIKeysCard({ project }: APIKeysCardProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<KeysResponse>({
    queryKey: ['api-keys', project.id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${project.id}/api-keys`);
      if (!res.ok) throw new Error('Failed to fetch API keys');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys (BYOK)
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
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
          Configure your own API keys for AI workflows. Keys are encrypted at rest.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(['ANTHROPIC', 'OPENAI'] as APIProvider[]).map((provider) => {
          const keyStatus = data?.keys.find((k) => k.provider === provider);
          return (
            <ProviderRow
              key={provider}
              provider={provider}
              status={keyStatus ?? { provider, configured: false, preview: null, updatedAt: null }}
              projectId={project.id}
              isOwner={project.isOwner}
              onUpdate={() => queryClient.invalidateQueries({ queryKey: ['api-keys', project.id] })}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

interface ProviderRowProps {
  provider: APIProvider;
  status: APIKeyStatus;
  projectId: number;
  isOwner: boolean;
  onUpdate: () => void;
}

function ProviderRow({ provider, status, projectId, isOwner, onUpdate }: ProviderRowProps) {
  const [inputValue, setInputValue] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidateAPIKeyResponse | null>(null);

  const saveMutation = useMutation({
    mutationFn: async ({ skipValidation }: { skipValidation: boolean }) => {
      const res = await fetch(`/api/projects/${projectId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: inputValue,
          skipValidation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save key');
      return data;
    },
    onSuccess: () => {
      setInputValue('');
      setShowInput(false);
      setValidationResult(null);
      onUpdate();
    },
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/api-keys/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: inputValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Validation failed');
      return data as ValidateAPIKeyResponse;
    },
    onSuccess: (data) => {
      setValidationResult(data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/api-keys/${provider}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete key');
      }
    },
    onSuccess: () => {
      setShowDeleteDialog(false);
      onUpdate();
    },
  });

  const isProcessing = saveMutation.isPending || validateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{PROVIDER_LABELS[provider]}</span>
          {status.configured ? (
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Configured
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Not configured
            </Badge>
          )}
        </div>
        {isOwner && status.configured && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-mono">
              ****{status.preview}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowInput(true);
                setValidationResult(null);
              }}
              disabled={isProcessing}
            >
              Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isProcessing}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
        {isOwner && !status.configured && !showInput && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowInput(true);
              setValidationResult(null);
            }}
          >
            Add Key
          </Button>
        )}
      </div>

      {status.updatedAt && (
        <p className="text-xs text-muted-foreground">
          Updated {new Date(status.updatedAt).toLocaleDateString()}
        </p>
      )}

      {isOwner && showInput && (
        <div className="space-y-2 mt-2">
          <Input
            type="password"
            placeholder={PROVIDER_PREFIXES[provider]}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setValidationResult(null);
              saveMutation.reset();
            }}
            disabled={isProcessing}
          />

          {validationResult && (
            <div className={`flex items-center gap-2 text-sm ${validationResult.valid ? 'text-green-600' : 'text-destructive'}`}>
              <ValidationIcon result={validationResult} />
              <span>{validationResult.message}</span>
            </div>
          )}

          {saveMutation.isError && (
            <p className="text-sm text-destructive">{saveMutation.error.message}</p>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => saveMutation.mutate({ skipValidation: false })}
              disabled={!inputValue.trim() || isProcessing}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => validateMutation.mutate()}
              disabled={!inputValue.trim() || isProcessing}
            >
              {validateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Test
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowInput(false);
                setInputValue('');
                setValidationResult(null);
                saveMutation.reset();
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            {inputValue.trim() && (
              <Button
                variant="link"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => saveMutation.mutate({ skipValidation: true })}
                disabled={isProcessing}
              >
                Save without validation
              </Button>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {PROVIDER_LABELS[provider]} API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the API key for {PROVIDER_LABELS[provider]}. Workflows for external projects will be blocked until a new key is configured.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
