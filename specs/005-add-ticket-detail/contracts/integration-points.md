# Integration Points Contract

**Feature**: 005-add-ticket-detail
**Date**: 2025-10-01

## Overview
This document defines how the TicketDetailModal integrates with existing components in the ai-board application.

## Integration Point 1: TicketCard Component

### Current State
**File**: `/components/board/ticket-card.tsx`

**Current Behavior**:
- Displays ticket summary (title, ID, metadata)
- Supports drag-and-drop with `@dnd-kit/core`
- Uses `useDraggable` hook
- Has click handlers for drag functionality

### Required Changes

**Add onClick Handler**:
```typescript
interface DraggableTicketCardProps {
  ticket: TicketWithVersion;
  isDraggable?: boolean;
  onTicketClick?: (ticket: TicketWithVersion) => void;  // NEW PROP
}

export const TicketCard = React.memo(({
  ticket,
  isDraggable = true,
  onTicketClick  // NEW
}: DraggableTicketCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    // ... existing drag config
  });

  // NEW: Click handler that respects drag state
  const handleClick = (e: React.MouseEvent) => {
    // Prevent click during drag
    if (!isDragging && onTicketClick) {
      onTicketClick(ticket);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}  // NEW
      // ... existing props
    >
      {/* Existing card content */}
    </div>
  );
});
```

**Interaction with Drag-and-Drop**:
- Click handler must check `isDragging` state before triggering
- Prevents accidental modal opens during drag operations
- Drag handlers take precedence over click handlers

**Testing Requirements**:
- Test: Click when not dragging → onTicketClick called
- Test: Click during drag → onTicketClick NOT called
- Test: Drag operation not affected by click handler

### Integration Contract

**Props Added**:
```typescript
onTicketClick?: (ticket: TicketWithVersion) => void;
```

**Behavior**:
- Optional prop (backward compatible)
- Called only when NOT dragging
- Receives full ticket object
- Parent decides how to handle click (open modal, navigate, etc.)

## Integration Point 2: Board Component

### Current State
**File**: `/components/board/board.tsx`

**Current Behavior**:
- Fetches tickets from API
- Manages drag-and-drop state
- Renders ticket cards in stage columns
- Handles ticket stage updates

### Required Changes

**Add Modal State Management**:
```typescript
'use client';

import { useState } from 'react';
import { TicketDetailModal } from './ticket-detail-modal';
// ... existing imports

export function Board() {
  // Existing state
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // NEW: Modal state
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // NEW: Ticket click handler
  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsModalOpen(true);
  };

  // NEW: Modal close handler
  const handleModalClose = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setSelectedTicket(null);
    }
  };

  return (
    <>
      {/* Existing board layout */}
      <div>
        {/* Stage columns with ticket cards */}
        <TicketCard
          ticket={ticket}
          onTicketClick={handleTicketClick}  // NEW
        />
      </div>

      {/* NEW: Modal component */}
      <TicketDetailModal
        ticket={selectedTicket}
        open={isModalOpen}
        onOpenChange={handleModalClose}
      />
    </>
  );
}
```

**State Management**:
- `selectedTicket`: Tracks which ticket to display in modal
- `isModalOpen`: Controls modal visibility
- Both states cleared when modal closes

**Testing Requirements**:
- Test: Click ticket → modal opens with correct data
- Test: Close modal → states reset correctly
- Test: Multiple tickets → each opens correct modal

### Integration Contract

**New State**:
```typescript
selectedTicket: Ticket | null;
isModalOpen: boolean;
```

**New Handlers**:
```typescript
handleTicketClick: (ticket: Ticket) => void;
handleModalClose: (open: boolean) => void;
```

**Behavior**:
- Modal state is independent of board state
- Closing modal doesn't affect ticket data or drag state
- Modal can be opened from any ticket in any stage

## Integration Point 3: Dialog Component (shadcn/ui)

### Current State
**File**: `/components/ui/dialog.tsx`

**Status**: Already installed and configured

**Components Available**:
- `Dialog`: Root component
- `DialogTrigger`: Optional trigger (not used)
- `DialogContent`: Modal content wrapper
- `DialogHeader`: Header section
- `DialogTitle`: Title with proper a11y
- `DialogDescription`: Optional description
- `DialogClose`: Close button

### Usage in TicketDetailModal

**Composition**:
```typescript
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';

export function TicketDetailModal({ ticket, open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen w-screen sm:h-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{ticket?.title}</DialogTitle>
          <DialogClose />
        </DialogHeader>
        {/* Modal body content */}
      </DialogContent>
    </Dialog>
  );
}
```

**No Changes Required**: Dialog component is used as-is

### Integration Contract

**Props Used**:
- `open`: Boolean from parent
- `onOpenChange`: Callback from parent
- `className`: For responsive styling

**Built-in Features**:
- Overlay click handling ✅
- ESC key handling ✅
- Focus trap ✅
- Scroll lock ✅
- Accessibility ✅

## Integration Point 4: Badge Component

### Current State
**File**: `/components/ui/badge.tsx`

**Status**: Already used in TicketCard for "SONNET" badge

**Usage in TicketDetailModal**:
```typescript
import { Badge } from '@/components/ui/badge';

// Stage badge
<Badge className={stageBadgeClass}>
  {stageName}
</Badge>
```

**No Changes Required**: Badge component is used as-is

### Integration Contract

**Stage Color Mapping**:
```typescript
const stageBadgeClass = {
  INBOX: 'bg-zinc-600 text-zinc-50',
  PLAN: 'bg-blue-600 text-blue-50',
  BUILD: 'bg-green-600 text-green-50',
  VERIFY: 'bg-orange-600 text-orange-50',
  SHIP: 'bg-purple-600 text-purple-50',
}[ticket.stage];
```

## Integration Point 5: Types (lib/types.ts)

### Current State
**File**: `/lib/types.ts`

**Existing Types**:
```typescript
import { Ticket } from '@prisma/client';

export type TicketWithVersion = Ticket & { version: number };
export type Stage = 'INBOX' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP';
```

### Required Changes (None)

**Reuse Existing Types**:
- `Ticket` or `TicketWithVersion` for ticket prop
- `Stage` for stage enum
- No new types needed

### Integration Contract

**Types Used**:
```typescript
import { Ticket } from '@prisma/client';
// OR
import { TicketWithVersion } from '@/lib/types';
```

## Integration Point 6: API Routes (No Changes)

### Current State
**Endpoints**:
- `GET /api/tickets` - Fetch all tickets
- `PATCH /api/tickets/[id]` - Update ticket stage

**Status**: Existing endpoints sufficient

**No Changes Required**: Modal is read-only, uses data already fetched by Board

### Integration Contract

**Data Flow**:
1. Board fetches tickets: `GET /api/tickets`
2. Board maintains tickets in state
3. User clicks ticket card
4. Modal displays ticket from Board state
5. No additional API calls

**Future Considerations**:
- If real-time updates needed, Board's existing refresh logic handles it
- Modal displays whatever data Board has (no independent data fetching)

## Integration Point 7: Prisma Client (No Changes)

### Current State
**Schema**: `/prisma/schema.prisma`

**Ticket Model**: Already defined with all required fields

**No Changes Required**: Modal uses existing Ticket type from Prisma

### Integration Contract

**Type Import**:
```typescript
import { Ticket, Stage } from '@prisma/client';
```

**Fields Used**:
- `id`, `title`, `description`, `stage`, `createdAt`, `updatedAt`
- All fields already exist in schema

## Testing Integration

### E2E Test Flow

**Test File**: `/tests/ticket-detail-modal.spec.ts`

**Integration Points Tested**:
1. Board renders tickets
2. Click ticket card (TicketCard integration)
3. Modal opens (Dialog integration)
4. Modal displays data (Badge integration, date formatting)
5. Close interactions (Dialog integration)
6. Mobile/desktop views (responsive behavior)

**Test Pattern**:
```typescript
test('user can view ticket details', async ({ page }) => {
  // Navigate to board
  await page.goto('/board');

  // Wait for tickets to load
  await page.waitForSelector('[data-testid="ticket-card"]');

  // Click first ticket (TicketCard integration)
  await page.click('[data-testid="ticket-card"]');

  // Modal opens (Dialog integration)
  await page.waitForSelector('[role="dialog"]');

  // Verify data displayed
  await expect(page.locator('[role="dialog"] h2')).toContainText('Ticket Title');

  // Close modal
  await page.keyboard.press('Escape');

  // Modal closes
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
});
```

## Dependencies Summary

### Direct Dependencies
- `@/components/ui/dialog` (shadcn/ui Dialog)
- `@/components/ui/badge` (shadcn/ui Badge)
- `@/components/board/ticket-card` (modified to add onClick)
- `@/components/board/board` (modified to add modal state)

### Indirect Dependencies
- `@radix-ui/react-dialog` (via shadcn Dialog)
- `date-fns` (for date formatting)
- `lucide-react` (for close icon)
- `@prisma/client` (for Ticket type)

### No Dependencies
- No new API endpoints
- No new database tables
- No new external services
- No new authentication requirements

## Backward Compatibility

**TicketCard Changes**: Backward compatible
- `onTicketClick` prop is optional
- Existing usages without prop continue to work
- Drag-and-drop functionality unchanged

**Board Changes**: Internal only
- New modal state doesn't affect existing board logic
- Drag-and-drop, ticket updates, etc. unaffected

**Dialog Component**: No changes
- Used as-is from shadcn/ui

**Prisma Schema**: No changes
- No migrations needed
- Existing API routes unchanged

## Rollout Strategy

**Phase 1**: Implement TicketDetailModal component
- Build modal in isolation
- Test with mock data

**Phase 2**: Integrate with TicketCard
- Add onClick handler
- Test click vs drag behavior

**Phase 3**: Integrate with Board
- Add modal state management
- Wire up handlers

**Phase 4**: E2E Testing
- Test full user flow
- Test responsive behavior
- Test accessibility

**Phase 5**: Deployment
- No feature flags needed (additive feature)
- No database migrations
- Deploy as single release
