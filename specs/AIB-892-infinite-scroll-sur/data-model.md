# Data Model: Infinite Scroll on the SHIP Column

No Prisma/schema changes. All state is client-side (TanStack Query cache) plus one optional API query param.

## Entities

### SHIP ticket batch (transient)
- Source: `GET /api/projects/:projectId/tickets?stage=SHIP&offset=N&limit=50` → `{ tickets: TicketWithVersion[] }`
- Ordering: `updatedAt desc` (unchanged).
- Rule: appended to `queryKeys.projects.tickets(projectId)` array **deduped by `id`**.

### SHIP column counter
- Derived: `loaded = ticketsByStage.SHIP.length`, `total = shipTotal` (`queryKeys.projects.shipTotal`).
- Display: `loaded/total` while `total > loaded`; plain count when equal (existing `stage-column.tsx` logic, unchanged).

### Load state (client, per board)
| Field | Type | Notes |
|-------|------|-------|
| `isLoadingMore` | boolean | mutation `isPending`; shows spinner |
| `loadMoreError` | boolean / Error | mutation `isError`; shows inline error + Retry; pauses observer |
| `hasMore` | boolean | `loaded < total`; false ⇒ observer disconnected, no sentinel |

State transitions: `idle → loading → idle | error`; `error → loading` only via Retry; `idle` with `hasMore=false` is terminal.

## Query param (API)
`GET /api/projects/:projectId/tickets?shipLimit=<int 1..500>` — default grouped response returns up to `shipLimit` SHIP tickets (default 50). `_shipTotal` unchanged.
