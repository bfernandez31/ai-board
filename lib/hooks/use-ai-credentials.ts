import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export type AiProvider = 'ANTHROPIC';
export type AiCredentialType = 'API_KEY' | 'OAUTH_TOKEN';

export interface AiCredentialListItem {
  id: number;
  provider: AiProvider;
  credentialType: AiCredentialType;
  label: string;
  preview: string;
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListAiCredentialsResponse {
  credentials: AiCredentialListItem[];
}

interface SaveAiCredentialInput {
  provider: AiProvider;
  credentialType: AiCredentialType;
  label: string;
  secret: string;
}

interface ValidateAiCredentialInput {
  provider: AiProvider;
  credentialType: AiCredentialType;
  secret: string;
}

interface ErrorResponse {
  error?: string;
}

async function parseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function getErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  const data = await parseJson<ErrorResponse>(response);
  return data.error || fallbackMessage;
}

function useInvalidateAiCredentials(): () => Promise<void> {
  const queryClient = useQueryClient();

  return function invalidateAiCredentials(): Promise<void> {
    return queryClient.invalidateQueries({ queryKey: queryKeys.users.aiCredentials });
  };
}

export function useAiCredentials() {
  return useQuery<ListAiCredentialsResponse, Error>({
    queryKey: queryKeys.users.aiCredentials,
    queryFn: async () => {
      const response = await fetch('/api/user/ai-credentials', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Failed to fetch AI credentials'));
      }

      return parseJson<ListAiCredentialsResponse>(response);
    },
  });
}

export function useValidateAiCredential() {
  return useMutation<{ valid: boolean }, Error, ValidateAiCredentialInput>({
    mutationFn: async (input) => {
      const response = await fetch('/api/user/ai-credentials/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      const data = await parseJson<{ valid?: boolean; error?: string }>(response);
      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate AI credential');
      }

      return { valid: Boolean(data.valid) };
    },
  });
}

export function useSaveAiCredential() {
  const invalidateAiCredentials = useInvalidateAiCredentials();

  return useMutation<{ credential: AiCredentialListItem }, Error, SaveAiCredentialInput>({
    mutationFn: async (input) => {
      const response = await fetch('/api/user/ai-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      const data = await parseJson<{ credential?: AiCredentialListItem; error?: string }>(response);
      if (!response.ok || !data.credential) {
        throw new Error(data.error || 'Failed to save AI credential');
      }

      return { credential: data.credential };
    },
    onSuccess: () => {
      return invalidateAiCredentials();
    },
  });
}

export function useDeleteAiCredential() {
  const invalidateAiCredentials = useInvalidateAiCredentials();

  return useMutation<void, Error, AiProvider>({
    mutationFn: async (provider) => {
      const response = await fetch(`/api/user/ai-credentials/${provider}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Failed to delete AI credential'));
      }
    },
    onSuccess: () => {
      return invalidateAiCredentials();
    },
  });
}
