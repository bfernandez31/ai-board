# Data Model: Infinite scroll on the SHIP column (AIB-893)

No database or Prisma schema changes. All entities below are **client-side view state**.

## 1. SHIP ticket list (client view)

- **Storage**: the existing flat TanStack Query cache `queryKeys.projects.tickets(projectId)` → `TicketWithVersion[]`; SHIP list = entries with `stage === 'SHIP'` (grouped by `useTicketsByStage.select`, array order preserved).
- **Ordering**: `updatedAt desc` (server), first batch then appended batches.
- **Invariants**:
  - Each `ticket.id` appears at most once in the whole array (FR-005).
  - Batch append only adds ids not already present (any stage).
  - A board refresh (refetch) never removes SHIP tickets loaded from later batches while the server SHIP response is capped (`freshShipCount < shipTotal`) (FR-010).
  - Fresh server data wins for ids present in both fresh and previous data.

## 2. SHIP total

- **Storage**: existing cache `queryKeys.projects.shipTotal(projectId)` → `number` (seeded by SSR, updated on every board fetch).
- **Usage**: header counter `loaded/total` (FR-007), `hasMore = loadedShipCount < shipTotal && !isExhausted` (FR-006).

## 3. SHIP loading state (per board mount, in `useLoadMoreShipTickets`)

| Field | Type | Meaning |
|-------|------|---------|
| `isLoading` | `boolean` | A batch request is in flight (spinner shown) |
| `isError` | `boolean` | Last batch failed; automatic loading suspended |
| `isExhausted` | `boolean` | Last batch returned 0 tickets, < `limit` tickets, or 0 new tickets after dedupe |
| `inFlightRef` | `MutableRefObject<boolean>` | Synchronous single-flight guard (not exposed) |
| `exhaustedAtTotalRef` | `MutableRefObject<number \| null>` | `shipTotal` when exhaustion was recorded; exhaustion is cleared if `shipTotal` grows above it |

### State transitions

```
idle ──(sentinel near bottom & hasMore & !paused)──▶ loading
loading ──(success, batch.length === limit, added > 0)──▶ idle   (auto-fill re-check)
loading ──(success, batch.length < limit OR added === 0)──▶ complete
loading ──(HTTP error / network error)──▶ error
error ──(user clicks Retry)──▶ loading           (same offset = same batch)
error ──(sentinel events)──▶ error               (ignored: no automatic retry)
complete ──(shipTotal grows above exhaustedAtTotal)──▶ idle
any ──(loadedShipCount >= shipTotal)──▶ complete  (derived: hasMore=false)
```

`paused` (drag in progress) blocks `idle → loading` only; it does not cancel an in-flight request.

## Validation rules

- `offset = loadedShipCount` (≥ 0 integer), `limit = 50` — already validated server-side by Zod in `app/api/projects/[projectId]/tickets/route.ts`.
