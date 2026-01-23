"use client";

import { Key } from "lucide-react";
import { CreateTokenDialog } from "@/components/tokens/create-token-dialog";
import { TokenList } from "@/components/tokens/token-list";
import { useCreateToken } from "@/lib/hooks/mutations/useTokens";

/**
 * Personal Access Tokens Settings Page
 *
 * User-level settings page for managing API authentication tokens.
 * Located at /settings/tokens
 */
export default function TokensSettingsPage() {
  const createToken = useCreateToken();

  const handleCreateToken = async (name: string) => {
    const result = await createToken.mutateAsync({ name });
    return {
      token: result.token,
      preview: result.preview,
    };
  };

  return (
    <main className="container mx-auto py-10 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Personal Access Tokens</h1>
              <p className="text-sm text-muted-foreground">
                Manage tokens for API authentication
              </p>
            </div>
          </div>
          <CreateTokenDialog
            onCreateToken={handleCreateToken}
            isCreating={createToken.isPending}
          />
        </div>

        {/* Description */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            Personal access tokens allow external tools like MCP servers, CLI applications,
            and CI pipelines to authenticate with the ai-board API. Tokens grant the same
            permissions as your user account.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the <code className="rounded bg-muted px-1 py-0.5 text-xs">Authorization: Bearer pat_xxx...</code> header
            to authenticate API requests.
          </p>
        </div>

        {/* Token List */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">Your Tokens</h2>
          <TokenList />
        </div>
      </div>
    </main>
  );
}
