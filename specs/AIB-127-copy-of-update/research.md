# Research: Real-Time Ticket Modal Data Synchronization

**Feature Branch**: `AIB-127-copy-of-update`
**Date**: 2026-01-02

## Research Tasks Identified

1. **Root cause analysis**: Why modal doesn't show updated ticket data after job completion
2. **TanStack Query cache invalidation**: How invalidation flows to components
3. **React state lifecycle**: How modal state syncs with cache data
4. **Testing patterns**: Existing test infrastructure for this type of bug

---

## 1. Root Cause Analysis

### Decision: Modal correctly updates when cache is invalidated, but has edge cases

### Findings

**Data Flow Analysis** (from `components/board/board.tsx`):

```
Server (initial) → ticketsByStage prop → React Query cache seed (line 91-96)
                                              ↓
                                     useTicketsByStage() query (line 99)
                                              ↓
                                     allTickets = flat array (line 164-166)
                                              ↓
                                     selectedTicket = find by ID (line 170-173)
                                              ↓
                                     Modal ticket prop (line 1082)
                                              ↓
                                     localTicket state in modal (line 194, 218-235)
```

**Job Polling Flow** (from `app/lib/hooks/useJobPolling.ts`):
1. Polls every 2 seconds at `/api/projects/{projectId}/jobs/status`
2. Detects terminal status transitions (lines 110-117)
3. Calls `queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) })` (lines 120-124)

**Cache Invalidation → Refetch** (from `app/lib/hooks/queries/useTickets.ts`):
- `useTicketsByStage` shares query key with cache invalidation target
- `staleTime: 5000` means data is fresh for 5 seconds after fetch
- Invalidation marks data as stale → triggers refetch

**Modal State Update** (from `components/board/ticket-detail-modal.tsx`, lines 218-235):
```typescript
useEffect(() => {
  if (ticket) {
    setLocalTicket((current) => {
      // Only update if different ticket, newer version, or branch changed
      if (!current || current.id !== ticket.id ||
          current.version !== ticket.version || current.branch !== ticket.branch) {
        return ticket;
      }
      return current;
    });
  }
}, [ticket]);
```

**The Bug**: The modal correctly updates for `branch` changes (line 228), but there's a potential race condition:
1. Job completes → cache invalidated → refetch starts
2. User opens modal BEFORE refetch completes → sees stale `initialTicketsByStage`
3. Refetch completes → `ticketsByStage` updates → `selectedTicket` updates → modal prop updates → `localTicket` should update

**Actual Issue Identified**: The bug is in how the Stats tab receives data:
- `fullJobs` prop comes from `initialJobs.get(selectedTicket.id)` (board.tsx:1089)
- `initialJobs` is a static prop passed from server, never updated
- When jobs complete with new telemetry (cost, duration, etc.), `fullJobs` is stale

Similarly, if a job creates a branch:
- The branch is stored in the database
- `/api/projects/{projectId}/tickets` returns updated `branch` field
- Cache invalidation triggers refetch → `selectedTicket` should have new branch
- Modal's `localTicket` useEffect checks for branch changes

**Secondary Issue**: The modal's useEffect at line 218-235 has correct comparison logic, but the `initialJobs` prop (line 1089) is never refreshed.

### Alternatives Considered

1. **Full job refetch in modal**: Add a separate `useJobs` query in the modal
   - Rejected: Would duplicate job data between polling and modal, cause inconsistency

2. **Include jobs in tickets query**: Eager load jobs with tickets
   - Rejected: Would increase tickets endpoint payload significantly

3. **Invalidate jobs cache on terminal transition**: Add jobs to cache invalidation
   - Selected: Most aligned with existing patterns

### Rationale

The fix requires two changes:
1. **Ensure ticket cache refetch propagates to modal**: Verify the data flow works
2. **Add mechanism to refresh job data**: Either include jobs in ticket query or add jobs to cache invalidation

---

## 2. TanStack Query Cache Invalidation Patterns

### Decision: Use hierarchical query key invalidation

### Findings

**Query Keys** (from `app/lib/query-keys.ts`):
```typescript
projects: {
  tickets: (id) => ['projects', id, 'tickets'],
  ticket: (projectId, ticketId) => ['projects', projectId, 'tickets', ticketId],
  jobsStatus: (id) => ['projects', id, 'jobs', 'status'],
}
```

**Invalidation Pattern** (from `useJobPolling.ts`):
```typescript
queryClient.invalidateQueries({
  queryKey: queryKeys.projects.tickets(projectId),
});
```

This invalidates ALL ticket queries for the project, triggering refetch.

**Missing Invalidation**: When jobs complete, we need to also:
1. Invalidate individual ticket query: `queryKeys.projects.ticket(projectId, ticketId)`
2. Consider adding a fullJobs query that gets invalidated

### Alternatives Considered

1. **Optimistic update of ticket data**: When job completes, optimistically update ticket with expected data
   - Rejected: We don't know what fields changed (branch value, etc.) without refetching

2. **Include jobs in terminal transition callback**: Poll returns job data → update local state
   - Rejected: Polling returns lightweight JobStatusDto, not full job with telemetry

### Rationale

The cache invalidation is correctly set up. The issue is that:
1. `initialJobs` prop is static (server-side only)
2. `fullJobs` needs to be reactive (derived from query or updated via callback)

---

## 3. React State Lifecycle in Modal

### Decision: Modal correctly syncs with ticket prop, but fullJobs is disconnected

### Findings

**Modal Props** (from `ticket-detail-modal.tsx`):
- `ticket`: Reactive - comes from TanStack Query cache
- `jobs`: Reactive - comes from polling (`polledJobs`)
- `fullJobs`: Static - comes from `initialJobs` Map

**View Spec Button Logic** (lines 284-290):
```typescript
const hasCompletedSpecifyJob = useMemo(() => {
  if (!localTicket?.branch || jobs.length === 0) return false;
  return jobs.some(
    (job) => job.command === 'specify' && job.status === 'COMPLETED'
  );
}, [localTicket?.branch, jobs]);
```

This correctly uses:
- `localTicket?.branch` - updates when ticket refetched
- `jobs` - updates from polling

**Stats Tab Logic** (lines 250-251):
```typescript
const hasJobs = fullJobs.length > 0;
```

This uses `fullJobs` which is never updated after initial server render.

### Solution Architecture

**Option A**: Add a `useTicketJobs` query hook that fetches full job data
- Pros: Clean separation, follows existing patterns
- Cons: Additional API endpoint needed

**Option B**: Include full jobs in ticket refetch response
- Pros: Single data source for ticket + jobs
- Cons: Larger payload, architectural change

**Option C**: Merge polled job data with initialJobs in parent component
- Pros: No new API calls, uses existing infrastructure
- Cons: Polled data lacks telemetry (cost, duration, tokens)

**Selected: Option A** - Add a `useTicketJobs` query that fetches full jobs for selected ticket, invalidated on terminal job transition.

### Rationale

Option A is cleanest because:
1. Follows existing TanStack Query patterns
2. Only fetches when modal is open (enabled: isModalOpen)
3. Invalidated by same terminal job detection logic
4. Maintains separation of concerns

---

## 4. Testing Patterns

### Decision: Extend existing test suites per Testing Trophy

### Findings

**Existing Tests**:
1. `tests/unit/useJobPolling.test.ts` - Tests cache invalidation on terminal job
2. `tests/unit/components/*.test.tsx` - RTL component tests for modals
3. `tests/integration/jobs/status.test.ts` - Job API tests

**Test Gaps Identified**:
1. No integration test for: "terminal job → ticket refetch → modal sees new data"
2. No component test for: TicketDetailModal reactivity to prop changes
3. No test for: Stats tab using reactive job data

**Test Strategy**:

| Test Type | Scope | File |
|-----------|-------|------|
| Integration | Cache invalidation triggers ticket refetch | Extend `tests/unit/useJobPolling.test.ts` |
| Component | Modal updates when ticket prop changes | New `tests/unit/components/ticket-detail-modal.test.tsx` |
| Component | Stats tab updates when jobs change | Same file as above |

**RTL Test Pattern** (from existing tests):
```typescript
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('TicketDetailModal', () => {
  it('should show View Specification button when ticket has branch and completed specify job', () => {
    renderWithProviders(
      <TicketDetailModal
        ticket={mockTicketWithBranch}
        jobs={[{ id: 1, command: 'specify', status: 'COMPLETED' }]}
        fullJobs={[]}
        ...
      />
    );
    expect(screen.getByRole('button', { name: /view specification/i })).toBeInTheDocument();
  });
});
```

### Rationale

Following Testing Trophy:
- Integration tests for data flow (cache → refetch → component)
- Component tests for UI behavior (modal reactivity)
- No E2E needed - this is not a browser-required feature

---

## Summary of Research Findings

### Root Cause

The modal's `fullJobs` prop is static (from server-side `initialJobs` Map), never updated after initial render. The ticket data flow is correct, but job telemetry data for Stats tab is stale.

### Solution Architecture

1. **Create `useTicketJobs` hook**: Fetch full job data for selected ticket
2. **Add cache invalidation**: Invalidate jobs query on terminal job transition
3. **Update modal**: Use `useTicketJobs` instead of static `fullJobs` prop

### Implementation Approach

1. Create `app/lib/hooks/queries/useTicketJobs.ts` with query for `/api/projects/{projectId}/tickets/{ticketId}/jobs`
2. Add API endpoint if not exists: `GET /api/projects/{projectId}/tickets/{ticketId}/jobs`
3. Update `useJobPolling.ts` to also invalidate ticket jobs query on terminal transition
4. Update `board.tsx` to pass query data instead of static prop to modal
5. Write tests per Testing Trophy

### Files to Modify

| File | Change |
|------|--------|
| `app/lib/hooks/queries/useTicketJobs.ts` | New file - fetch full jobs for ticket |
| `app/lib/hooks/useJobPolling.ts` | Add jobs query invalidation |
| `app/lib/query-keys.ts` | Add ticketJobs key |
| `components/board/board.tsx` | Use useTicketJobs for modal fullJobs |
| `app/api/projects/[projectId]/tickets/[ticketId]/jobs/route.ts` | New endpoint (if needed) |
| `tests/unit/useJobPolling.test.ts` | Extend for jobs invalidation |
| `tests/unit/components/ticket-detail-modal.test.tsx` | New file - modal reactivity tests |
