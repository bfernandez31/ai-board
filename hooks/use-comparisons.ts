'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  ComparisonCheckResult,
  ComparisonDetail,
  ComparisonSummary,
} from '@/lib/types/comparison';

const DEFAULT_QUERY_OPTIONS = {
  refetchOnWindowFocus: false,
} as const;

const SHORT_STALE_TIME_MS = 30_000;
const DEFAULT_GC_TIME_MS = 5 * 60 * 1000;
const DETAIL_STALE_TIME_MS = 5 * 60 * 1000;
const DETAIL_GC_TIME_MS = 30 * 60 * 1000;

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

function getComparisonDetailQueryKey(
  projectId: number,
  ticketId: number,
  comparisonId: number | null
) {
  if (comparisonId == null) {
    return [...comparisonKeys.ticket(projectId, ticketId, 10), 'no-detail'] as const;
  }

  return comparisonKeys.detail(projectId, ticketId, comparisonId);
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
    staleTime: SHORT_STALE_TIME_MS,
    gcTime: DEFAULT_GC_TIME_MS,
    ...DEFAULT_QUERY_OPTIONS,
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
    staleTime: SHORT_STALE_TIME_MS,
    gcTime: DEFAULT_GC_TIME_MS,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

export function useComparisonDetail(
  projectId: number,
  ticketId: number,
  comparisonId: number | null,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: getComparisonDetailQueryKey(projectId, ticketId, comparisonId),
    queryFn: async (): Promise<ComparisonDetail> =>
      fetchJson<ComparisonDetail>(
        `/api/projects/${projectId}/tickets/${ticketId}/comparisons/${comparisonId}`,
        'Failed to fetch comparison detail'
      ),
    enabled: enabled && projectId > 0 && ticketId > 0 && comparisonId != null,
    staleTime: DETAIL_STALE_TIME_MS,
    gcTime: DETAIL_GC_TIME_MS,
    ...DEFAULT_QUERY_OPTIONS,
  });
}
