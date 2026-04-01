"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteCredentialDialog } from "./delete-credential-dialog";
import { CredentialTestButton } from "./credential-test-button";
import {
  useDeleteCredential,
  type CredentialListItem,
} from "@/lib/hooks/mutations/useCredentials";

interface CredentialItemProps {
  credential: CredentialListItem;
}

function readinessBadgeVariant(status: string) {
  switch (status) {
    case "READY":
      return "default" as const;
    case "ACTION_REQUIRED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function readinessLabel(status: string) {
  switch (status) {
    case "READY":
      return "Ready";
    case "ACTION_REQUIRED":
      return "Action Required";
    case "PENDING_VERIFICATION":
      return "Pending";
    default:
      return status;
  }
}

function typeLabel(type: string) {
  return type === "API_KEY" ? "API Key" : "OAuth Token";
}

export function CredentialItem({ credential }: CredentialItemProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteCredential = useDeleteCredential();

  const handleDelete = async () => {
    await deleteCredential.mutateAsync(credential.id);
    setDeleteDialogOpen(false);
  };

  const createdAt = new Date(credential.createdAt);

  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{credential.label}</span>
          <Badge variant="outline" className="text-xs">
            {credential.provider}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {typeLabel(credential.credentialType)}
          </Badge>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
            ...{credential.preview}
          </code>
          <Badge variant={readinessBadgeVariant(credential.readinessStatus)}>
            {readinessLabel(credential.readinessStatus)}
          </Badge>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>Created {formatDistanceToNow(createdAt, { addSuffix: true })}</span>
          {credential.verificationMessage && (
            <span>{credential.verificationMessage}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <CredentialTestButton credentialId={credential.id} />
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete credential</span>
        </Button>
      </div>
      <DeleteCredentialDialog
        credentialLabel={credential.label}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        isDeleting={deleteCredential.isPending}
      />
    </div>
  );
}
