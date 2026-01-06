# API Contracts: Contrast on Search Closed Ticket

**Feature**: AIB-150 | **Date**: 2026-01-06

## Overview

This feature does not introduce new API endpoints or modify existing API contracts.

## Existing Endpoints (No Changes)

### Search API

**GET** `/api/projects/{projectId}/tickets/search?q={query}`

- Already returns CLOSED tickets (no stage filter in query)
- Response includes `stage` field in each result
- No changes required

### Tickets API

**GET** `/api/projects/{projectId}/tickets`

- Already returns tickets grouped by stage including CLOSED
- No changes required

### Close API

**POST** `/api/projects/{projectId}/tickets/{ticketId}/close`

- Transitions ticket to CLOSED stage
- No changes required

## Frontend Data Changes

The fix is entirely in frontend cache management:

**Location**: `components/board/board.tsx` line 923-928

**Current**:
```typescript
const updatedTickets = allTickets.filter(t => t.id !== ticket.id);
```

**Fixed**:
```typescript
const updatedTickets = allTickets.map(t =>
  t.id === ticket.id ? { ...t, stage: Stage.CLOSED } : t
);
```

This is not an API change - it's how the frontend manages the React Query cache after a successful close operation.
