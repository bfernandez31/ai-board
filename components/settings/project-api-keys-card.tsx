'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

interface ProviderState {
  configured: boolean;
  maskedValue: string | null;
}

interface ProjectApiKeysCardProps {
  project: {
    id: number;
    apiKeys: {
      anthropic: ProviderState;
      openai: ProviderState;
    };
  };
}

type Provider = 'anthropic' | 'openai';

export function ProjectApiKeysCard({ project }: ProjectApiKeysCardProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<Provider, string>>({
    anthropic: '',
    openai: '',
  });
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [message, setMessage] = useState<Record<Provider, string | null>>({
    anthropic: null,
    openai: null,
  });

  async function saveKey(provider: Provider) {
    const apiKey = values[provider].trim();
    if (!apiKey) {
      setMessage((current) => ({
        ...current,
        [provider]: 'Enter an API key first.',
      }));
      return;
    }

    setBusyProvider(provider);
    try {
      const response = await fetch(`/api/projects/${project.id}/api-keys`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });

      if (!response.ok) {
        throw new Error('Failed to save API key');
      }

      setValues((current) => ({ ...current, [provider]: '' }));
      setMessage((current) => ({
        ...current,
        [provider]: 'Saved successfully.',
      }));
      router.refresh();
    } catch {
      setMessage((current) => ({
        ...current,
        [provider]: 'Failed to save API key.',
      }));
    } finally {
      setBusyProvider(null);
    }
  }

  async function testKey(provider: Provider) {
    setBusyProvider(provider);
    try {
      const response = await fetch(`/api/projects/${project.id}/api-keys/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: values[provider].trim() || undefined,
        }),
      });

      const result = (await response.json()) as { valid?: boolean; message?: string };
      setMessage((current) => ({
        ...current,
        [provider]: result.message ?? 'Validation completed.',
      }));
    } catch {
      setMessage((current) => ({
        ...current,
        [provider]: 'Failed to validate API key.',
      }));
    } finally {
      setBusyProvider(null);
    }
  }

  async function removeKey(provider: Provider) {
    setBusyProvider(provider);
    try {
      const response = await fetch(`/api/projects/${project.id}/api-keys`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete API key');
      }

      setValues((current) => ({ ...current, [provider]: '' }));
      setMessage((current) => ({
        ...current,
        [provider]: 'Removed successfully.',
      }));
      router.refresh();
    } catch {
      setMessage((current) => ({
        ...current,
        [provider]: 'Failed to remove API key.',
      }));
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bring Your Own API Keys</CardTitle>
        <CardDescription>
          Store project-level Anthropic and OpenAI keys for Claude and Codex workflows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ProviderRow
          provider="anthropic"
          title="Anthropic API Key"
          description="Used for Claude workflows."
          value={values.anthropic}
          configuredValue={project.apiKeys.anthropic.maskedValue}
          busy={busyProvider === 'anthropic'}
          message={message.anthropic}
          onChange={(value) => setValues((current) => ({ ...current, anthropic: value }))}
          onSave={() => saveKey('anthropic')}
          onTest={() => testKey('anthropic')}
          onRemove={() => removeKey('anthropic')}
        />

        <ProviderRow
          provider="openai"
          title="OpenAI API Key"
          description="Used for Codex workflows."
          value={values.openai}
          configuredValue={project.apiKeys.openai.maskedValue}
          busy={busyProvider === 'openai'}
          message={message.openai}
          onChange={(value) => setValues((current) => ({ ...current, openai: value }))}
          onSave={() => saveKey('openai')}
          onTest={() => testKey('openai')}
          onRemove={() => removeKey('openai')}
        />
      </CardContent>
    </Card>
  );
}

interface ProviderRowProps {
  provider: Provider;
  title: string;
  description: string;
  value: string;
  configuredValue: string | null;
  busy: boolean;
  message: string | null;
  onChange: (value: string) => void;
  onSave: () => void;
  onTest: () => void;
  onRemove: () => void;
}

function ProviderRow({
  provider,
  title,
  description,
  value,
  configuredValue,
  busy,
  message,
  onChange,
  onSave,
  onTest,
  onRemove,
}: ProviderRowProps) {
  const inputId = `${provider}-api-key`;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label htmlFor={inputId}>{title}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-sm text-muted-foreground">
          Current value: {configuredValue ?? 'Not configured'}
        </p>
      </div>

      <Input
        id={inputId}
        type="password"
        autoComplete="off"
        placeholder="Paste a new API key"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onSave} disabled={busy}>
          Save key
        </Button>
        <Button type="button" variant="outline" onClick={onTest} disabled={busy}>
          Test key
        </Button>
        <Button type="button" variant="ghost" onClick={onRemove} disabled={busy || !configuredValue}>
          Remove key
        </Button>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
