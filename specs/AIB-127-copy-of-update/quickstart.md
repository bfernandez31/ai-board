# Quickstart: Real-Time Ticket Modal Data Synchronization

**Feature Branch**: `AIB-127-copy-of-update`
**Date**: 2026-01-02

## Implementation Summary

Fix ticket modal to display real-time data updates when jobs complete, specifically:
1. Branch name and "View Specification" button after SPECIFY job completes
2. Stats tab with up-to-date job telemetry data
3. Modal updates while open when job transitions to terminal status

## Key Files to Modify

### Core Implementation

| File | Purpose |
|------|---------|
| `app/lib/query-keys.ts` | Add `ticketJobs` query key |
| `app/lib/hooks/queries/useTicketJobs.ts` | New hook for fetching ticket jobs |
| `app/lib/hooks/useJobPolling.ts` | Add ticketJobs cache invalidation |
| `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` | Enhance to return telemetry |
| `components/board/board.tsx` | Use useTicketJobs for modal fullJobs |

### Test Files

| File | Purpose |
|------|---------|
| `tests/unit/useJobPolling.test.ts` | Extend for jobs invalidation |
| `tests/unit/components/ticket-detail-modal.test.tsx` | New - modal reactivity tests |

## Implementation Steps

### Step 1: Add Query Key

**File**: `app/lib/query-keys.ts`

```typescript
projects: {
  // ... existing keys
  ticketJobs: (projectId: number, ticketId: number) =>
    ['projects', projectId, 'tickets', ticketId, 'jobs'] as const,
}
```

### Step 2: Enhance Jobs Endpoint

**File**: `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`

Update the `select` clause to include telemetry fields:

```typescript
const jobs = await prisma.job.findMany({
  where: { ticketId: ticketId },
  select: {
    id: true,
    command: true,
    status: true,
    startedAt: true,
    completedAt: true,
    inputTokens: true,
    outputTokens: true,
    cacheReadTokens: true,
    cacheCreationTokens: true,
    costUsd: true,
    durationMs: true,
    model: true,
    toolsUsed: true,
  },
  orderBy: { id: 'asc' },
});
```

### Step 3: Create useTicketJobs Hook

**File**: `app/lib/hooks/queries/useTicketJobs.ts`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';

export function useTicketJobs(
  projectId: number,
  ticketId: number | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.projects.ticketJobs(projectId, ticketId || 0),
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/jobs`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: HTTP ${response.status}`);
      }
      return response.json() as Promise<TicketJobWithTelemetry[]>;
    },
    enabled: enabled && ticketId !== null,
    staleTime: 5000,
    gcTime: 10 * 60 * 1000,
  });
}
```

### Step 4: Add Cache Invalidation

**File**: `app/lib/hooks/useJobPolling.ts`

In the terminal job detection useEffect, add:

```typescript
if (newlyTerminal.length > 0) {
  // Existing tickets invalidation
  queryClient.invalidateQueries({
    queryKey: queryKeys.projects.tickets(projectId),
  });

  // NEW: Invalidate ticket jobs for each terminal job
  for (const job of newlyTerminal) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.projects.ticketJobs(projectId, job.ticketId),
    });
  }
}
```

### Step 5: Update Board Component

**File**: `components/board/board.tsx`

Replace static `initialJobs` with reactive query:

```typescript
// Import the new hook
import { useTicketJobs } from '@/app/lib/hooks/queries/useTicketJobs';

// In BoardContent component, add:
const { data: selectedTicketJobs = [] } = useTicketJobs(
  projectId,
  selectedTicketId,
  isModalOpen
);

// Update modal prop:
<TicketDetailModal
  // ... existing props
  fullJobs={selectedTicketJobs}
/>
```

### Step 6: Seed Cache from Initial Data

**File**: `components/board/board.tsx`

Add cache seeding for initial jobs:

```typescript
// Seed ticket jobs cache with server data
React.useEffect(() => {
  for (const [ticketId, jobs] of initialJobs.entries()) {
    if (jobs.length > 0) {
      queryClient.setQueryData(
        queryKeys.projects.ticketJobs(projectId, ticketId),
        jobs
      );
    }
  }
}, [projectId, initialJobs, queryClient]);
```

## Testing Strategy

### Integration Tests (Vitest)

1. **Cache invalidation triggers jobs refetch**
   - Mock terminal job transition
   - Verify `ticketJobs` query invalidated

2. **Jobs endpoint returns telemetry**
   - Call endpoint with valid IDs
   - Verify response includes telemetry fields

### Component Tests (RTL + Vitest)

1. **Modal shows branch after ticket prop update**
   - Render modal without branch
   - Update ticket prop with branch
   - Verify branch badge visible

2. **Modal shows View Spec button when conditions met**
   - Render modal with branch and completed specify job
   - Verify button visible and clickable

3. **Stats tab updates when jobs change**
   - Render modal with Stats tab open
   - Update fullJobs prop
   - Verify stats recalculate

## Verification Checklist

- [ ] Terminal job transition invalidates tickets cache
- [ ] Terminal job transition invalidates ticketJobs cache
- [ ] Modal shows branch immediately after job completion
- [ ] View Specification button appears without page reload
- [ ] Stats tab shows accurate telemetry data
- [ ] Open modal updates when job completes in background
- [ ] All existing tests pass
- [ ] New tests cover key scenarios

## Related Files Reference

- `app/lib/hooks/queries/useTickets.ts` - Pattern reference for query hook
- `tests/unit/useJobPolling.test.ts` - Pattern reference for cache tests
- `tests/utils/component-test-utils.tsx` - RTL test utilities
- `lib/types/job-types.ts` - TicketJobWithTelemetry type definition
