# Contracts

## 1. `GET /api/projects/:projectId/tickets` (extended, backward compatible)

Query: `shipLimit` (optional, integer 1–500, default 50). Ignored when `stage`/`workflowType`/`limit`/`updatedSince` filters or `offset` are provided (those paths unchanged).

Response 200 (unchanged shape): `{ INBOX: [...], ..., SHIP: [≤shipLimit], CLOSED: [], _shipTotal: number }`
Errors: 400 invalid `shipLimit` (zod, same error shape as other params), 401, 404 unchanged.

## 2. `GET /api/projects/:projectId/tickets?stage=SHIP&offset=N&limit=L` (unchanged)

Response: `{ tickets: TicketWithVersion[] }`, ordered `updatedAt desc`; empty array when offset ≥ total.

## 3. UI contracts

### `StageColumn` props (SHIP)
```ts
totalCount?: number;
onLoadMore?: () => void;          // load next batch (observer + Retry)
isLoadingMore?: boolean;          // spinner
loadMoreError?: boolean;          // NEW: show error + Retry, pause auto-load
```
Behavior when `onLoadMore` set and tickets non-empty:
- Renders sentinel `data-testid="ship-load-sentinel"` (only when `!loadMoreError`).
- `isLoadingMore` → `<Loader2>` row with `role="status"` and `aria-label="Loading more tickets"`.
- `loadMoreError` → row `role="alert"` text "Couldn't load more tickets" + `Button` "Retry" (calls `onLoadMore`).
- No "Load more" button anywhere.

### `useLoadMoreShipTickets(projectId)` return
```ts
{ loadMore(currentShipCount: number): void; isLoading: boolean; isError: boolean; reset(): void }
```
`loadMore` is a no-op while a request is in flight; appended tickets are deduped by `id`.
