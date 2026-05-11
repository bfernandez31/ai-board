'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { insightsReportsQueryKey } from '@/app/lib/hooks/queries/use-insights-reports';

interface PreflightShape {
  canTrigger: boolean;
  refusal: { refusalCode: string; message: string } | null;
}

interface RunAnalysisButtonProps {
  preflight: PreflightShape;
  /** Disable when the most-recent visible row is RUNNING — the API would
   *  refuse with ALREADY_RUNNING, but disabling avoids the round trip. */
  latestIsRunning: boolean;
}

interface TriggerResponse {
  id: number;
  status: 'RUNNING';
  createdAt: string;
}

interface RefusalResponse {
  refusalCode: string;
  message: string;
}

export function RunAnalysisButton({
  preflight,
  latestIsRunning,
}: RunAnalysisButtonProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (): Promise<TriggerResponse> => {
      const response = await fetch('/api/admin/insights/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (response.status === 201) {
        return (await response.json()) as TriggerResponse;
      }
      const body = (await response.json().catch(() => ({}))) as RefusalResponse;
      if (response.status === 409) {
        throw new Error(body.message ?? 'Cannot trigger right now');
      }
      if (response.status === 502) {
        throw new Error('Workflow dispatch failed. Try again in a moment.');
      }
      throw new Error(`Unexpected status ${response.status}`);
    },
    onSuccess: () => {
      setMessage(null);
      void queryClient.invalidateQueries({ queryKey: insightsReportsQueryKey });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Unknown error');
    },
  });

  const disabled =
    mutation.isPending || latestIsRunning || preflight.canTrigger === false;
  const reason = preflight.refusal?.message ?? null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={disabled}
        aria-disabled={disabled}
      >
        {mutation.isPending ? 'Starting…' : 'Run new analysis'}
      </Button>
      {message ? (
        <p className="text-xs text-destructive">{message}</p>
      ) : reason ? (
        <p className="text-xs text-muted-foreground">{reason}</p>
      ) : null}
    </div>
  );
}
