'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

interface CancelJobResponse {
  id: number;
  status: string;
  completedAt: string | null;
}

/**
 * Cancel a PENDING or RUNNING job.
 * Optimistically updates the job status in the cache.
 */
export function useCancelJob(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: number): Promise<CancelJobResponse> => {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel job');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate job status and ticket queries so UI reflects the cancellation
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.jobsStatus(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) });
    },
  });
}
