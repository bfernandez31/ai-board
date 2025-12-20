# Data Model: Ticket Search in Header

**Feature**: AIB-115-copy-of-recherche
**Date**: 2025-12-20

## Overview

This feature uses existing data models. No database schema changes required. This document describes the TypeScript interfaces used for the search functionality.

## Existing Entities Used

### Ticket (from Prisma schema)

```prisma
model Ticket {
  id                  Int                  @id @default(autoincrement())
  title               String               @db.VarChar(100)
  description         String               @db.VarChar(2500)
  stage               Stage                @default(INBOX)
  version             Int                  @default(1)
  projectId           Int
  ticketNumber        Int
  ticketKey           String               @unique @db.VarChar(20)
  branch              String?              @db.VarChar(200)
  previewUrl          String?              @db.VarChar(500)
  autoMode            Boolean              @default(false)
  workflowType        WorkflowType         @default(FULL)
  attachments         Json?                @default("[]")
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @default(now()) @updatedAt
  clarificationPolicy ClarificationPolicy?
  // ... relations omitted
}
```

**Searchable Fields**:
- `ticketKey`: Unique identifier (e.g., "AIB-123") - VARCHAR(20)
- `title`: Short description - VARCHAR(100)
- `description`: Detailed content - VARCHAR(2500)

## TypeScript Interfaces

### SearchResult

Represents a single search result with ranking information.

```typescript
interface TicketSearchResult {
  /** Ticket ID for selection */
  id: number;
  /** Ticket key for display (e.g., "AIB-123") */
  ticketKey: string;
  /** Ticket title */
  title: string;
  /** Current stage for visual indicator */
  stage: Stage;
  /** Match relevance score (higher = better match) */
  relevanceScore: number;
}
```

### SearchState

Component state for the search feature.

```typescript
interface TicketSearchState {
  /** Current search query */
  query: string;
  /** Whether dropdown is open */
  isOpen: boolean;
  /** Currently highlighted result index */
  selectedIndex: number;
  /** Filtered and sorted results */
  results: TicketSearchResult[];
}
```

### SearchProps

Props for the TicketSearch component.

```typescript
interface TicketSearchProps {
  /** All tickets in the current project (from TanStack Query cache) */
  tickets: TicketWithVersion[];
  /** Callback when user selects a ticket */
  onSelectTicket: (ticketId: number) => void;
  /** Optional className for styling */
  className?: string;
}
```

## Validation Rules

### Search Query
- **Minimum length**: 1 character (allows short key searches like "A-1")
- **Maximum length**: 100 characters (matches title max length)
- **Trimming**: Leading/trailing whitespace ignored
- **Case**: Case-insensitive matching

### Search Results
- **Maximum results**: 10 items displayed
- **Ordering**: By relevance score (key match > title match > description match)
- **Scope**: Current project only (not cross-project)

## State Transitions

### Search Flow State Machine

```
[IDLE] -- (user types) --> [SEARCHING]
[SEARCHING] -- (has results) --> [RESULTS_SHOWN]
[SEARCHING] -- (no results) --> [EMPTY_STATE]
[RESULTS_SHOWN] -- (user clears) --> [IDLE]
[RESULTS_SHOWN] -- (user selects) --> [SELECTED] --> (opens modal) --> [IDLE]
[RESULTS_SHOWN] -- (user presses Escape) --> [IDLE]
[EMPTY_STATE] -- (user clears) --> [IDLE]
```

## Data Access Pattern

```typescript
// Tickets are already loaded via TanStack Query in the board
// Access them via useTicketsByStage or directly from cache
const queryClient = useQueryClient();
const tickets = queryClient.getQueryData<TicketWithVersion[]>(
  queryKeys.projects.tickets(projectId)
);

// Or use the existing hook
const { data: ticketsByStage } = useTicketsByStage(projectId);
const allTickets = Object.values(ticketsByStage).flat();
```

## No Schema Changes Required

This feature operates entirely on the client side:
1. Tickets are already loaded when the board renders
2. Search filtering happens in-memory using useMemo
3. No new API endpoints needed
4. No database queries for search
