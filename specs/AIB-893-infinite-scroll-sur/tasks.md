---
description: "Task list for AIB-893 — Infinite scroll on the SHIP column (replaces Load more)"
---

# Tasks: Infinite scroll on the SHIP column (replaces "Load more")

**Input**: Design documents from `/specs/AIB-893-infinite-scroll-sur/`
**Prerequisites**: plan.md, spec.md, research.md (D1–D11 + Existing Files), data-model.md, contracts/ship-infinite-scroll.md

**Tests**: Included (constitution). Hook behavior → Vitest unit with a real `QueryClient`; column behavior → Vitest + RTL with a controllable `IntersectionObserver` stub. No new E2E by default (optional P3 task in Polish). API contract is already covered by `tests/integration/tickets/ship-pagination.test.ts` (keep, comment wording only).

**Organization**: Tasks are grouped by user story. US1–US3 are P1, US4–US5 are P2.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task belongs to (US1…US5)

## Path Conventions
Next.js web-app layout at repository root: `app/`, `components/`, `lib/`, `tests/`. All paths below were verified against the filesystem (research.md "Existing Files").

## Files touched (summary)

| Path | Action |
|------|--------|
| `app/lib/hooks/queries/useTickets.ts` | MODIFY — `SHIP_BATCH_SIZE`, extended `useLoadMoreShipTickets(projectId, shipTotal)`, polling merge in `makeTicketsQueryFn` |
| `components/board/hooks/use-infinite-scroll-trigger.ts` | CREATE — sentinel/IntersectionObserver trigger hook |
| `components/board/stage-column.tsx` | MODIFY — remove Load more button (lines ~310–328), add sentinel + spinner + error/Retry rows |
| `components/board/board-grid.tsx` | MODIFY — SHIP-only prop spread (lines ~137–142), new props |
| `components/board/board.tsx` | MODIFY — wire extended hook (lines ~54–59) |
| `tests/unit/use-load-more-ship-tickets.test.ts` | CREATE — hook tests (no existing hook test) |
| `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` | CREATE — column tests (harness pattern from `tests/unit/components/board/stage-column-selection.test.tsx`; separate file because selection is an unrelated concern) |
| `tests/integration/tickets/ship-pagination.test.ts` | KEEP — header comment wording only |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test scaffolding shared by all stories. No dependencies, no config changes.

- [ ] T001 [P] Create `tests/unit/use-load-more-ship-tickets.test.ts` scaffold: real `QueryClient` (`retry: false`) wrapped in `QueryClientProvider` for `renderHook` from `@testing-library/react` (pattern: `tests/unit/useSetupJobPolling.test.ts`, `tests/unit/job-cache.test.ts`), `vi.stubGlobal('fetch', vi.fn())` with `afterEach(vi.unstubAllGlobals)`, a `makeShipTicket(id, stage = 'SHIP')` factory producing `TicketWithVersion`, a `batchOf(n, startId)` helper, and a `seed(tickets, shipTotal)` helper that writes `queryKeys.projects.tickets(projectId)` and `queryKeys.projects.shipTotal(projectId)`; use `[e2e]` prefix in ticket titles
- [ ] T002 [P] Create `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` scaffold copying the harness from `tests/unit/components/board/stage-column-selection.test.tsx` (mock `next/navigation`, wrap in `DndContext`, `renderWithProviders`, `makeTicket()` with `[e2e]` titles) plus a controllable `IntersectionObserver` stub installed with `vi.stubGlobal` that records instances (`observe`, `unobserve`, `disconnect`, captured `options.root` / `options.rootMargin`) and exposes `triggerIntersect(isIntersecting: boolean)` that invokes the callback inside `act()` — required because `lib/hooks/use-intersection-observer.ts` returns `true` when IO is unavailable

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared constant + new trigger hook used by every UI story.

**⚠️ CRITICAL**: No user story UI work can begin until this phase is complete

- [ ] T003 Export `SHIP_BATCH_SIZE = 50` from `app/lib/hooks/queries/useTickets.ts` and use it as the `limit` in the existing `useLoadMoreShipTickets` fetch URL (`?stage=SHIP&offset=${offset}&limit=${SHIP_BATCH_SIZE}`) instead of the literal
- [ ] T004 [P] Create `components/board/hooks/use-infinite-scroll-trigger.ts` exporting `useInfiniteScrollTrigger({ rootRef, sentinelRef, enabled, onTrigger, prefetchDistancePx = 300 }): void` per contracts §4: capture `rootRef.current` into `useState` in a mount `useEffect` (never read `ref.current` during render — research pattern #6); call `useIntersectionObserver(sentinelRef, { root: rootEl, rootMargin: \`0px 0px ${prefetchDistancePx}px 0px\`, threshold: 0 })` from `lib/hooks/use-intersection-observer.ts` (verify how it handles a `null` root / gating and only treat the result as meaningful once `rootEl` is set); `useEffect(() => { if (isNearBottom && enabled && rootEl) onTrigger(); }, [isNearBottom, enabled, rootEl, onTrigger])` so the effect re-fires when `enabled` flips false→true (auto-fill, research D2); add JSDoc on the exported hook explaining the auto-fill re-evaluation

**Checkpoint**: Constant + trigger hook available; user stories can begin.

---

## Phase 3: User Story 1 - Automatic loading while scrolling SHIP (Priority: P1) 🎯 MVP

**Goal**: SHIP column loads the next batch of 50 automatically when its bottom approaches (300px prefetch inside the column viewport); no "Load more" button; spinner while loading; stops when all loaded.

**Independent Test**: Seed >100 SHIP tickets, scroll SHIP repeatedly → counter `50/120` → `100/120` → `120/120`, no button, no request after completion.

### Tests for User Story 1 (write first, ensure they FAIL)

- [ ] T005 [P] [US1] In `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` add cases: (1) with `onLoadMore`, `hasMore`, `totalCount=120` and 50 tickets, `queryByRole('button', { name: /load more/i })` is null (FR-001); (2) `triggerIntersect(true)` → `onLoadMore` called exactly once; IO instance was created with `root` = the column scroll viewport element (not `null`/document) and `rootMargin: '0px 0px 300px 0px'` (FR-002); (3) rerender with `isLoadingMore` → `getByRole('status')` contains text "Loading more tickets" (FR-003, FR-015); (4) `hasMore={false}` → `queryByTestId('ship-load-more-sentinel')` is null and `triggerIntersect(true)` does not call `onLoadMore`; (5) header shows `50/120` with 50 tickets and `totalCount=120`, and `120/120` with 120 tickets and `totalCount=120` (FR-007, US1-AS3)
- [ ] T006 [P] [US1] In `tests/unit/use-load-more-ship-tickets.test.ts` add cases: (1) seeded 50 SHIP + `shipTotal=120`, `loadMore(50)` → `fetch` called with URL containing `stage=SHIP&offset=50&limit=50`, cache grows to 100 SHIP tickets in order (first batch then new batch), `isLoading` true during the request then false; (2) batch of `< 50` tickets → `isExhausted === true` and a subsequent `loadMore` does not call `fetch`; (3) empty batch `[]` → `isExhausted === true` (FR-006)

### Implementation for User Story 1

- [ ] T007 [US1] Extend `useLoadMoreShipTickets` in `app/lib/hooks/queries/useTickets.ts` to signature `useLoadMoreShipTickets(projectId: number, shipTotal: number): LoadMoreShipTickets` (contracts §2, exported interface with `loadMore`, `retry`, `isLoading`, `isError`, `isExhausted`): add `isExhausted` state set in `onSuccess(newTickets, { limit })` when `newTickets.length < limit`, plus `exhaustedAtTotalRef` storing `shipTotal` at exhaustion and a `useEffect` on `shipTotal` that clears `isExhausted` when `shipTotal > exhaustedAtTotalRef.current` (research D5); `loadMore(offset)` returns early when exhausted; keep the functional `setQueryData` append form and the thrown `Error('Failed to fetch more SHIP tickets: HTTP …')` (research patterns #1, #2). Leave `retry`/in-flight/dedupe to US2 tasks but declare them in the returned object shape (`retry` may temporarily delegate to `loadMore`)
- [ ] T008 [US1] In `components/board/stage-column.tsx`: delete the `Load more (N remaining)` `<Button>` block (~lines 310–328) and remove `ChevronDown` from the `lucide-react` import if unused; add optional props `hasMore?: boolean`, `loadMoreError?: boolean`, `onRetryLoadMore?: () => void`, `isLoadMorePaused?: boolean` to the props interface and destructuring (contracts §5); add `const sentinelRef = React.useRef<HTMLDivElement>(null)`; after the last card render, when `onLoadMore && hasMore`, render `<div ref={sentinelRef} data-testid="ship-load-more-sentinel" aria-hidden="true" />`, then when `isLoadingMore` a fixed-height (`h-8`) row `role="status" aria-live="polite"` with `<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />` and `<span className="sr-only">Loading more tickets</span>`; call `useInfiniteScrollTrigger({ rootRef: scrollViewportRef, sentinelRef, enabled: !!onLoadMore && !!hasMore && !isLoadingMore && !loadMoreError && !isLoadMorePaused, onTrigger: onLoadMore ?? noop })` (stable `noop` defined at module scope); change the header counter condition (~line 263) to show `${ticketCount}/${totalCount}` whenever `totalCount !== undefined` so `120/120` is displayed once complete (US1-AS3). Use only static class strings and semantic tokens
- [ ] T009 [US1] In `components/board/board-grid.tsx`: add `hasMoreShipTickets`, `loadMoreShipError`, `onRetryLoadMoreShip` to `BoardGridProps` (keep existing `shipTotal`, `onLoadMoreShip`, `isLoadingMoreShip`-style props — match current names); replace the `hasMoreShipTickets &&` conditional spread (~lines 137–142) with a SHIP-only spread `stage === Stage.SHIP && { totalCount: shipTotal, hasMore: hasMoreShipTickets, onLoadMore, isLoadingMore, loadMoreError, onRetryLoadMore, isLoadMorePaused: isDragging }` so `totalCount` is always passed for SHIP and no other column receives `onLoadMore` (FR-016)
- [ ] T010 [US1] In `components/board/board.tsx` (~lines 54–59): call `useLoadMoreShipTickets(projectId, shipTotal)`; compute `hasMoreShipTickets = shipTicketCount < shipTotal && !isExhausted`; define `handleLoadMoreShip = useCallback(() => loadMore(shipTicketCount), [loadMore, shipTicketCount])` and `handleRetryLoadMoreShip = useCallback(() => retry(shipTicketCount), [retry, shipTicketCount])`; pass `hasMoreShipTickets`, `isError` and the retry handler to `BoardGrid`; update the code comment to "SHIP stage infinite scroll"
- [ ] T011 [US1] Run `bun run test:unit tests/unit/components/board/stage-column-infinite-scroll.test.tsx tests/unit/use-load-more-ship-tickets.test.ts` and make T005/T006 pass

**Checkpoint**: SHIP loads automatically while scrolling; MVP deliverable.

---

## Phase 4: User Story 2 - Reliable loading: no duplicates, single in-flight, recoverable errors (Priority: P1)

**Goal**: ≤1 request in flight, each ticket once, failure pauses auto-loading with inline error + Retry.

**Independent Test**: Fire repeated triggers and a failing request → one `fetch`, no duplicate ids, `role="alert"` with working Retry.

### Tests for User Story 2 (write first, ensure they FAIL)

- [ ] T012 [P] [US2] In `tests/unit/use-load-more-ship-tickets.test.ts` add cases: (1) two `loadMore(50)` calls in the same `act()` tick (pending `fetch` promise) → `fetch` called once (FR-004, SC-002); (2) cache seeded with ids 1–50 SHIP plus id 60 in VERIFY, batch returns ids 45–94 + 60 → every id appears exactly once in the tickets cache and id 60 stays in VERIFY (FR-005, research D4); (3) a full batch of 50 that are all already present → `isExhausted === true` (added === 0 guard, research D5); (4) `fetch` resolves `{ ok: false, status: 500 }` → `isError === true`, subsequent `loadMore(50)` does not call `fetch` (FR-008, SC-005); `retry(50)` calls `fetch` with `offset=50`, appends on success and `isError` returns to false
- [ ] T013 [P] [US2] In `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` add cases: (1) `isLoadingMore` true + `triggerIntersect(true)` repeatedly → `onLoadMore` not called (FR-004); (2) `loadMoreError` → `getByRole('alert')` contains "Couldn't load more tickets.", `triggerIntersect(true)` does not call `onLoadMore`, and `userEvent.click(getByRole('button', { name: /retry/i }))` calls `onRetryLoadMore` once (FR-008, FR-015); (3) Retry button is focusable via `userEvent.tab()` and activates with Enter

### Implementation for User Story 2

- [ ] T014 [US2] In `useLoadMoreShipTickets` (`app/lib/hooks/queries/useTickets.ts`): add `inFlightRef = useRef(false)` set synchronously before `mutation.mutate` and cleared in `onSettled` (research D3); `loadMore` returns early when `inFlightRef.current`, `mutation.isError` or exhausted; in `onSuccess` use functional `setQueryData` with `existingIds = new Set(old.map(t => t.id))` across all stages and append only unseen ids, counting `added`; mark exhausted when `added === 0` (research D4/D5); implement `retry(offset)` as `mutation.reset()` then the same guarded mutate path bypassing the `isError` check (research D6); expose `isError: mutation.isError`; ensure mutation `retry` stays 0 (no automatic retries)
- [ ] T015 [US2] In `components/board/stage-column.tsx`: when `loadMoreError`, render a row `role="alert"` with `<span className="text-xs text-destructive">Couldn't load more tickets.</span>` and shadcn `<Button size="sm" variant="ghost" onClick={onRetryLoadMore}>Retry</Button>` (reuse existing `Button` import); render it below the sentinel position, do not render the spinner row at the same time; keep class strings static (no hex colors)
- [ ] T016 [US2] Run `bun run test:unit tests/unit/use-load-more-ship-tickets.test.ts tests/unit/components/board/stage-column-infinite-scroll.test.tsx` and make T012/T013 pass

**Checkpoint**: US1 + US2 together satisfy SC-002, SC-004, SC-005.

---

## Phase 5: User Story 3 - Mobile touch scrolling (Priority: P1)

**Goal**: Loading triggers from touch/momentum scroll and the floating scroll-down button inside the column viewport; no scroll jump; horizontal swipe unaffected.

**Independent Test**: Mobile viewport, touch-scroll SHIP and use the floating ↓ button → batches load, visible cards don't move, horizontal swipe still works.

### Tests for User Story 3 (write first, ensure they FAIL)

- [ ] T017 [P] [US3] In `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` add cases: (1) the IO `root` captured by the stub is the same element as the Radix ScrollArea viewport (`[data-radix-scroll-area-viewport]`) of the column — guarantees page-level horizontal scroll cannot trigger loads (FR-012, research pattern #5); (2) appending tickets via rerender keeps existing card DOM nodes (same element references for `key={ticket.id}`) and the spinner/error rows render after all cards and after the sentinel (FR-013, research D9)

### Implementation for User Story 3

- [ ] T018 [US3] Review `components/board/stage-column.tsx` mobile scroll logic (~lines 187–236, `scrollViewportRef`, `useEffect([tickets])`) and `components/board/mobile-scroll-button.tsx`: confirm no change is needed for scroll-button visibility after appends (FR-014); ensure the sentinel/status rows use no `touch-action`/overflow classes that would interfere with horizontal swiping, and that the status/error rows have fixed height (`h-8`) so the floating ↓ button's `scrollBy` reaches the sentinel; adjust only if T017 or this review reveals a problem
- [ ] T019 [US3] Run `bun run test:unit tests/unit/components/board/stage-column-infinite-scroll.test.tsx` and make T017 pass

**Checkpoint**: All P1 stories complete.

---

## Phase 6: User Story 4 - Auto-fill on tall screens (Priority: P2)

**Goal**: If the first batch doesn't fill the column, batches keep loading (one at a time) until scrollable, complete, or error.

**Independent Test**: Sentinel stays visible across batches → `onLoadMore` re-fires after each batch completes; stops on error / `hasMore=false`.

### Tests for User Story 4 (write first, ensure they FAIL)

- [ ] T020 [P] [US4] In `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` add cases: (1) `triggerIntersect(true)` → 1 call; rerender `isLoadingMore=true` then `isLoadingMore=false` with 100 tickets while sentinel still intersecting (no new IO callback) → `onLoadMore` called a 2nd time (FR-009, research D2); (2) same sequence but ending with `loadMoreError=true` → no 2nd call (US4-AS2); (3) ending with `hasMore=false` → no 2nd call
- [ ] T021 [P] [US4] Add a direct unit test for the trigger hook in `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` (same IO stub, `renderHook` on `useInfiniteScrollTrigger` from `components/board/hooks/use-infinite-scroll-trigger.ts`): `enabled=false` while intersecting → no call; flipping `enabled` to true → exactly one call; custom `prefetchDistancePx=100` → IO `rootMargin` is `'0px 0px 100px 0px'`

### Implementation for User Story 4

- [ ] T022 [US4] Verify/adjust `components/board/hooks/use-infinite-scroll-trigger.ts` so the trigger effect depends on `enabled` and re-fires after each `isLoadingMore` true→false transition while the sentinel remains intersecting, and that `onTrigger` identity changes (new `shipTicketCount` in `handleLoadMoreShip` from `components/board/board.tsx`) cannot cause a second call while `enabled` is false; then run `bun run test:unit tests/unit/components/board/stage-column-infinite-scroll.test.tsx` and make T020/T021 pass

**Checkpoint**: Tall screens never get stuck without a way to load.

---

## Phase 7: User Story 5 - Compatibility with polling and drag & drop (Priority: P2)

**Goal**: Board refetches keep already-loaded SHIP tickets; no loading while dragging; drops stay deduplicated and counted.

**Independent Test**: Load 2 batches, refetch tickets query → SHIP count unchanged; set dragging → no trigger; drag ends near bottom → trigger.

### Tests for User Story 5 (write first, ensure they FAIL)

- [ ] T023 [P] [US5] In `tests/unit/use-load-more-ship-tickets.test.ts` add polling-merge cases using the real `useTickets`/`useTicketsByStage` query (or `queryClient.fetchQuery` with the query fn exported for test) from `app/lib/hooks/queries/useTickets.ts`: (1) cache has 100 SHIP (ids 1–100), refetch response returns SHIP ids 1–50 with `_shipTotal: 120` → cache still has 100 SHIP tickets, fresh first, no duplicates (FR-010, SC-006); (2) refetch where id 70 now appears under `VERIFY` → id 70 appears once, in VERIFY (reviewer note, research D7); (3) refetch returning SHIP with `fresh.length >= _shipTotal` → stale extras dropped; (4) fresh data wins for ids present in both (updated title from fresh response); (5) `shipTotal` growing above the exhausted total clears `isExhausted`
- [ ] T024 [P] [US5] In `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` add cases: (1) `isLoadMorePaused` true + `triggerIntersect(true)` → `onLoadMore` not called (FR-011, US5-AS2); (2) rerender with `isLoadMorePaused` false while still intersecting → `onLoadMore` called once (drag end)

### Implementation for User Story 5

- [ ] T025 [US5] In `makeTicketsQueryFn` (`app/lib/hooks/queries/useTickets.ts`): after `await fetchTicketsFromAPI(projectId)`, read `previous = queryClient.getQueryData<TicketWithVersion[]>(queryKeys.projects.tickets(projectId)) ?? []` (post-`await`, research pattern #4); compute `freshIds = new Set(tickets.map(t => t.id))` and `freshShipCount`; if `freshShipCount < shipTotal`, return `[...tickets, ...previous.filter(t => t.stage === Stage.SHIP && !freshIds.has(t.id))]`, else return `tickets`; keep the existing `setQueryData(queryKeys.projects.shipTotal(projectId), shipTotal)`. Export the query fn factory only if needed by T023 (prefer testing through the public hooks)
- [ ] T026 [US5] Confirm `components/board/board-grid.tsx` passes `isLoadMorePaused: isDragging` for SHIP (from T009) and that `components/board/board.tsx` does not need changes for drop handling (`use-ticket-transitions.ts` optimistic writers stay untouched per research pattern #3); run `bun run test:unit tests/unit/use-load-more-ship-tickets.test.ts tests/unit/components/board/stage-column-infinite-scroll.test.tsx` and make T023/T024 pass

**Checkpoint**: All user stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T027 [P] Update the header comment of `tests/integration/tickets/ship-pagination.test.ts` from "Load More" wording to "infinite scroll" (no test logic changes)
- [ ] T028 [P] Search for stale references: `grep -rniE "load more \(|loadMoreShip|useLoadMoreShipTickets" app components lib tests` — ensure every caller of `useLoadMoreShipTickets` passes `shipTotal`, no SHIP "Load more" text remains, and `components/activity/activity-feed.tsx` "Load more" is untouched (FR-016)
- [ ] T029 [P] (Optional, P3) Add one Playwright case to `tests/e2e/board/responsive.spec.ts`: mobile viewport, seed an `[e2e]` project (Project 1–2) with 60 SHIP tickets, scroll the SHIP column viewport to the bottom → header shows `60/60` and no `/load more/i` button
- [ ] T030 Run `bun run type-check` and `bun run lint`; fix all errors (including pre-existing)
- [ ] T031 Run `bun run test:unit` (full) and `bun run test:integration tests/integration/tickets/ship-pagination.test.ts`; fix regressions
- [ ] T032 Manual verification per plan.md "Manual verification (quickstart)" steps 1–6 (desktop scroll, single request in Network tab, blocked request → Retry, tall window auto-fill, mobile emulation incl. floating ↓ button and horizontal swipe, polling + drag to SHIP)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — T001, T002 in parallel
- **Foundational (Phase 2)**: after Setup; T003 and T004 in parallel (different files)
- **US1 (Phase 3)**: after Foundational — MVP
- **US2 (Phase 4)**: after US1 (same hook + same `stage-column.tsx` render block; extends T007/T008)
- **US3 (Phase 5)**: after US1 (verifies the sentinel/root wiring of T008); independent of US2
- **US4 (Phase 6)**: after US1 (relies on T004 + T008); independent of US2/US3, but its error case (T020-2) needs T015 from US2
- **US5 (Phase 7)**: T025 (query fn merge) only depends on Foundational and can start in parallel with US1 by a separate agent; T024/T026 depend on T008/T009
- **Polish (Phase 8)**: after all desired stories

### Story completion order

```
Setup → Foundational → US1 (MVP) ─┬─> US2 ──> US4
                                   ├─> US3
                                   └─> US5 (T025 may start right after Foundational)
                                         └─> Polish
```

### Within each story

- Tests written first and failing → hook/data layer (`useTickets.ts`) → UI (`stage-column.tsx`) → wiring (`board-grid.tsx`, `board.tsx`) → run targeted tests
- Tasks editing the same file are sequential: `useTickets.ts` (T003 → T007 → T014 → T025), `stage-column.tsx` (T008 → T015 → T018), test files appended story by story

## Parallel Execution Examples

**Setup**: T001 ‖ T002 (two different new test files)

**Foundational**: T003 (`useTickets.ts`) ‖ T004 (`use-infinite-scroll-trigger.ts`)

**US1**: T005 (column test) ‖ T006 (hook test); then T007 (`useTickets.ts`) ‖ T008 (`stage-column.tsx`); then T009 → T010

**US2**: T012 (hook test) ‖ T013 (column test); then T014 (`useTickets.ts`) ‖ T015 (`stage-column.tsx`)

**US4**: T020 ‖ T021 are in the same file — write sequentially if a single agent; they are marked [P] relative to production code

**US5**: T023 (hook test file) ‖ T024 (column test file); T025 (`useTickets.ts`) can run alongside US1 UI tasks T008–T010

**Polish**: T027 ‖ T028 ‖ T029, then T030 → T031 → T032

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 + Phase 2
2. Phase 3 (US1) → SHIP auto-loads with spinner, no button, counter `loaded/total`
3. Stop and validate with T011 + manual desktop scroll

### Incremental Delivery

1. US1 → automatic loading (MVP)
2. US2 → reliability guarantees (single in-flight, dedupe, error/Retry) — recommended to ship together with US1, since without it infinite scroll can loop or duplicate
3. US3 → mobile confirmation (mostly verification of IO root wiring)
4. US4 → auto-fill on tall screens
5. US5 → polling merge + drag pause
6. Polish → type-check, lint, full unit + targeted integration, manual quickstart

## Notes

- No server, Prisma, or API changes; endpoint `GET /api/projects/:projectId/tickets?stage=SHIP&offset=N&limit=50` is reused unchanged
- Do not modify optimistic cache writers in `components/board/hooks/use-ticket-transitions.ts` or `lib/hooks/mutations/useDeleteTicket.ts`
- No hardcoded colors; only static Tailwind class strings with semantic tokens (`text-muted-foreground`, `text-destructive`)
- Test data uses the `[e2e]` prefix
