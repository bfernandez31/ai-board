"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteTokenDialog } from "./delete-token-dialog";
import { useDeleteToken, type TokenListItem } from "@/lib/hooks/mutations/useTokens";

interface TokenItemProps {
  token: TokenListItem;
}

export function TokenItem({ token }: TokenItemProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteToken = useDeleteToken();

  const handleDelete = async () => {
    await deleteToken.mutateAsync(token.id);
    setDeleteDialogOpen(false);
  };

  const createdAt = new Date(token.createdAt);
  const lastUsedAt = token.lastUsedAt ? new Date(token.lastUsedAt) : null;

  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{token.name}</span>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
            ...{token.preview}
          </code>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>Created {formatDistanceToNow(createdAt, { addSuffix: true })}</span>
          {lastUsedAt ? (
            <span>Last used {formatDistanceToNow(lastUsedAt, { addSuffix: true })}</span>
          ) : (
            <span>Never used</span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setDeleteDialogOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">Delete token</span>
      </Button>
      <DeleteTokenDialog
        tokenName={token.name}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        isDeleting={deleteToken.isPending}
      />
    </div>
  );
}
