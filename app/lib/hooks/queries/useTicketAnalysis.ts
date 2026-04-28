'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { SerializedAnalysisDTO } from '@/lib/analysis/serialize';

export interface AnalysisEligibility {
  triggerable: boolean;
  estimatedCostUsd: { lower: number; upper: number };
  rateLimit: {
    limitPerHour: number;
    remaining: number;
    nextResetAt: string | null;
  };
}

export interface AnalysisQueryResult {
  latest: SerializedAnalysisDTO | null;
  eligibility: AnalysisEligibility;
}

export function useTicketAnalysis(
  projectId: number,
  ticketId: number | null,
  enabled: boolean = true
) {
  const queryClient = useQueryClient();
  const previousStatusRef = useRef<string | null>(null);

  const query = useQuery<AnalysisQueryResult>({
    queryKey: queryKeys.projects.analysis(projectId, ticketId ?? 0),
    queryFn: async () => {
      const res = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/analysis`,
        { method: 'GET' }
      );
      if (!res.ok) {
        throw new Error(`Failed to load analysis: HTTP ${res.status}`);
      }
      return res.json();
    },
    enabled: enabled && ticketId !== null,
    refetchInterval: (q) => {
      const data = q.state.data as AnalysisQueryResult | undefined;
      return data?.latest?.status === 'running' ? 2000 : false;
    },
    staleTime: 5_000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    const current = query.data?.latest?.status ?? null;
    const prev = previousStatusRef.current;
    if (prev === 'running' && current && current !== 'running') {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.analysis(projectId, ticketId ?? 0),
      });
    }
    previousStatusRef.current = current;
  }, [query.data?.latest?.status, projectId, ticketId, queryClient]);

  return query;
}
