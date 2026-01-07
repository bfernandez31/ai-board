# Research: Fix Display Closed Ticket Modal

**Feature Branch**: `AIB-156-fix-display-closed`
**Date**: 2026-01-07

## Root Cause Analysis

### The Problem

When a user clicks on a closed ticket from search results, the ticket detail modal fails to open. The issue manifests when:
1. User searches for a ticket that has been closed
2. Ticket appears in search dropdown with "Closed" badge
3. User clicks on search result
4. Modal does not open (no error, silent failure)

### Code Path Investigation

**Search → Modal Flow:**

1. **Search Selection** (`components/search/ticket-search.tsx:47-59`):
   - User selects a search result
   - Sets URL params: `?ticket=${ticketKey}&modal=open`
   - Navigates to board page

2. **URL Parameter Handling** (`components/board/board.tsx:210-237`):
   ```typescript
   const ticket = allTickets.find(t => t.ticketKey === ticketKey);
   if (ticket && !isModalOpen) {
     setSelectedTicketId(ticket.id);
     setIsModalOpen(true);
   }
   ```
   **Issue**: `allTickets` is derived from `ticketsByStage` which excludes CLOSED stage.

3. **Stage Filtering** (`components/board/board.tsx:1076`):
   ```typescript
   const stages = getAllStages().filter(s => s !== Stage.CLOSED);
   ```
   Board columns only render INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP. CLOSED tickets are intentionally excluded from the visual board.

4. **allTickets Derivation** (`components/board/board.tsx:185-187`):
   ```typescript
   const allTickets = useMemo(() => {
     return Object.values(ticketsByStage).flat();
   }, [ticketsByStage]);
   ```
   Since `ticketsByStage` includes CLOSED in the API response but the board's display filtering doesn't affect `allTickets`, the real issue is that **CLOSED tickets may not be loaded at all** if the server-side query filters them.

### Actual Root Cause Discovery

After investigating `lib/db/tickets.ts:getTicketsByStage()`:
- The function includes CLOSED stage in the grouping
- API response includes CLOSED tickets
- BUT: `allTickets` does contain CLOSED tickets from the query

**Re-investigation needed**: The issue might be:
- Cache timing where closed tickets aren't in initial server data
- URL parameter parsing runs before data is available

However, based on the spec's user description:
> "I think it's because the ticket is not present in the kanban"

The most reliable fix is to **fetch the ticket from backend when not found in local state**.

## Decisions

### Decision 1: Fetch Strategy for Missing Tickets

**Decision**: Use the existing `/api/projects/{projectId}/tickets/{identifier}` endpoint which already supports ticket key lookup (line 73-91 of route.ts).

**Rationale**:
- No new API endpoint needed
- Endpoint already handles both numeric ID and ticket key
- Follows DRY principle

**Alternatives Considered**:
1. **New `/by-key/[ticketKey]` endpoint**: Rejected - endpoint already exists with dual lookup capability
2. **Include CLOSED in visible columns**: Rejected - intentional design decision to hide closed tickets from board view

### Decision 2: Implementation Approach

**Decision**: Add a fallback fetch in the URL parameter useEffect when ticket is not found in `allTickets`.

**Rationale**:
- Minimal change to existing code
- Uses existing TanStack Query infrastructure
- Handles edge cases (deleted tickets, permission errors) gracefully

**Implementation**:
```typescript
// In board.tsx URL parameter handling
if (!ticket && ticketKey) {
  // Ticket not in local state - fetch from backend
  fetch(`/api/projects/${projectId}/tickets/${ticketKey}`)
    .then(res => res.ok ? res.json() : null)
    .then(fetchedTicket => {
      if (fetchedTicket) {
        setSelectedTicketId(fetchedTicket.id);
        // Store in separate state for modal use
        setFetchedTicketForModal(fetchedTicket);
        setModalInitialTab(initialTab);
        setIsModalOpen(true);
      }
      // Clean up URL params
      router.replace(pathname, { scroll: false });
    });
}
```

### Decision 3: State Management for Fetched Tickets

**Decision**: Add a new state variable `fetchedTicketForModal` to hold tickets fetched directly that aren't in the board state.

**Rationale**:
- `selectedTicket` derived from `allTickets` won't include fetched closed tickets
- Modal needs the full ticket data to render
- Clean separation between board tickets and directly fetched tickets

### Decision 4: Query Hook Approach

**Decision**: Create a new hook `useTicketByKey` that leverages the existing endpoint.

**Rationale**:
- Integrates with TanStack Query caching
- Prevents duplicate fetches
- Enables refetch if needed

**Hook Design**:
```typescript
export function useTicketByKey(
  projectId: number,
  ticketKey: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.projects.ticketByKey(projectId, ticketKey ?? ''),
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketKey}`
      );
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to fetch ticket: HTTP ${response.status}`);
      }
      return response.json() as Promise<TicketWithVersion>;
    },
    enabled: enabled && !!ticketKey,
    staleTime: 5000,
    gcTime: 10 * 60 * 1000,
  });
}
```

### Decision 5: Query Key Addition

**Decision**: Add `ticketByKey` to the query keys factory.

**Implementation**:
```typescript
// In app/lib/query-keys.ts
ticketByKey: (projectId: number, ticketKey: string) =>
  ['projects', projectId, 'tickets', 'by-key', ticketKey] as const,
```

## Testing Strategy

### Integration Tests (Vitest)
1. **API test**: GET `/api/projects/{projectId}/tickets/{ticketKey}` returns closed ticket
2. **API test**: GET with invalid key returns 404
3. **API test**: GET with closed ticket returns read-only fields correctly

### Component Tests (RTL)
1. **Modal opening**: When URL has closed ticket key, modal opens
2. **Modal state**: Closed ticket modal shows read-only indicators
3. **Error handling**: Invalid ticket key doesn't break board

### Test File Strategy (per Constitution III)
- **Search existing tests first**: Check `tests/integration/tickets/` for existing endpoint tests
- **Extend existing files**: Add to existing ticket tests rather than creating new files
- **Component tests**: Add to existing modal tests if they exist

## Files to Modify

| File | Change |
|------|--------|
| `app/lib/query-keys.ts` | Add `ticketByKey` query key |
| `app/lib/hooks/queries/useTickets.ts` | Add `useTicketByKey` hook |
| `components/board/board.tsx` | Add fallback fetch logic in URL param useEffect |

## Files to Create

| File | Purpose |
|------|---------|
| `tests/integration/tickets/ticket-by-key.test.ts` | Integration tests for endpoint |
| `tests/unit/components/board-modal-open.test.tsx` | RTL tests for modal opening behavior |

## Performance Considerations

- **Single fetch**: Only fetches when ticket not found in local state
- **Caching**: TanStack Query caches fetched ticket for 10 minutes
- **No duplicate requests**: Query deduplication prevents concurrent fetches
- **<2s target**: Single API call should complete well under 2 seconds

## Error Handling

| Scenario | Handling |
|----------|----------|
| Ticket not found (404) | Don't open modal, clean URL params |
| Unauthorized (401) | Redirect to login (existing behavior) |
| Network error | Don't open modal, clean URL params |
| Server error (500) | Don't open modal, clean URL params |

All error cases fail gracefully without breaking the board.
