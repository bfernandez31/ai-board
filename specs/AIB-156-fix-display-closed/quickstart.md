# Quickstart: Fix Display Closed Ticket Modal

**Feature Branch**: `AIB-156-fix-display-closed`
**Date**: 2026-01-07

## Implementation Summary

Fix the issue where clicking a closed ticket from search results fails to open the modal. Add fallback API fetch when ticket is not in board state.

## Files to Modify

### 1. Query Keys (`app/lib/query-keys.ts`)

Add new query key for ticket-by-key lookups:

```typescript
// In projects object, after existing keys:
ticketByKey: (projectId: number, ticketKey: string) =>
  ['projects', projectId, 'tickets', 'by-key', ticketKey] as const,
```

### 2. Tickets Hook (`app/lib/hooks/queries/useTickets.ts`)

Add `useTicketByKey` hook after existing hooks:

```typescript
/**
 * Fetch a single ticket by key (for tickets not in board state)
 */
export function useTicketByKey(
  projectId: number,
  ticketKey: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.projects.ticketByKey(projectId, ticketKey ?? ''),
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketKey}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
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

### 3. Board Component (`components/board/board.tsx`)

#### Add State Variable

```typescript
// After existing state declarations (~line 124)
const [pendingTicketKey, setPendingTicketKey] = useState<string | null>(null);
```

#### Add Hook

```typescript
// After useTicketJobs hook (~line 202)
const { data: fetchedTicket } = useTicketByKey(
  projectId,
  pendingTicketKey,
  !!pendingTicketKey
);
```

#### Modify URL Parameter Effect

Replace the existing useEffect (lines 210-237) with:

```typescript
// AIB-80 + AIB-156: Parse URL params to auto-open modal with specific tab
// Handles both board tickets and closed tickets not in board state
useEffect(() => {
  if (!searchParams) return;

  const shouldOpenModal = searchParams.get('modal') === 'open';
  const tabParam = searchParams.get('tab');
  const ticketKey = searchParams.get('ticket');

  if (!shouldOpenModal || !ticketKey) return;

  // Parse tab parameter
  const initialTab =
    tabParam === 'comments' || tabParam === 'files' ? tabParam : 'details';

  // First check if ticket is in board state
  const ticket = allTickets.find(t => t.ticketKey === ticketKey);

  if (ticket && !isModalOpen) {
    setSelectedTicketId(ticket.id);
    setModalInitialTab(initialTab);
    setIsModalOpen(true);
    router.replace(pathname, { scroll: false });
  } else if (!ticket && !isModalOpen && !pendingTicketKey) {
    // AIB-156: Ticket not in board state - trigger fetch
    setPendingTicketKey(ticketKey);
    setModalInitialTab(initialTab);
  }
}, [searchParams, allTickets, isModalOpen, router, pathname, pendingTicketKey]);

// AIB-156: Handle fetched ticket for closed tickets
useEffect(() => {
  if (fetchedTicket && pendingTicketKey && !isModalOpen) {
    setSelectedTicketId(fetchedTicket.id);
    setIsModalOpen(true);
    setPendingTicketKey(null);
    router.replace(pathname, { scroll: false });
  } else if (fetchedTicket === null && pendingTicketKey) {
    // Ticket not found - clean up
    setPendingTicketKey(null);
    router.replace(pathname, { scroll: false });
  }
}, [fetchedTicket, pendingTicketKey, isModalOpen, router, pathname]);
```

#### Update selectedTicket Derivation

Modify the useMemo to include fetched ticket as fallback:

```typescript
const selectedTicket = useMemo(() => {
  if (!selectedTicketId) return null;
  // First check board tickets
  const boardTicket = allTickets.find(t => t.id === selectedTicketId);
  if (boardTicket) return boardTicket;
  // Fallback to fetched ticket (for closed tickets)
  if (fetchedTicket && fetchedTicket.id === selectedTicketId) {
    return fetchedTicket;
  }
  return null;
}, [selectedTicketId, allTickets, fetchedTicket]);
```

## Testing

### Integration Tests

Create `tests/integration/tickets/ticket-by-key.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('GET /api/projects/:projectId/tickets/:ticketKey', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('should return ticket by key', async () => {
    // Create ticket
    const createRes = await ctx.api.post(`/api/projects/${ctx.projectId}/tickets`, {
      title: '[e2e] Test ticket',
      description: 'Test description',
    });
    const ticket = await createRes.json();

    // Fetch by key
    const response = await ctx.api.get(
      `/api/projects/${ctx.projectId}/tickets/${ticket.ticketKey}`
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ticketKey).toBe(ticket.ticketKey);
  });

  it('should return 404 for non-existent key', async () => {
    const response = await ctx.api.get(
      `/api/projects/${ctx.projectId}/tickets/XXX-999`
    );

    expect(response.status).toBe(404);
  });
});
```

### Component Tests

Create `tests/unit/components/board-modal-open.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';

// Test that useTicketByKey hook is called when ticket not in board state
describe('Board modal opening for closed tickets', () => {
  // ... test implementation
});
```

## Verification Steps

1. **Run type check**: `bun run type-check`
2. **Run unit tests**: `bun run test:unit`
3. **Run integration tests**: `bun run test:integration`
4. **Manual test**:
   - Close a ticket via VERIFY stage
   - Search for the closed ticket
   - Click on search result
   - Verify modal opens with ticket details
   - Verify modal shows "Read-only" indicator
