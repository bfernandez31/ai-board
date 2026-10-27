# Data Model: Infinite scroll on the SHIP column (AIB-894)

No Prisma schema change. No migration. All entities below are client-side views over the existing `Ticket` model (`prisma/schema.prisma`).

## Entities

### SHIP batch
- **Source**: `GET /api/projects/:projectId/tickets?stage=SHIP&offset=N&limit=50` → `{ tickets: TicketWithVersion[] }` (`lib/db/tickets.ts#getMoreShipTickets`)
- **Size**: `SHIP_BATCH_SIZE = 50` (new shared constant in `lib/tickets/ship-pagination.ts`, replaces the literal `50` in `lib/db/tickets.ts`, `route.ts`, `useTickets.ts`)
- **Order**: `updatedAt DESC, id DESC` (tie-breaker added — research D5)
- **Offset**: number of `stage === 'SHIP'` tickets currently in the `projects.tickets` cache, read at request time

### SHIP total
- **Cache key**: `queryKeys.projects.shipTotal(projectId)` (number)
- **Writers**: SSR seed (`use-board-cache-seeding.ts`), every board refetch (`makeTicketsQueryFn` from `_shipTotal`), and — new — empty-batch reconciliation (set to loaded count, research D6)
- **Validation**: integer ≥ 0

### Loaded SHIP list
- **Cache key**: `queryKeys.projects.tickets(projectId)` — flat `TicketWithVersion[]` shared with all stages (unchanged shape)
- **Invariant**: unique by `ticket.id` across the whole array (enforced by `appendUniqueTickets`)
- **Persistence across refresh**: refetch requests `shipLimit = computeShipRefetchLimit(loadedShipCount)` so the server returns at least as many SHIP tickets as were loaded (research D8)

### SHIP auto-load state (client, derived — not persisted)

| Field | Type | Derivation |
|-------|------|------------|
| `loadedCount` | `number` | SHIP tickets in cache |
| `hasMore` | `boolean` | `loadedCount < shipTotal` |
| `isLoading` | `boolean` | `mutation.isPending` (UI) / `inFlightRef` (guard) |
| `error` | `Error \| null` | `mutation.error` |
| `paused` | `boolean` | `isDragging` from `use-board-drag-state.ts` |

### State transitions

```
            sentinel in view & hasMore & !paused
  IDLE ──────────────────────────────────────────▶ LOADING
   ▲                                                 │
   │ success, n>0 new (append, dedupe)               │
   ├─────────────────────────────────────────────────┤
   │                                                 │ failure
   │ success, 0 new → shipTotal := loadedCount       ▼
   │   ⇒ DONE (until next refresh)                 ERROR ──(Retry click)──▶ LOADING
   │
  DONE  (loadedCount ≥ shipTotal): no sentinel trigger, no spinner
```

- `ERROR` never transitions automatically (FR-008, SC-005).
- `paused` blocks `IDLE → LOADING` only; an in-flight request still completes.

## Pure helpers (`lib/tickets/ship-pagination.ts`)

```ts
export const SHIP_BATCH_SIZE = 50;
export const SHIP_REFETCH_MAX = 1000;

/** Appends incoming tickets whose id is not already present. Returns { tickets, addedCount }. */
export function appendUniqueTickets(
  existing: TicketWithVersion[],
  incoming: TicketWithVersion[]
): { tickets: TicketWithVersion[]; addedCount: number };

/** SHIP limit to request on background refetch so loaded depth is preserved. */
export function computeShipRefetchLimit(loadedShipCount: number): number; // clamp(max(SHIP_BATCH_SIZE, n), SHIP_REFETCH_MAX)

/** Count of SHIP-stage tickets in a flat ticket array. */
export function countShipTickets(tickets: readonly TicketWithVersion[] | undefined): number;
```

Must not import Prisma (consumed by client hook and server).
