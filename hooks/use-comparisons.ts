'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ComparisonCheckResult,
  ComparisonDetail,
  ComparisonLaunchRequest,
  ComparisonSummary,
  ProjectComparisonCandidatesResponse,
  ProjectComparisonListResponse,
} from '@/lib/types/comparison';

const DEFAULT_QUERY_OPTIONS = {
  refetchOnWindowFocus: false,
} as const;

const SHORT_STALE_TIME_MS = 30_000;
const DEFAULT_GC_TIME_MS = 5 * 60 * 1000;
const DETAIL_STALE_TIME_MS = 5 * 60 * 1000;
const DETAIL_GC_TIME_MS = 30 * 60 * 1000;
const JOB_POLL_INTERVAL_MS = 2_000;

export const comparisonKeys = {
  all: ['comparisons'] as const,
  project: (projectId: number) => ['comparisons', projectId] as const,
  projectList: (projectId: number, page: number, pageSize: number) =>
    ['comparisons', projectId, 'project-history', page, pageSize] as const,
  projectInfiniteList: (projectId: number, pageSize: number) =>
    ['comparisons', projectId, 'project-infinite', pageSize] as const,
  projectDetail: (projectId: number, comparisonId: number | null) =>
    ['comparisons', projectId, 'project-detail', comparisonId ?? 'none'] as const,
  projectCandidates: (projectId: number) => ['comparisons', projectId, 'candidates'] as const,
  projectJobs: (projectId: number, pendingJobIds: number[]) =>
    ['comparisons', projectId, 'launch-jobs', ...pendingJobIds.slice().sort((a, b) => a - b)] as const,
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

interface ProjectJobsStatusResponse {
  jobs: Array<{
    id: number;
    status: ComparisonLaunchRequest['status'];
    ticketId: number;
    command: string;
    updatedAt: string;
  }>;
}

async function fetchJson<T>(
  url: string,
  fallbackMessage: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, init);
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
    queryFn: () =>
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

export function useProjectComparisonList(
  projectId: number,
  page: number,
  pageSize: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: comparisonKeys.projectList(projectId, page, pageSize),
    queryFn: () =>
      fetchJson<ProjectComparisonListResponse>(
        `/api/projects/${projectId}/comparisons?page=${page}&pageSize=${pageSize}`,
        'Failed to fetch project comparison history'
      ),
    enabled: enabled && projectId > 0,
    staleTime: SHORT_STALE_TIME_MS,
    gcTime: DEFAULT_GC_TIME_MS,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

export function useProjectComparisonInfiniteList(
  projectId: number,
  pageSize: number,
  enabled: boolean = true
) {
  return useInfiniteQuery({
    queryKey: comparisonKeys.projectInfiniteList(projectId, pageSize),
    queryFn: ({ pageParam }) =>
      fetchJson<ProjectComparisonListResponse>(
        `/api/projects/${projectId}/comparisons?page=${pageParam}&pageSize=${pageSize}`,
        'Failed to fetch project comparison history'
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: enabled && projectId > 0,
    staleTime: SHORT_STALE_TIME_MS,
    gcTime: DEFAULT_GC_TIME_MS,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

export function useProjectComparisonDetail(
  projectId: number,
  comparisonId: number | null,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: comparisonKeys.projectDetail(projectId, comparisonId),
    queryFn: () =>
      fetchJson<ComparisonDetail>(
        `/api/projects/${projectId}/comparisons/${comparisonId}`,
        'Failed to fetch project comparison detail'
      ),
    enabled: enabled && projectId > 0 && comparisonId != null,
    staleTime: DETAIL_STALE_TIME_MS,
    gcTime: DETAIL_GC_TIME_MS,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

export function useProjectComparisonCandidates(projectId: number, enabled: boolean = true) {
  return useQuery({
    queryKey: comparisonKeys.projectCandidates(projectId),
    queryFn: () =>
      fetchJson<ProjectComparisonCandidatesResponse>(
        `/api/projects/${projectId}/comparisons/candidates`,
        'Failed to fetch comparison candidates'
      ),
    enabled: enabled && projectId > 0,
    staleTime: SHORT_STALE_TIME_MS,
    gcTime: DEFAULT_GC_TIME_MS,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

export function useProjectComparisonLaunch(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketIds: number[]) =>
      fetchJson<ComparisonLaunchRequest>(
        `/api/projects/${projectId}/comparisons/launch`,
        'Failed to launch comparison',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ticketIds }),
        }
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: comparisonKeys.projectCandidates(projectId) }),
        queryClient.invalidateQueries({ queryKey: comparisonKeys.project(projectId) }),
      ]);
    },
  });
}

export function useProjectComparisonPendingJobs(
  projectId: number,
  pendingJobIds: number[],
  enabled: boolean = true
) {
  return useQuery({
    queryKey: comparisonKeys.projectJobs(projectId, pendingJobIds),
    queryFn: async () => {
      const response = await fetchJson<ProjectJobsStatusResponse>(
        `/api/projects/${projectId}/jobs/status`,
        'Failed to fetch comparison job status'
      );

      return response.jobs.filter((job) => pendingJobIds.includes(job.id));
    },
    enabled: enabled && projectId > 0 && pendingJobIds.length > 0,
    staleTime: 0,
    gcTime: DEFAULT_GC_TIME_MS,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((job) => job.status === 'PENDING' || job.status === 'RUNNING')
        ? JOB_POLL_INTERVAL_MS
        : false,
    refetchIntervalInBackground: true,
    ...DEFAULT_QUERY_OPTIONS,
  });
}
