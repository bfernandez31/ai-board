# Data Model: Infinite scroll on the SHIP column (AIB-890)

No database / Prisma schema change. All entities below are **client-side** (TanStack Query cache + React state) or derived values.

## Entities

### Ticket (existing — `TicketWithVersion`, `lib/types`)
Identity used for dedupe: `id: number`. Relevant fields: `stage`, `updatedAt` (SHIP order: `updatedAt desc`, `lib/db/tickets.ts:218,261`).

### Flat tickets cache (existing)
- Key: `queryKeys.projects.tickets(projectId)` → `TicketWithVersion[]`
- Contains: all non-SHIP/non-CLOSED tickets + loaded SHIP tickets.
- **Invariant (new, FR-005)**: ids are unique across the whole array.
- **Invariant (new, FR-010)**: a refresh never reduces the number of loaded SHIP tickets, except to respect `shipTotal` (SHIP shrank) or when a ticket's fresh copy is in another stage.

### SHIP total (existing)
- Key: `queryKeys.projects.shipTotal(projectId)` → `number`
- Source: `_shipTotal` from `GET /api/projects/:id/tickets`, seeded by SSR.
- Displayed total = `Math.max(shipTotal, loadedShipCount)` (prevents `51/50` after an optimistic drop into SHIP).

### SHIP batch (existing API response)
- `GET /api/projects/:id/tickets?stage=SHIP&offset={loadedShipCount}&limit=50` → `{ tickets: TicketWithVersion[] }`
- Batch size: `SHIP_BATCH_SIZE = 50` (unchanged; same as SSR `shipLimit`).

### SHIP load state (new, client hook state)

```ts
type ShipLoadStatus = 'idle' | 'loading' | 'error';

interface ShipInfiniteLoad {
  status: ShipLoadStatus;
  hasMore: boolean;          // !exhausted && loadedShipCount < shipTotal
  loadMore: () => void;      // no-op if in flight, !hasMore, or status === 'error'
  retry: () => void;         // re-requests same offset; only meaningful when status === 'error'
}
```

Internal: `inFlightRef: MutableRefObject<boolean>`, `exhausted: boolean` (reset when `shipTotal` changes).

## State transitions

```
            loadMore() [hasMore, !inFlight]
   idle ─────────────────────────────────▶ loading
    ▲                                        │
    │ success (addedCount > 0)               │ success, batch empty OR addedCount === 0
    ├────────────────────────────────────────┤──────────▶ idle + exhausted=true (hasMore=false)
    │                                        │
    │ retry() success                        │ throw / !response.ok
    │                                        ▼
    └──────────── loading ◀── retry() ─── error   (auto-trigger ignored while error)

 exhausted=true ──(shipTotal changes on refresh)──▶ exhausted=false
```

Trigger guard (component): `sentinelVisible && hasMore && status === 'idle' && !isPaused(isDragging)`.

## Pure helpers (new — `lib/tickets/ship-pagination.ts`)

```ts
export const SHIP_BATCH_SIZE = 50;

/** Append a fetched SHIP batch, discarding any ticket whose id is already cached (any stage). */
export function appendShipBatch(
  current: TicketWithVersion[],
  batch: TicketWithVersion[]
): { tickets: TicketWithVersion[]; addedCount: number };

/**
 * Merge a background refresh with the previous cache so SHIP tickets loaded by scrolling survive.
 * fresh wins for every id it contains; previous SHIP tickets absent from fresh are appended
 * (preserving their order) until the SHIP count reaches shipTotal.
 */
export function mergeRefreshedTickets(
  previous: TicketWithVersion[] | undefined,
  fresh: TicketWithVersion[],
  shipTotal: number
): TicketWithVersion[];
```

Validation rules: none server-side (API params already validated by Zod in `route.ts:46-62`: `offset ≥ 0`, `limit ≥ 1`).
