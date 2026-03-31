import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export interface CredentialListItem {
  id: number;
  provider: string;
  credentialType: string;
  label: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
}

interface ListCredentialsResponse {
  credentials: CredentialListItem[];
}

interface SaveCredentialInput {
  provider: string;
  credentialType: string;
  label: string;
  apiKey: string;
}

interface ValidateCredentialInput {
  provider: string;
  credentialType: string;
  apiKey: string;
}

interface ValidateResponse {
  valid: boolean;
  error?: string | null;
}

interface ApiError {
  error: string;
}

/**
 * Hook to fetch user's API credentials (metadata only).
 */
export function useCredentials() {
  return useQuery<ListCredentialsResponse, Error>({
    queryKey: queryKeys.credentials.all,
    queryFn: async () => {
      const response = await fetch('/api/credentials', {
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.error || 'Failed to fetch credentials');
      }
      return response.json();
    },
  });
}

/**
 * Hook to save (create or replace) an API credential.
 */
export function useSaveCredential() {
  const queryClient = useQueryClient();

  return useMutation<CredentialListItem, Error, SaveCredentialInput>({
    mutationFn: async (input) => {
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.error || 'Failed to save credential');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials.all });
    },
  });
}

/**
 * Hook to delete an API credential.
 */
export function useDeleteCredential() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (credentialId) => {
      const response = await fetch(`/api/credentials/${credentialId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.error || 'Failed to delete credential');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials.all });
    },
  });
}

/**
 * Hook to validate an API key (format + provider check).
 */
export function useValidateCredential() {
  return useMutation<ValidateResponse, Error, ValidateCredentialInput>({
    mutationFn: async (input) => {
      const response = await fetch('/api/credentials/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.error || 'Validation failed');
      }
      return response.json();
    },
  });
}
