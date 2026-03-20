'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  ComparisonCheckResult,
  ComparisonDetail,
  ComparisonSummary,
} from '@/lib/types/comparison';

export const comparisonKeys = {
  all: ['comparisons'] as const,
  project: (projectId: number) => ['comparisons', projectId] as const,
  ticket: (projectId: number, ticketId: number, limit: number) =>
    ['comparisons', projectId, ticketId, 'history', limit] as const,
  check: (projectId: number, ticketId: number) =>
    ['comparisons', projectId, ticketId, 'check'] as const,
  detail: (projectId: number, ticketId: number, comparisonId: number) =>
    ['comparisons', projectId, ticketId, 'detail', comparisonId] as const,
};

interface ComparisonListResponse {
  comparisons: ComparisonSummary[];
  total: number;
  limit: number;
}

async function fetchJson<T>(url: string, fallbackMessage: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || fallbackMessage);
  }

  return response.json();
}

export function useComparisonCheck(
  projectId: number,
  ticketId: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: comparisonKeys.check(projectId, ticketId),
    queryFn: () =>
      fetchJson<ComparisonCheckResult>(
        `/api/projects/${projectId}/tickets/${ticketId}/comparisons/check`,
        'Failed to check comparisons'
      ),
    enabled: enabled && projectId > 0 && ticketId > 0,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useComparisonList(
  projectId: number,
  ticketId: number,
  limit: number = 10,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: comparisonKeys.ticket(projectId, ticketId, limit),
    queryFn: () =>
      fetchJson<ComparisonListResponse>(
        `/api/projects/${projectId}/tickets/${ticketId}/comparisons?limit=${limit}`,
        'Failed to fetch comparison history'
      ),
    enabled: enabled && projectId > 0 && ticketId > 0,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useComparisonDetail(
  projectId: number,
  ticketId: number,
  comparisonId: number | null,
  enabled: boolean = false
) {
  return useQuery({
    queryKey:
      comparisonId == null
        ? [...comparisonKeys.ticket(projectId, ticketId, 10), 'no-detail']
        : comparisonKeys.detail(projectId, ticketId, comparisonId),
    queryFn: () =>
      fetchJson<ComparisonDetail>(
        `/api/projects/${projectId}/tickets/${ticketId}/comparisons/${comparisonId}`,
        'Failed to fetch comparison detail'
      ),
    enabled: enabled && projectId > 0 && ticketId > 0 && comparisonId != null,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
