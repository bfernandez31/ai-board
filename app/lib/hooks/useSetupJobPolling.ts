'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export interface SetupJobDto {
  id: number;
  projectId: number;
  agent: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  workflowRunId: number | null;
  errorMessage: string | null;
  artifactSummary: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface SetupJobPollResult {
  job: SetupJobDto | null;
  configSyncedAt: string | null;
}

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED']);

export interface UseSetupJobPollingReturn {
  job: SetupJobDto | null;
  configSyncedAt: string | null;
  isPolling: boolean;
  error: Error | null;
}

export function useSetupJobPolling(
  projectId: number,
  pollingInterval: number = 2000
): UseSetupJobPollingReturn {
  const { data, error, isFetching } = useQuery({
    queryKey: queryKeys.projects.setupJob(projectId),
    queryFn: async (): Promise<SetupJobPollResult> => {
      const response = await fetch(`/api/projects/${projectId}/setup/jobs`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const result = query.state.data;
      if (!result) return pollingInterval;

      // Stop polling when configSyncedAt is set (setup complete)
      if (result.configSyncedAt) return false;

      // Stop polling when job is in terminal state
      if (result.job && TERMINAL_STATUSES.has(result.job.status)) return false;

      return pollingInterval;
    },
    refetchIntervalInBackground: true,
  });

  const job = data?.job ?? null;
  const configSyncedAt = data?.configSyncedAt ?? null;
  const isTerminal = job ? TERMINAL_STATUSES.has(job.status) : false;
  const isPolling = isFetching || (!isTerminal && !configSyncedAt);

  return {
    job,
    configSyncedAt,
    isPolling,
    error: error as Error | null,
  };
}
