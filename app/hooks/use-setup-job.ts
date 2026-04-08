'use client';

import { useQuery } from '@tanstack/react-query';
import type { SetupJobStatus } from '@prisma/client';

export interface SetupJobData {
  id: number;
  projectId: number;
  selectedAgent: 'CLAUDE' | 'CODEX';
  status: SetupJobStatus;
  isPartial: boolean;
  completedFiles: string[];
  errorMessage: string | null;
  workflowRunId: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface SetupJobStatusResponse {
  setupJob: SetupJobData | null;
  hasConfig: boolean;
}

/**
 * TanStack Query hook for polling setup job status.
 * Polls every 2s while a job is active (PENDING/RUNNING).
 */
export function useSetupJob(projectId: number | undefined, enabled: boolean = true) {
  return useQuery<SetupJobStatusResponse>({
    queryKey: ['setup-job', projectId],
    queryFn: async () => {
      if (!projectId) {
        return { setupJob: null, hasConfig: false };
      }

      const response = await fetch(`/api/projects/${projectId}/setup`);
      if (!response.ok) {
        throw new Error('Failed to fetch setup job status');
      }
      return response.json();
    },
    enabled: enabled && projectId !== undefined,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.setupJob) return false;
      const status = data.setupJob.status;
      // Only poll while active
      return status === 'PENDING' || status === 'RUNNING' ? 2000 : false;
    },
    refetchIntervalInBackground: false,
    staleTime: 1000,
  });
}
