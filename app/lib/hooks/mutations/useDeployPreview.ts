'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

/**
 * Deploy Preview Response from API
 */
interface DeployPreviewResponse {
  job: {
    id: number;
    ticketId: number;
    projectId: number;
    command: string;
    status: string;
    branch: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  message: string;
}

/**
 * Mutation variables for deploy preview
 */
interface DeployPreviewVariables {
  /** Ticket ID to deploy */
  ticketId: number;
}

/**
 * Trigger Vercel preview deployment for a ticket
 *
 * Features:
 * - Creates deployment job with PENDING status
 * - Dispatches GitHub Actions workflow
 * - Clears existing preview URLs in project (single-preview enforcement)
 * - Invalidates tickets and jobs queries on success
 * - Type-safe mutation variables
 *
 * Eligibility Requirements (validated by API):
 * - Ticket must be in VERIFY stage
 * - Ticket must have a branch
 * - Latest job must have COMPLETED status
 *
 * @param projectId - Project ID for the ticket
 * @returns Mutation hook for deploying preview
 *
 * @example
 * ```tsx
 * const { mutate: deployPreview, isPending } = useDeployPreview(projectId);
 *
 * const handleDeploy = () => {
 *   deployPreview({ ticketId: 123 });
 * };
 * ```
 */
export function useDeployPreview(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: DeployPreviewVariables): Promise<DeployPreviewResponse> => {
      const { ticketId } = variables;

      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/deploy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to trigger deployment');
      }

      return response.json();
    },

    // No optimistic update needed - deployment is async via GitHub Actions
    // Job polling will update UI when job status changes

    // Error handling
    onError: (error) => {
      console.error('[useDeployPreview] Error:', error);
    },

    // Invalidate and refetch after success
    onSuccess: () => {
      // Invalidate tickets to show cleared preview URLs (single-preview enforcement)
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(projectId),
      });
      // Invalidate jobs to show newly created deployment job
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.jobsStatus(projectId),
      });
    },
  });
}
