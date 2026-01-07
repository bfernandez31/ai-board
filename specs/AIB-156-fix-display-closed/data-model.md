# Data Model: Fix Display Closed Ticket Modal

**Feature Branch**: `AIB-156-fix-display-closed`
**Date**: 2026-01-07

## Overview

This feature does not introduce new data models. It leverages existing entities (Ticket, SearchResult) and adds client-side state for handling tickets fetched directly from the API.

## Existing Entities (Referenced)

### Ticket

**Location**: `prisma/schema.prisma`

The Ticket entity already supports CLOSED stage:

```prisma
model Ticket {
  id                    Int                    @id @default(autoincrement())
  ticketNumber          Int
  ticketKey             String                 @unique
  title                 String
  description           String?
  stage                 Stage                  @default(INBOX)
  version               Int                    @default(1)
  projectId             Int
  branch                String?
  previewUrl            String?
  autoMode              Boolean                @default(false)
  workflowType          WorkflowType           @default(FULL)
  clarificationPolicy   ClarificationPolicy?
  attachments           Json                   @default("[]")
  closedAt              DateTime?
  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt
  // Relations...
}

enum Stage {
  INBOX
  SPECIFY
  PLAN
  BUILD
  VERIFY
  SHIP
  CLOSED
}
```

**Key Attributes for This Feature**:
- `stage`: Identifies CLOSED tickets
- `ticketKey`: Used for URL-based lookup (format: `{PROJECT_KEY}-{NUMBER}`)
- `closedAt`: Timestamp when ticket was closed

### SearchResult

**Location**: `app/api/projects/[projectId]/tickets/search/route.ts`

```typescript
interface SearchResult {
  id: number;
  ticketKey: string;
  title: string;
  stage: Stage;  // Includes CLOSED
  description: string | null;
}
```

Already includes `stage` field, enabling search UI to display "Closed" badge.

## New Client-Side State

### FetchedTicketForModal State

**Location**: `components/board/board.tsx`

```typescript
// New state for tickets fetched directly (not from board state)
const [fetchedTicketForModal, setFetchedTicketForModal] =
  useState<TicketWithVersion | null>(null);
```

**Purpose**: Holds ticket data fetched via `useTicketByKey` hook when the requested ticket (from URL params) is not present in the board's `allTickets` array.

**Lifecycle**:
1. Initialized as `null`
2. Populated when URL param specifies a ticket not in board state
3. Cleared when modal closes
4. Used by modal component as fallback when `selectedTicket` is null

## Query Key Addition

**Location**: `app/lib/query-keys.ts`

```typescript
export const queryKeys = {
  projects: {
    // ... existing keys

    /**
     * Single ticket lookup by key (for closed tickets not in board state)
     */
    ticketByKey: (projectId: number, ticketKey: string) =>
      ['projects', projectId, 'tickets', 'by-key', ticketKey] as const,
  },
};
```

## State Transitions

No new state transitions. The CLOSED stage is already a valid terminal state:

```
VERIFY → CLOSED (via /close endpoint)
```

Closed tickets cannot transition to any other stage.

## Data Flow Diagram

```
┌──────────────────┐     ┌───────────────────┐
│  Search Results  │────▶│  URL Parameters   │
│  (CLOSED badge)  │     │  ?ticket=ABC-123  │
└──────────────────┘     └─────────┬─────────┘
                                   │
                                   ▼
                         ┌─────────────────────┐
                         │   Board useEffect   │
                         │ (URL param handler) │
                         └─────────┬───────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
            Found in allTickets?           Not found?
                    │                             │
                    ▼                             ▼
          ┌─────────────────┐         ┌──────────────────┐
          │ Use from cache  │         │ useTicketByKey   │
          │ (board tickets) │         │ (fetch from API) │
          └────────┬────────┘         └────────┬─────────┘
                   │                           │
                   │                           ▼
                   │                 ┌──────────────────────┐
                   │                 │ fetchedTicketForModal│
                   │                 │ (new state)          │
                   │                 └────────┬─────────────┘
                   │                          │
                   └──────────┬───────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Ticket Modal   │
                    │  (read-only)    │
                    └─────────────────┘
```

## Validation Rules

### Ticket Key Format
- Pattern: `{PROJECT_KEY}-{NUMBER}`
- Example: `AIB-156`
- Validated by: API endpoint (regex detection)

### Authorization
- User must be project owner OR member
- Verified by: `verifyProjectAccess(projectId)` in API route

## Caching Strategy

| Cache Layer | Duration | Invalidation |
|------------|----------|--------------|
| TanStack Query | 5s stale, 10m gc | Manual invalidation on mutation |
| API response | No server cache | N/A |
| Browser | Standard HTTP caching | N/A |

The `useTicketByKey` hook uses the same caching parameters as existing ticket hooks for consistency.
