import { useQuery } from '@tanstack/react-query';
import type { JobLogResponse } from '@/lib/logs/types';

async function fetchJobLogs(jobId: number): Promise<JobLogResponse> {
  const res = await fetch(`/api/jobs/${jobId}/logs`);
  if (!res.ok) {
    throw new Error(`Failed to fetch logs: ${res.status}`);
  }
  return res.json();
}

export function useJobLogs(jobId: number, enabled: boolean) {
  return useQuery<JobLogResponse>({
    queryKey: ['job-logs', jobId],
    queryFn: () => fetchJobLogs(jobId),
    enabled,
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  });
}
