# Research: Show Duplicated Ticket

**Feature Branch**: `AIB-145-show-duplicated-ticket`
**Date**: 2026-01-05

## Root Cause Analysis

### Issue
After duplicating a ticket via the modal, the new ticket does not appear in the INBOX column until the page is manually refreshed.

### Investigation

**1. Cache Key Mismatch (CONFIRMED BUG)**

In `components/board/ticket-detail-modal.tsx` line 341:
```typescript
// CURRENT (WRONG)
await queryClient.invalidateQueries({ queryKey: ['tickets', projectId] });
```

In `app/lib/query-keys.ts` line 33:
```typescript
// CORRECT KEY STRUCTURE
tickets: (id: number) => ['projects', id, 'tickets'] as const,
```

The board component uses `queryKeys.projects.tickets(projectId)` which resolves to `['projects', projectId, 'tickets']`, but the duplicate handler invalidates `['tickets', projectId]` - a non-existent cache key.

**2. Missing Optimistic Update Pattern**

Other mutations (`useCreateTicket`, `useUpdateTicket`, `useDeleteTicket`) follow an optimistic update pattern:
- `onMutate`: Cancel queries, snapshot data, update cache optimistically
- `onError`: Rollback to snapshot
- `onSuccess`: Invalidate to sync with server

The duplicate handler only does cache invalidation (incorrectly) without optimistic updates.

## Decision: Fix Approach

**Decision**: Fix cache key AND add optimistic update for consistency
**Rationale**:
1. Fixing the cache key is mandatory - it's the root cause
2. Adding optimistic update aligns with existing mutation patterns
3. Optimistic update provides immediate feedback (< 1s requirement from SC-001)

**Alternatives Considered**:
1. Fix cache key only (simpler but inconsistent with other mutations)
2. Create dedicated `useDuplicateTicket` hook (cleaner but more code)
3. Inline fix in modal handler (chosen - minimal change, follows spec directive)

**Implementation Decision**: Inline fix in modal with optimistic update pattern

## Decision: Test Approach

**Decision**: RTL component test for duplicate-and-display behavior
**Rationale**:
- Per spec "Auto-Resolved Decisions": RTL component test over E2E
- Per Constitution III: "React component with user interactions → Vitest + RTL component test"
- No browser-specific features (no drag-drop, OAuth, viewport)

**Test Coverage**:
1. Duplicate button triggers mutation
2. New ticket appears in cache without refresh (via mocked query client)
3. Error handling shows toast on failure

## Files to Modify

| File | Change | Rationale |
|------|--------|-----------|
| `components/board/ticket-detail-modal.tsx` | Fix cache key, add optimistic update | Root cause fix + UX improvement |
| `tests/unit/components/ticket-detail-modal.test.tsx` | Add RTL test | Per spec SC-003 |

## Dependencies

- No new dependencies required
- Uses existing: `@tanstack/react-query`, `@/app/lib/query-keys`

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing duplicate functionality | Low | High | Test existing behavior before changing |
| Cache inconsistency on optimistic update rollback | Low | Medium | Follow existing `useCreateTicket` pattern |
| Test flakiness with async cache updates | Medium | Low | Use proper RTL async utilities |

## Resolved Clarifications

All technical context is clear from codebase exploration:
- ✅ Cache key structure: `['projects', projectId, 'tickets']`
- ✅ Mutation pattern: optimistic update with rollback
- ✅ Test approach: RTL component test
- ✅ Import path: `queryKeys` from `@/app/lib/query-keys`
