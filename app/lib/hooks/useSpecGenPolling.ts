'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export interface SpecGenJobDto {
  id: number;
  projectId: number;
  agent: string;
  depth: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  workflowRunId: number | null;
  errorMessage: string | null;
  artifactSummary: Record<string, unknown> | null;
  documentationUrl: string | null;
  additionalContext: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface SpecGenPollResult {
  job: SpecGenJobDto | null;
  specsGeneratedAt: string | null;
}

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED']);

export interface UseSpecGenPollingReturn {
  job: SpecGenJobDto | null;
  specsGeneratedAt: string | null;
  isPolling: boolean;
  error: Error | null;
}

export function useSpecGenPolling(
  projectId: number,
  pollingInterval: number = 2000
): UseSpecGenPollingReturn {
  const { data, error, isFetching } = useQuery({
    queryKey: queryKeys.projects.specGenJob(projectId),
    queryFn: async (): Promise<SpecGenPollResult> => {
      const response = await fetch(`/api/projects/${projectId}/spec-generation/jobs`, {
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

      // Stop polling when specsGeneratedAt is set
      if (result.specsGeneratedAt) return false;

      // Stop polling on terminal status
      if (result.job && TERMINAL_STATUSES.has(result.job.status)) return false;

      return pollingInterval;
    },
    refetchIntervalInBackground: true,
  });

  const job = data?.job ?? null;
  const specsGeneratedAt = data?.specsGeneratedAt ?? null;
  const isTerminal = job ? TERMINAL_STATUSES.has(job.status) : false;
  const isPolling = isFetching || (!isTerminal && !specsGeneratedAt);

  return {
    job,
    specsGeneratedAt,
    isPolling,
    error: error as Error | null,
  };
}
