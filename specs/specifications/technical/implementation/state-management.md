# State Management Implementation

Complete guide to TanStack Query usage, optimistic updates, and client-side state patterns.

## TanStack Query v5.90.5

### Core Configuration

**Query Client Setup** (`app/providers.tsx`):

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,        // 5 minutes
      gcTime: 1000 * 60 * 10,           // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: true,       // Refetch when tab gains focus
      refetchOnReconnect: true,         // Refetch on network reconnection
      retry: 3,                         // Retry failed requests 3 times
      retryDelay: (attemptIndex) =>
        Math.min(1000 * 2 ** attemptIndex, 30000),  // Exponential backoff
    },
    mutations: {
      retry: 1,                         // Retry mutations once
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Query Key Factory

**Hierarchical Keys** (`app/lib/query-keys.ts`):

```typescript
export const queryKeys = {
  all: ['projects'] as const,

  projects: {
    all: () => [...queryKeys.all] as const,
    detail: (projectId: number) => [...queryKeys.all, projectId] as const,

    tickets: (projectId: number) => [...queryKeys.projects.detail(projectId), 'tickets'] as const,
    ticket: (projectId: number, ticketId: number) =>
      [...queryKeys.projects.tickets(projectId), ticketId] as const,

    comments: (projectId: number, ticketId: number) =>
      [...queryKeys.projects.ticket(projectId, ticketId), 'comments'] as const,

    jobs: (projectId: number) => [...queryKeys.projects.detail(projectId), 'jobs'] as const,
  },
};
```

**Benefits**:
- Hierarchical invalidation (invalidate all tickets: `queryKeys.projects.tickets(1)`)
- Type-safe keys
- Consistent across codebase
- Easy cache debugging

## Query Hooks

### Tickets Query

**Hook** (`app/lib/hooks/queries/useTickets.ts`):

```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export function useTickets(projectId: number) {
  return useQuery({
    queryKey: queryKeys.projects.tickets(projectId),
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/tickets`);

      if (!response.ok) {
        throw new Error('Failed to fetch tickets');
      }

      return response.json();
    },
    staleTime: 1000 * 60,  // 1 minute
  });
}
```

**Usage**:

```typescript
function BoardComponent({ projectId }: { projectId: number }) {
  const { data, isLoading, error } = useTickets(projectId);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return <Board tickets={data.tickets} />;
}
```

### Comments Query with Polling

**Hook** (`app/lib/hooks/queries/useComments.ts`):

```typescript
export function useComments(projectId: number, ticketId: number, options?: {
  enabled?: boolean;
  pollingInterval?: number;
}) {
  return useQuery({
    queryKey: queryKeys.projects.comments(projectId, ticketId),
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/comments`
      );

      if (!response.ok) throw new Error('Failed to fetch comments');

      return response.json();
    },
    enabled: options?.enabled ?? true,
    refetchInterval: options?.pollingInterval ?? 10000,  // 10 seconds
    staleTime: 0,  // Always consider stale for real-time updates
  });
}
```

**Features**:
- **Polling**: Automatic refetch every 10 seconds
- **Conditional**: Can disable via `enabled` option
- **Real-time**: Stale time 0 for immediate updates

### Job Polling Hook

**Hook** (`app/lib/hooks/useJobPolling.ts`):

```typescript
export function useJobPolling(projectId: number) {
  const [terminalJobIds, setTerminalJobIds] = useState<Set<number>>(new Set());

  const { data, isError } = useQuery({
    queryKey: queryKeys.projects.jobs(projectId),
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/jobs/status`);

      if (!response.ok) throw new Error('Failed to fetch job status');

      return response.json();
    },
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs || [];

      // Stop polling when all jobs terminal
      const allTerminal = jobs.every((job: Job) =>
        ['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)
      );

      return allTerminal ? false : 2000;  // 2 seconds or stop
    },
    staleTime: 0,
  });

  // Track terminal jobs
  useEffect(() => {
    if (data?.jobs) {
      const newTerminalIds = new Set(terminalJobIds);

      data.jobs.forEach((job: Job) => {
        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
          newTerminalIds.add(job.id);
        }
      });

      setTerminalJobIds(newTerminalIds);
    }
  }, [data]);

  return {
    jobs: data?.jobs || [],
    isPolling: !isError && data?.jobs.some((job: Job) =>
      !['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)
    ),
    error: isError,
  };
}
```

**Features**:
- **Auto-Stop**: Polling stops when all jobs terminal
- **Auto-Resume**: Polling resumes when new jobs created
- **Terminal Tracking**: Client tracks which jobs completed
- **2-Second Interval**: Real-time feel
- **Cache Invalidation**: Automatically invalidates tickets cache when job reaches terminal state

### Constitution Hooks

**Constitution Content Hook** (`lib/hooks/use-constitution.ts`):

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useConstitution(projectId: number) {
  return useQuery({
    queryKey: ['projects', projectId, 'constitution'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/constitution`);
      if (!response.ok) throw new Error('Failed to fetch constitution');
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUpdateConstitution(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/projects/${projectId}/constitution`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error('Failed to update constitution');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'constitution'],
      });
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'constitution', 'history'],
      });
    },
  });
}
```

**Constitution History Hook** (`lib/hooks/use-constitution-history.ts`):

```typescript
import { useQuery } from '@tanstack/react-query';

export function useConstitutionHistory(projectId: number) {
  return useQuery({
    queryKey: ['projects', projectId, 'constitution', 'history'],
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/constitution/history`
      );
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useConstitutionDiff(projectId: number, sha: string | null) {
  return useQuery({
    queryKey: ['projects', projectId, 'constitution', 'diff', sha],
    queryFn: async () => {
      if (!sha) return null;
      const response = await fetch(
        `/api/projects/${projectId}/constitution/diff?sha=${sha}`
      );
      if (!response.ok) throw new Error('Failed to fetch diff');
      return response.json();
    },
    enabled: !!sha,
    staleTime: 1000 * 60 * 10, // 10 minutes (historical data)
  });
}
```

**Features**:
- **Constitution Content**: Fetches and updates constitution markdown
- **Optimistic Updates**: UI updates immediately on save
- **Cache Invalidation**: Invalidates both content and history on update
- **Test Mode Support**: Handles mock responses in test environment
- **Conditional Diff**: Only fetches diff when SHA is provided

### Ticket Stats Hook

**Hook** (`lib/hooks/use-ticket-stats.ts`):

```typescript
import { useMemo } from 'react';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';

export interface TicketStats {
  totalCost: number;
  totalDuration: number;
  totalTokens: number;
  cacheEfficiency: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  jobs: TicketJobWithTelemetry[];
  toolsUsage: Array<{ tool: string; count: number }>;
  hasData: boolean;
}

export function useTicketStats(jobs: TicketJobWithTelemetry[]): TicketStats {
  return useMemo(() => {
    // Sort jobs chronologically (oldest first)
    const sortedJobs = [...jobs].sort((a, b) => {
      const dateA = new Date(a.startedAt).getTime();
      const dateB = new Date(b.startedAt).getTime();
      return dateA - dateB;
    });

    // Aggregate totals (null treated as 0)
    const totalCost = jobs.reduce((sum, job) => sum + (job.costUsd ?? 0), 0);
    const totalDuration = jobs.reduce((sum, job) => sum + (job.durationMs ?? 0), 0);
    const inputTokens = jobs.reduce((sum, job) => sum + (job.inputTokens ?? 0), 0);
    const outputTokens = jobs.reduce((sum, job) => sum + (job.outputTokens ?? 0), 0);
    const cacheReadTokens = jobs.reduce((sum, job) => sum + (job.cacheReadTokens ?? 0), 0);
    const cacheCreationTokens = jobs.reduce((sum, job) => sum + (job.cacheCreationTokens ?? 0), 0);

    const totalTokens = inputTokens + outputTokens;
    const cacheEfficiency = (inputTokens + cacheReadTokens) === 0
      ? 0
      : (cacheReadTokens / (inputTokens + cacheReadTokens)) * 100;

    // Aggregate tools usage
    const toolCounts = new Map<string, number>();
    jobs.forEach(job => {
      if (job.toolsUsed && Array.isArray(job.toolsUsed)) {
        job.toolsUsed.forEach(tool => {
          toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
        });
      }
    });

    const toolsUsage = Array.from(toolCounts.entries())
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count);

    const hasData = jobs.some(job =>
      job.costUsd != null || job.inputTokens != null || job.durationMs != null
    );

    return {
      totalCost,
      totalDuration,
      totalTokens,
      cacheEfficiency,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      jobs: sortedJobs,
      toolsUsage,
      hasData,
    };
  }, [jobs]);
}
```

**Features**:
- **Memoization**: Computation only runs when jobs array changes
- **Null Safety**: Treats null telemetry values as 0 for aggregation
- **Chronological Sorting**: Jobs sorted by startedAt (oldest first)
- **Tools Aggregation**: Counts all tool usage across jobs, sorted by frequency
- **Cache Efficiency**: Standard formula with division-by-zero protection
- **Data Detection**: `hasData` flag indicates if any job has meaningful telemetry

**Usage in Stats Tab** (`components/ticket/ticket-stats.tsx`):

```typescript
import { useTicketStats } from '@/lib/hooks/use-ticket-stats';
import type { Job } from '@prisma/client';
import type { TicketJob } from '@/components/board/ticket-detail-modal';

function TicketStats({ jobs, polledJobs }: {
  jobs: Job[];
  polledJobs: TicketJob[];
}) {
  // Merge full job data with polled status updates
  const mergedJobs = useMemo(() => {
    return jobs.map(job => {
      const polledJob = polledJobs.find(p => p.id === job.id);
      return {
        ...job,
        status: polledJob?.status ?? job.status,
      };
    });
  }, [jobs, polledJobs]);

  const stats = useTicketStats(mergedJobs);

  return (
    <div>
      <StatsSummaryCards stats={stats} />
      <JobsTimeline jobs={stats.jobs} />
      <ToolsUsageSection toolsUsage={stats.toolsUsage} />
    </div>
  );
}
```

**Real-Time Updates**:
- Stats recalculate automatically when jobs array changes
- Polled job status updates merge with full job data
- Existing 2-second job polling provides real-time status updates
- No additional API calls required

## Mutation Hooks

### Create Ticket Mutation

**Hook** (`app/lib/hooks/mutations/useCreateTicket.ts`):

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export function useCreateTicket(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTicketInput) => {
      const response = await fetch(`/api/projects/${projectId}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create ticket');
      }

      return response.json();
    },

    onSuccess: (newTicket) => {
      // Invalidate tickets query to refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(projectId),
      });

      // Optionally add to cache directly
      queryClient.setQueryData(
        queryKeys.projects.tickets(projectId),
        (old: any) => ({
          ...old,
          tickets: [newTicket, ...old.tickets],
        })
      );
    },

    onError: (error) => {
      console.error('Failed to create ticket:', error);
      // Error handled by UI via mutation.error
    },
  });
}
```

**Usage**:

```typescript
function CreateTicketForm({ projectId }: { projectId: number }) {
  const mutation = useCreateTicket(projectId);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    mutation.mutate(
      { title: titleValue, description: descValue },
      {
        onSuccess: () => {
          toast.success('Ticket created');
          closeModal();
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <Button disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating...' : 'Create'}
      </Button>
    </form>
  );
}
```

### Update Ticket with Optimistic Updates

**Hook** (`app/lib/hooks/mutations/useUpdateTicket.ts`):

```typescript
export function useUpdateTicket(projectId: number, ticketId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTicketInput) => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json();

        if (response.status === 409) {
          throw new Error('VERSION_CONFLICT');
        }

        throw new Error(error.message || 'Failed to update ticket');
      }

      return response.json();
    },

    onMutate: async (input) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.projects.ticket(projectId, ticketId),
      });

      // Snapshot previous value
      const previousTicket = queryClient.getQueryData(
        queryKeys.projects.ticket(projectId, ticketId)
      );

      // Optimistically update
      queryClient.setQueryData(
        queryKeys.projects.ticket(projectId, ticketId),
        (old: any) => ({
          ...old,
          ...input,
          updatedAt: new Date().toISOString(),
        })
      );

      return { previousTicket };
    },

    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousTicket) {
        queryClient.setQueryData(
          queryKeys.projects.ticket(projectId, ticketId),
          context.previousTicket
        );
      }

      if (error.message === 'VERSION_CONFLICT') {
        toast.error('Ticket was updated by someone else. Please refresh.');
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.ticket(projectId, ticketId),
        });
      }
    },

    onSuccess: (updatedTicket) => {
      // Merge server response (includes new version)
      queryClient.setQueryData(
        queryKeys.projects.ticket(projectId, ticketId),
        updatedTicket
      );

      // Also update tickets list
      queryClient.setQueryData(
        queryKeys.projects.tickets(projectId),
        (old: any) => ({
          ...old,
          tickets: old.tickets.map((t: Ticket) =>
            t.id === ticketId ? updatedTicket : t
          ),
        })
      );
    },
  });
}
```

**Optimistic Update Flow**:
1. **onMutate**: Update cache immediately, return snapshot
2. **API Call**: Send request to server
3. **onError**: Rollback using snapshot if failure
4. **onSuccess**: Merge server response (with new version)

### Transition Ticket Mutation

**Hook** (`app/lib/hooks/mutations/useTransitionTicket.ts`):

```typescript
export function useTransitionTicket(projectId: number, ticketId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { targetStage: Stage }) => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/transition`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to transition ticket');
      }

      return response.json();
    },

    onMutate: async (input) => {
      // Cancel queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.projects.tickets(projectId),
      });

      const previousTickets = queryClient.getQueryData(
        queryKeys.projects.tickets(projectId)
      );

      // Optimistic update: move ticket to target stage
      queryClient.setQueryData(
        queryKeys.projects.tickets(projectId),
        (old: any) => ({
          ...old,
          tickets: old.tickets.map((t: Ticket) =>
            t.id === ticketId
              ? { ...t, stage: input.targetStage, updatedAt: new Date().toISOString() }
              : t
          ),
        })
      );

      return { previousTickets };
    },

    onError: (error, variables, context) => {
      // Rollback
      if (context?.previousTickets) {
        queryClient.setQueryData(
          queryKeys.projects.tickets(projectId),
          context.previousTickets
        );
      }

      toast.error(error.message);
    },

    onSuccess: (data) => {
      // Invalidate to refetch (includes new Job)
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(projectId),
      });

      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.jobs(projectId),
      });

      toast.success('Workflow started');
    },
  });
}
```

**Features**:
- Optimistic stage update
- Rollback on error
- Invalidate jobs query (new job created)
- Toast notifications

### Delete Ticket Mutation

**Hook** (`app/lib/hooks/mutations/useDeleteTicket.ts`):

```typescript
export function useDeleteTicket(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<DeleteTicketResponse, Error, number, { previousTickets: Ticket[] }>({
    mutationFn: async (ticketId: number) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete ticket');
      }

      return response.json();
    },

    onMutate: async (ticketId: number) => {
      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.tickets(projectId) });

      // Snapshot previous state for rollback
      const previousTickets = queryClient.getQueryData<Ticket[]>(
        queryKeys.projects.tickets(projectId)
      );

      // Optimistically remove ticket from cache
      queryClient.setQueryData<Ticket[]>(
        queryKeys.projects.tickets(projectId),
        (old) => {
          if (!old) return [];
          return old.filter((t) => t.id !== ticketId);
        }
      );

      // Return snapshot for rollback context
      // Ensure we always return a valid context, even if previousTickets is undefined
      return { previousTickets: previousTickets ?? [] };
    },

    onError: (_error, _ticketId, context) => {
      // Restore snapshot from onMutate context
      if (context) {
        queryClient.setQueryData(queryKeys.projects.tickets(projectId), context.previousTickets);
      }
    },

    onSettled: () => {
      // Always refetch after mutation (success or error) to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) });
    },

    retry: false,  // Don't retry GitHub API failures automatically
  });
}
```

**Features**:
- **Optimistic removal**: Ticket disappears immediately from UI
- **Rollback on error**: Ticket reappears if deletion fails
- **Query invalidation**: Refetches tickets after success to ensure consistency
- **No automatic retry**: User must manually retry after failures (GitHub API rate limits, permissions)
- **Consecutive deletion support**: Properly handles undefined cache data when multiple tickets are deleted in sequence

**Critical Implementation Details**:
- The context type guarantees `previousTickets` is always an array, never `undefined`
- The `onMutate` callback handles undefined cache data by returning an empty array
- This prevents errors when deleting multiple tickets consecutively after cache invalidation
- The `onError` callback safely restores the snapshot without additional null checks

## Cache Invalidation Patterns

### Hierarchical Invalidation

```typescript
// Invalidate all tickets
queryClient.invalidateQueries({
  queryKey: queryKeys.projects.tickets(projectId),
});

// Invalidate single ticket (and its children)
queryClient.invalidateQueries({
  queryKey: queryKeys.projects.ticket(projectId, ticketId),
});

// Invalidate comments for specific ticket
queryClient.invalidateQueries({
  queryKey: queryKeys.projects.comments(projectId, ticketId),
});
```

### Selective Invalidation

```typescript
// Invalidate only tickets in INBOX stage
queryClient.invalidateQueries({
  queryKey: queryKeys.projects.tickets(projectId),
  predicate: (query) => {
    const data = query.state.data as any;
    return data?.tickets?.some((t: Ticket) => t.stage === 'INBOX');
  },
});
```

### Manual Cache Updates

```typescript
// Add comment to cache without refetch
queryClient.setQueryData(
  queryKeys.projects.comments(projectId, ticketId),
  (old: any) => ({
    ...old,
    comments: [newComment, ...old.comments],
  })
);
```

## Real-Time Updates

### Polling Strategy

**Comments Polling**:
- **Interval**: 10 seconds
- **Trigger**: When Comments tab opened
- **Stop**: When modal closed
- **Deduplication**: Filter optimistically added comments

**Job Status Polling**:
- **Interval**: 2 seconds
- **Trigger**: When board visible
- **Stop**: When all jobs terminal
- **Resume**: When new job created

### Workflow-Triggered Cache Invalidation

**Pattern**: When workflows complete and transition tickets to new stages, the board automatically updates via cache invalidation.

**Implementation** (`useJobPolling` hook):

```typescript
useEffect(() => {
  if (data?.jobs) {
    data.jobs.forEach((job: Job) => {
      const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status);
      const wasNotTerminalBefore = !terminalJobIds.has(job.id);

      if (isTerminal && wasNotTerminalBefore) {
        // Invalidate tickets cache when job transitions to terminal state
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.tickets(projectId),
        });

        // Track that we've processed this job's terminal state
        setTerminalJobIds((prev) => new Set(prev).add(job.id));
      }
    });
  }
}, [data?.jobs, terminalJobIds, projectId, queryClient]);
```

**Flow**:
1. **Job Polling**: Client polls `/api/projects/:projectId/jobs/status` every 2 seconds
2. **Terminal Detection**: Hook detects when job transitions to COMPLETED/FAILED/CANCELLED
3. **Cache Invalidation**: Automatically invalidates `queryKeys.projects.tickets(projectId)`
4. **Board Refetch**: TanStack Query refetches tickets from `/api/projects/:projectId/tickets`
5. **UI Update**: Board re-renders with updated ticket positions
6. **Deduplication**: Terminal job IDs tracked to prevent duplicate invalidations

**Benefits**:
- **Automatic**: No manual refresh required
- **Efficient**: Only invalidates when workflows complete (not during PENDING/RUNNING)
- **Consistent**: Uses existing TanStack Query infrastructure
- **Race-Safe**: TanStack Query deduplicates concurrent refetch requests
- **Eventual Consistency**: Server state is source of truth

**Edge Cases**:
- **Offline Recovery**: Board refetches when network reconnects (built-in TanStack Query feature)
- **Concurrent Workflows**: Multiple jobs finishing simultaneously → single API call via deduplication
- **Polling Stopped**: If all jobs terminal before invalidation, next job creation resumes polling
- **Manual Transitions**: Optimistic updates for drag-and-drop continue to work independently

### Implementation Pattern

```typescript
const { data } = useQuery({
  queryKey: ['comments', ticketId],
  queryFn: fetchComments,
  refetchInterval: isModalOpen ? 10000 : false,  // Conditional polling
  staleTime: 0,
});
```

## Error Handling

### Global Error Handler

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      onError: (error) => {
        console.error('Query error:', error);
        // Optionally show global error toast
      },
    },
    mutations: {
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});
```

### Per-Query Error Handling

```typescript
const { error, isError } = useQuery({
  queryKey: ['tickets'],
  queryFn: fetchTickets,
});

if (isError) {
  return <ErrorBoundary error={error} />;
}
```

### Mutation Error Recovery

```typescript
mutation.mutate(input, {
  onError: (error) => {
    if (error.message === 'VERSION_CONFLICT') {
      // Refetch and retry
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      toast.error('Please retry after refresh');
    } else {
      toast.error(error.message);
    }
  },
});
```

## Performance Optimization

### Request Deduplication

TanStack Query automatically deduplicates simultaneous identical queries:

```typescript
// Both components render simultaneously
function ComponentA() {
  const { data } = useTickets(1);  // Triggers API call
}

function ComponentB() {
  const { data } = useTickets(1);  // Uses same request
}

// Result: Only 1 API call made
```

### Prefetching

```typescript
// Prefetch before navigation
const queryClient = useQueryClient();

const handleTicketClick = (ticketId: number) => {
  queryClient.prefetchQuery({
    queryKey: queryKeys.projects.ticket(projectId, ticketId),
    queryFn: () => fetchTicket(projectId, ticketId),
  });

  // Navigate after prefetch starts
  router.push(`/projects/${projectId}/tickets/${ticketId}`);
};
```

### Optimistic Updates

Reduce perceived latency with optimistic updates:

1. Update cache immediately (onMutate)
2. Show changes to user
3. API call in background
4. Rollback if error, merge if success

**Performance Gain**: Feels instant (0ms perceived latency)

## Testing Patterns

### Test Query Client

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,  // Disable retries in tests
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function wrapper({ children }: { children: React.ReactNode }) {
  const testQueryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={testQueryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Testing Queries

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useTickets } from './useTickets';
import { wrapper } from './test-utils';

test('fetches tickets', async () => {
  const { result } = renderHook(() => useTickets(1), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(result.current.data.tickets).toHaveLength(2);
});
```

### Testing Mutations

```typescript
test('creates ticket with optimistic update', async () => {
  const { result } = renderHook(() => useCreateTicket(1), { wrapper });

  act(() => {
    result.current.mutate({ title: 'Test', description: 'Desc' });
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(result.current.data.title).toBe('Test');
});
```

## Best Practices

### Query Keys
- ✅ Use factory pattern (`queryKeys` object)
- ✅ Hierarchical structure for easy invalidation
- ✅ Never hardcode keys
- ❌ Don't use dynamic keys without factory

### Optimistic Updates
- ✅ Always return snapshot in `onMutate`
- ✅ Always rollback in `onError`
- ✅ Merge server response in `onSuccess`
- ❌ Don't skip version field

### Error Handling
- ✅ Handle errors in UI
- ✅ Show user-friendly messages
- ✅ Provide retry mechanisms
- ❌ Don't silently swallow errors

### Performance
- ✅ Use appropriate `staleTime` (default: 0)
- ✅ Enable request deduplication (automatic)
- ✅ Prefetch on hover/click
- ❌ Don't poll unnecessarily
