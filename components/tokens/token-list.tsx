"use client";

import { useTokens } from "@/lib/hooks/mutations/useTokens";
import { TokenItem } from "./token-item";
import { Loader2 } from "lucide-react";

export function TokenList() {
  const { data, isLoading, error } = useTokens();

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
        Failed to load tokens: {error.message}
      </div>
    );
  }

  const tokens = data?.tokens ?? [];

  if (tokens.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
        <p className="text-muted-foreground">
          No personal access tokens yet. Create one to authenticate API requests.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border divide-y">
      {tokens.map((token) => (
        <TokenItem key={token.id} token={token} />
      ))}
    </div>
  );
}
