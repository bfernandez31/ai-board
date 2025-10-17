# Data Model: TanStack Query State Management

**Feature**: Migrate State Management to TanStack Query
**Date**: 2025-01-17
**Status**: Phase 1 Design

## Overview

This document defines the data structures and state management patterns for TanStack Query integration. No database schema changes are required; this focuses on client-side state management and caching strategies.

## Core Entities

### 1. Query Client Configuration

**Entity**: `QueryClient`
**Purpose**: Central configuration for all queries and mutations

```typescript
interface QueryClientConfig {
  defaultOptions: {
    queries: {
      staleTime: number;           // Default: 5000ms
      gcTime: number;              // Default: 10 * 60 * 1000ms (10 min)
      refetchOnWindowFocus: boolean; // Default: false
      retry: number | RetryFunction; // Default: 1
      refetchOnReconnect: boolean;   // Default: true
    };
    mutations: {
      retry: number;                // Default: 0
      onError?: (error: Error) => void;
    };
  };
}
```

**Validation Rules**:
- staleTime must be <= gcTime
- retry count must be >= 0
- All time values in milliseconds

### 2. Query Key Structure

**Entity**: `QueryKeys`
**Purpose**: Type-safe, hierarchical query key management

```typescript
type QueryKeyFactory = {
  projects: {
    all: readonly ['projects'];
    detail: (id: number) => readonly ['projects', number];
    tickets: (id: number) => readonly ['projects', number, 'tickets'];
    ticket: (projectId: number, ticketId: number) =>
      readonly ['projects', number, 'tickets', number];
    jobs: (id: number) => readonly ['projects', number, 'jobs'];
    jobsStatus: (id: number) => readonly ['projects', number, 'jobs', 'status'];
    settings: (id: number) => readonly ['projects', number, 'settings'];
  };
  users: {
    all: readonly ['users'];
    current: readonly ['users', 'current'];
    detail: (id: string) => readonly ['users', string];
  };
};
```

**Validation Rules**:
- Keys must be immutable arrays (readonly)
- Hierarchical structure for smart invalidation
- Type parameters must match API expectations

### 3. Query Hooks

**Entity**: `QueryHook<TData, TError>`
**Purpose**: Typed wrappers for data fetching

```typescript
interface QueryHookOptions<TData> {
  queryKey: ReadonlyArray<unknown>;
  queryFn: () => Promise<TData>;
  staleTime?: number;
  gcTime?: number;
  refetchInterval?: number | false | ((query: Query) => number | false);
  enabled?: boolean;
  initialData?: TData;
  placeholderData?: TData;
  select?: (data: TData) => unknown;
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

interface QueryHookReturn<TData> {
  data: TData | undefined;
  error: Error | null;
  isLoading: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  isError: boolean;
  isPending: boolean;
  status: 'pending' | 'error' | 'success';
  fetchStatus: 'fetching' | 'paused' | 'idle';
  refetch: () => Promise<QueryObserverResult<TData>>;
}
```

### 4. Mutation Hooks

**Entity**: `MutationHook<TData, TError, TVariables, TContext>`
**Purpose**: Typed wrappers for state-changing operations

```typescript
interface MutationHookOptions<TData, TVariables, TContext> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onMutate?: (variables: TVariables) => Promise<TContext>;
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void;
  onError?: (error: Error, variables: TVariables, context?: TContext) => void;
  onSettled?: (data?: TData, error?: Error, variables?: TVariables) => void;
  retry?: number | RetryFunction;
}

interface MutationHookReturn<TData, TVariables> {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  data: TData | undefined;
  error: Error | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isPending: boolean;
  status: 'idle' | 'pending' | 'error' | 'success';
  reset: () => void;
}
```

### 5. Optimistic Update Context

**Entity**: `OptimisticContext<T>`
**Purpose**: Snapshot management for rollback on errors

```typescript
interface OptimisticContext<T> {
  previousData: T;
  optimisticData: T;
  timestamp: number;
  queryKey: ReadonlyArray<unknown>;
}
```

**State Transitions**:
- `idle` → `pending` (mutation starts)
- `pending` → `success` (server confirms)
- `pending` → `error` (rollback triggered)
- `error/success` → `idle` (reset)

## Cache Management Strategies

### 1. Job Status Polling

**Pattern**: Real-time polling with conditional stop

```typescript
interface JobPollingConfig {
  queryKey: ['projects', number, 'jobs', 'status'];
  staleTime: 0;                    // Always fresh
  gcTime: 5 * 60 * 1000;           // 5 minutes
  refetchInterval: 2000;            // 2 seconds
  refetchIntervalInBackground: true;
  stopCondition: (jobs: Job[]) => boolean; // Terminal state check
}
```

### 2. Ticket Management

**Pattern**: Optimistic updates with conflict resolution

```typescript
interface TicketCacheStrategy {
  queryKey: ['projects', number, 'tickets'];
  staleTime: 5000;                 // 5 seconds
  gcTime: 10 * 60 * 1000;         // 10 minutes
  optimisticUpdate: true;
  conflictResolution: 'server-wins' | 'client-wins' | 'merge';
}
```

### 3. Project Settings

**Pattern**: Long-lived cache for static data

```typescript
interface SettingsCacheStrategy {
  queryKey: ['projects', number, 'settings'];
  staleTime: 5 * 60 * 1000;       // 5 minutes
  gcTime: 30 * 60 * 1000;         // 30 minutes
  backgroundRefetch: false;
}
```

## Query Invalidation Patterns

### Hierarchical Invalidation

```typescript
// Invalidate all project data
queryClient.invalidateQueries({ queryKey: ['projects'] });

// Invalidate specific project
queryClient.invalidateQueries({ queryKey: ['projects', projectId] });

// Invalidate project tickets only
queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tickets'] });

// Invalidate specific ticket
queryClient.invalidateQueries({
  queryKey: ['projects', projectId, 'tickets', ticketId]
});
```

### Cross-Entity Invalidation

```typescript
// After ticket update, invalidate related queries
const invalidateAfterTicketUpdate = (projectId: number) => {
  queryClient.invalidateQueries({
    queryKey: ['projects', projectId, 'tickets']
  });
  queryClient.invalidateQueries({
    queryKey: ['projects', projectId, 'jobs', 'status']
  });
};
```

## Error Handling

### Retry Strategies

```typescript
interface RetryConfig {
  maxRetries: number;
  backoffMultiplier: number;
  maxBackoff: number;
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 1,
  backoffMultiplier: 2,
  maxBackoff: 30000 // 30 seconds
};

const customRetry = (failureCount: number, error: Error) => {
  // Don't retry on 4xx errors (client errors)
  if (error.message.includes('4')) return false;

  // Retry with exponential backoff
  const delay = Math.min(
    1000 * Math.pow(2, failureCount),
    defaultRetryConfig.maxBackoff
  );

  return failureCount < defaultRetryConfig.maxRetries ? delay : false;
};
```

### Error Boundaries

```typescript
interface QueryErrorBoundaryProps {
  fallback: React.ComponentType<{ error: Error; reset: () => void }>;
  onError?: (error: Error) => void;
  resetKeys?: ReadonlyArray<unknown>[];
}
```

## Type Definitions

### API Response Types (Existing)

```typescript
// These already exist in the codebase
interface TicketWithVersion {
  id: number;
  title: string;
  description: string | null;
  stage: Stage;
  projectId: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  branch: string | null;
  autoMode: boolean;
  workflowType: WorkflowType;
  clarificationPolicy: ClarificationPolicy | null;
}

interface JobStatusDto {
  id: number;
  ticketId: number;
  status: JobStatus;
  updatedAt: string;
}

interface Project {
  id: number;
  name: string;
  description: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
  clarificationPolicy: ClarificationPolicy;
  userId: string;
}
```

### Query-Specific Types

```typescript
// New types for TanStack Query
type TicketsByStage = Record<Stage, TicketWithVersion[]>;

interface TicketUpdateVariables {
  ticketId: number;
  updates: Partial<TicketWithVersion>;
  version: number;
}

interface TicketCreateVariables {
  title: string;
  description: string | null;
  stage: Stage;
  projectId: number;
}

interface StageTransitionVariables {
  ticketId: number;
  targetStage: Stage;
  version: number;
}

interface JobPollingResult {
  jobs: JobStatusDto[];
  hasActiveJobs: boolean;
  lastPollTime: number;
}
```

## Migration Mapping

### Current State → TanStack Query

| Current Implementation | TanStack Query Replacement | Benefits |
|----------------------|---------------------------|----------|
| `useJobPolling` hook | `useQuery` with `refetchInterval` | Less code, automatic cleanup |
| Manual `fetch` calls | `useQuery` hooks | Caching, deduplication |
| `setState` after fetch | Automatic state management | No manual state updates |
| Manual error handling | Built-in retry & error states | Consistent error handling |
| Custom loading states | `isLoading`, `isFetching` | Standard loading patterns |
| Manual cache management | Automatic cache with TTL | Smart invalidation |
| Optimistic updates (manual) | `useMutation` with `onMutate` | Automatic rollback |

## Performance Considerations

### Bundle Size
- Core: 11.4KB gzipped
- DevTools: 15KB (dev only)
- Total impact: < 12KB production

### Memory Usage
- Default cache size: ~100 entries
- Memory per entry: ~1-5KB (depending on data)
- Total memory: < 1MB typical usage

### Network Optimization
- Request deduplication: -50% duplicate requests
- Smart caching: -30% total API calls
- Background refetch: Maintains freshness

## Security Considerations

### Data Privacy
- No sensitive data in query keys
- Cache cleared on logout
- Memory-only storage (no persistence)

### API Security
- Auth tokens in headers (unchanged)
- CORS policies respected
- Rate limiting compatible

## Testing Strategies

### Unit Testing
```typescript
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});
```

### E2E Testing
- Mock API responses at network level
- Test optimistic updates and rollbacks
- Verify cache behavior

## Conclusion

This data model provides a complete foundation for TanStack Query integration:
- Type-safe query and mutation hooks
- Hierarchical cache management
- Optimistic update patterns
- Comprehensive error handling
- Performance-optimized configurations

The design maintains backward compatibility while significantly improving developer experience and application performance.