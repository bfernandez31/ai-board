import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { EditDocumentationRequest, EditDocumentationResponse } from '@/app/lib/schemas/documentation';

/**
 * Parameters for the edit documentation mutation
 */
interface EditDocumentationParams {
  projectId: number;
  ticketId: number;
  docType: 'spec' | 'plan' | 'tasks';
  content: string;
  commitMessage?: string;
}

/**
 * TanStack Query mutation hook for editing documentation files
 *
 * Features:
 * - Optimistic updates to TanStack Query cache
 * - Automatic rollback on error
 * - Cache invalidation on success (refetch from server)
 * - Type-safe request/response handling
 *
 * @example
 * const mutation = useEditDocumentation();
 *
 * const handleSave = async () => {
 *   await mutation.mutateAsync({
 *     projectId: 1,
 *     ticketId: 42,
 *     docType: 'spec',
 *     content: '# Updated Spec\n\nNew content',
 *   });
 * };
 *
 * if (mutation.isError) {
 *   console.error('Save failed:', mutation.error);
 * }
 */
export function useEditDocumentation() {
  const queryClient = useQueryClient();

  return useMutation<EditDocumentationResponse, Error, EditDocumentationParams>({
    mutationFn: async (params: EditDocumentationParams) => {
      const { projectId, ticketId, docType, content, commitMessage } = params;

      const requestBody: EditDocumentationRequest = {
        ticketId,
        docType,
        content,
        commitMessage,
      };

      const response = await fetch(`/api/projects/${projectId}/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save documentation');
      }

      return response.json();
    },

    // Optimistic update: immediately show new content in UI
    onMutate: async (params) => {
      const { projectId, ticketId, docType, content } = params;
      const queryKey = queryKeys.projects.documentation(projectId, ticketId, docType);

      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previous = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, content);

      // Return context object with the snapshotted value
      return { previous, queryKey };
    },

    // On error: roll back to the previous value
    onError: (err, params, context) => {
      if (context?.queryKey && context.previous !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }

      console.error('[useEditDocumentation] Mutation failed:', {
        projectId: params.projectId,
        ticketId: params.ticketId,
        docType: params.docType,
        error: err.message,
      });
    },

    // On success: invalidate and refetch to confirm server state
    onSuccess: (data, params) => {
      const { projectId, ticketId, docType } = params;

      // Invalidate the query to trigger a refetch
      // This ensures the UI shows the actual content from the server (post-commit)
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.documentation(projectId, ticketId, docType),
      });

      console.log('[useEditDocumentation] Save successful:', {
        projectId,
        ticketId,
        docType,
        commitSha: data.commitSha,
      });
    },
  });
}
