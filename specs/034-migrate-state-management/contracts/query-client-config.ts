/**
 * TanStack Query Client Configuration Contract
 *
 * This file defines the configuration contract for the QueryClient
 * and associated providers used in the ai-board application.
 */

import type { QueryClient, QueryClientConfig } from '@tanstack/react-query';

// ============================================================================
// Query Client Configuration
// ============================================================================

export interface AIBoardQueryClientConfig extends QueryClientConfig {
  defaultOptions: {
    queries: {
      /**
       * How long data is considered fresh (no background refetch)
       * @default 5000 (5 seconds)
       */
      staleTime: number;

      /**
       * How long unused data stays in memory
       * @default 600000 (10 minutes)
       */
      gcTime: number;

      /**
       * Whether to refetch when window gains focus
       * @default false (per user requirement)
       */
      refetchOnWindowFocus: boolean;

      /**
       * Number of retry attempts for failed queries
       * @default 1
       */
      retry: number | ((failureCount: number, error: Error) => boolean);

      /**
       * Whether to refetch when reconnecting to network
       * @default true
       */
      refetchOnReconnect: boolean;

      /**
       * Whether to refetch on mount if data is stale
       * @default true
       */
      refetchOnMount: boolean;

      /**
       * Network mode for queries
       * @default 'online'
       */
      networkMode: 'online' | 'always' | 'offlineFirst';
    };
    mutations: {
      /**
       * Number of retry attempts for failed mutations
       * @default 0 (no retries for mutations)
       */
      retry: number | ((failureCount: number, error: Error) => boolean);

      /**
       * Network mode for mutations
       * @default 'online'
       */
      networkMode: 'online' | 'always' | 'offlineFirst';
    };
  };
}

/**
 * Default configuration for the AI Board application
 */
export const defaultQueryClientConfig: AIBoardQueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 5000, // 5 seconds
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false, // User requirement: no refetch on tab switch
      retry: 1, // Retry once on failure
      refetchOnReconnect: true,
      refetchOnMount: true,
      networkMode: 'online',
    },
    mutations: {
      retry: 0, // Don't retry mutations
      networkMode: 'online',
    },
  },
};

// ============================================================================
// Environment-Specific Configurations
// ============================================================================

/**
 * Development configuration with extended cache times for debugging
 */
export const developmentConfig: Partial<AIBoardQueryClientConfig> = {
  defaultOptions: {
    queries: {
      staleTime: 60000, // 1 minute (longer for debugging)
      gcTime: 30 * 60 * 1000, // 30 minutes
      retry: 0, // No retries in dev for faster feedback
    },
    mutations: {
      retry: 0,
    },
  },
};

/**
 * Test configuration for predictable test behavior
 */
export const testConfig: AIBoardQueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 0, // Always stale in tests
      gcTime: 0, // No caching in tests
      refetchOnWindowFocus: false,
      retry: false, // No retries in tests
      refetchOnReconnect: false,
      refetchOnMount: false,
      networkMode: 'always', // Work offline in tests
    },
    mutations: {
      retry: false,
      networkMode: 'always',
    },
  },
};

// ============================================================================
// Query-Specific Configurations
// ============================================================================

/**
 * Configuration for real-time data (job polling)
 */
export const realtimeQueryConfig = {
  staleTime: 0, // Always stale
  gcTime: 5 * 60 * 1000, // 5 minutes
  refetchInterval: 2000, // 2 seconds
  refetchIntervalInBackground: true,
  retry: 1,
} as const;

/**
 * Configuration for static data (project settings)
 */
export const staticQueryConfig = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
  refetchOnMount: false,
  refetchOnReconnect: false,
} as const;

/**
 * Configuration for frequently updated data (tickets)
 */
export const dynamicQueryConfig = {
  staleTime: 5000, // 5 seconds
  gcTime: 10 * 60 * 1000, // 10 minutes
  refetchOnMount: true,
  refetchOnReconnect: true,
} as const;

// ============================================================================
// Retry Configuration
// ============================================================================

/**
 * Custom retry logic for queries
 */
export const customRetryLogic = (failureCount: number, error: Error): boolean | number => {
  // Don't retry on 4xx errors (client errors)
  if (error instanceof Error && error.message.includes('4')) {
    return false;
  }

  // Don't retry after 3 attempts
  if (failureCount >= 3) {
    return false;
  }

  // Exponential backoff: 1s, 2s, 4s
  const delay = Math.min(1000 * Math.pow(2, failureCount), 4000);
  return delay;
};

// ============================================================================
// Provider Props
// ============================================================================

export interface QueryProviderProps {
  /**
   * React children to wrap with the provider
   */
  children: React.ReactNode;

  /**
   * Optional custom configuration (overrides defaults)
   */
  config?: Partial<AIBoardQueryClientConfig>;

  /**
   * Whether to show React Query DevTools
   * @default process.env.NODE_ENV === 'development'
   */
  enableDevTools?: boolean;

  /**
   * Initial open state for DevTools
   * @default false
   */
  devToolsInitialOpen?: boolean;

  /**
   * Position of DevTools button
   * @default 'bottom-right'
   */
  devToolsPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// ============================================================================
// Cache Management
// ============================================================================

export interface CacheManagementOptions {
  /**
   * Clear all cached data
   */
  clearAll(): void;

  /**
   * Clear cached data for a specific project
   */
  clearProject(projectId: number): void;

  /**
   * Clear cached user data
   */
  clearUserData(): void;

  /**
   * Reset cache to initial state
   */
  reset(): void;

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    queriesCount: number;
    mutationsCount: number;
    cacheSize: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  };
}

// ============================================================================
// Hydration Configuration
// ============================================================================

export interface HydrationConfig {
  /**
   * Whether to hydrate from server on mount
   * @default true
   */
  hydrateOnMount: boolean;

  /**
   * Custom hydration function
   */
  hydrate?: (dehydratedState: unknown) => void;

  /**
   * Custom dehydration function
   */
  dehydrate?: () => unknown;

  /**
   * Options for dehydration
   */
  dehydrateOptions?: {
    shouldDehydrateQuery?: (query: unknown) => boolean;
    shouldDehydrateMutation?: (mutation: unknown) => boolean;
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid QueryClient configuration
 */
export function isValidQueryClientConfig(
  config: unknown
): config is AIBoardQueryClientConfig {
  if (!config || typeof config !== 'object') return false;

  const c = config as any;
  return (
    c.defaultOptions &&
    typeof c.defaultOptions === 'object' &&
    c.defaultOptions.queries &&
    typeof c.defaultOptions.queries === 'object' &&
    c.defaultOptions.mutations &&
    typeof c.defaultOptions.mutations === 'object'
  );
}

/**
 * Merge configurations with proper type safety
 */
export function mergeQueryClientConfigs(
  base: AIBoardQueryClientConfig,
  ...overrides: Partial<AIBoardQueryClientConfig>[]
): AIBoardQueryClientConfig {
  const result = { ...base };

  for (const override of overrides) {
    if (override.defaultOptions) {
      result.defaultOptions = {
        queries: {
          ...result.defaultOptions.queries,
          ...(override.defaultOptions.queries || {}),
        },
        mutations: {
          ...result.defaultOptions.mutations,
          ...(override.defaultOptions.mutations || {}),
        },
      };
    }
  }

  return result;
}