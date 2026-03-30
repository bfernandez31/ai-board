'use client';

import { useQuery } from '@tanstack/react-query';
import type { QualityGateDetails } from '@/lib/health/quality-gate';

export function useQualityGateDetails(projectId: number, enabled: boolean) {
  return useQuery<QualityGateDetails>({
    queryKey: ['health', 'quality-gate', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/health/quality-gate`);
      if (!res.ok) throw new Error('Failed to fetch quality gate details');
      return res.json();
    },
    enabled,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
}
