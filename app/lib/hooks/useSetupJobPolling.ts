'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export interface SetupJobDto {
  id: number;
  projectId: number;
  agent: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  workflowRunId: number | null;
  partial: boolean;
  commitSha: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  logs: string | null;
  artifactSummary: {
    created: Array<{ path: string; kind: string; reason?: string }>;
    preserved: Array<{ path: string; kind: string; reason?: string }>;
    missing: Array<{ path: string; kind: string; reason?: string }>;
    analysisPath?: string;
    partialReason?: string;
  } | null;
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
  pollingInterval: number = 2000,
  initialData?: SetupJobPollResult
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
    initialData,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const result = query.state.data;
      if (!result) {
        return pollingInterval;
      }

      if (result.configSyncedAt) {
        return false;
      }

      const hasFailedJob = result.job?.status === 'FAILED';
      if (hasFailedJob) {
        return false;
      }

      return pollingInterval;
    },
    refetchIntervalInBackground: true,
  });

  const job = data?.job ?? null;
  const configSyncedAt = data?.configSyncedAt ?? null;
  const isTerminal = job ? TERMINAL_STATUSES.has(job.status) : false;
  const shouldPoll = !isTerminal && !configSyncedAt;
  const isPolling = isFetching || shouldPoll;

  return {
    job,
    configSyncedAt,
    isPolling,
    error: error as Error | null,
  };
}
