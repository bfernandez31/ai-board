'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export interface JobLogReadable {
  captureStatus: 'CAPTURED' | 'UNAVAILABLE' | 'PRUNED';
  preview: string;
  schemaVersion: number;
  eventCount: number;
  errorCount: number;
  artifactSize: number | null;
  capturedAt: string;
  rawUrl: string | null;
}

export function useJobLog(
  projectId: number,
  ticketId: number,
  jobId: number,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.projects.jobLog(projectId, ticketId, jobId),
    queryFn: async (): Promise<JobLogReadable> => {
      const res = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/jobs/${jobId}/logs`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch log summary: HTTP ${res.status}`);
      }
      return res.json();
    },
    enabled,
    staleTime: 5_000,
    gcTime: 10 * 60 * 1000,
  });
}
