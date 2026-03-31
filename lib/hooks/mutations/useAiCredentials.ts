import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  DeleteAiCredentialResponse,
  UpsertAiCredentialInput,
  UserAiCredentialSummary,
} from '@/lib/ai-credentials/types';

interface ListAiCredentialsResponse {
  credentials: UserAiCredentialSummary[];
}

interface ApiError {
  error: string;
  code?: string;
  message?: string | null;
}

export function useAiCredentials() {
  return useQuery<ListAiCredentialsResponse, Error>({
    queryKey: queryKeys.aiCredentials.all,
    queryFn: async () => {
      const response = await fetch('/api/settings/ai-credentials', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.error || 'Failed to fetch AI credentials');
      }

      return response.json();
    },
  });
}

export function useSaveAiCredential() {
  const queryClient = useQueryClient();

  return useMutation<
    { credential: UserAiCredentialSummary },
    Error,
    UpsertAiCredentialInput
  >({
    mutationFn: async ({ provider, ...body }) => {
      const response = await fetch(
        `/api/settings/ai-credentials/${provider.toLowerCase()}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.message || errorData.error || 'Failed to save AI credential');
      }

      return response.json();
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiCredentials.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.aiCredentials.provider(variables.provider),
      });
    },
  });
}

export function useDeleteAiCredential(provider: string) {
  const queryClient = useQueryClient();

  return useMutation<DeleteAiCredentialResponse, Error, void>({
    mutationFn: async () => {
      const response = await fetch(
        `/api/settings/ai-credentials/${provider.toLowerCase()}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.message || errorData.error || 'Failed to delete AI credential');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiCredentials.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.aiCredentials.provider(provider),
      });
    },
  });
}
