# UI contract: SHIP column infinite scroll

## `StageColumn` props (components/board/stage-column.tsx)

Removed: `onLoadMore`, `isLoadingMore` (button-specific).
Kept: `totalCount` (header `loaded/total` badge — unchanged rendering).

Added (only passed for `stage === SHIP` by `board-grid.tsx`):

```ts
shipInfiniteScroll?: {
  hasMore: boolean;         // loaded < total
  isLoading: boolean;       // batch in flight
  error: Error | null;      // last batch failed → paused until retry
  paused: boolean;          // true while a drag is in progress
  onLoadMore: () => void;   // idempotent: no-op when a request is in flight
};
```

## `ShipInfiniteScrollFooter` (new: components/board/ship-infinite-scroll-footer.tsx)

Rendered after the last SHIP card, inside the ScrollArea viewport.

| State | DOM |
|-------|-----|
| `hasMore && !isLoading && !error` | sentinel `<div data-testid="ship-scroll-sentinel" aria-hidden>` only |
| `isLoading` | `<div role="status">` with `Loader2` (`aria-hidden`, `animate-spin`, `text-muted-foreground`) + `sr-only` "Loading more shipped tickets" |
| `error` | `<div role="alert">` "Couldn't load more shipped tickets." + shadcn `<Button variant="ghost" size="sm">Retry</Button>` → `onLoadMore` |
| `!hasMore` | renders nothing (no sentinel, no spinner) |

- Props: `{ rootRef: RefObject<HTMLDivElement>; hasMore; isLoading; error; paused; onLoadMore }`.
- Observer: `new IntersectionObserver(cb, { root: rootRef.current, rootMargin: '0px 0px 300px 0px' })`, recreated when `hasMore | isLoading | error | paused | ticketCount` change; disconnected on cleanup.
- Trigger rule: `entry.isIntersecting && hasMore && !isLoading && !error && !paused`.
- No text "Load more" anywhere in the SHIP column (FR-001).
- Colors: semantic tokens only (`text-muted-foreground`, `text-destructive`).

## `useLoadMoreShipTickets(projectId)` return shape (app/lib/hooks/queries/useTickets.ts)

```ts
{
  loadMore: () => void;   // offset computed from cache; guarded by inFlightRef
  isLoading: boolean;
  error: Error | null;
}
```
(Signature changes from `loadMore(currentShipCount)` → `loadMore()`; only caller is `components/board/board.tsx`.)
