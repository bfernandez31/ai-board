"use client";

import { Shield } from "lucide-react";
import { CredentialForm } from "@/components/credentials/credential-form";
import { CredentialList } from "@/components/credentials/credential-list";

export default function CredentialsSettingsPage() {
  return (
    <main className="container mx-auto py-10 max-w-4xl">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Credentials</h1>
            <p className="text-sm text-muted-foreground">
              Manage your AI provider credentials for automated workflows
            </p>
          </div>
        </div>

        <div className="rounded-lg border aurora-bg-subtle p-4">
          <p className="text-sm text-muted-foreground">
            AI credentials allow workflows to authenticate with AI providers.
            Your credential is encrypted at rest and only decrypted during workflow execution.
            Each provider supports one credential per account.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong>Anthropic</strong>: API Key (sk-ant-api...) or OAuth Token (Claude Code OAuth flow).{" "}
            <strong>OpenAI</strong>: API Key (sk-...) for Codex agent workflows.
          </p>
        </div>

        <div>
          <h2 className="mb-4 text-lg font-semibold">Add or Replace Credential</h2>
          <div className="rounded-lg border p-4">
            <CredentialForm />
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-lg font-semibold">Your Credentials</h2>
          <CredentialList />
        </div>
      </div>
    </main>
  );
}
