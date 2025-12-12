/**
 * TanStack Query Hook for Constitution Fetching and Mutation
 *
 * Provides query and mutation hooks for fetching and updating
 * constitution content with caching, loading states, and error handling.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  ConstitutionContent,
  ConstitutionNotFound,
  ConstitutionUpdateRequest,
  ConstitutionUpdateResponse,
} from '@/lib/types/constitution';

/**
 * Fetch constitution content from API
 *
 * @param projectId - Project ID
 * @returns Promise resolving to ConstitutionContent
 * @throws Error if fetch fails or file not found
 */
async function fetchConstitution(projectId: number): Promise<ConstitutionContent> {
  const res = await fetch(`/api/projects/${projectId}/constitution`);

  if (!res.ok) {
    const errorData = await res.json();
    // Preserve not found status for handling in component
    if (res.status === 404) {
      const notFound = errorData as ConstitutionNotFound;
      const error = new Error(notFound.error || 'Constitution file not found');
      (error as Error & { notFound: boolean }).notFound = true;
      throw error;
    }
    throw new Error(errorData.error || 'Failed to fetch constitution');
  }

  return res.json();
}

/**
 * Update constitution content via API
 *
 * @param projectId - Project ID
 * @param data - Update request with content and optional commit message
 * @returns Promise resolving to ConstitutionUpdateResponse
 * @throws Error if update fails
 */
async function updateConstitution(
  projectId: number,
  data: ConstitutionUpdateRequest
): Promise<ConstitutionUpdateResponse> {
  const res = await fetch(`/api/projects/${projectId}/constitution`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to update constitution');
  }

  return res.json();
}

/**
 * Hook for fetching constitution content
 *
 * Provides caching, loading states, and error handling via TanStack Query.
 * Only fetches when enabled=true (lazy loading).
 *
 * @param projectId - Project ID
 * @param enabled - Whether to enable the query (default: false for lazy loading)
 * @returns Query result with data, loading, and error states
 *
 * @example
 * const { data, isLoading, error } = useConstitution(1, true);
 * // Handle not found case
 * if (error && (error as any).notFound) {
 *   // Show empty state
 * }
 */
export function useConstitution(projectId: number, enabled: boolean = false) {
  return useQuery({
    queryKey: queryKeys.projects.constitution(projectId),
    queryFn: () => fetchConstitution(projectId),
    enabled, // Lazy: only fetch when modal opens
    staleTime: 5 * 60 * 1000, // 5 minutes (constitution rarely changes within session)
    gcTime: 30 * 60 * 1000, // 30 minutes (keep in cache longer than default)
    refetchOnWindowFocus: false, // Avoid unnecessary GitHub API calls
    retry: (failureCount, error) => {
      // Don't retry on 404 (file not found)
      if ((error as Error & { notFound?: boolean }).notFound) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook for updating constitution content
 *
 * Provides mutation with optimistic updates and cache invalidation.
 *
 * @returns Mutation result with mutate function and loading/error states
 *
 * @example
 * const mutation = useConstitutionMutation(1);
 * await mutation.mutateAsync({ content: '# Updated Constitution' });
 */
export function useConstitutionMutation(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ConstitutionUpdateRequest) => updateConstitution(projectId, data),
    onSuccess: () => {
      // Invalidate constitution query to refetch fresh data
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.constitution(projectId),
      });
      // Also invalidate history since a new commit was created
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.constitutionHistory(projectId),
      });
    },
  });
}
