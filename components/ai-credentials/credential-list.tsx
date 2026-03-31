"use client";

import { AI_CREDENTIAL_PROVIDER_LABELS, AI_CREDENTIAL_TYPE_LABELS, type UserAiCredentialSummary } from '@/lib/ai-credentials/types';

interface CredentialListProps {
  credentials: UserAiCredentialSummary[];
}

function getStatusLabel(status: UserAiCredentialSummary['readinessStatus']): string {
  switch (status) {
    case 'READY':
      return 'Ready';
    case 'ACTION_REQUIRED':
      return 'Action required';
    case 'PENDING_VERIFICATION':
      return 'Pending verification';
    default:
      return status;
  }
}

function getStatusClassName(status: UserAiCredentialSummary['readinessStatus']): string {
  switch (status) {
    case 'READY':
      return 'bg-primary/10 text-primary';
    case 'ACTION_REQUIRED':
      return 'bg-destructive/10 text-destructive';
    case 'PENDING_VERIFICATION':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function CredentialList({ credentials }: CredentialListProps) {
  if (credentials.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No AI credentials saved yet. Add your Anthropic credential to enable AI workflows.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border divide-y">
      {credentials.map((credential) => (
        <div
          key={`${credential.provider}-${credential.credentialType}`}
          className="flex items-start justify-between gap-4 p-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{credential.label}</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                ...{credential.maskedPreview}
              </code>
            </div>
            <p className="text-sm text-muted-foreground">
              {AI_CREDENTIAL_PROVIDER_LABELS[credential.provider]} •{' '}
              {AI_CREDENTIAL_TYPE_LABELS[credential.credentialType]}
            </p>
            {credential.lastVerificationMessage ? (
              <p className="text-sm text-muted-foreground">
                {credential.lastVerificationMessage}
              </p>
            ) : null}
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClassName(
              credential.readinessStatus
            )}`}
          >
            {getStatusLabel(credential.readinessStatus)}
          </span>
        </div>
      ))}
    </div>
  );
}
