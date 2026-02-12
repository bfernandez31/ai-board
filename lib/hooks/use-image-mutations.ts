import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { TicketAttachment } from '@/app/lib/types/ticket';

interface ImageMutationResponse {
  attachments: TicketAttachment[];
  version: number;
}

interface UploadImageVariables {
  projectId: number;
  ticketId: number;
  file: File;
  version: number;
}

interface DeleteImageVariables {
  projectId: number;
  ticketId: number;
  attachmentIndex: number;
  version: number;
}

interface ReplaceImageVariables {
  projectId: number;
  ticketId: number;
  attachmentIndex: number;
  file: File;
  version: number;
}

function invalidateTicketImageQueries(
  queryClient: QueryClient,
  projectId: number,
  ticketId: number
): void {
  queryClient.invalidateQueries({
    queryKey: ['ticket', projectId, ticketId, 'images'],
  });
  queryClient.invalidateQueries({
    queryKey: ['ticket', projectId, ticketId],
  });
}

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
      invalidateTicketImageQueries(queryClient, variables.projectId, variables.ticketId);
      toast({ title: 'Image uploaded', description: 'Image has been added to the ticket' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message });
    },
  });
}

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
      invalidateTicketImageQueries(queryClient, variables.projectId, variables.ticketId);
      toast({ title: 'Image deleted', description: 'Image has been removed from the ticket' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Delete failed', description: error.message });
    },
  });
}

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
      invalidateTicketImageQueries(queryClient, variables.projectId, variables.ticketId);
      toast({ title: 'Image replaced', description: 'Image has been updated successfully' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Replace failed', description: error.message });
    },
  });
}
