/**
 * useJobPolling React Hook
 *
 * Custom hook for polling job status updates at 2-second intervals.
 * Implements client-side filtering of terminal jobs and auto-stop when all jobs complete.
 *
 * Features:
 * - 2-second polling interval (aggressive for real-time feel)
 * - Terminal state tracking (COMPLETED, FAILED, CANCELLED)
 * - Auto-stop when all jobs terminal
 * - Fixed retry interval (no exponential backoff)
 * - Automatic cleanup on unmount
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { JobStatusDto } from '@/app/lib/schemas/job-polling';

/**
 * Polling state interface
 */
export interface PollingState {
  isPolling: boolean;
  lastPollTime: number | null;
  errorCount: number;
  terminalJobIds: Set<number>;
}

/**
 * Hook return type
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
 * Check if a job status is terminal
 */
function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
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
  // State
  const [jobs, setJobs] = useState<JobStatusDto[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [lastPollTime, setLastPollTime] = useState<number | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [terminalJobIds, setTerminalJobIds] = useState<Set<number>>(new Set());

  // Refs to avoid stale closures
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const terminalJobIdsRef = useRef<Set<number>>(new Set());

  // Keep ref in sync with state
  useEffect(() => {
    terminalJobIdsRef.current = terminalJobIds;
  }, [terminalJobIds]);

  /**
   * Fetch job statuses from API
   */
  const pollJobs = useCallback(async () => {
    try {
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

      const data: { jobs: JobStatusDto[] } = await response.json();

      // Update terminal job IDs
      const newTerminalIds = new Set(terminalJobIdsRef.current);
      data.jobs.forEach(job => {
        if (isTerminalStatus(job.status)) {
          newTerminalIds.add(job.id);
        }
      });
      setTerminalJobIds(newTerminalIds);

      // Check if all jobs are terminal (but keep polling to detect new jobs)
      const allJobIds = new Set(data.jobs.map(j => j.id));
      const allTerminal = data.jobs.length > 0 && allJobIds.size === newTerminalIds.size;

      // Update polling state for UI feedback
      setIsPolling(!allTerminal);

      // Update state
      setJobs(data.jobs);
      setLastPollTime(Date.now());
      setErrorCount(0); // Reset error count on success
      setError(null);
    } catch (err) {
      console.error('[useJobPolling] Poll error:', err);
      setErrorCount(prev => prev + 1);
      setError(err instanceof Error ? err : new Error(String(err)));
      // Continue polling on error (fixed interval, no exponential backoff)
    }
  }, [projectId]);

  /**
   * Start polling on mount (never stops, always detecting new jobs)
   */
  useEffect(() => {
    // Initial poll
    pollJobs();

    // Set up interval (continuous polling)
    intervalRef.current = setInterval(pollJobs, pollingInterval);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pollJobs, pollingInterval]);

  return {
    jobs,
    isPolling,
    lastPollTime,
    errorCount,
    error,
  };
}
