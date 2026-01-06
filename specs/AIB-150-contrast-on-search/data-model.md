# Data Model: Contrast on Search Closed Ticket

**Feature**: AIB-150 | **Date**: 2026-01-06

## Overview

This feature does not introduce new data models. It modifies existing UI behavior and cache management.

## Existing Entities (No Changes)

### Ticket

The existing `Ticket` entity already includes the `CLOSED` stage:

```typescript
// From lib/stage-transitions.ts
export enum Stage {
  INBOX = 'INBOX',
  SPECIFY = 'SPECIFY',
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  SHIP = 'SHIP',
  CLOSED = 'CLOSED',  // Already exists
}
```

### SearchResult

The existing search result type already includes stage:

```typescript
// From app/lib/types/search.ts
export interface SearchResult {
  id: number;
  ticketKey: string;
  title: string;
  stage: Stage;  // Already includes CLOSED
}
```

## State Changes

### React Query Cache

**Current Behavior** (Bug):
- When ticket is closed, it's removed from cache via `allTickets.filter(t => t.id !== ticket.id)`
- CLOSED tickets become inaccessible via search modal

**Fixed Behavior**:
- When ticket is closed, update its stage in cache via `allTickets.map(t => t.id === ticket.id ? {...t, stage: Stage.CLOSED} : t)`
- CLOSED tickets remain in cache for modal access
- Board columns still filter out CLOSED tickets at display time

### Component State

**SearchResults Component**:
- `selectedIndex`: number - Index of keyboard-selected item (unchanged)
- `isClosed`: boolean - Derived from `result.stage === 'CLOSED'` (unchanged)

**No new state introduced.**

## Validation Rules

No new validation rules. Existing rules apply:
- Stage must be valid Stage enum value
- Search query must be at least 2 characters

## Database Schema

**No schema changes required.**

The Prisma schema already supports CLOSED stage:

```prisma
// From prisma/schema.prisma
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
