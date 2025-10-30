# Research: Real-Time UI Stage Synchronization

**Feature**: Real-Time UI Stage Synchronization
**Date**: 2025-10-30
**Status**: Complete

## Overview

This document consolidates research findings for implementing real-time UI stage synchronization in the AI Board application. The feature fixes a bug where workflow-initiated ticket stage transitions (quick-impl → VERIFY, auto-ship → SHIP) do not automatically update the UI without page refresh.

## Problem Analysis

### Current Behavior

**What Works**:
- Job status polling via `useJobPolling` hook (2-second interval)
- Database updates when workflows transition ticket stages
- Manual drag-and-drop stage transitions with optimistic updates
- TanStack Query cache management for tickets

**What's Broken**:
- UI does not detect when workflows transition tickets to new stages
- Polling hook only tracks job status changes (PENDING → RUNNING → COMPLETED)
- Tickets cache is not invalidated when workflow-initiated stage changes occur
- Users must manually refresh page to see correct ticket stage

### Root Cause

The `useJobPolling` hook currently detects terminal job status changes (COMPLETED, FAILED, CANCELLED) but does not trigger tickets cache invalidation. When a workflow transitions a ticket stage via API call, the job status changes to COMPLETED, but the UI continues displaying stale ticket data from the cache.

**Key Insight**: The existing polling infrastructure is functional and correctly detects job status changes. The missing piece is the link between job completion and tickets cache invalidation.

## TanStack Query Cache Invalidation Patterns

### Research Question
How should we invalidate the tickets cache when workflow-initiated stage transitions are detected?

### Decision: Invalidate on Terminal Job Status

**Approach**: When `useJobPolling` detects ANY job transitioning to terminal status (COMPLETED, FAILED, CANCELLED), invalidate the tickets cache to trigger refetch.

**Rationale**:
1. **Simplicity**: Single invalidation point in polling hook
2. **Correctness**: Terminal job always indicates potential ticket changes
3. **Existing Infrastructure**: Leverages TanStack Query's built-in cache management
4. **Performance**: 2-second polling interval already aggressive; one additional refetch per terminal job is acceptable
5. **Deduplication**: TanStack Query automatically deduplicates concurrent requests

### TanStack Query Cache Invalidation API

**Method**: `queryClient.invalidateQueries()`

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

const queryClient = useQueryClient();

// Invalidate tickets cache for a specific project
queryClient.invalidateQueries({
  queryKey: queryKeys.projects.tickets(projectId),
});
```

**Behavior** (from TanStack Query v5 docs):
- Marks queries as stale immediately
- Triggers background refetch if query is currently in use
- Does not clear cache data (preserves UI state during refetch)
- Respects `staleTime` configuration (current: 5 seconds for tickets)
- Automatic request deduplication if multiple invalidations occur rapidly

**Performance Characteristics**:
- Invalidation is synchronous (no network call)
- Refetch is asynchronous (happens in background)
- UI remains interactive during refetch
- No visual flicker (TanStack Query transitions smoothly)

### Alternative Approaches Considered

#### Option 1: Poll Tickets Endpoint Directly
**Rejected**: Duplicates existing polling logic; more API calls; no job status visibility

#### Option 2: WebSocket/SSE for Real-Time Updates
**Rejected**: Vercel serverless functions don't support long-lived connections; polling already provides acceptable 2-second latency

#### Option 3: Optimistic Updates on Workflow Dispatch
**Rejected**: Cannot predict workflow outcome; requires complex rollback logic; breaks separation of concerns

#### Option 4: Debounced Invalidation (Wait N seconds before invalidating)
**Rejected**: User experience trade-off (4-6s delay vs. < 2s); current 2-second interval already aggressive; one additional refetch per terminal job is acceptable (see spec.md decision 3)

## Terminal State Detection Logic

### Current Implementation

The `useJobPolling` hook already tracks terminal states:

```typescript
const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

function areAllJobsTerminal(jobs: JobStatusDto[]): boolean {
  if (jobs.length === 0) return false;
  return jobs.every(job => TERMINAL_STATUSES.has(job.status));
}
```

### Enhancement Required

**Add**: Detect newly terminal jobs (jobs that just transitioned to terminal status) and invalidate tickets cache.

**Implementation Strategy**:
1. Use `useRef` to track previous job state
2. Compare current jobs with previous jobs to detect new terminal transitions
3. Call `queryClient.invalidateQueries()` when transitions detected
4. Update ref with current state for next comparison

**Why useRef?**:
- Persists across renders without causing re-renders
- Avoids infinite loop (unlike useState which triggers re-render)
- Standard React pattern for tracking previous values

### Race Condition Handling

**Scenario**: What if multiple jobs transition to terminal status simultaneously?

**Solution**: TanStack Query's built-in request deduplication ensures only one refetch occurs, even if `invalidateQueries()` is called multiple times in rapid succession.

**Evidence**: TanStack Query documentation states: "Query invalidation is optimized to only trigger refetches if the query is currently being used and is stale."

## Testing Strategy

### Hybrid Testing Approach

Per constitution Principle III (Test-Driven Development):

1. **Vitest Unit Tests** (`tests/unit/useJobPolling.test.ts`):
   - Pure cache invalidation logic
   - Terminal state detection algorithm
   - useRef state tracking behavior
   - Fast feedback (~1ms per test)

2. **Playwright Integration Tests** (`tests/integration/real-time/job-polling.spec.ts`):
   - Polling hook + TanStack Query integration
   - Cache invalidation triggers refetch correctly
   - Concurrent job transitions handled
   - Moderate speed (~500ms per test)

3. **Playwright E2E Tests** (`tests/e2e/real-time/ui-stage-sync.spec.ts`):
   - Full workflow: ticket drag → workflow dispatch → stage transition → UI update
   - Quick-impl workflow (INBOX → BUILD → VERIFY)
   - Auto-ship workflow (VERIFY → SHIP)
   - Real user scenarios (~2s per test)

### Test Discovery Required

**Before creating test files**, search for existing tests:

```bash
# Search for existing useJobPolling tests
npx grep -r "useJobPolling" tests/

# Search for existing real-time test directory
npx glob "tests/**/real-time/*.spec.ts"

# Search for existing stage synchronization tests
npx grep -r "stage.*sync" tests/
```

**Action**: Update existing test files if found; create new files only if no existing coverage.

## Performance Analysis

### Current Polling Performance

- **Polling Interval**: 2 seconds (aggressive for real-time feel)
- **Endpoint Response Time**: < 100ms p95 (measured, per CLAUDE.md)
- **Query Deduplication**: Enabled via TanStack Query (single request per 2s interval)
- **Cache Time**: 5 minutes (gcTime) for tickets query

### Impact of Cache Invalidation

**Scenario**: Job transitions to COMPLETED status

1. **T+0s**: Polling hook detects terminal job
2. **T+0s**: `queryClient.invalidateQueries()` called (synchronous)
3. **T+0s**: TanStack Query marks tickets query as stale
4. **T+0s**: Background refetch triggered (async)
5. **T+0-100ms**: Tickets API responds with updated data
6. **T+100ms**: UI re-renders with new ticket stage

**Total Latency**: 0-100ms from detection to UI update

**Additional API Calls**: One additional tickets fetch per terminal job (acceptable given 2-second polling interval already aggressive)

**TanStack Query Optimizations**:
- Request deduplication (multiple invalidations = one refetch)
- Background refetching (UI remains responsive)
- Structural sharing (minimizes re-renders)

### Performance Monitoring

**Metrics to Track**:
- Tickets API response time (target: < 100ms p95)
- Polling endpoint response time (target: < 100ms p95)
- Time from workflow completion to UI update (target: < 3s)
- Cache hit rate (should remain high between invalidations)

**Alerting Thresholds**:
- If tickets API p95 > 150ms: Consider query optimization
- If polling endpoint p95 > 150ms: Consider job query optimization
- If UI update latency > 5s: Investigate polling or refetch failures

## Implementation Checklist

Based on research findings:

- [ ] Modify `useJobPolling.ts` to detect newly terminal jobs
- [ ] Add `useRef` to track previous job state
- [ ] Call `queryClient.invalidateQueries()` on terminal transitions
- [ ] Search for existing test files before creating new ones
- [ ] Write Vitest unit tests for terminal detection logic
- [ ] Write Playwright integration tests for cache invalidation
- [ ] Write Playwright E2E tests for workflow → UI synchronization
- [ ] Verify backward compatibility with manual drag-and-drop
- [ ] Test rapid successive transitions (multiple workflows chaining)
- [ ] Monitor API response times and cache performance

## References

- **TanStack Query v5 Documentation**: https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation
- **Existing Implementation**: `app/lib/hooks/useJobPolling.ts` (lines 102-128)
- **Query Keys Factory**: `app/lib/query-keys.ts`
- **Constitution**: `.specify/memory/constitution.md` (Principle III: TDD, hybrid testing strategy)
- **Feature Spec**: `specs/076-934-ui-stages/spec.md` (Auto-Resolved Decisions section)
