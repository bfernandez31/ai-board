/**
 * useJobPolling React Hook (TanStack Query implementation)
 *
 * Custom hook for polling job status updates at 2-second intervals.
 * Migrated to TanStack Query for better caching and deduplication.
 *
 * Features:
 * - 2-second polling interval (aggressive for real-time feel)
 * - Terminal state tracking (COMPLETED, FAILED, CANCELLED)
 * - Auto-stop when all jobs terminal
 * - Automatic retry logic via TanStack Query
 * - Automatic cleanup on unmount
 * - Request deduplication across components
 */

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';
import { queryKeys } from '@/app/lib/query-keys';
import type { JobStatusDto } from '@/app/lib/schemas/job-polling';

/**
 * Hook return type (matches previous interface for backward compatibility)
 */
export interface UseJobPollingReturn {
  jobs: JobStatusDto[];
  isPolling: boolean;
  lastPollTime: number | null;
  errorCount: number;
  error: Error | null;
}

/**
 * Terminal job statuses (no further state changes possible)
 */
const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

/**
 * Check if all jobs have reached terminal status
 */
function areAllJobsTerminal(jobs: JobStatusDto[]): boolean {
  if (jobs.length === 0) return false;
  return jobs.every(job => TERMINAL_STATUSES.has(job.status));
}

/**
 * useJobPolling hook
 *
 * @param projectId - Project ID to poll jobs for
 * @param pollingInterval - Polling interval in milliseconds (default: 2000ms)
 * @returns Job data and polling state
 */
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
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Disable caching for real-time data
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: { jobs: JobStatusDto[] } = await response.json();
      return result.jobs;
    },
    // Always fresh data for real-time polling
    staleTime: 0,
    // Keep in cache for 5 minutes after unmount
    gcTime: 5 * 60 * 1000,
    // Conditional polling: stop when all jobs terminal, otherwise poll at interval
    refetchInterval: (query) => {
      const jobs = query.state.data || [];
      const allTerminal = areAllJobsTerminal(jobs);
      // Return false to stop polling, or interval to continue
      return allTerminal ? false : pollingInterval;
    },
    // Continue polling even when tab is in background
    refetchIntervalInBackground: true,
    // Enable query by default
    enabled: true,
  });

  // Compute polling state for UI feedback
  const jobs = data || [];
  const allTerminal = areAllJobsTerminal(jobs);

  // Detect terminal status transitions and invalidate tickets cache
  useEffect(() => {
    // Skip on initial mount (no previous jobs to compare)
    if (previousJobsRef.current.length === 0 && jobs.length > 0) {
      previousJobsRef.current = jobs;
      return;
    }

    // Find jobs that transitioned to terminal status
    const newlyTerminal = jobs.filter(job => {
      const isTerminal = TERMINAL_STATUSES.has(job.status);
      const wasTerminal = previousJobsRef.current.some(
        prev => prev.id === job.id && TERMINAL_STATUSES.has(prev.status)
      );
      return isTerminal && !wasTerminal;
    });

    // Invalidate tickets cache when workflow completes
    if (newlyTerminal.length > 0) {
      console.log('[useJobPolling] Detected terminal jobs:', newlyTerminal);
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(projectId),
      });
    }

    // Update previous state for next comparison
    previousJobsRef.current = jobs;
  }, [jobs, projectId, queryClient]);

  return {
    jobs,
    // isPolling is true when fetching AND not all jobs terminal
    isPolling: isFetching || !allTerminal,
    // Last poll time from TanStack Query
    lastPollTime: dataUpdatedAt || null,
    // Error count from TanStack Query
    errorCount: failureCount,
    // Error from TanStack Query
    error: error as Error | null,
  };
}
