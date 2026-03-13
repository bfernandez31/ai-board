'use client';

import { useState } from 'react';
import type { ProviderStatusView } from '@/lib/types/ai-credentials';
import { AiProviderStatusRow } from '@/components/settings/ai-provider-status-row';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ProviderUpdate =
  | ProviderStatusView
  | { provider: ProviderStatusView['provider']; status: 'NOT_CONFIGURED' };

interface AiCredentialsCardProps {
  projectId: number;
  initialProviders: ProviderStatusView[];
}

export function AiCredentialsCard({
  projectId,
  initialProviders,
}: AiCredentialsCardProps) {
  const [providers, setProviders] = useState<ProviderStatusView[]>(initialProviders);

  function handleProviderUpdate(updated: ProviderUpdate): void {
    setProviders((current) =>
      current.map((provider) => {
        if (provider.provider !== updated.provider) {
          return provider;
        }

        if (updated.status === 'NOT_CONFIGURED') {
          return {
            ...provider,
            status: 'NOT_CONFIGURED',
            validationStatus: null,
            lastFour: null,
            validatedAt: null,
            message: null,
          };
        }

        return updated;
      })
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bring Your Own API Keys</CardTitle>
        <CardDescription>
          Configure project-scoped Anthropic and OpenAI credentials for workflow runs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {providers.map((provider) => (
          <AiProviderStatusRow
            key={provider.provider}
            provider={provider}
            projectId={projectId}
            onUpdated={handleProviderUpdate}
          />
        ))}
      </CardContent>
    </Card>
  );
}
