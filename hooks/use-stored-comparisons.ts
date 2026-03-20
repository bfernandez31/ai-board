'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  StoredComparisonListResponse,
  EnrichedComparison,
} from '@/lib/types/stored-comparison';

export const storedComparisonKeys = {
  all: ['stored-comparisons'] as const,
  project: (projectId: number) => ['stored-comparisons', projectId] as const,
  ticket: (projectId: number, ticketKey: string) =>
    ['stored-comparisons', projectId, ticketKey] as const,
  detail: (projectId: number, id: number) =>
    ['stored-comparisons', projectId, 'detail', id] as const,
};

async function fetchStoredComparisons(
  projectId: number,
  ticketKey?: string,
  limit: number = 20
): Promise<StoredComparisonListResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (ticketKey) params.set('ticketKey', ticketKey);

  const res = await fetch(
    `/api/projects/${projectId}/comparisons/stored?${params}`
  );
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to fetch stored comparisons');
  }
  return res.json();
}

async function fetchEnrichedComparison(
  projectId: number,
  comparisonId: number
): Promise<EnrichedComparison> {
  const res = await fetch(
    `/api/projects/${projectId}/comparisons/stored/${comparisonId}`
  );
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to fetch comparison detail');
  }
  return res.json();
}

export function useStoredComparisons(
  projectId: number,
  ticketKey?: string,
  limit: number = 20,
  enabled: boolean = true
) {
  return useQuery<StoredComparisonListResponse>({
    queryKey: ticketKey
      ? storedComparisonKeys.ticket(projectId, ticketKey)
      : storedComparisonKeys.project(projectId),
    queryFn: () => fetchStoredComparisons(projectId, ticketKey, limit),
    enabled: enabled && projectId > 0,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useEnrichedComparison(
  projectId: number,
  comparisonId: number,
  enabled: boolean = true
) {
  return useQuery<EnrichedComparison>({
    queryKey: storedComparisonKeys.detail(projectId, comparisonId),
    queryFn: () => fetchEnrichedComparison(projectId, comparisonId),
    enabled: enabled && projectId > 0 && comparisonId > 0,
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
