'use client';

import { ShieldCheck, Loader2 } from 'lucide-react';
import { useCredentials } from '@/lib/hooks/mutations/useCredentials';
import { CredentialForm } from '@/components/credentials/credential-form';
import { CredentialCard } from '@/components/credentials/credential-card';

export default function CredentialsSettingsPage() {
  const { data, isLoading } = useCredentials();
  const anthropicCredential = data?.credentials?.find((c) => c.provider === 'ANTHROPIC') ?? null;

  return (
    <main className="container mx-auto py-10 max-w-4xl">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Credentials</h1>
            <p className="text-sm text-muted-foreground">
              Manage your API keys for AI-powered workflows
            </p>
          </div>
        </div>

        <div className="rounded-lg border aurora-bg-subtle p-4">
          <p className="text-sm text-muted-foreground">
            AI workflows (specify, plan, build, verify) require an API key to interact with AI
            providers. Your key is encrypted at rest and only used by workflows running on your
            projects. It is never visible after saving.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading credentials...
          </div>
        ) : (
          <>
            {anthropicCredential && (
              <div>
                <h2 className="mb-4 text-lg font-semibold">Current Credential</h2>
                <CredentialCard credential={anthropicCredential} />
              </div>
            )}

            <div>
              <h2 className="mb-4 text-lg font-semibold">
                {anthropicCredential ? 'Replace Credential' : 'Add Credential'}
              </h2>
              <CredentialForm existingCredential={anthropicCredential} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
