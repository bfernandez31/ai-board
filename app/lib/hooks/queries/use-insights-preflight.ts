'use client';

import { useQuery } from '@tanstack/react-query';

export interface InsightsPreflight {
  canTrigger: boolean;
  shippedSincePreviousRun: number;
  previousRunEnd: string | null;
  runningSince: string | null;
  refusal: {
    refusalCode: 'NO_CLAUDE_JOBS' | 'NO_NEW_SHIPPED' | 'ALREADY_RUNNING';
    message: string;
  } | null;
}

const QUERY_KEY = ['admin', 'insights', 'preflight'] as const;

/**
 * Live preflight gate for the "Run new analysis" button. Polls every 15s
 * while a RUNNING report is visible (the same cadence as the report list
 * polling) so the button re-enables automatically once a run finishes and
 * the `shippedSincePreviousRun` counter rolls forward. SSR provides the
 * first value via `initialData`.
 */
export function useInsightsPreflight(
  initialData: InsightsPreflight,
  pollWhileRunning: boolean
) {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<InsightsPreflight> => {
      const response = await fetch('/api/admin/insights/preflight', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch preflight: HTTP ${response.status}`);
      }
      return (await response.json()) as InsightsPreflight;
    },
    initialData,
    refetchInterval: pollWhileRunning ? 15_000 : false,
    staleTime: 0,
  });
}

export const insightsPreflightQueryKey = QUERY_KEY;
