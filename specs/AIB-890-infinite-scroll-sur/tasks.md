---
description: "Task list for AIB-890 — Infinite scroll on the SHIP column (replaces Load more)"
---

# Tasks: Infinite scroll on the SHIP column (replaces "Load more")

**Input**: Design documents from `specs/AIB-890-infinite-scroll-sur/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ship-column-ui.md

**Tests**: Included (constitution §III). Unit for pure helpers, Vitest + RTL for component/hook behavior, integration for API pagination boundaries, one Playwright mobile scenario.

**Organization**: Tasks are grouped by user story. No API, Prisma, or batch-size change. Other columns (INBOX → VERIFY) and `components/activity/activity-feed.tsx` MUST NOT be modified (FR-016).

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 map to spec.md user stories

## Path Conventions
Next.js monolith at repository root: `app/`, `components/`, `lib/`, `tests/`.

## Verified file inventory

| Path | Status | Action |
|------|--------|--------|
| `lib/tickets/ship-pagination.ts` | new (no existing file covers it; `lib/tickets/` exists) | Create |
| `app/lib/hooks/queries/useTickets.ts` | existing (`useLoadMoreShipTickets` L87, only consumer `components/board/board.tsx:15,56`) | Modify |
| `components/board/stage-column.tsx` | existing (Load more button L310-328, `scrollViewportRef` L185-236) | Modify |
| `components/board/board-grid.tsx` | existing (SHIP props L29-32, L67-70, L138-142) | Modify |
| `components/board/board.tsx` | existing (L15, L54-59, L341-344) | Modify |
| `lib/hooks/use-intersection-observer.ts` | existing | Reuse as-is |
| `tests/unit/tickets/ship-pagination.test.ts` | new (dir exists, only `ticket-page-redirect.test.ts`) | Create |
| `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` | new (`stage-column-selection.test.tsx` is bulk-selection — do not mix) | Create |
| `tests/integration/tickets/ship-pagination.test.ts` | existing | Extend |
| `tests/e2e/board/responsive.spec.ts` | existing | Extend (1 test) |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test scaffolding shared by all story test tasks. No dependency installation is needed.

- [X] T001 ✅ DONE Create `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` scaffolding: copy the `vi.mock('next/navigation', …)` block, `makeTicket(overrides)` helper and `DndContext` + `renderWithProviders` wrapper pattern from `tests/unit/components/board/stage-column-selection.test.tsx`; add a controllable global `IntersectionObserver` mock (class stored in a module-level array of instances, each exposing `trigger(isIntersecting: boolean)` that calls the callback with `[{ isIntersecting, target }]` inside `act`), installed with `vi.stubGlobal` in `beforeEach` and removed with `vi.unstubAllGlobals` in `afterEach`; add a `renderShipColumn(props)` helper rendering `StageColumn` with `stage={Stage.SHIP}`; add empty `describe('StageColumn SHIP infinite scroll')` and `describe('useShipInfiniteLoad')` blocks (the latter will use `renderHook` + `vi.stubGlobal('fetch', vi.fn())` and a `QueryClient` from `tests/helpers/test-query-client.ts`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure helpers used by the hook (US1/US2) and the refresh merge (US5).

**⚠️ CRITICAL**: Complete before any user story phase.

- [X] T002 ✅ DONE [P] Write failing unit tests in new `tests/unit/tickets/ship-pagination.test.ts` for `appendShipBatch`: (a) appends unseen batch tickets after current, preserving order, `addedCount` = number appended; (b) drops batch tickets whose `id` already exists in `current` in ANY stage (e.g. a SHIP-batch ticket present as `VERIFY` in cache); (c) all-duplicate batch → `tickets` unchanged (same contents) and `addedCount === 0`; (d) empty batch → `addedCount === 0`; (e) duplicate ids inside the batch itself are added once. Also assert `SHIP_BATCH_SIZE === 50`. Build fixtures with a local `makeTicket` returning `TicketWithVersion` (`lib/types`)
- [X] T003 ✅ DONE [P] Write failing unit tests in `tests/unit/tickets/ship-pagination.test.ts` (separate `describe`) for `mergeRefreshedTickets(previous, fresh, shipTotal)`: (a) `previous` undefined → returns `fresh`; (b) previous SHIP tickets absent from `fresh` are appended after fresh, in previous order; (c) a ticket present in both uses the fresh copy (e.g. fresh stage `VERIFY` replaces previous `SHIP`, and it is not appended again); (d) retained count is capped so fresh SHIP count + retained ≤ `shipTotal` (oldest-loaded extras kept first, later ones dropped); (e) previous non-SHIP tickets absent from fresh are NOT retained (fresh is authoritative for INBOX→VERIFY); (f) result has unique ids
- [X] T004 ✅ DONE Create `lib/tickets/ship-pagination.ts` exporting `SHIP_BATCH_SIZE = 50`, `appendShipBatch(current, batch): { tickets, addedCount }` (build a `Set` of current ids, filter batch, also dedupe within batch) and `mergeRefreshedTickets(previous, fresh, shipTotal): TicketWithVersion[]` per data-model.md (fresh authoritative; append previous `stage === 'SHIP'` tickets whose id ∉ fresh ids, in previous order, while fresh SHIP count + retained < `shipTotal`); import `TicketWithVersion` from `@/lib/types`; JSDoc on both functions; make T002/T003 pass with `bun run test:unit tests/unit/tickets/ship-pagination.test.ts`
- [X] T005 ✅ DONE Add `export type ShipLoadStatus = 'idle' | 'loading' | 'error'` and `export interface ShipInfiniteLoad { status: ShipLoadStatus; hasMore: boolean; loadMore: () => void; retry: () => void }` to `app/lib/hooks/queries/useTickets.ts` (next to the SHIP hooks) so the hook, `board-grid.tsx` and `stage-column.tsx` share one type

**Checkpoint**: Helpers green; types available.

---

## Phase 3: User Story 1 — Auto-load next SHIP batch while scrolling (Priority: P1) 🎯 MVP

**Goal**: No "Load more" button; the next 50-ticket batch loads automatically when a bottom sentinel enters a 300px margin of the column viewport; spinner while loading; stops at total; header `loaded/total` stays correct.

**Independent Test**: Board with >50 SHIP tickets → SHIP shows 50, no Load more button; scrolling the SHIP column near its end appends the next batch with a spinner shown meanwhile; once all are loaded no further request is sent.

### Tests for User Story 1 (write first, must FAIL)

- [X] T006 ✅ DONE [P] [US1] In `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` `describe('StageColumn SHIP infinite scroll')` add: (a) SHIP column with `hasMore`, `loadStatus='idle'`, `onLoadMore` → `queryByRole('button', { name: /load more/i })` is null and `getByTestId('ship-load-sentinel')` exists; (b) triggering the observer with `isIntersecting=true` calls `onLoadMore` exactly once; (c) observer created with `rootMargin: '0px 0px 300px 0px'` (assert on the mock's captured options); (d) `loadStatus='loading'` → `getByRole('status')` visible with accessible text "Loading more shipped tickets"; (e) `hasMore=false` → no sentinel, no `status`, triggering never calls `onLoadMore`; (f) header shows `50/120` when 50 tickets and `totalCount=120`; (g) SHIP with zero tickets → no sentinel/no spinner, existing empty state shown; (h) a non-SHIP column (e.g. `Stage.VERIFY`) rendered without the new props has no sentinel, status or alert
- [X] T007 ✅ DONE [P] [US1] In the same file, `describe('useShipInfiniteLoad')` add: (a) `loadMore()` calls `fetch` with `/api/projects/{id}/tickets?stage=SHIP&offset={loadedShipCount}&limit=50` and appends returned tickets to the `queryKeys.projects.tickets(projectId)` cache; (b) `status` is `'loading'` while the fetch is pending and `'idle'` after success; (c) `hasMore=false` when `loadedShipCount >= shipTotal` and `loadMore()` then does not call `fetch`
- [X] T008 ✅ DONE [P] [US1] Extend `tests/integration/tickets/ship-pagination.test.ts`: add boundary case where SHIP total is an exact multiple of the limit (e.g. 4 tickets, `limit=2`) → `offset=4` returns `{ tickets: [] }` with 200 (supports FR-006 stop on empty batch). Reuse the file's existing project/ticket seeding helpers and `[e2e]` prefixes

### Implementation for User Story 1

- [X] T009 ✅ DONE [US1] In `app/lib/hooks/queries/useTickets.ts` replace `useLoadMoreShipTickets` with `useShipInfiniteLoad(projectId, loadedShipCount, shipTotal): ShipInfiniteLoad`: keep the existing fetch + `throw` on `!response.ok` (pattern L92-98) with `limit=SHIP_BATCH_SIZE` from `@/lib/tickets/ship-pagination`; hold `loadedShipCount` in a ref (updated each render) so `loadMore` is stable (`useCallback`) and always reads the latest offset; `status` via `useState<ShipLoadStatus>('idle')`; append with `queryClient.setQueryData(queryKeys.projects.tickets(projectId), old => appendShipBatch(old ?? [], batch).tickets)`; `hasMore = loadedShipCount < shipTotal`; `retry` stub delegating to the load function (completed in US2). Delete the old export (only consumer is `board.tsx`)
- [X] T010 ✅ DONE [US1] In `components/board/stage-column.tsx`: remove the "Load more" `<Button>` block (L310-328) and the `isLoadingMore` prop, plus `ChevronDown` import if now unused (keep `Button` import for Retry later); add props `hasMore?: boolean`, `loadStatus?: ShipLoadStatus`, `onLoadMore?: () => void`, `onRetryLoad?: () => void`, `isLoadPaused?: boolean` (keep `totalCount`); hold the viewport in state (`const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null)`; `useEffect(() => setViewportEl(scrollViewportRef.current), [])`) while keeping `scrollViewportRef` for the mobile buttons; add `sentinelRef` and `const isSentinelVisible = useIntersectionObserver(sentinelRef, { root: viewportEl, rootMargin: '0px 0px 300px 0px' })` from `@/lib/hooks/use-intersection-observer`; add effect on `[isSentinelVisible, hasMore, loadStatus, isLoadPaused, tickets.length]` calling `onLoadMore()` when `isSentinelVisible && hasMore && loadStatus === 'idle' && !isLoadPaused`
- [X] T011 ✅ DONE [US1] In `components/board/stage-column.tsx` render the bottom load region only when `onLoadMore` is defined and the column has tickets: wrapper `<div className="min-h-10 flex items-center justify-center">`; inside, `<div ref={sentinelRef} data-testid="ship-load-sentinel" aria-hidden="true" className="h-px w-full" />` when `hasMore && loadStatus !== 'error'`; `<div role="status" aria-live="polite">` with `<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />` + `<span className="sr-only">Loading more shipped tickets</span>` when `loadStatus === 'loading'`. Literal class strings and semantic tokens only
- [X] T012 ✅ DONE [US1] In `components/board/board-grid.tsx` replace props `hasMoreShipTickets`, `onLoadMoreShip`, `isLoadingMoreShip` (L29-32, L67-70) with `shipLoad: ShipInfiniteLoad`; at L138-142 pass to the SHIP column **always** (drop the `&& hasMoreShipTickets` condition): `totalCount: shipTotal`, `hasMore: shipLoad.hasMore`, `loadStatus: shipLoad.status`, `onLoadMore: shipLoad.loadMore`, `onRetryLoad: shipLoad.retry`. Other stages receive none of these props
- [X] T013 ✅ DONE [US1] In `components/board/board.tsx` (L15, L54-59, L341-344): import `useShipInfiniteLoad` instead of `useLoadMoreShipTickets`; `const shipLoad = useShipInfiniteLoad(projectId, shipTicketCount, shipTotal)`; remove `hasMoreShipTickets`/`handleLoadMoreShip`/`isLoadingMoreShip`; pass `shipLoad={shipLoad}` and `shipTotal={Math.max(shipTotal, shipTicketCount)}` to `BoardGrid`
- [X] T014 ✅ DONE [US1] Run `bun run test:unit tests/unit/components/board/stage-column-infinite-scroll.test.tsx tests/unit/tickets/ship-pagination.test.ts` and `bun run test:integration tests/integration/tickets/ship-pagination.test.ts`; T006–T008 must pass

**Checkpoint**: SHIP auto-loads on scroll with spinner; no button; MVP shippable.

---

## Phase 4: User Story 2 — Safe loading: no duplicates, no concurrent requests, recoverable errors (Priority: P1)

**Goal**: Single request in flight, id-based dedupe, stop on empty/all-duplicate batch, error state with Retry that pauses auto-loading.

**Independent Test**: Fire many intersections / `loadMore()` calls quickly → one fetch; feed overlapping batches → no duplicate cards; make fetch fail → alert + Retry, no automatic re-request; Retry success resumes.

### Tests for User Story 2 (write first, must FAIL)

- [X] T015 ✅ DONE [P] [US2] In `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` `describe('useShipInfiniteLoad')` add: (a) two `loadMore()` calls in the same `act` tick → `fetch` called once (pending promise); (b) batch containing ids already in the cache (incl. a non-SHIP stage) → cache has unique ids and only new tickets appended; (c) empty batch → `hasMore` becomes false and a subsequent `loadMore()` does not fetch; (d) all-duplicate batch → `hasMore` false, no further fetch (no offset loop); (e) `fetch` resolving `ok: false` → `status === 'error'`, cache unchanged, `loadMore()` is a no-op; (f) `retry()` refetches the same `offset`, on success appends, `status === 'idle'`, and `loadMore()` works again; (g) unmount while fetch pending then resolve/reject → no state update warning and no thrown error
- [X] T016 ✅ DONE [P] [US2] In the same file `describe('StageColumn SHIP infinite scroll')` add: (a) `loadStatus='loading'` + repeated `trigger(true)` → `onLoadMore` not called; (b) `loadStatus='error'` → `getByRole('alert')` contains "Couldn't load more tickets.", no sentinel, triggering the observer does not call `onLoadMore`; (c) clicking `getByRole('button', { name: /retry/i })` calls `onRetryLoad` once
- [X] T017 ✅ DONE [P] [US2] Extend `tests/integration/tickets/ship-pagination.test.ts`: fetch page 1 (`offset=0&limit=2`), then move a non-SHIP ticket into SHIP (update `stage` + newer `updatedAt` via Prisma), fetch page 2 (`offset=2&limit=2`) → assert page 2 contains a ticket id already returned in page 1 (documents offset shift that client dedupe handles)

### Implementation for User Story 2

- [X] T018 ✅ DONE [US2] In `app/lib/hooks/queries/useTickets.ts` `useShipInfiniteLoad`: add synchronous `inFlightRef = useRef(false)` guard checked/set at the top of the internal `load` and cleared in `finally`; `mountedRef` (set false on unmount) so no state updates/errors after leaving the board; capture `addedCount` from `appendShipBatch` inside the `setQueryData` updater and set `exhausted` (`useState(false)`) when `batch.length === 0 || addedCount === 0`; `hasMore = !exhausted && loadedShipCount < shipTotal`; on throw `console.error('[useShipInfiniteLoad] failed to load SHIP batch', { projectId, offset, error })` and `setStatus('error')` (error surfaced as UI state, never silently dropped); `loadMore` no-ops when `status === 'error'` or `!hasMore` (read both via refs to keep the callback stable); `retry` calls `load()` only when status is `'error'`
- [X] T019 ✅ DONE [US2] In `components/board/stage-column.tsx` load region add the error state when `loadStatus === 'error'`: `<div role="alert" className="flex items-center gap-2 text-sm text-destructive">` with text "Couldn't load more tickets." and `<Button variant="ghost" size="sm" onClick={onRetryLoad}>Retry</Button>`; ensure the sentinel is not rendered in error state (so scrolling never re-triggers)
- [X] T020 ✅ DONE [US2] Run `bun run test:unit tests/unit/components/board/stage-column-infinite-scroll.test.tsx` and `bun run test:integration tests/integration/tickets/ship-pagination.test.ts`; T015–T017 must pass

**Checkpoint**: Loading is safe under fast scrolling, overlaps, and failures.

---

## Phase 5: User Story 3 — Works on mobile touch scrolling (Priority: P1)

**Goal**: Auto-load works with touch/momentum scrolling inside the SHIP column on mobile; no jumps; floating scroll buttons and horizontal swipe unchanged.

**Independent Test**: Mobile viewport, navigate to SHIP, scroll inside the column → >50 cards, no Load more button, floating scroll buttons still work.

### Tests for User Story 3 (write first)

- [X] T021 ✅ DONE [US3] Extend `tests/e2e/board/responsive.spec.ts` with ONE mobile-viewport test: seed an `[e2e]`-prefixed project (projects 1-2 reserved) with 60+ SHIP tickets (`[e2e]` titles) using the file's existing seeding/auth pattern; open the board, navigate horizontally to the SHIP column; assert no `/load more/i` button; scroll the SHIP column's Radix viewport (`[data-radix-scroll-area-viewport]` inside the SHIP column) to its bottom via `evaluate(el => el.scrollTo(0, el.scrollHeight))`; `expect.poll` the SHIP card count to exceed 50; assert the floating scroll-to-top button is visible and clicking it scrolls the viewport back to `scrollTop === 0`

### Implementation for User Story 3

- [X] T022 ✅ DONE [US3] In `components/board/stage-column.tsx` ensure the mobile scroll-button visibility (`checkScrollPosition`, L185-236) is re-evaluated when `tickets.length` changes (add `tickets.length` to the effect dependencies or call `checkScrollPosition` in an effect on it) so "scroll to bottom" reappears after a batch is appended; verify the load region's fixed `min-h-10` wrapper sits inside the scroll content after the last card and does not set `overflow-anchor: none` (default anchoring keeps cards in view stable — FR-013). Do not change `components/board/mobile-scroll-button.tsx` or horizontal swipe handling (FR-014)
- [X] T023 ✅ DONE [US3] Add a component test in `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` asserting the observer's `root` option is the SHIP column's scroll viewport element (`[data-radix-scroll-area-viewport]`) once mounted, not `null`/document (guards against page-scroll misfire on desktop and mobile)
- [X] T024 ✅ DONE [US3] Run `bun run test:e2e tests/e2e/board/responsive.spec.ts` and the component test file; T021 and T023 must pass

**Checkpoint**: Mobile touch scrolling loads batches; floating buttons intact.

---

## Phase 6: User Story 4 — Fill tall columns automatically (Priority: P2)

**Goal**: When loaded tickets don't fill the column, batches continue one at a time until it scrolls, total is reached, or an error occurs.

**Independent Test**: Sentinel stays visible after append → next load triggered; stops on `hasMore=false` or error.

### Tests for User Story 4 (write first, must FAIL if trigger only reacts to intersection changes)

- [X] T025 ✅ DONE [US4] In `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` add: (a) sentinel intersecting (`trigger(true)` once), `onLoadMore` called; rerender with `loadStatus='loading'` then with `loadStatus='idle'` and 50 more tickets **without** triggering the observer again → `onLoadMore` called a second time; (b) same flow but rerender with `hasMore=false` → no second call; (c) same flow but rerender with `loadStatus='error'` → no further call

### Implementation for User Story 4

- [X] T026 ✅ DONE [US4] In `components/board/stage-column.tsx` confirm the trigger effect dependency list includes `tickets.length` and `loadStatus` (from T010) so a still-visible sentinel fires the next load after each append; adjust if T025 fails. No polling/timers — loading proceeds strictly one batch at a time via `loadStatus` gating

**Checkpoint**: Large screens load until filled or exhausted.

---

## Phase 7: User Story 5 — Stable during polling and drag & drop (Priority: P2)

**Goal**: Background refresh keeps scrolled-in SHIP tickets; loading paused during drag; counter accurate after drop into SHIP; exhausted flag resets when total changes.

**Independent Test**: Load extra SHIP batches, invalidate the tickets query → tickets remain and count is right; with `isLoadPaused` no load fires, unpausing fires it.

### Tests for User Story 5 (write first, must FAIL)

- [X] T027 ✅ DONE [P] [US5] In `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` add: (a) `isLoadPaused=true` + `trigger(true)` → `onLoadMore` not called; rerender with `isLoadPaused=false` (sentinel still visible) → called once; (b) header shows `51/51` (no `51/50`) when rendered with 51 tickets and `totalCount={Math.max(50, 51)}`
- [X] T028 ✅ DONE [P] [US5] In the same file `describe('useShipInfiniteLoad')` add: after `exhausted` becomes true (empty batch), rerender with a different `shipTotal` → `hasMore` true again and `loadMore()` fetches
- [X] T029 ✅ DONE [P] [US5] In the same file add a `describe('tickets query refresh')` test: seed the tickets cache with 50 fresh-page SHIP tickets + 50 scrolled-in SHIP tickets, mock `fetch` for `GET /api/projects/{id}/tickets` returning the first 50 SHIP + `_shipTotal: 120`, run `useTicketsByStage(projectId)` (or `queryClient.refetchQueries` on `queryKeys.projects.tickets(projectId)`) → cache still contains all 100 SHIP tickets with unique ids

### Implementation for User Story 5

- [X] T030 ✅ DONE [US5] In `app/lib/hooks/queries/useTickets.ts` `makeTicketsQueryFn`: after `fetchTicketsFromAPI`, read `const previous = queryClient.getQueryData<TicketWithVersion[]>(queryKeys.projects.tickets(projectId))` and return `mergeRefreshedTickets(previous, tickets, shipTotal)`; keep the existing `setQueryData(queryKeys.projects.shipTotal(projectId), shipTotal)` call (L24-26)
- [X] T031 ✅ DONE [US5] In `app/lib/hooks/queries/useTickets.ts` `useShipInfiniteLoad`: add `useEffect(() => setExhausted(false), [shipTotal])` so a refresh with a changed total re-enables loading
- [X] T032 ✅ DONE [US5] In `components/board/board-grid.tsx` pass `isLoadPaused={isDragging}` to the SHIP column (alongside the T012 props); in `components/board/stage-column.tsx` confirm `isLoadPaused` is in the trigger effect dependencies so loading resumes after drop. Do not change `components/board/hooks/use-ticket-transitions.ts` or `use-board-drag-state.ts`
- [X] T033 ✅ DONE [US5] Run `bun run test:unit tests/unit/components/board/stage-column-infinite-scroll.test.tsx tests/unit/tickets/ship-pagination.test.ts`; T027–T029 must pass. Run `bun run test:e2e tests/e2e/board/drag-drop.spec.ts` to confirm no drag regression

**Checkpoint**: All stories functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T034 ✅ DONE [P] Grep the repo (`grep -rn "useLoadMoreShipTickets\|isLoadingMoreShip\|onLoadMoreShip\|hasMoreShipTickets\|isLoadingMore" app components lib tests`) and remove any leftover references; confirm `components/activity/activity-feed.tsx` and non-SHIP column rendering are untouched (`git diff --stat` shows only planned files) — FR-016
- [X] T035 ✅ DONE [P] Review `components/board/stage-column.tsx` for literal Tailwind class strings only, semantic tokens (`text-muted-foreground`, `text-destructive`), no hardcoded colors, and unused imports
- [X] T036 ✅ DONE Update `specs/specifications/technical/api/endpoints/tickets.md` (L19, L24, L56 mention SHIP "Load More"): reword to "SHIP infinite-scroll pagination" and note the client auto-loads the next batch (300px pre-load, one request in flight, id dedupe, error + Retry, refresh retains scrolled-in tickets). Do not touch the unrelated "Load more" mentions in `functional/03-collaboration.md` or `functional/05-projects.md`
- [X] T037 ✅ DONE Run quality gates: `bun run type-check`, `bun run lint`, `bun run test:unit`, `bun run test:integration tests/integration/tickets/ship-pagination.test.ts`; fix all errors (including pre-existing ones) before committing

---

## Dependencies & Execution Order

### Phase dependencies
- **Setup (P1)** → **Foundational (P2)** → **US1** → {**US2**, **US3**, **US4**, **US5**} → **Polish**
- US2–US5 all build on the US1 hook/component/wiring (T009–T013). After US1 they touch overlapping files (`useTickets.ts`, `stage-column.tsx`), so implement them sequentially in priority order: US2 → US3 → US4 → US5. Their **test** tasks can be authored in parallel.

### Within-story order
Tests first (must fail) → hook (`useTickets.ts`) → component (`stage-column.tsx`) → wiring (`board-grid.tsx`, `board.tsx`) → run tests.

### Key task dependencies
- T004 depends on T002, T003; T009 depends on T004, T005
- T010 → T011 (same file); T012 → T013 (props contract)
- T018 depends on T009; T019 depends on T011
- T030 depends on T004 (`mergeRefreshedTickets`); T032 depends on T012

---

## Parallel Execution Examples

**Foundational**
```
T002 (appendShipBatch tests)  ‖  T003 (mergeRefreshedTickets tests)
```

**US1 tests**
```
T006 (component tests)  ‖  T007 (hook tests)  ‖  T008 (integration boundary)
```
(T006/T007 share a file — if run by separate agents, write distinct `describe` blocks and merge.)

**US2 tests**
```
T015 (hook)  ‖  T016 (component)  ‖  T017 (integration overlap)
```

**US5 tests**
```
T027  ‖  T028  ‖  T029
```

**Polish**
```
T034  ‖  T035
```

---

## Implementation Strategy

### MVP (US1)
Phases 1–3: button removed, auto-load with spinner and stop-at-total. Validate with T014.

### Incremental delivery
1. US2 — safety guarantees (single in-flight, dedupe, error/Retry). Strongly recommended before release since auto-loading without it can loop.
2. US3 — mobile verification + scroll-button refresh.
3. US4 — tall-column fill (mostly verified by dependency list).
4. US5 — refresh retention (prevents drop→reload loop) and drag pause.
5. Polish + quality gates.

### Independent test criteria summary
- **US1**: >50 SHIP tickets → scrolling column appends batch, spinner visible during load, no button, no request after total.
- **US2**: rapid triggers → 1 fetch; overlapping batch → unique cards; failure → alert + Retry, no auto re-request.
- **US3**: mobile viewport scroll in SHIP → >50 cards; floating buttons work.
- **US4**: sentinel still visible after append → next batch loads; stops on exhaustion/error.
- **US5**: refetch keeps scrolled-in tickets; paused during drag; counter never `51/50`.
