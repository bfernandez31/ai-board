'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export interface RetroSpecJobDto {
  id: number;
  projectId: number;
  agent: string;
  command: 'RETRO_SPEC';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  depth: string | null;
  docUrl: string | null;
  workflowRunId: number | null;
  errorMessage: string | null;
  artifactSummary: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface RetroSpecPollResult {
  job: RetroSpecJobDto | null;
  configSyncedAt: string | null;
}

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED']);

export interface UseRetroSpecPollingReturn {
  job: RetroSpecJobDto | null;
  isGenerating: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  error: Error | null;
}

export function useRetroSpecPolling(
  projectId: number,
  pollingInterval: number = 2000
): UseRetroSpecPollingReturn {
  const { data, error } = useQuery({
    queryKey: queryKeys.projects.retroSpecJob(projectId),
    queryFn: async (): Promise<RetroSpecPollResult> => {
      const response = await fetch(
        `/api/projects/${projectId}/setup/jobs?command=RETRO_SPEC`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const result = query.state.data;
      if (!result?.job) return pollingInterval;

      // Stop polling on terminal statuses
      if (TERMINAL_STATUSES.has(result.job.status)) return false;

      return pollingInterval;
    },
    refetchIntervalInBackground: true,
  });

  const job = data?.job ?? null;
  const status = job?.status;

  return {
    job,
    isGenerating: status === 'PENDING' || status === 'RUNNING',
    isCompleted: status === 'COMPLETED',
    isFailed: status === 'FAILED',
    error: error as Error | null,
  };
}
