/**
 * TanStack Query Hooks for Constitution History and Diff
 *
 * Provides query hooks for fetching commit history and diffs
 * with caching, loading states, and error handling.
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  ConstitutionHistoryResponse,
  ConstitutionDiffResponse,
} from '@/lib/types/constitution';

/**
 * Fetch commit history for constitution file
 *
 * @param projectId - Project ID
 * @returns Promise resolving to ConstitutionHistoryResponse
 * @throws Error if fetch fails
 */
async function fetchConstitutionHistory(
  projectId: number
): Promise<ConstitutionHistoryResponse> {
  const res = await fetch(`/api/projects/${projectId}/constitution/history`);

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to fetch constitution history');
  }

  return res.json();
}

/**
 * Hook for fetching constitution commit history
 *
 * Provides caching, loading states, and error handling via TanStack Query.
 * Only fetches when enabled=true (lazy loading).
 *
 * @param projectId - Project ID
 * @param enabled - Whether to enable the query (default: false for lazy loading)
 * @returns Query result with commits array, loading, and error states
 *
 * @example
 * const { data, isLoading, error } = useConstitutionHistory(
 *   1,
 *   true // fetch when View History button clicked
 * );
 */
export function useConstitutionHistory(projectId: number, enabled: boolean = false) {
  return useQuery({
    queryKey: queryKeys.projects.constitutionHistory(projectId),
    queryFn: () => fetchConstitutionHistory(projectId),
    enabled, // Lazy: only fetch when View History clicked
    staleTime: 30 * 1000, // 30 seconds (history may change with new commits)
    gcTime: 5 * 60 * 1000, // 5 minutes (keep in cache)
    refetchOnWindowFocus: true, // Refetch on focus to catch new commits
    retry: 2, // Retry twice for resilience against GitHub API errors
  });
}

/**
 * Fetch diff for a specific commit
 *
 * @param projectId - Project ID
 * @param sha - Commit SHA to fetch diff for
 * @returns Promise resolving to ConstitutionDiffResponse
 * @throws Error if fetch fails
 */
async function fetchConstitutionDiff(
  projectId: number,
  sha: string
): Promise<ConstitutionDiffResponse> {
  const res = await fetch(
    `/api/projects/${projectId}/constitution/diff?sha=${sha}`
  );

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to fetch constitution diff');
  }

  return res.json();
}

/**
 * Hook for fetching diff for a specific commit
 *
 * Provides caching, loading states, and error handling via TanStack Query.
 * Only fetches when enabled=true and SHA is provided.
 *
 * @param projectId - Project ID
 * @param sha - Commit SHA to fetch diff for (null when no commit selected)
 * @returns Query result with files array, loading, and error states
 *
 * @example
 * const { data, isLoading, error } = useConstitutionDiff(
 *   1,
 *   'abc123...' // SHA from selected commit
 * );
 */
export function useConstitutionDiff(projectId: number, sha: string | null) {
  return useQuery({
    queryKey: queryKeys.projects.constitutionDiff(projectId, sha || ''),
    queryFn: () => fetchConstitutionDiff(projectId, sha!),
    enabled: !!sha, // Only fetch when SHA is selected
    staleTime: Infinity, // Commits are immutable, cache forever
    gcTime: 30 * 60 * 1000, // 30 minutes (keep diffs in cache longer)
    refetchOnWindowFocus: false, // No need to refetch (commits are immutable)
    retry: 2, // Retry twice for resilience
  });
}
