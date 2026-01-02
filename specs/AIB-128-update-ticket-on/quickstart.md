# Quickstart: Ticket Modal Real-Time Data Refresh

**Feature**: AIB-128
**Date**: 2026-01-02

## Implementation Summary

This fix addresses stale data in the ticket modal when jobs complete. The root cause is the modal's `localTicket` state not syncing with incoming ticket prop updates after cache invalidation.

## Changes Required

### 1. Fix Modal State Sync (Primary Fix)

**File**: `components/board/ticket-detail-modal.tsx`
**Lines**: 218-235

**Before**:
```typescript
useEffect(() => {
  if (ticket) {
    setLocalTicket((current) => {
      if (!current || current.id !== ticket.id ||
          current.version !== ticket.version ||
          current.branch !== ticket.branch) {
        return ticket;
      }
      return current;  // Stale data persists
    });
  }
}, [ticket]);
```

**After**:
```typescript
useEffect(() => {
  if (ticket) {
    setLocalTicket(ticket);  // Always sync with parent
  }
}, [ticket]);
```

### 2. Add Timeline Invalidation (Stats Tab Fix)

**File**: `app/lib/hooks/useJobPolling.ts`
**Lines**: 119-125

**Before**:
```typescript
if (newlyTerminal.length > 0) {
  console.log('[useJobPolling] Detected terminal jobs:', newlyTerminal);
  queryClient.invalidateQueries({
    queryKey: queryKeys.projects.tickets(projectId),
  });
}
```

**After**:
```typescript
if (newlyTerminal.length > 0) {
  console.log('[useJobPolling] Detected terminal jobs:', newlyTerminal);
  // Invalidate tickets cache for branch/stage updates
  queryClient.invalidateQueries({
    queryKey: queryKeys.projects.tickets(projectId),
  });
  // Invalidate timeline cache for each affected ticket (Stats tab)
  newlyTerminal.forEach(job => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.projects.timeline(projectId, job.ticketId),
    });
  });
}
```

## Testing

### Run All Tests
```bash
bun run test
```

### Run Unit Tests Only
```bash
bun run test:unit
```

### Run Integration Tests Only
```bash
bun run test:integration
```

## Verification Steps

1. Open a ticket modal
2. Move ticket to SPECIFY stage (triggers workflow)
3. Wait for job to complete (~2 minutes)
4. Verify:
   - Branch field shows branch name (without page refresh)
   - "View Specification" button appears (without page refresh)
   - Stats tab shows updated job data

## Key Files

| File | Purpose |
|------|---------|
| `components/board/ticket-detail-modal.tsx` | Fix localTicket sync |
| `app/lib/hooks/useJobPolling.ts` | Add timeline invalidation |
| `app/lib/query-keys.ts` | Query key definitions (no changes) |
| `components/board/board.tsx` | Parent data flow (no changes) |

## Test Files

| File | Purpose |
|------|---------|
| `tests/unit/components/ticket-detail-modal.test.tsx` | Component tests for button visibility |
| `tests/integration/job-polling/cache-invalidation.test.ts` | Integration tests for cache invalidation |
