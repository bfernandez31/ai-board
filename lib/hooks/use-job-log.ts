/**
 * TanStack Query hook for fetching the captured execution log of a Job.
 *
 * Lazily loaded — only fires when `enabled` flips to true (typically when
 * the user opens the log dialog). Full content can be hundreds of KB, so
 * we keep it out of the normal ticket-jobs payload.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export interface JobLogResponse {
  jobId: number;
  command: string;
  status: string;
  log: {
    id: number;
    content: string;
    summary: string | null;
    truncated: boolean;
    byteSize: number;
    eventCount: number;
    agent: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

async function fetchJobLog(
  projectId: number,
  ticketId: number,
  jobId: number
): Promise<JobLogResponse> {
  const res = await fetch(
    `/api/projects/${projectId}/tickets/${ticketId}/jobs/${jobId}/logs`
  );
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    if (res.status === 404) {
      throw new Error(errorData.error || 'No log captured for this job');
    }
    throw new Error(errorData.error || 'Failed to fetch job log');
  }
  return res.json();
}

export function useJobLog(
  projectId: number,
  ticketId: number,
  jobId: number,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: queryKeys.projects.jobLog(projectId, ticketId, jobId),
    queryFn: () => fetchJobLog(projectId, ticketId, jobId),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
