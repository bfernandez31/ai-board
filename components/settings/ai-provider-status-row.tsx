'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, Trash2 } from 'lucide-react';
import type { ProviderStatusView } from '@/lib/types/ai-credentials';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PROVIDER_LABELS: Record<ProviderStatusView['provider'], string> = {
  ANTHROPIC: 'Anthropic',
  OPENAI: 'OpenAI',
};

function statusVariant(provider: ProviderStatusView): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (provider.status === 'INVALID') {
    return 'destructive';
  }
  if (provider.status === 'NOT_CONFIGURED') {
    return 'outline';
  }
  if (provider.validationStatus === 'VALID') {
    return 'default';
  }
  return 'secondary';
}

interface AiProviderStatusRowProps {
  provider: ProviderStatusView;
  projectId: number;
  onUpdated: (provider: ProviderStatusView | { provider: ProviderStatusView['provider']; status: 'NOT_CONFIGURED' }) => void;
}

export function AiProviderStatusRow({
  provider,
  projectId,
  onUpdated,
}: AiProviderStatusRowProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/ai-credentials/${provider.provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to save credential');
      }

      onUpdated(payload);
      setApiKey('');
      setDialogOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save credential');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleValidate() {
    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/ai-credentials/${provider.provider}/validate`, {
        method: 'POST',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to validate credential');
      }

      onUpdated(payload);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Failed to validate credential');
    } finally {
      setIsValidating(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/ai-credentials/${provider.provider}`, {
        method: 'DELETE',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to delete credential');
      }

      onUpdated(payload);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete credential');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h3 className="font-medium">{PROVIDER_LABELS[provider.provider]}</h3>
            <Badge variant={statusVariant(provider)}>
              {provider.status === 'NOT_CONFIGURED' ? 'Not configured' : provider.validationStatus ?? provider.status}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            {provider.lastFour ? `Masked suffix: ••••${provider.lastFour}` : 'No stored key suffix visible'}
          </div>
          {provider.message ? (
            <p className="text-sm text-muted-foreground">{provider.message}</p>
          ) : null}
        </div>

        {provider.canManage ? (
          <div className="flex flex-wrap gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  {provider.status === 'NOT_CONFIGURED' ? 'Save key' : 'Replace key'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{provider.status === 'NOT_CONFIGURED' ? 'Save API key' : 'Replace API key'}</DialogTitle>
                  <DialogDescription>
                    Store a project-scoped {PROVIDER_LABELS[provider.provider]} API key for workflow execution.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor={`${provider.provider}-api-key`}>API key</Label>
                  <Input
                    id={`${provider.provider}-api-key`}
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={`Enter ${PROVIDER_LABELS[provider.provider]} API key`}
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <DialogFooter>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || apiKey.trim().length === 0}
                  >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={provider.status === 'NOT_CONFIGURED' || isValidating}
            >
              {isValidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Validate
            </Button>

            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={provider.status === 'NOT_CONFIGURED' || isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      {!provider.canManage ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Only project owners can manage stored API keys.
        </p>
      ) : null}

      {error && !dialogOpen ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
