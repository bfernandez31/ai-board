import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/app/lib/query-keys";

/**
 * Token list item returned from API
 */
export interface TokenListItem {
  id: number;
  name: string;
  preview: string;
  lastUsedAt: string | null;
  createdAt: string;
}

/**
 * Response from listing tokens
 */
interface ListTokensResponse {
  tokens: TokenListItem[];
}

/**
 * Response from creating a token
 */
interface CreateTokenResponse {
  id: number;
  name: string;
  token: string;
  preview: string;
  createdAt: string;
}

/**
 * Error response from token API
 */
interface TokenApiError {
  error: string;
}

/**
 * Hook to fetch user's personal access tokens
 *
 * @returns Query object with tokens data and loading states
 */
export function useTokens() {
  return useQuery<ListTokensResponse, Error>({
    queryKey: queryKeys.tokens.all,
    queryFn: async () => {
      const response = await fetch("/api/tokens", {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = (await response.json()) as TokenApiError;
        throw new Error(errorData.error || "Failed to fetch tokens");
      }

      return response.json();
    },
  });
}

/**
 * Hook to create a new personal access token
 *
 * @returns Mutation object with mutate function and status
 */
export function useCreateToken() {
  const queryClient = useQueryClient();

  return useMutation<CreateTokenResponse, Error, { name: string }>({
    mutationFn: async ({ name }) => {
      const response = await fetch("/api/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as TokenApiError;
        throw new Error(errorData.error || "Failed to create token");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate tokens list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.tokens.all });
    },
  });
}

/**
 * Hook to delete a personal access token
 *
 * @returns Mutation object with mutate function and status
 */
export function useDeleteToken() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number, { previousTokens: ListTokensResponse | undefined }>({
    mutationFn: async (tokenId) => {
      const response = await fetch(`/api/tokens/${tokenId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = (await response.json()) as TokenApiError;
        throw new Error(errorData.error || "Failed to delete token");
      }
    },
    onMutate: async (tokenId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.tokens.all });

      // Snapshot previous state
      const previousTokens = queryClient.getQueryData<ListTokensResponse>(
        queryKeys.tokens.all
      );

      // Optimistically remove token
      queryClient.setQueryData<ListTokensResponse>(
        queryKeys.tokens.all,
        (old) => {
          if (!old) return { tokens: [] };
          return {
            tokens: old.tokens.filter((t) => t.id !== tokenId),
          };
        }
      );

      return { previousTokens };
    },
    onError: (_error, _tokenId, context) => {
      // Rollback on error
      if (context?.previousTokens) {
        queryClient.setQueryData(queryKeys.tokens.all, context.previousTokens);
      }
    },
    onSettled: () => {
      // Always refetch after mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.tokens.all });
    },
  });
}
