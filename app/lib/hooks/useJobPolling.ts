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

  // Detect when previously seen jobs stop being returned. This should now be rare because
  // tracked job IDs keep terminal jobs visible, but invalidation remains as a safety net
  // and refreshes richer ticket/job payloads after workflow completion.
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
