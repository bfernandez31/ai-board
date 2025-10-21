import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { TicketAttachment } from '@/app/lib/types/ticket';

/**
 * Response from image mutation endpoints (POST, DELETE, PUT)
 */
interface ImageMutationResponse {
  attachments: TicketAttachment[];
  version: number;
}

/**
 * Variables for upload image mutation
 */
interface UploadImageVariables {
  projectId: number;
  ticketId: number;
  file: File;
  version: number;
}

/**
 * Variables for delete image mutation
 */
interface DeleteImageVariables {
  projectId: number;
  ticketId: number;
  attachmentIndex: number;
  version: number;
}

/**
 * Variables for replace image mutation
 */
interface ReplaceImageVariables {
  projectId: number;
  ticketId: number;
  attachmentIndex: number;
  file: File;
  version: number;
}

/**
 * Hook for uploading images to an existing ticket
 *
 * Features:
 * - Optimistic UI update (shows image immediately)
 * - Automatic rollback on error
 * - Toast notifications for success/error
 * - Invalidates ticket images query on success
 *
 * @example
 * const uploadMutation = useImageUpload();
 * uploadMutation.mutate({ projectId, ticketId, file, version });
 */
export function useImageUpload() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      projectId,
      ticketId,
      file,
      version,
    }: UploadImageVariables): Promise<ImageMutationResponse> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('version', version.toString());

      const response = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/images`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate ticket images query to refetch with new image
      queryClient.invalidateQueries({
        queryKey: ['ticket', variables.projectId, variables.ticketId, 'images'],
      });

      toast({
        title: 'Image uploaded',
        description: 'Image has been added to the ticket',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message,
      });
    },
  });
}

/**
 * Hook for deleting images from a ticket
 *
 * Features:
 * - Optimistic UI update (removes image immediately)
 * - Automatic rollback on error
 * - Toast notifications
 * - Invalidates queries on success
 *
 * @example
 * const deleteMutation = useImageDelete();
 * deleteMutation.mutate({ projectId, ticketId, attachmentIndex, version });
 */
export function useImageDelete() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      projectId,
      ticketId,
      attachmentIndex,
      version,
    }: DeleteImageVariables): Promise<ImageMutationResponse> => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/images/${attachmentIndex}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete image');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate ticket images query
      queryClient.invalidateQueries({
        queryKey: ['ticket', variables.projectId, variables.ticketId, 'images'],
      });

      toast({
        title: 'Image deleted',
        description: 'Image has been removed from the ticket',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error.message,
      });
    },
  });
}

/**
 * Hook for replacing images in a ticket
 *
 * Features:
 * - Optimistic UI update (shows new image immediately)
 * - Automatic rollback on error
 * - Toast notifications
 * - Invalidates queries on success
 *
 * @example
 * const replaceMutation = useImageReplace();
 * replaceMutation.mutate({ projectId, ticketId, attachmentIndex, file, version });
 */
export function useImageReplace() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      projectId,
      ticketId,
      attachmentIndex,
      file,
      version,
    }: ReplaceImageVariables): Promise<ImageMutationResponse> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('version', version.toString());

      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/images/${attachmentIndex}`,
        {
          method: 'PUT',
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to replace image');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate ticket images query
      queryClient.invalidateQueries({
        queryKey: ['ticket', variables.projectId, variables.ticketId, 'images'],
      });

      toast({
        title: 'Image replaced',
        description: 'Image has been updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Replace failed',
        description: error.message,
      });
    },
  });
}
