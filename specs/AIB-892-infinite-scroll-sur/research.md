# Research: Infinite Scroll on the SHIP Column

## Existing Files

| Path | Covers | Action |
|------|--------|--------|
| `components/board/stage-column.tsx` | Column UI; renders "Load more" `Button` (props `onLoadMore`, `isLoadingMore`, `totalCount`); owns the Radix `ScrollArea` viewport ref (`scrollViewportRef`), scroll listener, mobile up/down buttons | **Extend**: remove button, add sentinel + observer + spinner + error/retry |
| `components/board/board-grid.tsx` (L29-32, 67-70, 138-142) | Passes `onLoadMoreShip`/`isLoadingMoreShip`/`hasMoreShipTickets`/`shipTotal` to SHIP column | **Extend**: add `loadMoreShipError`, `onRetryLoadMoreShip`; keep wiring |
| `components/board/board.tsx` (L54-59, 341-344) | Computes `hasMoreShipTickets`, `handleLoadMoreShip` | **Extend** |
| `app/lib/hooks/queries/useTickets.ts` | `useLoadMoreShipTickets` (mutation, offset=cache SHIP count, no dedupe, no error exposure), `makeTicketsQueryFn` (refetch returns only first 50 SHIP) | **Extend** |
| `components/board/hooks/use-board-cache-seeding.ts` | Seeds tickets/shipTotal cache on mount | Reuse as-is |
| `app/api/projects/[projectId]/tickets/route.ts` (L44-83) | `?stage=SHIP&offset&limit` endpoint; default response SHIP capped at 50 | **Extend**: optional `shipLimit` on default response |
| `lib/db/tickets.ts` (`getTicketsByStage` L204, `getMoreShipTickets` L253) | Queries; `getTicketsByStage(projectId, shipLimit=50)` already parametrised | Reuse (pass limit) |
| `app/lib/hooks/useJobPolling.ts` (L109), `mutations/useStageTransition.ts`, `useUpdateTicket.ts`, `useCreateTicket.ts`, `useAutoMode.ts`, `useDeployPreview.ts` | Invalidate `projects.tickets` → full refetch | Reuse (fixed centrally in queryFn) |
| `tests/integration/tickets/ship-pagination.test.ts` | Endpoint pagination ("Load More endpoint" describe) | **Extend** (shipLimit, no-overlap pagination) |
| `tests/unit/components/board/stage-column-selection.test.tsx` | StageColumn RTL render setup (DndContext, next/navigation mock) | Pattern reference only; its domain is selection |
| `tests/e2e/board/responsive.spec.ts`, `drag-drop.spec.ts` | Mobile/viewport + DnD browser tests | Optional extend (mobile scroll) |
| `tests/utils/component-test-utils.tsx`, `tests/helpers/test-query-client.ts` | `renderWithProviders`, test QueryClient | Reuse |

No existing test covers the "Load more" button in the UI (grep for "Load more" in `tests/` only hits the integration endpoint test), so FR-015 is met by extending the integration test and adding **one new** component test file `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` (existing stage-column test is about bulk selection — mixing concerns) and one hook test `tests/unit/hooks/use-load-more-ship-tickets.test.tsx` (no existing hook test dir/file for `useTickets`).

## Patterns to Follow

- **Mutation error/retry + cache write**: `useLoadMoreShipTickets` (`useTickets.ts:87-111`) uses `useMutation` with `onSuccess` `setQueryData`. Keep, add dedupe-by-id on append and expose `isError`/`reset`.
- **Scroll viewport access**: `stage-column.tsx` `scrollViewportRef` + effect with `addEventListener('scroll')` and cleanup (L172-181). The observer MUST use this viewport as `root` — the Radix viewport is the scroller (`overscroll-none`, `touch-pan-y`), not the window.
- **Cache seeding / derived state**: `useShipTotal` reads dedicated cache entry; `hasMoreShipTickets = shipTicketCount < shipTotal` (`board.tsx:58`) is the single "exhausted" source of truth — reuse for stop condition.
- **Dispatch-then-guard**: concurrency guard follows mutation `isPending` (react-query) plus a ref guard inside the loader to close the gap between two observer callbacks in the same tick.
- **Static Tailwind classes, semantic tokens** (`text-muted-foreground`, `text-destructive`) per CLAUDE.md; reuse `Loader2` from lucide-react as current button does.

## Decisions

### D1 — Trigger: `IntersectionObserver` on a sentinel
- **Decision**: Render a zero-height sentinel `<div>` after the last SHIP card; observe with `root = scrollViewportRef.current`, `rootMargin: '0px 0px 100% 0px'` (≈ one viewport-height pre-load, per spec auto-decision).
- **Rationale**: Works for touch scrolling inside the internal scroller (FR-011), floating scroll buttons (they call `scrollBy` on same viewport, FR-012), and — crucially — fires on observe if the sentinel is already intersecting, which satisfies tall-screen fill (FR-010) and resize (edge case) with no extra code: after each batch the observer is re-evaluated when `tickets.length` changes (re-observe via effect dependency).
- **Alternatives**: scroll-event + threshold math (already have a listener; but needs manual fill check and is throttle-sensitive on iOS momentum scrolling); `react-intersection-observer` (new dependency, unnecessary); window-level observer (wrong root).

### D2 — Concurrency (FR-004/005)
- **Decision**: Guard with `isPending` + a `useRef` in-flight flag; on append, merge by ticket `id` (skip ids already in cache).
- **Rationale**: Offset pagination (`offset = loaded SHIP count`) can overlap if a ticket enters/leaves SHIP between requests; dedupe guarantees no duplicates. Ref guard avoids double fire before React re-renders.
- **Alternatives**: cursor pagination (`updatedAt,id`) — more correct but API/contract change beyond scope; revisit if drift proves visible.

### D3 — Error + retry (FR-007)
- **Decision**: Hook exposes `isError`; while in error state the observer is disconnected (no auto loop). Column shows inline "Failed to load more tickets" + `Retry` button (shadcn `Button`). Retry clears the error and calls loader. Error is cleared when a periodic refetch succeeds only via explicit retry or when the load succeeds — a board refresh alone does **not** re-arm auto loading (avoids loop; spec edge case).
- **Alternatives**: auto-retry with backoff (rejected by spec).

### D4 — Surviving board refresh (FR-008) — gap in current code
- **Problem**: `makeTicketsQueryFn` replaces the cache with `GET /tickets`, which returns only the first 50 SHIP. Any invalidation (job polling, stage transition, create) therefore drops already loaded SHIP tickets beyond 50 and the column "jumps" back.
- **Decision**: Add optional `shipLimit` query param (int, 1–500, default 50) to the default response; `makeTicketsQueryFn` reads the currently cached SHIP count `n` and requests `shipLimit=max(50, n)`. Cached SHIP count is read from `queryClient.getQueryData(tickets(projectId))`.
- **Rationale**: Server remains authoritative (tickets that left SHIP vanish, no stale rows); order stays consistent; single request.
- **Alternatives**: client-side merge of old SHIP rows (can keep stale tickets); refetch all pages sequentially (N requests).

### D5 — Scroll jump (FR-013)
- **Decision**: Append only (keyed `TicketCard`s, stable keys by `ticket.id`), no scroll manipulation; add CSS `overflow-anchor: auto` (browser default; not on iOS Safari < 18 — appended content is below viewport, so no anchoring needed). Spinner/error footer has fixed min-height to avoid layout shift.

### D6 — Drag & drop (FR-009)
- **Decision**: No special handling; loading only appends below. Sentinel excluded from droppable/draggable (outside `TicketCard`). Verify in manual/E2E that dnd-kit auto-scroll near bottom doesn't break; loader writes via `setQueryData`, which doesn't clash with optimistic mutations' `cancelQueries` (a drag-triggered transition's `onMutate` snapshots/restore operate on the same array; append happens via functional updater so merge is safe).

### D7 — Scope (FR-014)
- Remove `Button`/`ChevronDown` imports from `stage-column.tsx` only if unused; `onLoadMore` prop retained but semantics become "load next batch" (called by observer/retry). `activity-feed.tsx`, `drawer-history.tsx`, comparisons "Load more" untouched.
