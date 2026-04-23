import { useQuery } from '@tanstack/react-query';
import type { LogRetrievalResponse } from '@/lib/types/log-types';

/**
 * Fetch job logs from API
 */
async function fetchJobLogs(jobId: number, signal?: AbortSignal): Promise<LogRetrievalResponse> {
  const response = await fetch(`/api/jobs/${jobId}/logs`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch job logs');
  }

  return response.json();
}

/**
 * useJobLogs Hook
 * Fetch and manage job execution logs
 */
export function useJobLogs(jobId: number | null, options?: {
  enabled?: boolean;
  refetchInterval?: number;
  retry?: number;
}) {
  return useQuery<LogRetrievalResponse, Error>({
    queryKey: ['jobLogs', jobId],
    queryFn: ({ signal }) => {
      if (!jobId) {
        throw new Error('Job ID is required');
      }
      return fetchJobLogs(jobId, signal);
    },
    enabled: options?.enabled !== false && !!jobId,
    refetchInterval: options?.refetchInterval,
    retry: options?.retry ?? 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Fetch log preview from API
 */
async function fetchLogPreview(jobId: number, signal?: AbortSignal): Promise<{
  previewContent: string;
  hasFullLogs: boolean;
  errorCount: number;
  warningCount: number;
}> {
  const response = await fetch(`/api/jobs/${jobId}/logs/preview`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch log preview');
  }

  return response.json();
}

/**
 * useLogPreview Hook
 * Fetch log preview data for inline display
 */
export function useLogPreview(jobId: number | null, options?: {
  enabled?: boolean;
  refetchInterval?: number;
}) {
  return useQuery<{
    previewContent: string;
    hasFullLogs: boolean;
    errorCount: number;
    warningCount: number;
  }, Error>({
    queryKey: ['logPreview', jobId],
    queryFn: ({ signal }) => {
      if (!jobId) {
        throw new Error('Job ID is required');
      }
      return fetchLogPreview(jobId, signal);
    },
    enabled: options?.enabled !== false && !!jobId,
    refetchInterval: options?.refetchInterval,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Check if logs exist for a job
 */
export async function checkLogsExist(jobId: number): Promise<boolean> {
  try {
    const response = await fetch(`/api/jobs/${jobId}/logs`, {
      method: 'HEAD',
    });
    return response.ok;
  } catch {
    return false;
  }
}