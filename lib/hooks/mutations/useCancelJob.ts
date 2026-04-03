'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

interface CancelJobResponse {
  id: number;
  status: string;
  completedAt: string | null;
  alreadyTerminal?: boolean;
}

export function useCancelJob(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<CancelJobResponse, Error, number>({
    mutationFn: async (jobId: number) => {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel job');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.jobsStatus(projectId) });
    },
    retry: false,
  });
}
