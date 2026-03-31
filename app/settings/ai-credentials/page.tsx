"use client";

import { KeyRound } from 'lucide-react';
import { AiCredentialSettingsCard } from '@/components/ai-credentials/credential-settings-card';

export default function AiCredentialsSettingsPage() {
  return (
    <main className="container mx-auto max-w-4xl py-10">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Credentials</h1>
            <p className="text-sm text-muted-foreground">
              Manage the provider credentials used for your AI workflows.
            </p>
          </div>
        </div>

        <div className="rounded-lg border aurora-bg-subtle p-4">
          <p className="text-sm text-muted-foreground">
            Credentials are stored in masked form after save and only the project owner&apos;s
            ready credential can authorize AI workflows.
          </p>
        </div>

        <AiCredentialSettingsCard />
      </div>
    </main>
  );
}
