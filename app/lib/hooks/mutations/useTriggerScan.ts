'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { HealthScanType } from '@prisma/client';

interface TriggerScanParams {
  projectId: number;
  scanType: HealthScanType;
}

export function useTriggerScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, scanType }: TriggerScanParams) => {
      const response = await fetch(`/api/projects/${projectId}/health/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanType }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.health.score(variables.projectId),
      });
    },
  });
}
