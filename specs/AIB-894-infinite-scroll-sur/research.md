# Research: Infinite scroll on the SHIP column (AIB-894)

## Existing Files

| Path | Covers | Action |
|------|--------|--------|
| `components/board/stage-column.tsx` | Column UI, Radix `ScrollArea` with `scrollViewportRef`, mobile scroll buttons, current "Load more" `<Button>` (L310-328), `loaded/total` badge (L263-265) | **Extend** — replace button with sentinel + spinner + error/retry (file is 364 lines; extract a sub-component, see D6) |
| `components/board/board-grid.tsx` | Passes `totalCount` / `onLoadMore` / `isLoadingMore` to SHIP column only (L138-142); owns `isDragging` prop | **Extend** — pass new props (`hasMore`, `loadError`, `onRetry`, `autoLoadPaused=isDragging`) |
| `components/board/board.tsx` | Wires `useShipTotal`, `useLoadMoreShipTickets`, computes `hasMoreShipTickets` (L54-59, L341-344) | **Extend** — wire new hook return shape |
| `app/lib/hooks/queries/useTickets.ts` | `makeTicketsQueryFn` (refetch of board tickets), `useShipTotal`, `useLoadMoreShipTickets` (mutation, appends without dedupe, no in-flight guard) | **Extend** — dedupe, synchronous in-flight guard, error state, empty-batch stop, refetch preserves loaded count |
| `app/api/projects/[projectId]/tickets/route.ts` | GET: default grouped response (SHIP limited to 50 + `_shipTotal`), `?stage=SHIP&offset=N&limit=M` pagination branch (L65-69) | **Extend** — accept optional `shipLimit` on default branch |
| `lib/db/tickets.ts` | `getTicketsByStage(projectId, shipLimit=50)` (L204), `getMoreShipTickets` (L253), `getTicketsWithJobs` (L657, board SSR) — both `orderBy: { updatedAt: 'desc' }` only | **Extend** — add `id: 'desc'` tie-breaker to both; use shared batch-size constant |
| `components/board/hooks/use-board-cache-seeding.ts` | Seeds tickets + shipTotal cache from SSR props | Reuse as-is |
| `components/board/hooks/use-board-drag-state.ts` | `isDragging` state | Reuse as-is (source of "pause during drag") |
| `components/board/mobile-scroll-button.tsx` | Floating up/down buttons | Reuse as-is (FR-014) |
| `components/activity/activity-feed.tsx` | Activity "Load more" | **Do not touch** (FR-016) |
| `app/lib/query-keys.ts` | `projects.tickets`, `projects.shipTotal` | Reuse as-is |
| `lib/tickets/` | Ticket domain helpers (no pagination helper exists) | **Create** `lib/tickets/ship-pagination.ts` (pure helpers + `SHIP_BATCH_SIZE`) — no existing file covers this |

### Tests

| Path | Covers | Action |
|------|--------|--------|
| `tests/integration/tickets/ship-pagination.test.ts` | `_shipTotal`, offset pagination, sort order, qualityScore | **Extend** — `shipLimit` param on default GET (honored, validated, capped), deterministic tie-breaker (no overlap/gap across pages when `updatedAt` ties) |
| `tests/unit/components/board/stage-column-selection.test.tsx` | StageColumn render pattern (DndContext wrapper, `makeTicket`) | Pattern reference only (different concern: INBOX selection) |
| `tests/unit/components/board/` | Board component tests | **Create** `stage-column-infinite-scroll.test.tsx` — no existing file covers SHIP loading UI |
| `tests/unit/useJobPolling.test.ts` | `renderHook` + QueryClient pattern for hooks | Pattern reference for hook tests |
| `tests/unit/` | — | **Create** `tests/unit/use-load-more-ship-tickets.test.ts` (hook: single in-flight, dedupe, error, empty batch) and `tests/unit/ship-pagination.test.ts` (pure helpers) |
| `tests/e2e/board/responsive.spec.ts` | Mobile board navigation | Not extended — touch scrolling inside Radix viewport is covered by IntersectionObserver semantics; manual check listed in quickstart |
| `tests/e2e/board/drag-drop.spec.ts` | DnD | Not extended (pause-during-drag is unit-tested via prop) |

No existing test references the "Load more (N remaining)" button text (`grep -ri "load more" tests/` only hits activity/comparisons), so no stale assertions to remove.

## Patterns to Follow

1. **Scroll viewport ref** — `stage-column.tsx:187` `scrollViewportRef` is passed to `ScrollArea` via `viewportRef` (`components/ui/scroll-area.tsx:21-24`, attached to `ScrollAreaPrimitive.Viewport`). The IntersectionObserver `root` MUST be this same viewport (the column's own scroll region, FR-002), not `document`.
2. **Effect + cleanup style** — `stage-column.tsx:228-236` registers listeners in `useEffect` and removes them in cleanup. The observer follows the same shape: create in effect, `disconnect()` in cleanup (covers unmount / leaving the page — edge case "no errors surfaced afterwards").
3. **Cache append via `setQueryData`** — `useTickets.ts:104-110` appends to the flat `projects.tickets` array. Keep the flat-array shape (other mutations such as `lib/hooks/mutations/useBulkDeleteTickets.ts:53-83` and `useStageTransition` do optimistic updates on it); add id-based dedupe inside the updater so it is computed against the *latest* cache state, not a stale closure.
4. **Error propagation** — `useTickets.ts:95-97` throws on `!response.ok`; the error MUST surface as UI state (constitution: never silently swallow). Mutation `isError`/`error` drives the retry UI.
5. **API validation** — `route.ts:46-62` uses a Zod `safeParse` with `{ error, code: 'VALIDATION_ERROR' }` 400 response. New `shipLimit` param joins the same schema with `.int().min(1).max(SHIP_REFETCH_MAX)`.
6. **Branch ordering in GET** — `route.ts:65-80`: the SHIP offset branch runs first, then any of `stage|workflowType|limit|updatedSince` routes to `listTicketsFiltered`. `shipLimit` MUST NOT be added to that filter condition; it only parameterizes the default branch (L83).
7. **Accessible spinner** — reuse `Loader2` + `animate-spin` (already imported in `stage-column.tsx:13`); retry uses shadcn `Button` (`stage-column.tsx:7`).

## Decisions

### D1 — Trigger mechanism: IntersectionObserver on a bottom sentinel
- **Decision**: Render a 1px sentinel `<div>` after the last SHIP card; observe it with `IntersectionObserver({ root: scrollViewportRef.current, rootMargin: '0px 0px 300px 0px' })`. When `isIntersecting && hasMore && !isLoading && !isError && !paused` → `onLoadMore()`.
- **Rationale**: Works identically for wheel, keyboard, touch (iOS Safari/Chrome Android) and the mobile floating buttons since it observes geometry, not events. 300px ≈ 2-3 cards satisfies the spec's pre-load margin (SC-003). Zero scroll-handler cost.
- **Alternatives**: `scroll` listener with `scrollTop + clientHeight >= scrollHeight - 300` (extends existing `checkScrollPosition`) — rejected: doesn't fire when content doesn't fill the column (FR-009) and needs throttling. Third-party (`react-intersection-observer`) — rejected: unnecessary dependency.

### D2 — Fill tall columns (FR-009)
- **Decision**: The observer effect depends on `[hasMore, isLoading, isError, paused, ticketCount]`. It recreates the observer whenever these change; `observe()` always emits an initial entry, so if the sentinel is still within root+margin after a batch lands, the next batch is requested — one at a time, stopping at total, on error, or once the sentinel leaves the margin (column scrollable).
- **Rationale**: No timers/loops; each load is gated by the previous completing.
- **Alternatives**: Measuring `scrollHeight <= clientHeight` after render — rejected as duplicative of D1.

### D3 — Single in-flight request (FR-004)
- **Decision**: `useLoadMoreShipTickets` keeps an `inFlightRef` (synchronous) in addition to `mutation.isPending`. `loadMore()` returns early when the ref is set; cleared in `onSettled`.
- **Rationale**: `isPending` only updates after a re-render, so two observer callbacks in the same frame could both pass a state check.
- **Alternatives**: Rely on `isPending` only — rejected (race). `useInfiniteQuery` — rejected: SHIP tickets live in the shared flat `projects.tickets` cache that all optimistic mutations, DnD and polling already use; splitting would be a broad refactor out of scope.

### D4 — Deduplication (FR-005)
- **Decision**: Pure helper `appendUniqueTickets(existing, incoming)` in `lib/tickets/ship-pagination.ts` filters incoming tickets whose `id` already exists anywhere in the cache (any stage — covers a ticket dropped into SHIP optimistically). Offset = current count of SHIP tickets in the cache (read at call time from `queryClient.getQueryData`, not from props).
- **Rationale**: Offset tracks server shifts naturally (ticket into SHIP gets newest `updatedAt` → position 0, client count +1). Dedupe covers the remaining races.
- **Alternatives**: Cursor pagination (`updatedAt,id` cursor) — more robust but changes the API contract; rejected per spec decision "no contract change beyond correctness".

### D5 — Deterministic ordering (correctness fix, server)
- **Decision**: `orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]` in both `getTicketsByStage` and `getMoreShipTickets`.
- **Rationale**: With only `updatedAt`, ties (bulk updates, seeds) make Postgres page order non-deterministic → overlaps (dupes) and gaps across offset pages. Additive, no contract change.

### D6 — Stop conditions (FR-006) and empty batch
- **Decision**: `hasMore = loadedShipCount < shipTotal`. When a batch returns 0 tickets (or only duplicates), set the `shipTotal` cache to the current loaded SHIP count → `hasMore=false`; the next background refetch restores the real total (spec edge case "reconciles on next refresh").
- **Rationale**: No extra flag state, no loop, header counter becomes consistent immediately.

### D7 — Errors (FR-008)
- **Decision**: On failure the mutation's `isError` pauses auto-load (gate in D1). Bottom of column shows `role="alert"` message "Couldn't load more shipped tickets." + shadcn `Button` "Retry" → calls `loadMore()` (same offset, since cache unchanged). `mutation.reset()` is implicit on the next `mutate`; success clears the error and the observer resumes.
- **Alternatives**: Auto-retry with back-off — rejected by spec decision (CONSERVATIVE).

### D8 — Background refresh keeps loaded batches (FR-010)
- **Finding**: Today `makeTicketsQueryFn` refetches `GET /tickets` (first 50 SHIP only) and *replaces* the cache, so any refetch (job-polling invalidation, window focus, mutation `onSettled`) drops "Load more" batches — an existing bug the spec now forbids.
- **Decision**: `makeTicketsQueryFn` reads the current cache, counts SHIP tickets, and requests `GET /api/projects/:id/tickets?shipLimit=${computeShipRefetchLimit(count)}` where `computeShipRefetchLimit = clamp(max(SHIP_BATCH_SIZE, count), ≤ SHIP_REFETCH_MAX=1000)`. The server returns that many SHIP tickets, so the refreshed list is authoritative (tickets that left SHIP disappear, new ones appear) and the loaded depth is preserved.
- **Rationale**: Single source of truth; no client-side merge heuristics that could keep stale tickets (e.g. SHIP→CLOSED). Optional, backward-compatible query param.
- **Alternatives**: Client merge of old SHIP tail with fresh head — rejected: can't tell "left SHIP/closed" apart from "beyond page 1". Refetching all pages sequentially — rejected: N requests per poll.

### D9 — Drag & drop (FR-011)
- **Decision**: `BoardGrid` passes `autoLoadPaused={isDragging}` to the SHIP column; observer gate ignores intersections while paused. When the drag ends the effect re-runs (dependency change) and loads if the sentinel is in view.
- **Rationale**: Appending cards under the pointer can shift droppable rects mid-drag in dnd-kit.

### D10 — Accessibility (FR-015)
- **Decision**: Footer region with `aria-live="polite"`: loading → `<Loader2 aria-hidden>` + `<span className="sr-only">Loading more shipped tickets</span>` inside `role="status"`; error → `role="alert"` + focusable Retry button. Keyboard: tabbing through cards scrolls the viewport, which moves the sentinel into the margin → same auto-load; no button kept (FR-001).

### D11 — Scroll stability (FR-013)
- **Decision**: Append-only at the bottom; no `scrollTop` manipulation; keys stay `ticket.id`. Footer reserves a fixed min-height (`min-h-8`) whether showing spinner, error, or nothing-while-hasMore, so toggling states doesn't shift content.

### D12 — Component extraction
- **Decision**: Extract `components/board/ship-infinite-scroll-footer.tsx` (sentinel + observer effect + spinner/error UI).
- **Rationale**: Constitution II allows extraction when the block has its own state/effects (observer) and the parent is already 364 lines.

### D13 — Test environment: IntersectionObserver in jsdom
- **Decision**: Component tests install a controllable `IntersectionObserver` stub via `vi.stubGlobal` in the test file (capturing the callback so tests can trigger `isIntersecting: true`). Not added to global setup (no other consumer).

## Unknowns

None outstanding. Technical Context contains no NEEDS CLARIFICATION.
