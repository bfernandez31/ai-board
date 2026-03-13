'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
const PROVIDERS: Provider[] = ['anthropic', 'openai'];

const PROVIDER_CONFIG: Record<
  Provider,
  {
    title: string;
    description: string;
  }
> = {
  anthropic: {
    title: 'Anthropic API Key',
    description: 'Used for Claude workflows.',
  },
  openai: {
    title: 'OpenAI API Key',
    description: 'Used for Codex workflows.',
  },
};

export function ProjectApiKeysCard({
  project,
}: ProjectApiKeysCardProps): React.JSX.Element {
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

  function updateValue(provider: Provider, value: string): void {
    setValues((current) => ({ ...current, [provider]: value }));
  }

  function updateMessage(provider: Provider, nextMessage: string): void {
    setMessage((current) => ({
      ...current,
      [provider]: nextMessage,
    }));
  }

  async function saveKey(provider: Provider): Promise<void> {
    const apiKey = values[provider].trim();

    if (!apiKey) {
      updateMessage(provider, 'Enter an API key first.');
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

      updateValue(provider, '');
      updateMessage(provider, 'Saved successfully.');
      router.refresh();
    } catch {
      updateMessage(provider, 'Failed to save API key.');
    } finally {
      setBusyProvider(null);
    }
  }

  async function testKey(provider: Provider): Promise<void> {
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
      updateMessage(provider, result.message ?? 'Validation completed.');
    } catch {
      updateMessage(provider, 'Failed to validate API key.');
    } finally {
      setBusyProvider(null);
    }
  }

  async function removeKey(provider: Provider): Promise<void> {
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

      updateValue(provider, '');
      updateMessage(provider, 'Removed successfully.');
      router.refresh();
    } catch {
      updateMessage(provider, 'Failed to remove API key.');
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
        {PROVIDERS.map((provider) => (
          <ProviderRow
            key={provider}
            provider={provider}
            title={PROVIDER_CONFIG[provider].title}
            description={PROVIDER_CONFIG[provider].description}
            value={values[provider]}
            configuredValue={project.apiKeys[provider].maskedValue}
            busy={busyProvider === provider}
            message={message[provider]}
            onChange={function handleChange(value: string): void {
              updateValue(provider, value);
            }}
            onSave={function handleSave(): Promise<void> {
              return saveKey(provider);
            }}
            onTest={function handleTest(): Promise<void> {
              return testKey(provider);
            }}
            onRemove={function handleRemove(): Promise<void> {
              return removeKey(provider);
            }}
          />
        ))}
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
}: ProviderRowProps): React.JSX.Element {
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
