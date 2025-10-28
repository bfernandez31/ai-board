# Implementation Quickstart: Board Real-Time Update on Workflow Stage Transitions

## Overview

Fix board real-time updates for workflow-initiated stage transitions by adding cache invalidation to the `useJobPolling` hook. When jobs reach terminal status (COMPLETED/FAILED/CANCELLED), invalidate the tickets cache to trigger automatic refetch and board update.

## Prerequisites

1. **Read research findings**: `specs/068-923-update-the/research.md`
2. **Review existing patterns**: `app/lib/hooks/mutations/useStageTransition.ts:87-93`
3. **Understand query keys**: `app/lib/query-keys.ts:33`
4. **Search for existing tests**: `npx grep -r "useJobPolling" tests/`

## Implementation Steps

### Step 1: Modify useJobPolling Hook

**File**: `app/lib/hooks/useJobPolling.ts`

**Changes**:
1. Import `useQueryClient` and `useEffect` from React/TanStack Query
2. Add `useRef` to track previous jobs state
3. Add `useEffect` to detect terminal status transitions
4. Call `queryClient.invalidateQueries()` when terminal status detected

**Code Pattern** (simplified):
```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';

export function useJobPolling(projectId: number, pollingInterval: number = 2000) {
  const queryClient = useQueryClient();
  const previousJobsRef = useRef<JobStatusDto[]>([]);

  // Existing useQuery logic remains unchanged
  const { data, error, isFetching, dataUpdatedAt, failureCount } = useQuery({
    // ... existing query options
  });

  const jobs = data || [];

  // NEW: Detect terminal status transitions and invalidate tickets cache
  useEffect(() => {
    // Skip on initial mount (no previous jobs to compare)
    if (previousJobsRef.current.length === 0 && jobs.length > 0) {
      previousJobsRef.current = jobs;
      return;
    }

    // Find jobs that transitioned to terminal status
    const newlyTerminal = jobs.filter(job => {
      const isTerminal = TERMINAL_STATUSES.has(job.status);
      const wasTerminal = previousJobsRef.current.some(
        prev => prev.id === job.id && TERMINAL_STATUSES.has(prev.status)
      );
      return isTerminal && !wasTerminal;
    });

    // Invalidate tickets cache when workflow completes
    if (newlyTerminal.length > 0) {
      console.log('[useJobPolling] Detected terminal jobs:', newlyTerminal);
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.tickets(projectId),
      });
    }

    // Update previous state for next comparison
    previousJobsRef.current = jobs;
  }, [jobs, projectId, queryClient]);

  // Existing return statement unchanged
  return { jobs, isPolling, lastPollTime, errorCount, error };
}
```

**Key Points**:
- Use `useRef` to avoid triggering re-renders on state changes
- Skip invalidation on initial mount (prevent false positive)
- Only invalidate when status changes from non-terminal to terminal
- Use existing `TERMINAL_STATUSES` constant for consistency
- Add console logging for debugging (remove in production if desired)

**Testing Hook** (before moving to Step 2):
```bash
# Run unit tests for useJobPolling
bun run test:unit useJobPolling
```

---

### Step 2: Add Unit Tests

**File Search** (mandatory per Constitution):
```bash
# Search for existing useJobPolling tests
npx grep -r "useJobPolling" tests/

# Expected result: tests/unit/useJobPolling.test.ts
```

**Action**: Extend existing test file (do NOT create new file)

**File**: `tests/unit/useJobPolling.test.ts`

**New Test Cases**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJobPolling } from '@/app/lib/hooks/useJobPolling';
import type { JobStatusDto } from '@/app/lib/schemas/job-polling';

describe('useJobPolling - Cache Invalidation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it('should invalidate tickets cache when job transitions to COMPLETED', async () => {
    // Spy on invalidateQueries
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Mock fetch to return job with RUNNING status, then COMPLETED
    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      const jobs: JobStatusDto[] = callCount === 1
        ? [{ id: 1, ticketId: 10, status: 'RUNNING', updatedAt: new Date().toISOString() }]
        : [{ id: 1, ticketId: 10, status: 'COMPLETED', updatedAt: new Date().toISOString() }];

      return Promise.resolve({
        ok: true,
        json: async () => ({ jobs }),
      } as Response);
    });

    // Render hook
    const { result } = renderHook(() => useJobPolling(1, 100), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    // Wait for first poll (RUNNING status)
    await waitFor(() => expect(result.current.jobs.length).toBe(1));

    // Wait for second poll (COMPLETED status)
    await waitFor(() => expect(result.current.jobs[0].status).toBe('COMPLETED'));

    // Verify invalidateQueries was called with correct query key
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets'],
    });
  });

  it('should NOT invalidate cache on initial load', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    global.fetch = vi.fn(() => {
      const jobs: JobStatusDto[] = [
        { id: 1, ticketId: 10, status: 'COMPLETED', updatedAt: new Date().toISOString() },
      ];
      return Promise.resolve({
        ok: true,
        json: async () => ({ jobs }),
      } as Response);
    });

    const { result } = renderHook(() => useJobPolling(1, 100), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.jobs.length).toBe(1));

    // Should NOT invalidate on initial load (job was already COMPLETED)
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('should invalidate cache for multiple jobs transitioning simultaneously', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      const jobs: JobStatusDto[] = callCount === 1
        ? [
            { id: 1, ticketId: 10, status: 'RUNNING', updatedAt: new Date().toISOString() },
            { id: 2, ticketId: 11, status: 'RUNNING', updatedAt: new Date().toISOString() },
          ]
        : [
            { id: 1, ticketId: 10, status: 'COMPLETED', updatedAt: new Date().toISOString() },
            { id: 2, ticketId: 11, status: 'FAILED', updatedAt: new Date().toISOString() },
          ];

      return Promise.resolve({
        ok: true,
        json: async () => ({ jobs }),
      } as Response);
    });

    renderHook(() => useJobPolling(1, 100), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());

    // Should only invalidate once (TanStack Query deduplicates)
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('should NOT invalidate cache when job transitions from PENDING to RUNNING', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      const jobs: JobStatusDto[] = callCount === 1
        ? [{ id: 1, ticketId: 10, status: 'PENDING', updatedAt: new Date().toISOString() }]
        : [{ id: 1, ticketId: 10, status: 'RUNNING', updatedAt: new Date().toISOString() }];

      return Promise.resolve({
        ok: true,
        json: async () => ({ jobs }),
      } as Response);
    });

    renderHook(() => useJobPolling(1, 100), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2), { timeout: 500 });

    // Should NOT invalidate (neither PENDING nor RUNNING is terminal)
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
```

**Run Tests**:
```bash
# Run unit tests
bun run test:unit useJobPolling

# Expected: 4 new tests pass (total ~15-20 tests for entire file)
```

---

### Step 3: Add E2E Tests

**File Search** (mandatory per Constitution):
```bash
# Search for existing board E2E tests
npx glob "tests/e2e/**/*board*.spec.ts"

# Expected results: tests/e2e/board/*.spec.ts
```

**Action**: Create new test file for workflow transitions (distinct from manual transitions)

**File**: `tests/e2e/board/workflow-transitions.spec.ts` (NEW)

**Test Cases**:
```typescript
import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../../helpers/db-cleanup';
import { createTicket } from '../../helpers/api-helpers';

test.describe('Board - Workflow-Initiated Stage Transitions', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test('should update board when workflow transitions ticket to VERIFY', async ({
    page,
    request,
  }) => {
    // Create ticket in BUILD stage
    const ticket = await createTicket(request, {
      title: '[e2e] Workflow transition test',
      description: 'Test workflow-initiated stage transition',
      stage: 'BUILD',
      projectId: 1,
    });

    // Navigate to board
    await page.goto('http://localhost:3000/projects/1/board');

    // Verify ticket in BUILD column
    const buildColumn = page.locator('[data-stage="BUILD"]');
    await expect(buildColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();

    // Simulate workflow completion: Create job and mark as COMPLETED
    const jobResponse = await request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
      data: {
        targetStage: 'VERIFY',
        version: ticket.version,
      },
    });
    expect(jobResponse.ok()).toBeTruthy();
    const updatedTicket = await jobResponse.json();

    // Mark job as COMPLETED (simulating workflow)
    const job = await request.post(`/api/projects/1/jobs`, {
      data: {
        ticketId: ticket.id,
        command: 'test-workflow',
        status: 'RUNNING',
      },
    });
    const jobData = await job.json();

    await request.patch(`/api/jobs/${jobData.id}/status`, {
      data: { status: 'COMPLETED' },
    });

    // Wait for board to update (within 2 seconds)
    const verifyColumn = page.locator('[data-stage="VERIFY"]');
    await expect(verifyColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible({
      timeout: 3000,
    });

    // Verify ticket no longer in BUILD column
    await expect(buildColumn.locator(`[data-ticket-id="${ticket.id}"]`)).not.toBeVisible();
  });

  test('should update board when quick-impl workflow completes', async ({
    page,
    request,
  }) => {
    // Create ticket in INBOX stage
    const ticket = await createTicket(request, {
      title: '[e2e] Quick-impl workflow test',
      description: 'Test quick-impl workflow completion',
      stage: 'INBOX',
      projectId: 1,
    });

    await page.goto('http://localhost:3000/projects/1/board');

    // Verify ticket in INBOX column
    const inboxColumn = page.locator('[data-stage="INBOX"]');
    await expect(inboxColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();

    // Simulate quick-impl: INBOX → BUILD → VERIFY
    const transitionResponse = await request.post(
      `/api/projects/1/tickets/${ticket.id}/transition`,
      {
        data: {
          targetStage: 'BUILD',
          version: ticket.version,
        },
      }
    );
    expect(transitionResponse.ok()).toBeTruthy();

    // Create and complete job
    const job = await request.post(`/api/projects/1/jobs`, {
      data: {
        ticketId: ticket.id,
        command: 'quick-impl',
        status: 'RUNNING',
      },
    });
    const jobData = await job.json();

    await request.patch(`/api/jobs/${jobData.id}/status`, {
      data: { status: 'COMPLETED' },
    });

    // Wait for board to update (ticket should appear in VERIFY after workflow)
    const verifyColumn = page.locator('[data-stage="VERIFY"]');
    await expect(verifyColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible({
      timeout: 3000,
    });
  });

  test('should not break manual drag-and-drop transitions', async ({ page, request }) => {
    // Regression test: Ensure cache invalidation doesn't interfere with manual transitions
    const ticket = await createTicket(request, {
      title: '[e2e] Manual transition test',
      description: 'Verify manual transitions still work',
      stage: 'INBOX',
      projectId: 1,
    });

    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
    const specifyColumn = page.locator('[data-stage="SPECIFY"]');

    // Drag ticket from INBOX to SPECIFY
    await ticketCard.dragTo(specifyColumn);

    // Verify immediate optimistic update (should be visible instantly)
    await expect(specifyColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible({
      timeout: 500, // Optimistic update should be < 100ms
    });
  });
});
```

**Run Tests**:
```bash
# Run E2E tests
bun run test:e2e board/workflow-transitions

# Expected: 3 new tests pass
```

**Note**: These tests require working job creation and status update APIs. Adjust test setup based on your project's API helpers.

---

### Step 4: Verify Board Component Integration

**File**: `components/board/board.tsx`

**Current Implementation** (verify, no changes needed):
```typescript
// Board already uses useJobPolling and useTickets
const { jobs, isPolling } = useJobPolling(projectId);
const { data: ticketsByStage } = useTicketsByStage(projectId);

// TanStack Query automatically refetches when tickets cache invalidated
// Board re-renders with updated ticket positions
```

**Manual Testing**:
1. Start dev server: `bun run dev`
2. Navigate to board: `http://localhost:3000/projects/1/board`
3. Create ticket in BUILD stage
4. Manually trigger workflow completion via API:
   ```bash
   curl -X POST http://localhost:3000/api/projects/1/tickets/[ID]/transition \
     -H "Content-Type: application/json" \
     -d '{"targetStage": "VERIFY", "version": 1}'

   curl -X PATCH http://localhost:3000/api/jobs/[JOB_ID]/status \
     -H "Content-Type: application/json" \
     -d '{"status": "COMPLETED"}'
   ```
5. Observe ticket moves to VERIFY column within 2 seconds (no page refresh)

---

## Rollout Plan

### Phase 1: Implementation
1. ✅ Modify `useJobPolling` hook (Step 1)
2. ✅ Add unit tests (Step 2)
3. ✅ Add E2E tests (Step 3)
4. ✅ Verify board integration (Step 4)

### Phase 2: Testing
1. Run full test suite: `bun test`
2. Verify all tests pass (unit + E2E)
3. Manual testing on dev environment
4. Test concurrent workflow completions (multiple tickets)

### Phase 3: Deployment
1. Create pull request with changes
2. Code review focusing on:
   - Cache invalidation logic correctness
   - Test coverage completeness
   - Performance impact (none expected)
3. Merge to main branch
4. Deploy to production (Vercel auto-deploy)
5. Monitor Vercel logs for errors

### Phase 4: Validation
1. Test on production board with real workflows
2. Verify board updates within 2 seconds of workflow completion
3. Verify no regressions in manual transitions
4. Monitor performance (no additional API load expected)

---

## Troubleshooting

### Issue: Board not updating after workflow completion

**Diagnosis**:
```bash
# Check browser console for invalidation logs
# Expected: "[useJobPolling] Detected terminal jobs: [...]"
```

**Possible Causes**:
1. Job polling stopped (all jobs already terminal)
2. Cache invalidation not triggered (logic error)
3. Tickets query not refetching after invalidation

**Solution**:
- Verify job status changes from RUNNING to COMPLETED
- Check `newlyTerminal` filter logic (may need debugging)
- Verify `queryClient.invalidateQueries()` called with correct query key

---

### Issue: Infinite invalidation loop

**Symptoms**: High API request rate, browser becomes unresponsive

**Possible Causes**:
- `previousJobsRef.current` not updated correctly
- `useEffect` dependency array missing `queryClient`
- Terminal status detection logic incorrect

**Solution**:
- Add guard to skip invalidation on initial mount
- Ensure `previousJobsRef.current = jobs` runs after every effect
- Verify `TERMINAL_STATUSES.has()` check is correct

---

### Issue: Unit tests failing

**Common Errors**:
- `queryClient.invalidateQueries is not a function`: Mock `queryClient` correctly
- `Cannot read property 'jobs' of undefined`: Wrap hook in `QueryClientProvider`
- `Test timeout`: Reduce polling interval in tests (e.g., 100ms instead of 2000ms)

**Solution**:
- Review existing test setup in `tests/helpers/test-query-client.ts`
- Use `renderHook` from `@testing-library/react`
- Mock `global.fetch` to return controlled job status responses

---

## References

- **Research**: `specs/068-923-update-the/research.md`
- **Data Model**: `specs/068-923-update-the/data-model.md`
- **API Contracts**: `specs/068-923-update-the/contracts/api-contracts.md`
- **Existing Pattern**: `app/lib/hooks/mutations/useStageTransition.ts:87-93`
- **Query Keys**: `app/lib/query-keys.ts:33`
- **Job Polling Hook**: `app/lib/hooks/useJobPolling.ts`
- **Tickets Query**: `app/lib/hooks/queries/useTickets.ts`
- **Constitution**: `.specify/memory/constitution.md:82-112` (TDD requirements)
