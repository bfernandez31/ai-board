# Quickstart: Show Duplicated Ticket

**Feature Branch**: `AIB-145-show-duplicated-ticket`
**Date**: 2026-01-05

## Implementation Steps

### Step 1: Fix Cache Key in Modal Handler

**File**: `components/board/ticket-detail-modal.tsx`

**Location**: `handleDuplicate` function (lines 319-359)

**Change**: Replace incorrect cache key with proper hierarchical key

```typescript
// BEFORE (line 341):
await queryClient.invalidateQueries({ queryKey: ['tickets', projectId] });

// AFTER:
import { queryKeys } from '@/app/lib/query-keys';
// ... in handleDuplicate:
await queryClient.invalidateQueries({
  queryKey: queryKeys.projects.tickets(projectId)
});
```

### Step 2: Add Optimistic Update Pattern

**File**: `components/board/ticket-detail-modal.tsx`

**Rationale**: Align with existing mutation patterns (`useCreateTicket`, etc.) for immediate UI feedback

**Pattern to implement**:
1. Before API call: Add temporary ticket to cache
2. On success: Invalidate to sync with server (real data replaces temp)
3. On error: Remove temporary ticket from cache

```typescript
const handleDuplicate = async () => {
  if (!localTicket) return;
  setIsDuplicating(true);

  const queryKey = queryKeys.projects.tickets(projectId);
  const previousData = queryClient.getQueryData<TicketWithVersion[]>(queryKey) || [];

  // Optimistic: Create temporary ticket
  const tempId = Date.now();
  const now = new Date().toISOString();
  const optimisticTicket: TicketWithVersion = {
    id: tempId,
    ticketNumber: tempId,
    ticketKey: `TEMP-${tempId}`,
    title: `Copy of ${localTicket.title}`.slice(0, 100),
    description: localTicket.description || '',
    stage: 'INBOX',
    projectId,
    version: 1,
    createdAt: now,
    updatedAt: now,
    branch: null,
    autoMode: false,
    workflowType: 'FULL',
    clarificationPolicy: localTicket.clarificationPolicy || null,
    attachments: localTicket.attachments || [],
  };

  // Add to cache optimistically
  queryClient.setQueryData<TicketWithVersion[]>(queryKey, (old) => [
    ...(old || []),
    optimisticTicket,
  ]);

  try {
    const response = await fetch(
      `/api/projects/${projectId}/tickets/${localTicket.id}/duplicate`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to duplicate ticket');
    }

    const newTicket = await response.json();

    // Invalidate to replace temp with real data
    await queryClient.invalidateQueries({ queryKey });

    toast({
      title: 'Ticket duplicated',
      description: `Created ${newTicket.ticketKey}`,
    });

    onOpenChange(false);
  } catch (error) {
    // Rollback optimistic update
    queryClient.setQueryData(queryKey, previousData);

    toast({
      variant: 'destructive',
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to duplicate ticket',
    });
  } finally {
    setIsDuplicating(false);
  }
};
```

### Step 3: Add RTL Component Test

**File**: `tests/unit/components/ticket-detail-modal.test.tsx` (new file)

**Test scenarios**:
1. Duplicate button calls API and updates cache
2. New ticket appears in INBOX without refresh
3. Error shows toast and does not corrupt cache

**Test pattern**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { TicketDetailModal } from '@/components/board/ticket-detail-modal';

describe('TicketDetailModal - Duplicate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add duplicated ticket to cache immediately', async () => {
    const user = userEvent.setup();
    // Setup mock ticket, mock fetch response
    // Render modal with ticket
    // Click duplicate button
    // Verify cache updated with new ticket
    // Verify toast shown
  });

  it('should show error toast on duplicate failure', async () => {
    // Setup mock to return error
    // Click duplicate
    // Verify error toast
    // Verify cache not corrupted
  });
});
```

## Required Imports

Add to `ticket-detail-modal.tsx`:
```typescript
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/app/lib/types/query-types';
```

## Verification Checklist

- [ ] Duplicated ticket appears in INBOX immediately (no refresh)
- [ ] Toast shows new ticket key
- [ ] Modal closes after successful duplicate
- [ ] Error toast on failure
- [ ] Cache rollback on error
- [ ] RTL test passes
- [ ] Existing duplicate functionality unchanged
