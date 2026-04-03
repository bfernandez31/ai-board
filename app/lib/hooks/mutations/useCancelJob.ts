'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

interface CancelJobResponse {
  id: number;
  status: string;
  completedAt: string | null;
}

/**
 * Cancel a running or pending job via POST /api/jobs/:id/cancel
 *
 * @param projectId - Project ID for cache invalidation
 */
export function useCancelJob(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: number): Promise<CancelJobResponse> => {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel job');
      }

      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.jobsStatus(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(projectId),
      });
    },
  });
}
