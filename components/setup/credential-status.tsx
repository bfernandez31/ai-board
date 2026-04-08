'use client';

import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export type CredentialState = 'loading' | 'available' | 'unavailable';

interface CredentialStatusProps {
  state: CredentialState;
  guidance?: string | undefined;
}

export function CredentialStatus({ state, guidance }: CredentialStatusProps) {
  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking credential availability...</span>
      </div>
    );
  }

  if (state === 'available') {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-500">
        <CheckCircle2 className="h-4 w-4" />
        <span>Credential ready</span>
      </div>
    );
  }

  return (
    <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
      <XCircle className="h-4 w-4" />
      <AlertDescription className="text-sm">
        {guidance || 'No credential configured for this agent. Add one in Settings → Credentials.'}
      </AlertDescription>
    </Alert>
  );
}
