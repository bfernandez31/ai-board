'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect, useMemo } from 'react';
import { queryKeys } from '@/app/lib/query-keys';
import { isTerminalStatus } from '@/app/lib/schemas/job-polling';
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
  const trackedJobIdsRef = useRef<Set<number>>(new Set());

  const { data, error, isFetching, dataUpdatedAt, failureCount } = useQuery({
    queryKey: queryKeys.projects.jobsStatus(projectId),
    queryFn: async () => {
      const trackedJobIds = Array.from(trackedJobIdsRef.current).sort((a, b) => a - b);
      const searchParams = new URLSearchParams();
      if (trackedJobIds.length > 0) {
        searchParams.set('jobIds', trackedJobIds.join(','));
      }

      const response = await fetch(
        `/api/projects/${projectId}/jobs/status${searchParams.size > 0 ? `?${searchParams.toString()}` : ''}`,
        {
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: { jobs: JobStatusDto[] } = await response.json();
      for (const job of result.jobs) {
        trackedJobIdsRef.current.add(job.id);
      }
      return result.jobs;
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    // Fast poll (2s) when active jobs exist, slow poll (30s) when idle.
    // Slow idle poll detects new jobs starting without wasting requests.
    refetchInterval: (query) => {
      const jobs = query.state.data || [];
      const hasActiveJobs = jobs.some((job) => job.status === 'PENDING' || job.status === 'RUNNING');
      return hasActiveJobs ? pollingInterval : 30000;
    },
    refetchIntervalInBackground: true,
    enabled: true,
  });

  const jobs = useMemo(() => data || [], [data]);
  const hasActiveJobs = jobs.some((job) => job.status === 'PENDING' || job.status === 'RUNNING');

  // With tracked job IDs, terminal jobs stay in the response instead of disappearing,
  // so we detect transitions by comparing previous vs current status.
  useEffect(() => {
    if (previousJobsRef.current.length === 0 && jobs.length > 0) {
      previousJobsRef.current = jobs;
      return;
    }

    const previousById = new Map(previousJobsRef.current.map(j => [j.id, j]));

    const newlyTerminalJobs = jobs.filter(job => {
      const prev = previousById.get(job.id);
      return prev && !isTerminalStatus(prev.status) && isTerminalStatus(job.status);
    });

    // Safety net: rare with tracked IDs
    const currentIds = new Set(jobs.map(j => j.id));
    const disappearedJobs = previousJobsRef.current.filter(
      prev => !currentIds.has(prev.id)
    );

    const jobsToInvalidate = [...newlyTerminalJobs, ...disappearedJobs];

    if (jobsToInvalidate.length > 0) {
      console.log('[useJobPolling] Jobs reached terminal state:', jobsToInvalidate.map(j => `${j.id}(${j.status})`));
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(projectId),
        exact: true,
      });

      const ticketIds = new Set(jobsToInvalidate.map(j => j.ticketId));
      for (const ticketId of ticketIds) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.ticketJobs(projectId, ticketId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.ticket(projectId, ticketId),
        });
      }
    }

    for (const job of jobsToInvalidate) {
      trackedJobIdsRef.current.delete(job.id);
    }

    previousJobsRef.current = jobs;
  }, [jobs, projectId, queryClient]);

  return {
    jobs,
    isPolling: isFetching || hasActiveJobs,
    lastPollTime: dataUpdatedAt || null,
    errorCount: failureCount,
    error,
  };
}
