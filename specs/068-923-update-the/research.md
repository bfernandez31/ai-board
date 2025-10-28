# Research: Board Real-Time Update on Workflow Stage Transitions

## Decision: Use `queryClient.invalidateQueries()` for Cache Invalidation

**Rationale**: TanStack Query provides `invalidateQueries()` as the standard mechanism for marking cached data as stale and triggering refetch. This is the same pattern used in `useStageTransition` hook (line 87-93) for manual transitions.

**Alternatives Considered**:
1. **Manual refetch**: Calling `refetch()` directly on useTickets query
   - Rejected: Doesn't work across multiple component instances
   - Rejected: Requires passing refetch function between components
   - Rejected: Less idiomatic TanStack Query pattern

2. **Adding new polling endpoint**: Creating separate endpoint for workflow-updated tickets
   - Rejected: Duplicates existing `/api/projects/:id/tickets` endpoint
   - Rejected: Increases API surface area and maintenance burden
   - Rejected: Polling already exists via `useJobPolling`, just needs cache integration

3. **Server-Sent Events (SSE)**: Real-time push notifications
   - Rejected: Already removed from codebase (see CLAUDE.md migration notes)
   - Rejected: Doesn't work on Vercel serverless (connection timeouts)
   - Rejected: Polling with 2s interval provides adequate UX

**Implementation Pattern** (from `useStageTransition.ts:87-93`):
```typescript
queryClient.invalidateQueries({
  queryKey: queryKeys.projects.tickets(projectId),
});
```

**References**:
- Existing pattern: `app/lib/hooks/mutations/useStageTransition.ts:87-93`
- Query keys: `app/lib/query-keys.ts:33`
- Hierarchical invalidation: `app/lib/query-keys.ts:11-13` (comments explain invalidation tree)

---

## Decision: Trigger Invalidation on Terminal Job Status

**Rationale**: Job status changes from PENDING/RUNNING to terminal states (COMPLETED/FAILED/CANCELLED) indicate workflow completion. This is when ticket stage transitions occur in the database.

**Alternatives Considered**:
1. **Invalidate on every job status change**: Including PENDING → RUNNING
   - Rejected: Causes unnecessary API requests while workflows are still executing
   - Rejected: Ticket stage doesn't change during PENDING/RUNNING states
   - Rejected: Terminal state detection already implemented in `useJobPolling.ts:36`

2. **Invalidate only on COMPLETED**: Ignore FAILED/CANCELLED
   - Rejected: Failed workflows may still update ticket metadata (error messages, logs)
   - Rejected: Cancelled workflows may roll back stage transitions
   - Rejected: All terminal states should trigger board refresh for consistency

3. **Use `refetchInterval` callback**: Modify existing polling logic
   - Rejected: `refetchInterval` only controls polling frequency, not cache invalidation
   - Rejected: Doesn't invalidate tickets query, only jobs query
   - Rejected: Need explicit invalidation to trigger tickets refetch

**Implementation Location**: `useJobPolling` hook
- Detect terminal status transition: Compare previous `jobs` state with current state
- Trigger invalidation when status changes from non-terminal to terminal
- Use `useQueryClient()` hook to access query client instance

**Terminal Status Definition** (from `useJobPolling.ts:36`):
```typescript
const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);
```

**References**:
- Terminal status check: `useJobPolling.ts:41-44`
- Job polling hook: `useJobPolling.ts:53-108`
- Job status types: `app/lib/schemas/job-polling.ts`

---

## Decision: Use `useEffect` for Side-Effect Detection

**Rationale**: Cache invalidation is a side effect triggered by state changes (job status reaching terminal). React's `useEffect` is the standard hook for performing side effects in response to state changes.

**Alternatives Considered**:
1. **Inline invalidation in query callback**: Call `invalidateQueries()` inside `useQuery` return
   - Rejected: Query callbacks should be pure (data fetching only)
   - Rejected: Violates separation of concerns (data fetching vs. cache management)
   - Rejected: May cause infinite loops if not carefully guarded

2. **Event emitter pattern**: Publish event when job reaches terminal status
   - Rejected: Over-engineered for single use case
   - Rejected: Introduces new architecture pattern not used elsewhere in codebase
   - Rejected: `useEffect` is sufficient and idiomatic React

3. **Mutation hook**: Wrap job polling in `useMutation` instead of `useQuery`
   - Rejected: Job polling is a query (read operation), not a mutation (write operation)
   - Rejected: Mutations don't support automatic polling (`refetchInterval`)
   - Rejected: Semantic mismatch (polling is not mutating data)

**Implementation Pattern**:
```typescript
const previousJobsRef = useRef<JobStatusDto[]>([]);

useEffect(() => {
  // Detect jobs that transitioned to terminal status
  const newlyTerminal = jobs.filter(job =>
    TERMINAL_STATUSES.has(job.status) &&
    !previousJobsRef.current.some(prev => prev.id === job.id && TERMINAL_STATUSES.has(prev.status))
  );

  if (newlyTerminal.length > 0) {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) });
  }

  previousJobsRef.current = jobs;
}, [jobs, projectId, queryClient]);
```

**Guard Conditions**:
- Only invalidate if jobs actually transitioned (not on initial load)
- Use `useRef` to track previous state without causing re-renders
- Dependency array includes `jobs`, `projectId`, and `queryClient`

**References**:
- React useEffect: https://react.dev/reference/react/useEffect
- React useRef: https://react.dev/reference/react/useRef
- TanStack Query invalidation: https://tanstack.com/query/latest/docs/react/guides/query-invalidation

---

## Best Practices: TanStack Query Cache Invalidation

**Hierarchical Invalidation** (from `query-keys.ts:11-13`):
- `['projects']` invalidates ALL project queries (tickets, jobs, settings)
- `['projects', 1]` invalidates ALL queries for project 1
- `['projects', 1, 'tickets']` invalidates ONLY tickets for project 1

**Current Feature**: Use specific invalidation to minimize refetch scope
```typescript
// CORRECT: Only invalidate tickets, not jobs or settings
queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) });

// AVOID: Invalidates ALL project queries unnecessarily
queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
```

**Invalidation Timing** (from `useStageTransition.ts:84-94`):
- `onMutate`: Set optimistic updates (manual transitions)
- `onError`: Rollback optimistic updates
- `onSuccess`: Invalidate queries to refetch server state

**Current Feature**: Invalidation happens in `useEffect` (not mutation hook)
- Job polling detects terminal status → triggers useEffect
- useEffect calls `invalidateQueries()` → TanStack Query refetches tickets
- Board re-renders with updated ticket positions

**Deduplication**: TanStack Query automatically deduplicates concurrent requests
- Multiple components using `useTickets()` share same cache
- Single invalidation triggers single refetch, all components update
- No need for manual deduplication logic

**References**:
- Query key factory: `app/lib/query-keys.ts`
- Mutation pattern: `app/lib/hooks/mutations/useStageTransition.ts`
- Query pattern: `app/lib/hooks/queries/useTickets.ts`

---

## Performance Considerations

**Polling Interval**: 2 seconds (existing setting)
- Provides "real-time feel" without excessive server load
- Aligns with Job polling SLA (<2s update latency)
- Already implemented in `useJobPolling.ts:55`

**Cache Stale Time**: 5 seconds (existing setting)
- Tickets marked stale after 5s (`useTickets.ts:37`)
- Invalidation forces immediate refetch regardless of stale time
- After refetch, tickets remain fresh for 5s

**Race Condition Handling**: TanStack Query built-in
- Query cancellation prevents stale responses overwriting fresh data
- Latest request wins (older requests ignored if newer one completes first)
- No manual race condition handling needed

**Memory**: Minimal overhead
- `useRef` stores previous jobs array (typically <10 items)
- Terminal status detection is O(n×m) where n=current jobs, m=previous jobs
- Acceptable complexity for small datasets (max 50 concurrent jobs unlikely)

**Network**: Single additional request per workflow completion
- Invalidation triggers one `/api/projects/:id/tickets` request
- Existing optimistic updates already handle manual transitions
- No duplicate requests (TanStack Query deduplication)

**References**:
- Job polling performance: `useJobPolling.ts:76-91` (staleTime, gcTime, refetchInterval)
- Tickets query performance: `useTickets.ts:36-40` (staleTime, gcTime)
- Race condition handling: `useStageTransition.ts:54` (cancelQueries)

---

## Testing Strategy

**Unit Tests** (Vitest):
- Test terminal status detection logic in isolation
- Mock `queryClient.invalidateQueries()` and verify it's called correctly
- Test guard conditions (no invalidation on initial load)
- Test edge cases (empty jobs array, all jobs already terminal)

**Integration Tests** (Playwright):
- Test real workflow completion → board update flow
- Verify ticket moves to correct stage after workflow completes
- Test concurrent workflow completions (multiple tickets)
- Test error cases (workflow failure, cancellation)

**Test Utilities**:
- Mock TanStack Query client: `tests/helpers/test-query-client.ts`
- Job polling test setup: Search for existing tests in `tests/unit/useJobPolling.test.ts`
- E2E workflow simulation: Search for existing tests in `tests/e2e/real-time/`

**Test Discovery** (per Constitution Principle III):
1. Search for existing job polling tests: `npx grep -r "useJobPolling" tests/`
2. Search for existing board tests: `npx glob "tests/**/*board*.spec.ts"`
3. Extend existing tests rather than creating duplicates
4. Only create new test file if no existing coverage found

**References**:
- Constitution testing rules: `.specify/memory/constitution.md:82-112`
- Existing test patterns: `tests/unit/useJobPolling.test.ts`, `tests/e2e/real-time/`
- Test commands: `bun run test:unit`, `bun run test:e2e`
