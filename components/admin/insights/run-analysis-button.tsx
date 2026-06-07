'use client';

import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { insightsReportsQueryKey } from '@/app/lib/hooks/queries/use-insights-reports';
import { insightsPreflightQueryKey } from '@/app/lib/hooks/queries/use-insights-preflight';
import type { ReportListEntry } from '@/app/lib/insights/repository';

interface PreflightShape {
  canTrigger: boolean;
  refusal: { refusalCode: string; message: string } | null;
}

interface RunAnalysisButtonProps {
  preflight: PreflightShape;
  /** Disable when the most-recent visible row is RUNNING — the API would
   *  refuse with ALREADY_RUNNING, but disabling avoids the round trip. */
  latestIsRunning: boolean;
  retryPeriod?: { periodStart: string; periodEnd: string };
}

// Shared across every <RunAnalysisButton/> instance so the header and the
// FAILED-row retry button cannot fire concurrent POSTs (each instance has its
// own useMutation otherwise). `useIsMutating` returns >0 while any instance
// keyed with this same array is in flight.
const TRIGGER_MUTATION_KEY = ['admin', 'insights', 'trigger'] as const;

interface TriggerResponse {
  id: number;
  status: 'RUNNING';
  createdAt: string;
}

interface RefusalResponse {
  refusalCode: string;
  message: string;
}

interface OptimisticContext {
  previousReports: ReportListEntry[] | undefined;
}

const OPTIMISTIC_ID = -1;

function buildOptimisticEntry(
  now: Date,
  retryPeriod?: { periodStart: string; periodEnd: string }
): ReportListEntry {
  const iso = now.toISOString();
  return {
    id: OPTIMISTIC_ID,
    status: 'RUNNING',
    generatedAt: iso,
    // Retries reuse the failed report's exact window — the server uses these
    // same values, so showing `now → now` until the refetch is misleading.
    periodStart: retryPeriod?.periodStart ?? iso,
    periodEnd: retryPeriod?.periodEnd ?? iso,
    sessionsCount: null,
    expectedSessionsCount: null,
    ticketsCount: null,
    artifactSize: null,
    errorReason: null,
    completedAt: null,
    createdAt: iso,
    workflowRunId: null,
    githubActionsUrl: null,
  };
}

export function RunAnalysisButton({
  preflight,
  latestIsRunning,
  retryPeriod,
}: RunAnalysisButtonProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const mutation = useMutation<TriggerResponse, Error, void, OptimisticContext>({
    mutationKey: TRIGGER_MUTATION_KEY,
    mutationFn: async () => {
      const response = await fetch('/api/admin/insights/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retryPeriod ?? {}),
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
    onMutate: async () => {
      // Constitution: mutations require an optimistic update so the user
      // sees their click reflected instantly. We prepend a tentative RUNNING
      // row that the success/error handler then reconciles with the server.
      await queryClient.cancelQueries({ queryKey: insightsReportsQueryKey });
      const previousReports = queryClient.getQueryData<ReportListEntry[]>(
        insightsReportsQueryKey
      );
      queryClient.setQueryData<ReportListEntry[]>(
        insightsReportsQueryKey,
        (current) => [
          buildOptimisticEntry(new Date(), retryPeriod),
          ...(current ?? []),
        ]
      );
      return { previousReports };
    },
    onSuccess: () => {
      setMessage(null);
      void queryClient.invalidateQueries({ queryKey: insightsReportsQueryKey });
      void queryClient.invalidateQueries({ queryKey: insightsPreflightQueryKey });
    },
    onError: (error, _vars, context) => {
      if (context?.previousReports !== undefined) {
        queryClient.setQueryData(
          insightsReportsQueryKey,
          context.previousReports
        );
      }
      void queryClient.invalidateQueries({ queryKey: insightsPreflightQueryKey });
      setMessage(error instanceof Error ? error.message : 'Unknown error');
    },
  });

  // >0 if either button instance is mid-POST. Prevents two optimistic
  // RUNNING rows briefly appearing if both buttons are clicked in quick
  // succession (the DB partial-unique index already prevents corruption).
  const triggerInFlight = useIsMutating({ mutationKey: TRIGGER_MUTATION_KEY }) > 0;
  const disabled =
    mutation.isPending ||
    triggerInFlight ||
    latestIsRunning ||
    preflight.canTrigger === false;
  const reason = preflight.refusal?.message ?? null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={disabled}
        aria-disabled={disabled}
      >
        {mutation.isPending ? 'Starting…' : retryPeriod ? 'Retry analysis' : 'Run new analysis'}
      </Button>
      {message ? (
        <p className="text-xs text-destructive">{message}</p>
      ) : reason ? (
        <p className="text-xs text-muted-foreground">{reason}</p>
      ) : null}
    </div>
  );
}
