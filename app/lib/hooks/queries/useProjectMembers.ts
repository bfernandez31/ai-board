/**
 * TanStack Query hook for fetching project members
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { GetProjectMembersResponse } from '@/app/api/projects/[projectId]/members/route';

/**
 * Fetch project members from API
 *
 * @param projectId - Project ID to fetch members for
 * @returns Promise resolving to GetProjectMembersResponse
 */
async function fetchProjectMembers(projectId: number): Promise<GetProjectMembersResponse> {
  const response = await fetch(`/api/projects/${projectId}/members`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch project members');
  }

  return response.json();
}

/**
 * Hook to fetch project members for autocomplete dropdown
 *
 * @param projectId - Project ID to fetch members for
 * @returns TanStack Query result with members data
 *
 * @example
 * const { data, isLoading, error } = useProjectMembers(projectId);
 *
 * if (isLoading) return <div>Loading members...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 *
 * return <UserAutocomplete users={data.members} />;
 */
export function useProjectMembers(projectId: number) {
  return useQuery({
    queryKey: queryKeys.projects.members(projectId),
    queryFn: () => fetchProjectMembers(projectId),
    staleTime: 5 * 60 * 1000, // 5 minutes (members don't change often)
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection time
    enabled: !!projectId, // Only run if projectId exists
  });
}
