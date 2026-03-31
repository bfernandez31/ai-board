import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  DeleteAiCredentialResponse,
  UpsertAiCredentialInput,
  UserAiCredentialSummary,
} from '@/lib/ai-credentials/types';
import { AiCredentialProvider } from '@/lib/ai-credentials/types';

interface ListAiCredentialsResponse {
  credentials: UserAiCredentialSummary[];
}

interface ApiError {
  error: string;
  code?: string;
  message?: string | null;
}

async function parseAiCredentialResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  if (!response.ok) {
    const errorData = (await response.json()) as ApiError;
    throw new Error(errorData.message || errorData.error || fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export function useAiCredentials(): UseQueryResult<ListAiCredentialsResponse, Error> {
  return useQuery<ListAiCredentialsResponse, Error>({
    queryKey: queryKeys.aiCredentials.all,
    queryFn: async () => {
      const response = await fetch('/api/settings/ai-credentials', {
        credentials: 'include',
      });

      return parseAiCredentialResponse<ListAiCredentialsResponse>(
        response,
        'Failed to fetch AI credentials'
      );
    },
  });
}

export function useSaveAiCredential(): UseMutationResult<
  { credential: UserAiCredentialSummary },
  Error,
  UpsertAiCredentialInput
> {
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

      return parseAiCredentialResponse<{ credential: UserAiCredentialSummary }>(
        response,
        'Failed to save AI credential'
      );
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiCredentials.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.aiCredentials.provider(variables.provider),
      });
    },
  });
}

export function useDeleteAiCredential(
  provider: AiCredentialProvider
): UseMutationResult<DeleteAiCredentialResponse, Error, void> {
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

      return parseAiCredentialResponse<DeleteAiCredentialResponse>(
        response,
        'Failed to delete AI credential'
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiCredentials.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.aiCredentials.provider(provider),
      });
    },
  });
}
