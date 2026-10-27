# Research: Infinite scroll on the SHIP column (AIB-893)

## Existing Files

### Source (modify)

| Path | Current responsibility | Action |
|------|------------------------|--------|
| `app/lib/hooks/queries/useTickets.ts` | `makeTicketsQueryFn` (board fetch, writes `shipTotal` cache), `useLoadMoreShipTickets` (offset mutation, appends to flat tickets cache **without dedupe**, no in-flight guard, no exhausted/error state) | **Extend**: dedupe on append, synchronous in-flight guard, `isError` / `isExhausted` / `retry`; merge already-loaded SHIP tickets in `makeTicketsQueryFn` so polling refetches don't drop them |
| `components/board/stage-column.tsx` | Column UI; renders the `Load more (N remaining)` `<Button>` (lines 310–328) when `onLoadMore` is passed; owns `scrollViewportRef` + mobile scroll buttons | **Modify**: remove the button, add bottom sentinel + spinner + inline error/Retry, wire infinite-scroll hook |
| `components/board/board-grid.tsx` | Passes `totalCount`, `onLoadMore`, `isLoadingMore` to the SHIP column only when `hasMoreShipTickets` (lines 137–142); already receives `isDragging` | **Modify**: pass new props (`loadMoreError`, `onRetryLoadMore`, `isLoadMorePaused={isDragging}`); always pass `totalCount` for SHIP |
| `components/board/board.tsx` | Computes `hasMoreShipTickets`, `handleLoadMoreShip` (lines 54–59), renders `BoardGrid` | **Modify**: consume the extended hook result, factor `isExhausted` into `hasMoreShipTickets` |
| `lib/hooks/use-intersection-observer.ts` | Generic `useIntersectionObserver(ref, options)` → boolean; supports `root` / `rootMargin`; returns `true` when IO unavailable | **Reuse as-is** (root = column viewport element, `rootMargin: '0px 0px 300px 0px'`) |
| `components/ui/scroll-area.tsx` | Radix ScrollArea exposing `viewportRef` (the real scroll container) | **Reuse as-is** |
| `components/board/mobile-scroll-button.tsx` | Floating up/down buttons | **Unchanged** (visibility re-checked via existing `useEffect([tickets])`) |

### Source (unchanged, verified)

| Path | Why unchanged |
|------|---------------|
| `app/api/projects/[projectId]/tickets/route.ts` (lines 65–69) | `?stage=SHIP&offset=N&limit=50` endpoint already returns `{ tickets }`; spec: endpoint reused unchanged |
| `lib/db/tickets.ts` `getTicketsByStage` / `getMoreShipTickets` (lines 204–268) | First 50 SHIP + `shipTotal`; offset pages ordered `updatedAt desc` |
| `components/board/hooks/use-board-cache-seeding.ts` | Seeds tickets + `shipTotal` caches from SSR props |
| `app/lib/hooks/useJobPolling.ts` (line 108) | Invalidates `projects.tickets(projectId)` (exact) on job transitions → triggers `makeTicketsQueryFn` refetch; merge fix lives in the query fn, not here |
| `components/activity/activity-feed.tsx` | Activity "Load more" is out of scope (FR-016) |

### New source file

| Path | Responsibility | Justification |
|------|----------------|---------------|
| `components/board/hooks/use-infinite-scroll-trigger.ts` | Observes a sentinel inside a scroll root; calls `onLoadMore` while the sentinel is within the prefetch margin and loading is allowed | Has its own state/effects (constitution §II rule (b)); keeps `stage-column.tsx` (364 lines) from growing; no existing board hook covers it |

### Tests

| Path | Covers | Action |
|------|--------|--------|
| `tests/integration/tickets/ship-pagination.test.ts` | API: `_shipTotal`, offset pages, empty page past end, ordering, qualityScore | **Keep unchanged** — the short-last-page and empty-page contracts the client relies on are already covered ("remaining tickets when offset + limit exceeds total", "empty array when offset exceeds total"). Only update the header comment wording ("Load More" → "infinite scroll") |
| `tests/unit/components/board/stage-column-selection.test.tsx` | `StageColumn` RTL harness (`renderWithProviders`, `DndContext`, `makeTicket`) | **Pattern reference** for the new column test |
| `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` | — | **Create**: column-level behavior (no button, spinner, sentinel trigger, error + Retry, paused while dragging, auto-fill re-trigger). Separate file because selection tests are an unrelated concern |
| `tests/unit/use-load-more-ship-tickets.test.ts` | — | **Create**: hook behavior with a real `QueryClient` (dedupe, single in-flight, exhausted on empty/short page, error → no auto retry → `retry()` resumes, polling merge keeps loaded tickets). Pattern: `tests/unit/useSetupJobPolling.test.ts` / `tests/unit/job-cache.test.ts` (QueryClient in unit tests) |
| `tests/e2e/board/*.spec.ts` | No existing SHIP "Load more" E2E | **No new E2E by default** (see Testing Strategy in plan); an optional single scroll E2E is listed in plan as P3 |

No other test references `Load more` for SHIP (`grep -rniE "load more|loadMoreShip|useLoadMoreShipTickets" tests` → only `ship-pagination.test.ts` header comment).

## Patterns to Follow

1. **Cache append via functional `setQueryData`** — `app/lib/hooks/queries/useTickets.ts:104-110`. Keep the functional updater form (never compute from a stale closure) and add id-based dedupe across **all** stages: a ticket already in the cache (possibly optimistically moved to another stage) must not be re-added from a later batch.
2. **Error propagation, no silent swallow** — `useTickets.ts:95-97` throws `Error('Failed to fetch more SHIP tickets: HTTP …')`. Keep throwing; the hook surfaces `isError` and the UI shows the error row (constitution: "External call failures MUST be propagated … never silently swallowed").
3. **Optimistic snapshot/rollback writers of the tickets cache** — `components/board/hooks/use-ticket-transitions.ts:75-112`, `lib/hooks/mutations/useDeleteTicket.ts:78-112`. These replace the whole array. Rollback snapshots taken before a batch landed could drop that batch; acceptable (rare, self-heals on next scroll since `isExhausted` is false and count < total). Do **not** modify these writers.
4. **Exact invalidation from polling** — `app/lib/hooks/useJobPolling.ts:108-111` invalidates with `exact: true` so the `ship-total` key (`['projects', id, 'tickets', 'ship-total']`) is not refetched (it has `enabled: false`). The merge logic must read the previous cache **after** the network call resolves (`queryClient.getQueryData` inside the query fn, post-`await`), so a batch appended during an in-flight refetch is preserved.
5. **Viewport-relative scroll logic** — `components/board/stage-column.tsx:189-236` uses `scrollViewportRef` (Radix viewport) for `scrollTop/scrollHeight`. The IntersectionObserver `root` must be this same viewport element, not the document (spec assumption: "near the bottom" is relative to the column's scroll area; mobile horizontal page scroll must not trigger loads).
6. **IO options stabilization** — `lib/hooks/use-intersection-observer.ts:27-43` memoizes options on primitive fields; pass `root` as state (element captured after mount), not `ref.current` read during render.
7. **RTL harness** — `tests/unit/components/board/stage-column-selection.test.tsx:1-50`: mock `next/navigation`, wrap in `DndContext`, `renderWithProviders`, `makeTicket()` factory. Query by role (`getByRole('status')`, `getByRole('button', { name: /retry/i })`).

## Decisions

### D1 — Trigger mechanism: IntersectionObserver sentinel inside the column viewport
- **Decision**: A zero-height `<div aria-hidden>` sentinel after the last card; `useIntersectionObserver(sentinelRef, { root: viewportEl, rootMargin: '0px 0px 300px 0px' })`. When `isNearBottom && canLoad` → `onLoadMore()`.
- **Rationale**: Fires on touch/momentum scroll (iOS Safari, Chrome Android), keyboard scroll, wheel, and programmatic `scrollBy` from the mobile floating button — all move the same viewport (FR-012, FR-014, FR-015). No scroll-event throttling needed. Supported on all target browsers.
- **Alternatives**: `scroll` listener with `scrollHeight - scrollTop - clientHeight < 300` — works but fires at high frequency and does not fire when content doesn't overflow (auto-fill would need separate code). Kept as unnecessary.

### D2 — Auto-fill on tall screens via effect re-evaluation
- **Decision**: The trigger is an effect keyed on `[isNearBottom, canLoad]`. IO doesn't re-fire if the sentinel stays visible after a batch, but `canLoad` flips `false → true` when loading ends, re-running the effect → next batch. Loop ends when the sentinel leaves the margin (column scrollable), `hasMore` becomes false, or an error occurs (FR-009, US4).
- **Rationale**: Single mechanism for scroll + fill; no `ResizeObserver` needed.
- **Alternatives**: Measuring `scrollHeight <= clientHeight` after render — duplicated logic.

### D3 — Single in-flight guard via ref, not `isPending`
- **Decision**: `inFlightRef = useRef(false)` set synchronously in `loadMore` before `mutate`, cleared in `onSettled`. `loadMore` is a no-op while set, while `isError`, or when exhausted.
- **Rationale**: `mutation.isPending` updates on the next render; two IO callbacks/effects in the same tick could both pass a state check (FR-004, SC-002).

### D4 — Dedupe on append across all stages
- **Decision**: In `onSuccess`, `existingIds = new Set(old.map(t => t.id))`; append only `newTickets.filter(t => !existingIds.has(t.id))`.
- **Rationale**: Offsets shift when tickets enter SHIP between batches → overlap (FR-005).

### D5 — Stop conditions
- **Decision**: `isExhausted = true` when a batch returns `0` tickets or fewer than `limit` (50). UI `hasMore = shipCount < shipTotal && !isExhausted`. `isExhausted` resets when `shipTotal` changes upward (new SHIP tickets after refresh) — implemented by storing the `shipTotal` at exhaustion time and comparing.
- **Rationale**: FR-006; prevents loops when dedupe makes the count lag the server offset (edge case "filters hide loaded tickets" / offset shifts).
- **Alternatives**: Trust count only → infinite loop if a full batch is entirely duplicates and count stays < total. Additional guard: if a non-empty batch adds 0 new tickets after dedupe, also mark exhausted (prevents same-offset re-request loop).

### D6 — Error handling: suspend until explicit Retry
- **Decision**: On error, `isError` stays true (no automatic retry, TanStack `retry: 0` for this mutation — default for mutations). UI shows `role="alert"` row with "Couldn't load more tickets." + shadcn `Button` "Retry". `retry()` → `mutation.reset()` then `loadMore(currentCount)` (same offset = same batch) (FR-008, SC-005).
- **Rationale**: Spec auto-resolved decision (CONSERVATIVE).

### D7 — Polling preservation: merge in `makeTicketsQueryFn`
- **Decision**: After fetching, read `previous = queryClient.getQueryData(tickets key)`. If `freshShipCount < shipTotal` (server capped SHIP), keep `previous` tickets with `stage === SHIP` whose id is **not** in the fresh response (any stage); append them after fresh tickets. If `freshShipCount >= shipTotal`, keep nothing extra (server returned the full SHIP set; missing ones truly left). Fresh data always wins for ids present in both.
- **Rationale**: FR-010, SC-006. A ticket moved from SHIP to another board stage appears in fresh data under its new stage → not duplicated (reviewer note). Tickets moved to CLOSED via the board are removed optimistically by the close flow; tickets closed elsewhere and beyond the first 50 may linger until reload — accepted trade-off in spec.
- **Ordering**: grouping in `useTicketsByStage.select` preserves array order → SHIP = fresh first 50 (newest) then older loaded ones. Matches `updatedAt desc` ordering (FR spec assumption).
- **Alternatives**: `useInfiniteQuery` for SHIP — would split SHIP out of the shared flat tickets cache used by optimistic transitions, drag & drop and ~15 cache writers. Rejected as too invasive.

### D8 — Drag & drop: pause while dragging
- **Decision**: `isLoadMorePaused = isDragging` from `BoardGrid` (already a prop). The trigger hook's `canLoad` includes `!paused`; when drag ends, the effect re-evaluates and loads if still near bottom (FR-011, US5-AS2).

### D9 — Scroll stability
- **Decision**: Append only at the end, keep `key={ticket.id}`; spinner/error row is rendered below the sentinel with fixed small height (`h-8`) so appending cards above it doesn't shift visible content. Browsers keep `scrollTop` constant when content grows below (FR-013, SC-007). No scroll anchoring code needed.

### D10 — Accessibility
- **Decision**: Loading row: `role="status"` + `aria-live="polite"` with visually hidden text "Loading more tickets" next to `Loader2` spinner. Error row: `role="alert"` + focusable shadcn `Button` "Retry". Sentinel is `aria-hidden`. Keyboard users scrolling the viewport (arrow/PageDown on focused viewport or tabbing through cards, which scrolls them into view) move the sentinel into range (FR-015).

### D11 — Tests strategy
- **Decision**: Hook behavior in a Vitest unit test with real `QueryClient` + mocked `fetch`; component behavior in RTL with a controllable `IntersectionObserver` mock (jsdom lacks IO, and `useIntersectionObserver` returns `true` without it → would auto-load). No new E2E required; API contract already covered by `ship-pagination.test.ts`.
- **Rationale**: Constitution §III decision tree: component interactions → RTL; no browser-only behavior (viewport/drag) is newly introduced except touch scroll, which is native IO behavior.

## NEEDS CLARIFICATION

None remaining — all resolved above.
