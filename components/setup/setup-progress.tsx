'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SetupJobStatus } from '@prisma/client';

interface SetupProgressProps {
  status: SetupJobStatus;
  startedAt: string | null;
  errorMessage: string | null;
  onRetry?: (() => void) | undefined;
}

export function SetupProgress({ status, startedAt, errorMessage, onRetry }: SetupProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== 'RUNNING' || !startedAt) {
      setElapsed(0);
      return;
    }

    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status, startedAt]);

  if (status === 'PENDING') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border p-4">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="text-sm font-medium text-foreground">Queued</div>
          <div className="text-xs text-muted-foreground">Waiting for workflow to start...</div>
        </div>
      </div>
    );
  }

  if (status === 'RUNNING') {
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    return (
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <div className="text-sm font-medium text-foreground">Setting up project...</div>
          <div className="text-xs text-muted-foreground">
            Detecting tech stack and generating configuration — {timeStr}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'COMPLETED') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        <div>
          <div className="text-sm font-medium text-foreground">Setup complete</div>
          <div className="text-xs text-muted-foreground">
            Project configuration has been committed and synced.
          </div>
        </div>
      </div>
    );
  }

  // FAILED
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <XCircle className="h-5 w-5 text-destructive" />
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">Setup failed</div>
          <div className="text-xs text-muted-foreground">
            {errorMessage || 'An unexpected error occurred during setup.'}
          </div>
        </div>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry Setup
        </Button>
      )}
    </div>
  );
}
