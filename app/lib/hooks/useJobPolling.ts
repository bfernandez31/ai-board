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
    // Fast poll (2s) when active jobs exist, slow poll (30s) when idle.
    // Slow idle poll detects new jobs starting without wasting requests.
    refetchInterval: (query) => {
      const jobs = query.state.data || [];
      return jobs.length > 0 ? pollingInterval : 30000;
    },
    refetchIntervalInBackground: true,
    enabled: true,
  });

  const jobs = useMemo(() => data || [], [data]);
  const hasActiveJobs = jobs.length > 0;

  // Detect job completion by tracking jobs that disappear from the active-only response.
  // The API only returns PENDING/RUNNING jobs, so a previously-seen job that's no longer
  // in the response has transitioned to a terminal status.
  useEffect(() => {
    if (previousJobsRef.current.length === 0 && jobs.length > 0) {
      previousJobsRef.current = jobs;
      return;
    }

    const currentIds = new Set(jobs.map(j => j.id));
    const disappearedJobs = previousJobsRef.current.filter(
      prev => !currentIds.has(prev.id)
    );

    if (disappearedJobs.length > 0) {
      console.log('[useJobPolling] Jobs completed:', disappearedJobs.map(j => j.id));
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(projectId),
      });

      for (const job of disappearedJobs) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.ticketJobs(projectId, job.ticketId),
        });
      }
    }

    previousJobsRef.current = jobs;
  }, [jobs, projectId, queryClient]);

  return {
    jobs,
    isPolling: isFetching || hasActiveJobs,
    lastPollTime: dataUpdatedAt || null,
    errorCount: failureCount,
    error: error as Error | null,
  };
}
