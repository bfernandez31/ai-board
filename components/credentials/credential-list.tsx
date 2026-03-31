"use client";

import { useCredentials } from "@/lib/hooks/mutations/useCredentials";
import { CredentialItem } from "./credential-item";
import { Loader2 } from "lucide-react";

export function CredentialList() {
  const { data, isLoading, error } = useCredentials();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load credentials: {error.message}
      </div>
    );
  }

  const credentials = data?.credentials ?? [];

  if (credentials.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
        <p className="text-muted-foreground">
          No AI credentials configured yet. Add one above to enable AI-powered workflows.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border divide-y">
      {credentials.map((credential) => (
        <CredentialItem key={credential.id} credential={credential} />
      ))}
    </div>
  );
}
