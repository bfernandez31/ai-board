# Research: Ticket Modal Real-Time Data Refresh

**Feature**: AIB-128
**Date**: 2026-01-02

## Research Tasks Completed

### 1. TanStack Query Cache Invalidation Patterns

**Decision**: Use existing `queryClient.invalidateQueries()` pattern with query key hierarchy

**Rationale**:
- Already proven in `useJobPolling.ts` lines 122-124 for tickets cache
- Already proven in `useStageTransition.ts` lines 85-93 for post-mutation invalidation
- TanStack Query v5 automatically deduplicates and batches invalidations

**Alternatives Considered**:
- Manual refetch via `queryClient.refetchQueries()` - rejected because invalidation is cleaner and respects staleTime
- WebSocket real-time updates - rejected due to over-engineering for this scope

### 2. Modal State Synchronization Best Practices

**Decision**: Remove conditional update logic, always sync localTicket with incoming ticket prop

**Rationale**:
- The original conditional logic (`if version changed OR branch changed`) was designed to prevent edit flicker
- However, the editing hooks (`useTicketEdit`) manage their own isolated state
- The `localTicket` state is purely for display, not edit tracking
- Simpler code = fewer bugs

**Alternatives Considered**:
- Deep equality check on ticket object - rejected due to unnecessary complexity
- Removing localTicket entirely and using ticket prop directly - considered but localTicket provides stable reference during re-renders

### 3. Stats Tab Job Data Freshness

**Decision**: Invalidate timeline query when jobs reach terminal status

**Rationale**:
- `fullJobs` prop in Stats tab comes from server-rendered `initialJobs` Map
- Jobs created during session have minimal data (no telemetry fields)
- Timeline endpoint returns full job data with telemetry
- Invalidating timeline on job completion ensures fresh data for Stats

**Alternatives Considered**:
- Add dedicated jobs polling endpoint - rejected due to additional complexity
- Fetch full job data on modal open - rejected due to latency on open

### 4. Testing Strategy

**Decision**: RTL component tests + Vitest integration tests (no E2E)

**Rationale** (per Constitution III):
- This is not a browser-required feature (no OAuth, drag-drop, viewport testing needed)
- Component tests can mock TanStack Query hooks
- Integration tests can verify cache invalidation without browser
- E2E tests would be 10-20x slower with no additional coverage benefit

**Test File Organization**:
- Extend existing test files where possible
- Search for existing modal/job tests before creating new files
- Group by domain (tickets), not by feature branch

## Codebase Patterns Discovered

### Query Key Structure (app/lib/query-keys.ts)

```typescript
export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    tickets: (id: number) => ['projects', id, 'tickets'] as const,
    jobsStatus: (id: number) => ['projects', id, 'jobs', 'status'] as const,
    timeline: (projectId: number, ticketId: number) =>
      ['projects', projectId, 'tickets', ticketId, 'timeline'] as const,
  },
};
```

### Invalidation Pattern (useJobPolling.ts:120-125)

```typescript
if (newlyTerminal.length > 0) {
  console.log('[useJobPolling] Detected terminal jobs:', newlyTerminal);
  queryClient.invalidateQueries({
    queryKey: queryKeys.projects.tickets(projectId),
  });
}
```

### Modal Prop Flow (board.tsx:170-173)

```typescript
const selectedTicket = useMemo(() => {
  if (!selectedTicketId) return null;
  return allTickets.find(t => t.id === selectedTicketId) || null;
}, [selectedTicketId, allTickets]);
```

This ensures `selectedTicket` updates when `allTickets` changes (via cache invalidation).

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Edit state lost on ticket sync | Editing hooks have isolated state; localTicket is display-only |
| Too many invalidations | TanStack Query batches and deduplicates; already doing tickets invalidation |
| Stats tab flicker | Use staleTime to show cached data while refetching |

## Dependencies Confirmed

- TanStack Query v5.90.5 - supports `invalidateQueries` with query key prefixes
- React 18 - concurrent rendering handles re-renders efficiently
- No new dependencies needed
