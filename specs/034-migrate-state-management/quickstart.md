# TanStack Query Migration Quickstart Guide

**Feature**: Migrate State Management to TanStack Query
**Date**: 2025-01-17

## Overview

This guide provides step-by-step instructions for migrating the ai-board application from manual fetch calls to TanStack Query. The migration is designed to be incremental, allowing you to migrate one component at a time while maintaining functionality.

## Prerequisites

- Node.js 22.20.0 LTS installed
- TypeScript 5.6 with strict mode enabled
- Existing ai-board project with Next.js 15 App Router

## Step 1: Installation

```bash
# Install TanStack Query and DevTools
npm install @tanstack/react-query @tanstack/react-query-devtools
```

Expected bundle size increase: ~11.4KB gzipped (well within 50KB limit)

## Step 2: Create Query Client Configuration

Create `app/lib/query-client.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5000, // 5 seconds
        gcTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false, // Per user requirement
        retry: 1,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// Singleton for client-side
let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always create new instance
    return makeQueryClient();
  } else {
    // Browser: use singleton
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
  }
}
```

## Step 3: Create Query Provider

Create `app/providers/query-provider.tsx`:

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { getQueryClient } from '@/lib/query-client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Use singleton in browser, new instance in SSR
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
```

## Step 4: Update Root Layout

Update `app/layout.tsx`:

```typescript
import { QueryProvider } from '@/app/providers/query-provider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

## Step 5: Create Query Keys

Create `app/lib/query-keys.ts`:

```typescript
export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    detail: (id: number) => ['projects', id] as const,
    tickets: (id: number) => ['projects', id, 'tickets'] as const,
    ticket: (projectId: number, ticketId: number) =>
      ['projects', projectId, 'tickets', ticketId] as const,
    jobsStatus: (id: number) => ['projects', id, 'jobs', 'status'] as const,
  },
} as const;
```

## Step 6: Migrate Job Polling (Priority 1)

Replace `app/lib/hooks/useJobPolling.ts`:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { JobStatusDto } from '@/app/lib/schemas/job-polling';

export function useJobPolling(projectId: number, pollingInterval = 2000) {
  const { data, error, isFetching, dataUpdatedAt, failureCount } = useQuery({
    queryKey: queryKeys.projects.jobsStatus(projectId),
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/jobs/status`,
        { cache: 'no-store' }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      return result.jobs as JobStatusDto[];
    },
    staleTime: 0, // Always fresh for real-time data
    refetchInterval: (query) => {
      // Stop polling when all jobs are terminal
      const jobs = query.state.data || [];
      const allTerminal = jobs.every((job) =>
        ['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)
      );
      return allTerminal ? false : pollingInterval;
    },
    refetchIntervalInBackground: true,
  });

  return {
    jobs: data || [],
    isPolling: isFetching,
    lastPollTime: dataUpdatedAt || null,
    errorCount: failureCount,
    error: error as Error | null,
  };
}
```

## Step 7: Create Ticket Hooks

Create `app/lib/hooks/queries/useTickets.ts`:

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { TicketWithVersion, Stage } from '@/lib/types';

export function useProjectTickets(projectId: number) {
  return useQuery({
    queryKey: queryKeys.projects.tickets(projectId),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/tickets`);
      if (!res.ok) throw new Error('Failed to fetch tickets');
      return res.json() as Promise<TicketWithVersion[]>;
    },
    staleTime: 5000, // 5 seconds
  });
}

export function useUpdateTicketStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      ticketId,
      stage,
      version,
    }: {
      projectId: number;
      ticketId: number;
      stage: Stage;
      version: number;
    }) => {
      const res = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage, version }),
        }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update');
      }
      return res.json();
    },
    // Optimistic update
    onMutate: async ({ projectId, ticketId, stage }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.projects.tickets(projectId),
      });

      const previous = queryClient.getQueryData<TicketWithVersion[]>(
        queryKeys.projects.tickets(projectId)
      );

      queryClient.setQueryData<TicketWithVersion[]>(
        queryKeys.projects.tickets(projectId),
        (old) =>
          old?.map((ticket) =>
            ticket.id === ticketId ? { ...ticket, stage } : ticket
          ) || []
      );

      return { previous };
    },
    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.projects.tickets(variables.projectId),
          context.previous
        );
      }
    },
    // Always refetch after settlement
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(variables.projectId),
      });
    },
  });
}
```

## Step 8: Update Board Component

Update `components/board/board.tsx`:

```typescript
'use client';

import { useProjectTickets, useUpdateTicketStage } from '@/lib/hooks/queries/useTickets';
import { useJobPolling } from '@/lib/hooks/useJobPolling';
// ... other imports

export function Board({ projectId }: { projectId: number }) {
  // Replace manual fetching with TanStack Query
  const { data: tickets, isLoading } = useProjectTickets(projectId);
  const { jobs, isPolling } = useJobPolling(projectId);
  const updateStage = useUpdateTicketStage();

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const ticket = active.data.current?.ticket as TicketWithVersion;
    const targetStage = over.data.current?.stage as Stage;

    if (!ticket || !targetStage || ticket.stage === targetStage) return;

    // Use mutation with optimistic update
    updateStage.mutate({
      projectId,
      ticketId: ticket.id,
      stage: targetStage,
      version: ticket.version,
    });
  };

  if (isLoading) return <div>Loading...</div>;

  // Rest of component remains the same
  // ...
}
```

## Step 9: Add Server-Side Prefetching (Optional)

Update `app/projects/[projectId]/board/page.tsx`:

```typescript
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { Board } from '@/components/board/board';
import prisma from '@/lib/prisma';

export default async function BoardPage({
  params,
}: {
  params: { projectId: string };
}) {
  const projectId = parseInt(params.projectId);
  const queryClient = new QueryClient();

  // Prefetch tickets on server
  await queryClient.prefetchQuery({
    queryKey: queryKeys.projects.tickets(projectId),
    queryFn: async () => {
      const tickets = await prisma.ticket.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });
      return tickets;
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Board projectId={projectId} />
    </HydrationBoundary>
  );
}
```

## Step 10: Testing

Create `tests/helpers/test-query-client.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // No retries in tests
        gcTime: 0, // No caching
      },
      mutations: {
        retry: false,
      },
    },
  });
}
```

Update test files to use test query client:

```typescript
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/tests/helpers/test-query-client';

test('should update ticket stage', async () => {
  const queryClient = createTestQueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <Board projectId={1} />
    </QueryClientProvider>
  );

  // Test logic...
});
```

## Migration Checklist

### Phase 1: Infrastructure (Day 1)
- [ ] Install dependencies
- [ ] Create query client configuration
- [ ] Set up query provider
- [ ] Update root layout
- [ ] Create query keys

### Phase 2: Read Operations (Day 2)
- [ ] Migrate useJobPolling hook
- [ ] Create ticket query hooks
- [ ] Update board to use queries
- [ ] Add loading states
- [ ] Verify polling works

### Phase 3: Write Operations (Day 3)
- [ ] Create mutation hooks
- [ ] Add optimistic updates
- [ ] Implement error handling
- [ ] Add rollback logic
- [ ] Test drag-and-drop

### Phase 4: Testing & Documentation (Day 4)
- [ ] Update all E2E tests
- [ ] Create test utilities
- [ ] Update CLAUDE.md
- [ ] Update constitution if needed
- [ ] Remove old code

## Common Patterns

### Conditional Queries

```typescript
const { data } = useQuery({
  queryKey: ['data', id],
  queryFn: fetchData,
  enabled: !!id, // Only run if id exists
});
```

### Dependent Queries

```typescript
const { data: user } = useQuery({
  queryKey: ['user'],
  queryFn: fetchUser,
});

const { data: projects } = useQuery({
  queryKey: ['projects', user?.id],
  queryFn: () => fetchProjects(user!.id),
  enabled: !!user?.id, // Only run after user loads
});
```

### Manual Refetch

```typescript
const { data, refetch } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
});

// Manual refresh button
<button onClick={() => refetch()}>Refresh</button>
```

## Troubleshooting

### Issue: Stale data after mutation

**Solution**: Ensure you're invalidating the correct queries:

```typescript
queryClient.invalidateQueries({
  queryKey: queryKeys.projects.tickets(projectId),
});
```

### Issue: Infinite refetch loop

**Solution**: Check your staleTime and ensure conditional logic in refetchInterval:

```typescript
refetchInterval: (query) => {
  // Add termination condition
  return someCondition ? false : 2000;
};
```

### Issue: TypeScript errors

**Solution**: Ensure all types are properly imported and use type assertions:

```typescript
const data = await response.json() as TicketWithVersion[];
```

## Performance Tips

1. **Use selective queries**: Only fetch what you need
2. **Leverage cache**: Don't set staleTime to 0 unless necessary
3. **Batch invalidations**: Invalidate parent keys to refresh children
4. **Use placeholderData**: Show stale data while fetching fresh
5. **Monitor DevTools**: Check cache hits/misses in development

## Next Steps

1. Monitor API call reduction (target: 30-40% reduction)
2. Gather team feedback on developer experience
3. Consider adding persistence with tanstack/query-sync-storage-persister
4. Optimize bundle size with tree-shaking
5. Document team conventions in CLAUDE.md

## Resources

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Next.js App Router Integration](https://tanstack.com/query/latest/docs/react/guides/advanced-ssr)
- [TypeScript Best Practices](https://tanstack.com/query/latest/docs/react/typescript)
- [Migration Guide](https://tanstack.com/query/latest/docs/react/guides/migrating-to-v5)