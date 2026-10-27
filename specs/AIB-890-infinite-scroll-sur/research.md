# Research: Infinite scroll on the SHIP column (AIB-890)

## Technical Context Resolution

No `NEEDS CLARIFICATION` items remained after reading the spec and existing code. The decisions below cover the trigger mechanism, concurrency, deduplication, interaction with polling, drag-and-drop, and accessibility.

---

## Existing Files

### Source files

| Path | What it covers today | Action |
|------|----------------------|--------|
| `app/lib/hooks/queries/useTickets.ts` | `makeTicketsQueryFn` (full board fetch, writes `shipTotal` cache), `useTicketsByStage`, `useShipTotal`, `useLoadMoreShipTickets` (mutation, `offset`=current SHIP count, `limit`=50, blindly appends `[...old, ...newTickets]` with **no dedupe**, **no in-flight guard**, error not surfaced) | **Extend/modify**: replace `useLoadMoreShipTickets` with an auto-load-safe version (in-flight ref guard, dedupe, error/exhausted states, retry); make `makeTicketsQueryFn` preserve SHIP tickets loaded beyond the first page (FR-010) |
| `components/board/stage-column.tsx` (364 lines) | Renders column; SHIP gets `totalCount`/`onLoadMore`/`isLoadingMore`; "Load more (N remaining)" `<Button>` at L310-328; `scrollViewportRef` + `checkScrollPosition` for mobile scroll buttons | **Modify**: remove button; add bottom sentinel + spinner + error/Retry region; IntersectionObserver rooted on `scrollViewportRef` |
| `components/board/board-grid.tsx` | Threads `hasMoreShipTickets`, `shipTotal`, `onLoadMoreShip`, `isLoadingMoreShip` to the SHIP column only (L138-142); receives `isDragging` | **Modify**: thread new props (`shipLoadStatus`, `onRetryShip`, pause while `isDragging`) |
| `components/board/board.tsx` | Computes `shipTicketCount`, `hasMoreShipTickets`, `handleLoadMoreShip` (L54-59); passes to `BoardGrid` (L341-344) | **Modify**: consume new hook API |
| `lib/hooks/use-intersection-observer.ts` | Generic `useIntersectionObserver(ref, {threshold, rootMargin, root})` → `boolean`; falls back to `true` when IO unavailable | **Reuse as-is** (pass `root` = viewport element held in state, `rootMargin: '0px 0px 300px 0px'`) |
| `components/ui/scroll-area.tsx` | Radix ScrollArea, exposes `viewportRef` (the real scroll container) | Reuse as-is |
| `components/board/mobile-scroll-button.tsx` | Floating up/down buttons | Unchanged (FR-014) |
| `components/board/hooks/use-board-drag-state.ts` | Exposes `isDragging` | Reuse as-is (drives load pause, FR-011) |
| `components/board/hooks/use-board-cache-seeding.ts` | Seeds tickets + `shipTotal` caches from SSR | Unchanged |
| `components/board/hooks/use-ticket-transitions.ts` | Optimistic stage changes via `setQueryData(tickets)` (L75, L112) | Unchanged — moving a ticket keeps the same id in the flat array, so dedupe-by-id remains valid |
| `app/api/projects/[projectId]/tickets/route.ts` | `GET ?stage=SHIP&offset&limit` → `{ tickets }` (L64-68) | **Unchanged** (contract kept) |
| `lib/db/tickets.ts` | `getTicketsByStage` (SHIP `take: 50`, `orderBy updatedAt desc`, `shipTotal` count), `getMoreShipTickets` (skip/take) | **Unchanged** |
| `components/activity/activity-feed.tsx` | Activity "Load more" | **Must not change** (FR-016) |

New file (verified no existing file covers it):

| Path | Responsibility |
|------|----------------|
| `lib/tickets/ship-pagination.ts` | Pure helpers: `appendShipBatch(current, batch)` (dedupe by id across all stages, returns `{ tickets, addedCount }`) and `mergeRefreshedTickets(previous, fresh, shipTotal)` (keep previously scrolled-in SHIP tickets across background refresh). `lib/tickets/` already exists (`creation.ts`) — domain fit. |

### Test files

| Path | Covers | Action |
|------|--------|--------|
| `tests/integration/tickets/ship-pagination.test.ts` | `_shipTotal`, `?stage=SHIP&offset&limit` slicing, ordering, qualityScore | **Extend**: add exact-multiple boundary (offset == total → `[]`) and "ticket enters SHIP between pages → overlapping slice" scenario documenting why client dedupe is needed |
| `tests/unit/components/board/stage-column-selection.test.tsx` | `StageColumn` render with `makeTicket` helper + `DndContext` wrapper | Pattern reference only (bulk-selection concern — do not mix). |
| `tests/unit/components/board/` | Board component tests directory | **Create** `stage-column-infinite-scroll.test.tsx` (no existing SHIP-load test; adding to the selection file would mix concerns) |
| `tests/unit/tickets/` | Pure ticket helpers | **Create** `tests/unit/tickets/ship-pagination.test.ts` for the pure helpers |
| `tests/e2e/board/responsive.spec.ts` | Mobile viewport board behavior | **Extend** with one mobile SHIP auto-load scenario (touch scroll inside column, requires real browser + viewport) |
| `tests/e2e/board/drag-drop.spec.ts` | Drag & drop | No change required (drag-pause covered at component level) |

No test currently asserts the SHIP "Load more" button UI (grep for `Load more` in `tests/` only hits a comment in `ship-pagination.test.ts`), so nothing must be deleted — FR-017 is satisfied by the new/extended tests below.

---

## Patterns to Follow

1. **Cache mutation via `setQueryData` updater, keyed by `queryKeys.projects.tickets(projectId)`** — `app/lib/hooks/queries/useTickets.ts:103-110`. The new append path keeps this, but routes through `appendShipBatch` so duplicates are discarded.
2. **Error propagation, never swallowed** (constitution "External call failures MUST be propagated") — `useTickets.ts:95-97` throws on `!response.ok`. The new hook keeps the throw and exposes it as `status: 'error'`; it must not `catch` and ignore.
3. **Optimistic + revert on failure** — `components/board/hooks/use-ticket-transitions.ts:72-81`. For SHIP loading there is no optimistic insert (read-only append), so on failure the cache is untouched and only UI state flips to `error`.
4. **Scroll container is the Radix viewport, not the page** — `stage-column.tsx:185-236` attaches listeners to `scrollViewportRef.current`. The IntersectionObserver `root` must be this same element (otherwise on desktop the page never scrolls and the observer misfires).
5. **Stable IO options** — `lib/hooks/use-intersection-observer.ts:31-44` memoizes options by primitive values; pass `root` as a state-held `HTMLDivElement | null` so the effect re-subscribes once the viewport mounts.
6. **Literal Tailwind classes only / semantic tokens** — CLAUDE.md. Spinner uses `Loader2` + `text-muted-foreground`; error uses `text-destructive` + shadcn `Button variant="ghost" size="sm"`.
7. **Server shape stays `{ tickets }`** — `route.ts:65-68`; no API change, so no Zod/schema work.

---

## Decisions

### D1 — Trigger: IntersectionObserver sentinel inside the column viewport
- **Decision**: Render a 1px sentinel after the last card; observe it with `useIntersectionObserver(sentinelRef, { root: viewportEl, rootMargin: '0px 0px 300px 0px' })`. When visible ∧ `hasMore` ∧ `status === 'idle'` ∧ `!isPaused` → `loadMore()`.
- **Rationale**: Works identically for wheel, keyboard focus scroll, and touch momentum scrolling (iOS Safari / Chrome Android fire IO callbacks during inertial scroll; `scroll` events are throttled there). 300px ≈ 2–3 cards = the spec's pre-load distance.
- **Alternatives**: `scroll` listener with `scrollHeight - scrollTop - clientHeight < 300` — rejected (iOS momentum event gaps, more re-renders; already used only for button visibility). Library (`react-intersection-observer`, `react-virtuoso`) — rejected (forbidden extra UI/state libs, existing hook suffices).

### D2 — Fill tall columns (FR-009)
- **Decision**: The trigger effect depends on `[isVisible, hasMore, status, isPaused, ticketCount]`. After a batch is appended, `ticketCount` changes; if the sentinel is still within the root margin (column not filled), the effect fires the next load. When the column overflows, IO reports not-intersecting and loading stops.
- **Rationale**: IO only fires on intersection *changes*; re-evaluating on `ticketCount` avoids a stuck state when the sentinel stays visible.
- **Alternatives**: ResizeObserver on content — more code, same outcome.

### D3 — Single in-flight request (FR-004)
- **Decision**: Synchronous `inFlightRef` (useRef boolean) checked/set at the top of `loadMore`, cleared in `finally`. UI state (`status`) mirrors it for rendering.
- **Rationale**: `mutation.isPending` updates asynchronously; two IO callbacks in the same frame could both pass a state-based check.
- **Alternatives**: TanStack `useInfiniteQuery` — rejected: SHIP pages live inside the flat `tickets` cache shared with every optimistic mutation (`use-ticket-transitions.ts`, `useDeleteTicket`, etc.); splitting into a separate infinite query would rewrite all of them. Out of scope.

### D4 — Deduplication (FR-005)
- **Decision**: `appendShipBatch(current, batch)` drops any batch ticket whose `id` already exists anywhere in the flat cache (any stage — covers a ticket dragged out of SHIP that a later offset page returns again, and a ticket dropped into SHIP). Returns `addedCount`.
- **Rationale**: Offset pagination shifts when tickets enter/leave SHIP. Id-based dedupe is O(n) and safe.
- **Alternatives**: Cursor pagination (`updatedAt,id`) — more correct but changes API contract; spec decision keeps contract. Noted as future improvement.

### D5 — Stop conditions (FR-006, edge cases)
- **Decision**: `hasMore = !exhausted && loadedShipCount < shipTotal`. `exhausted` is set when a batch returns `0` tickets **or** `addedCount === 0` (all duplicates → offset would repeat forever). `exhausted` resets when `shipTotal` changes (background refresh reconciles).
- **Rationale**: Guarantees no request loop in the "counter says more remain but server returns nothing" edge case.

### D6 — Errors (FR-008)
- **Decision**: On throw → `status = 'error'`; trigger effect ignores non-`idle` status, so scrolling never refires. Error region shows message + `Retry` button; `retry()` calls `loadMore()` with the current offset (= same batch). Success → `status = 'idle'`, auto-loading resumes.
- **Alternatives**: Auto-retry with back-off — rejected by spec decision.

### D7 — Background refresh keeps scrolled-in tickets (FR-010)
- **Finding**: Today `makeTicketsQueryFn` replaces the whole cache with the server response, which only contains the first 50 SHIP tickets → every invalidation (`useJobPolling.ts:108`, mutations' `onSettled`) **drops** previously loaded SHIP pages. This is a latent bug that auto-loading would turn into a reload loop (drop → sentinel visible → reload).
- **Decision**: `makeTicketsQueryFn` reads previous cache (`queryClient.getQueryData`) and calls `mergeRefreshedTickets(previous, fresh, shipTotal)`: keep fresh tickets authoritative; append previous SHIP tickets whose id is absent from `fresh`; cap total SHIP count at `shipTotal` (drops the oldest retained extras if SHIP shrank).
- **Trade-off**: A scrolled-in ticket that was CLOSED/deleted by someone else may linger until page reload when SHIP did not shrink overall. Acceptable (same staleness as today for any non-refetched data); documented.

### D8 — Drag & drop (FR-011)
- **Decision**: `isPaused = isDragging` passed from `BoardGrid` to the SHIP column; the trigger effect skips while paused and re-evaluates when the drag ends (dependency on `isPaused`). In-flight requests that complete mid-drag still append (append happens below the list; dnd-kit measures droppables on drag start, column droppable is the whole column so appended cards do not change drop target).
- **Counter**: header uses `Math.max(shipTotal, loadedShipCount)` as total so an optimistic drop into SHIP never shows `51/50`; refresh reconciles.

### D9 — Scroll stability (FR-013)
- **Decision**: Content is only appended below; loader/error region has a fixed `min-h-10` so swapping spinner ↔ nothing ↔ error does not shift cards. Browsers' default `overflow-anchor: auto` keeps visible cards in place.

### D10 — Accessibility (FR-015)
- **Decision**: Loading region `role="status" aria-live="polite"` with sr-only "Loading more shipped tickets"; error region `role="alert"` with visible text "Couldn't load more tickets." + `Button` "Retry". Ticket cards are already focusable (dnd-kit `useDraggable` attributes); tabbing to the last card scrolls the viewport → sentinel enters root margin → load.
