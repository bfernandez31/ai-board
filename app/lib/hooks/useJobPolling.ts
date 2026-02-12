'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect, useMemo } from 'react';
import { queryKeys } from '@/app/lib/query-keys';
import type { JobStatusDto } from '@/app/lib/schemas/job-polling';

export interface UseJobPollingReturn {
  jobs: JobStatusDto[];
  isPolling: boolean;
  lastPollTime: number | null;
  errorCount: number;
  error: Error | null;
}

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

function areAllJobsTerminal(jobs: JobStatusDto[]): boolean {
  if (jobs.length === 0) return false;
  return jobs.every(job => TERMINAL_STATUSES.has(job.status));
}

export function useJobPolling(
  projectId: number,
  pollingInterval: number = 2000
): UseJobPollingReturn {
  const queryClient = useQueryClient();
  const previousJobsRef = useRef<JobStatusDto[]>([]);

  const { data, error, isFetching, dataUpdatedAt, failureCount } = useQuery({
    queryKey: queryKeys.projects.jobsStatus(projectId),
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/jobs/status`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: { jobs: JobStatusDto[] } = await response.json();
      return result.jobs;
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const jobs = query.state.data || [];
      return areAllJobsTerminal(jobs) ? false : pollingInterval;
    },
    refetchIntervalInBackground: true,
    enabled: true,
  });

  const jobs = useMemo(() => data || [], [data]);
  const allTerminal = areAllJobsTerminal(jobs);

  useEffect(() => {
    if (previousJobsRef.current.length === 0 && jobs.length > 0) {
      previousJobsRef.current = jobs;
      return;
    }

    const newlyTerminal = jobs.filter(job => {
      const isTerminal = TERMINAL_STATUSES.has(job.status);
      const wasTerminal = previousJobsRef.current.some(
        prev => prev.id === job.id && TERMINAL_STATUSES.has(prev.status)
      );
      return isTerminal && !wasTerminal;
    });

    if (newlyTerminal.length > 0) {
      console.log('[useJobPolling] Detected terminal jobs:', newlyTerminal);
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(projectId),
      });

      for (const job of newlyTerminal) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.ticketJobs(projectId, job.ticketId),
        });
      }
    }

    previousJobsRef.current = jobs;
  }, [jobs, projectId, queryClient]);

  return {
    jobs,
    isPolling: isFetching || !allTerminal,
    lastPollTime: dataUpdatedAt || null,
    errorCount: failureCount,
    error: error as Error | null,
  };
}
