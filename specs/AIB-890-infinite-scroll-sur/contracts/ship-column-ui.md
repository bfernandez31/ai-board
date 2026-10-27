# Contract: SHIP column auto-loading (UI + hook)

## API (unchanged — documented for reference)

`GET /api/projects/{projectId}/tickets?stage=SHIP&offset={n}&limit={k}`
- Auth: session (`verifyProjectAccess`) or workflow token.
- 200 → `{ tickets: TicketWithVersion[] }` ordered `updatedAt desc`; `[]` when `offset >= total`.
- 400 `{ error, code: 'VALIDATION_ERROR' }`, 401 `AUTH_ERROR`, 404 `PROJECT_NOT_FOUND`, 500 `DATABASE_ERROR`.

`GET /api/projects/{projectId}/tickets` → `{ INBOX..VERIFY: [...], SHIP: first 50, _shipTotal: number }`.

## Hook: `useShipInfiniteLoad(projectId, loadedShipCount, shipTotal)` — `app/lib/hooks/queries/useTickets.ts`

Replaces `useLoadMoreShipTickets`. Returns `{ status, hasMore, loadMore, retry }` (see data-model.md).

Guarantees:
- At most one fetch in flight (synchronous ref guard).
- `offset = loadedShipCount`, `limit = SHIP_BATCH_SIZE`.
- Appends via `appendShipBatch` (no duplicate ids).
- Errors set `status='error'`; never auto-retried.

## Component: `StageColumn` (`components/board/stage-column.tsx`)

Props change (SHIP only; other stages pass none → unchanged rendering):

| Removed | Added |
|---------|-------|
| `onLoadMore?: () => void` (button click) | `onLoadMore?: () => void` (auto trigger) — kept name, new semantics |
| `isLoadingMore?: boolean` | `loadStatus?: 'idle' \| 'loading' \| 'error'` |
| — | `hasMore?: boolean` |
| — | `onRetryLoad?: () => void` |
| — | `isLoadPaused?: boolean` (true while a drag is in progress) |
| `totalCount?: number` | kept (header `loaded/total`) |

### DOM contract (test hooks, accessibility-first)

| State | Rendered at bottom of the ticket list | Query |
|-------|----------------------------------------|-------|
| `hasMore && idle` | invisible sentinel `<div data-testid="ship-load-sentinel" aria-hidden>` | `getByTestId` (last resort, no semantic role) |
| `loading` | `<div role="status" aria-live="polite">` with spinning `Loader2` + `<span className="sr-only">Loading more shipped tickets</span>` | `getByRole('status')` |
| `error` | `<div role="alert">` "Couldn't load more tickets." + `<Button variant="ghost" size="sm">Retry</Button>` | `getByRole('alert')`, `getByRole('button', { name: /retry/i })` |
| `!hasMore` | nothing (no sentinel, no spinner) | — |
| never | button matching `/load more/i` | `queryByRole('button', { name: /load more/i })` → null |

Region wrapper uses fixed `min-h-10` to avoid layout shift.

### Trigger rule

`useIntersectionObserver(sentinelRef, { root: viewportEl, rootMargin: '0px 0px 300px 0px' })`
→ effect on `[isVisible, hasMore, loadStatus, isLoadPaused, tickets.length]`:
`if (isVisible && hasMore && loadStatus === 'idle' && !isLoadPaused) onLoadMore()`.

## Board wiring

`Board` → `BoardGrid` props: replace `hasMoreShipTickets`, `onLoadMoreShip`, `isLoadingMoreShip` with `shipLoad: { hasMore, status, loadMore, retry }` + existing `shipTotal`; `BoardGrid` passes `isLoadPaused={isDragging}` to SHIP column.
