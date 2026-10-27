# Contracts: SHIP infinite scroll (AIB-893)

## 1. HTTP API (unchanged — reused)

`GET /api/projects/:projectId/tickets?stage=SHIP&offset={n}&limit=50`

- Auth: session or `x-test-user-id` (via `verifyProjectAccess`)
- 200 → `{ tickets: TicketWithVersion[] }` ordered `updatedAt desc`; `[]` when `offset >= total`; `< limit` items on the last page
- 400 `{ error, code: 'VALIDATION_ERROR' }`, 401 `AUTH_ERROR`, 404 `PROJECT_NOT_FOUND`, 500 `DATABASE_ERROR`

`GET /api/projects/:projectId/tickets` → `{ INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP (≤50), CLOSED: [], _shipTotal }` (unchanged)

## 2. Hook: `useLoadMoreShipTickets(projectId)` — `app/lib/hooks/queries/useTickets.ts`

```ts
export const SHIP_BATCH_SIZE = 50;

interface LoadMoreShipTickets {
  /** Request the batch at `offset`. No-op while in flight, in error, or exhausted. */
  loadMore: (offset: number) => void;
  /** Clear the error and re-request the batch at `offset`. */
  retry: (offset: number) => void;
  isLoading: boolean;
  isError: boolean;
  isExhausted: boolean;
}
export function useLoadMoreShipTickets(projectId: number, shipTotal: number): LoadMoreShipTickets;
```

Guarantees: ≤ 1 request in flight; appended tickets deduped by id across the whole tickets cache; no automatic retry.

## 3. Query fn merge — `makeTicketsQueryFn` (same file)

Post-fetch: if `freshShip.length < shipTotal`, result = `[...fresh, ...previous.filter(t => t.stage === 'SHIP' && !freshIds.has(t.id))]`; else `fresh`.

## 4. Hook: `useInfiniteScrollTrigger` — `components/board/hooks/use-infinite-scroll-trigger.ts`

```ts
interface UseInfiniteScrollTriggerOptions {
  rootRef: React.RefObject<HTMLElement>;   // column scroll viewport
  sentinelRef: React.RefObject<HTMLElement>;
  enabled: boolean;                         // hasMore && !isLoading && !isError && !paused
  onTrigger: () => void;
  prefetchDistancePx?: number;              // default 300
}
export function useInfiniteScrollTrigger(options: UseInfiniteScrollTriggerOptions): void;
```

Behavior: observes `sentinelRef` with `root = rootRef.current` (captured after mount), `rootMargin: '0px 0px {prefetchDistancePx}px 0px'`; calls `onTrigger` whenever `isNearBottom && enabled` becomes/stays true across renders (auto-fill).

## 5. UI: `StageColumn` props — `components/board/stage-column.tsx`

| Prop | Type | Change |
|------|------|--------|
| `totalCount` | `number?` | unchanged (header `loaded/total`) |
| `onLoadMore` | `() => void` | **semantics change**: invoked by sentinel, no button |
| `isLoadingMore` | `boolean?` | unchanged |
| `hasMore` | `boolean?` | **new** — enables sentinel |
| `loadMoreError` | `boolean?` | **new** |
| `onRetryLoadMore` | `() => void?` | **new** |
| `isLoadMorePaused` | `boolean?` | **new** — `true` while dragging |

Rendered DOM (SHIP only, after last card):

| State | Element | Accessible contract |
|-------|---------|---------------------|
| hasMore | `<div data-testid="ship-load-more-sentinel" aria-hidden="true" />` | — |
| loading | `Loader2` spinner + `sr-only` "Loading more tickets" | `role="status"`, `aria-live="polite"` |
| error | "Couldn't load more tickets." + shadcn `Button` "Retry" | `role="alert"`; button reachable by Tab/Enter/touch |
| complete / no more | nothing | — |

There is **no** button whose text matches `/load more/i` in the SHIP column (FR-001).
