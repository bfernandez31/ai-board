'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ComparisonDetail } from '@/lib/types/comparison';

const DEFAULT_QUERY_OPTIONS = {
  refetchOnWindowFocus: false,
} as const;

const SHORT_STALE_TIME_MS = 30_000;
const DEFAULT_GC_TIME_MS = 5 * 60 * 1000;
const DETAIL_STALE_TIME_MS = 5 * 60 * 1000;
const DETAIL_GC_TIME_MS = 30 * 60 * 1000;

export const projectComparisonKeys = {
  all: ['comparisons', 'project'] as const,
  list: (projectId: number, limit: number, offset: number) =>
    ['comparisons', 'project', projectId, limit, offset] as const,
  detail: (projectId: number, comparisonId: number) =>
    ['comparisons', 'project', projectId, 'detail', comparisonId] as const,
  verifyTickets: (projectId: number) =>
    ['tickets', 'verify', projectId] as const,
};

export interface ProjectComparisonSummary {
  id: number;
  generatedAt: string;
  sourceTicketKey: string;
  sourceTicketTitle: string;
  winnerTicketKey: string;
  winnerTicketTitle: string;
  winnerScore: number;
  participantCount: number;
  participantTicketKeys: string[];
  summary: string;
  keyDifferentiators: string[];
}

interface ProjectComparisonsResponse {
  comparisons: ProjectComparisonSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface VerifyStageTicket {
  id: number;
  ticketKey: string;
  title: string;
  branch: string | null;
}

interface VerifyStageTicketsResponse {
  tickets: VerifyStageTicket[];
}

interface LaunchComparisonResponse {
  jobId: number;
  status: string;
  sourceTicketKey: string;
  participantTicketKeys: string[];
}

async function fetchJson<T>(url: string, fallbackMessage: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || fallbackMessage);
  }
  return response.json();
}

export function useProjectComparisons(
  projectId: number,
  limit: number = 20,
  offset: number = 0,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: projectComparisonKeys.list(projectId, limit, offset),
    queryFn: () =>
      fetchJson<ProjectComparisonsResponse>(
        `/api/projects/${projectId}/comparisons?limit=${limit}&offset=${offset}`,
        'Failed to fetch comparisons'
      ),
    enabled: enabled && projectId > 0,
    staleTime: SHORT_STALE_TIME_MS,
    gcTime: DEFAULT_GC_TIME_MS,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

export function useProjectComparisonDetail(
  projectId: number,
  comparisonId: number | null
) {
  return useQuery({
    queryKey: comparisonId != null
      ? projectComparisonKeys.detail(projectId, comparisonId)
      : ['comparisons', 'project', projectId, 'no-detail'],
    queryFn: () =>
      fetchJson<ComparisonDetail>(
        `/api/projects/${projectId}/comparisons/${comparisonId}`,
        'Failed to fetch comparison detail'
      ),
    enabled: projectId > 0 && comparisonId != null,
    staleTime: DETAIL_STALE_TIME_MS,
    gcTime: DETAIL_GC_TIME_MS,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

export function useVerifyStageTickets(
  projectId: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: projectComparisonKeys.verifyTickets(projectId),
    queryFn: () =>
      fetchJson<VerifyStageTicketsResponse>(
        `/api/projects/${projectId}/tickets/verify`,
        'Failed to fetch VERIFY-stage tickets'
      ),
    enabled: enabled && projectId > 0,
    staleTime: SHORT_STALE_TIME_MS,
    gcTime: DEFAULT_GC_TIME_MS,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

export function useLaunchComparison(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketIds }: { ticketIds: number[] }) => {
      const response = await fetch(`/api/projects/${projectId}/comparisons/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to launch comparison');
      }

      return response.json() as Promise<LaunchComparisonResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: projectComparisonKeys.all,
      });
    },
  });
}
