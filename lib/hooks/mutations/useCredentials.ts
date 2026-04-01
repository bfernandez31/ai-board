import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/app/lib/query-keys";

export interface CredentialListItem {
  id: number;
  provider: string;
  credentialType: string;
  label: string;
  preview: string;
  readinessStatus: string;
  lastVerifiedAt: string | null;
  verificationCode: string | null;
  verificationMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListCredentialsResponse {
  credentials: CredentialListItem[];
}

interface CreateCredentialInput {
  provider: string;
  credentialType: string;
  label: string;
  value: string;
}

interface CredentialApiError {
  error: string;
  code?: string;
}

interface TestCredentialResult {
  readinessStatus: string;
  verificationCode: string;
  verificationMessage: string | null;
  lastVerifiedAt: string;
}

export function useCredentials() {
  return useQuery<ListCredentialsResponse, Error>({
    queryKey: queryKeys.credentials.all,
    queryFn: async () => {
      const response = await fetch("/api/credentials", {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = (await response.json()) as CredentialApiError;
        throw new Error(errorData.error || "Failed to fetch credentials");
      }

      return response.json();
    },
  });
}

export function useCreateCredential() {
  const queryClient = useQueryClient();

  return useMutation<CredentialListItem, Error, CreateCredentialInput>({
    mutationFn: async (input) => {
      const response = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as CredentialApiError;
        throw new Error(errorData.error || "Failed to create credential");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials.all });
    },
  });
}

export function useDeleteCredential() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number, { previous: ListCredentialsResponse | undefined }>({
    mutationFn: async (credentialId) => {
      const response = await fetch(`/api/credentials/${credentialId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = (await response.json()) as CredentialApiError;
        throw new Error(errorData.error || "Failed to delete credential");
      }
    },
    onMutate: async (credentialId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.credentials.all });

      const previous = queryClient.getQueryData<ListCredentialsResponse>(
        queryKeys.credentials.all
      );

      queryClient.setQueryData<ListCredentialsResponse>(
        queryKeys.credentials.all,
        (old) => {
          if (!old) return { credentials: [] };
          return {
            credentials: old.credentials.filter((c) => c.id !== credentialId),
          };
        }
      );

      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.credentials.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials.all });
    },
  });
}

export function useTestCredential() {
  const queryClient = useQueryClient();

  return useMutation<TestCredentialResult, Error, number>({
    mutationFn: async (credentialId) => {
      const response = await fetch(`/api/credentials/${credentialId}/test`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = (await response.json()) as CredentialApiError;
        throw new Error(errorData.error || "Failed to test credential");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials.all });
    },
  });
}
