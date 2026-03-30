'use client';

import { useQuery } from '@tanstack/react-query';
import type { LastCleanDetails } from '@/lib/health/last-clean';

export function useLastCleanDetails(projectId: number, enabled: boolean) {
  return useQuery<LastCleanDetails>({
    queryKey: ['health', 'last-clean', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/health/last-clean`);
      if (!res.ok) throw new Error('Failed to fetch last clean details');
      return res.json();
    },
    enabled,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
}
