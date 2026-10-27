---
description: "Task list for AIB-894 — Infinite scroll on the SHIP column (replaces Load more)"
---

# Tasks: Infinite scroll on the SHIP column (replaces Load more)

**Input**: Design documents from `specs/AIB-894-infinite-scroll-sur/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tickets-api.md, contracts/ship-column-ui.md, quickstart.md

**Tests**: Included (constitution §III). Extend `tests/integration/tickets/ship-pagination.test.ts`; create new unit/component test files only where no existing file covers the concern (verified: none exist for SHIP pagination helpers, the load-more hook, or the SHIP loading UI).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task belongs to (US1–US5)
- All paths are relative to the repository root

## Path Conventions
Next.js monolith: `app/`, `components/`, `lib/`, `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the baseline before editing. No new dependency is required (native `IntersectionObserver`, existing Radix `ScrollArea`, TanStack Query, lucide-react).

- [ ] T001 Confirm baseline is green and record current callers: run `bun run type-check` and `bun run lint`, then `grep -rn "useLoadMoreShipTickets\|onLoadMoreShip\|isLoadingMoreShip\|isLoadingMore\|onLoadMore" components/board app/lib/hooks/queries/useTickets.ts` (expected callers: `components/board/board.tsx`, `components/board/board-grid.tsx`, `components/board/stage-column.tsx`, `app/lib/hooks/queries/useTickets.ts`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared pure helpers and the shared batch-size constant used by the server, the hook, and every story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 [P] Write failing unit tests in new file `tests/unit/ship-pagination.test.ts` for `lib/tickets/ship-pagination.ts`: `SHIP_BATCH_SIZE === 50`, `SHIP_REFETCH_MAX === 1000`; `appendUniqueTickets(existing, incoming)` drops incoming tickets whose `id` already exists in `existing` regardless of stage, preserves existing order then incoming order, returns correct `addedCount` (0 when all duplicates, 0 for empty incoming), does not mutate inputs; `computeShipRefetchLimit` (0→50, 49→50, 120→120, 1000→1000, 5000→1000); `countShipTickets` (`undefined`→0, `[]`→0, mixed stages counts only `stage === 'SHIP'`). Build minimal `TicketWithVersion` fixtures with a local `makeTicket` helper (pattern: `tests/unit/components/board/stage-column-selection.test.tsx`)
- [ ] T003 Create `lib/tickets/ship-pagination.ts` exporting `SHIP_BATCH_SIZE = 50`, `SHIP_REFETCH_MAX = 1000`, `appendUniqueTickets(existing, incoming): { tickets; addedCount }` (Set of existing ids), `computeShipRefetchLimit(n) = Math.min(SHIP_REFETCH_MAX, Math.max(SHIP_BATCH_SIZE, n))`, `countShipTickets(tickets | undefined)`. Use `import type` only for `TicketWithVersion` (no Prisma runtime import — consumed by client hook and server). Run `bun run test:unit tests/unit/ship-pagination.test.ts` until T002 passes
- [ ] T004 Replace the literal `50` SHIP limits with `SHIP_BATCH_SIZE` from `@/lib/tickets/ship-pagination` in `lib/db/tickets.ts`: default `shipLimit` of `getTicketsByStage` (~L204), default `limit` of `getMoreShipTickets` (~L253), default `shipLimit` of `getTicketsWithJobs` (~L657); and in `app/api/projects/[projectId]/tickets/route.ts` the offset-branch default `limitParam ?? SHIP_BATCH_SIZE` (~L67) and default-branch call (~L83). No behavior change

**Checkpoint**: Helpers tested and importable from both client and server code.

---

## Phase 3: User Story 1 — Auto-load next SHIP batch while scrolling (Priority: P1) 🎯 MVP

**Goal**: The "Load more" button is gone; a sentinel inside the SHIP column's own scroll viewport triggers the next batch 300px before the end, with a discreet spinner and an accurate `loaded/total` badge.

**Independent Test**: Seed a project with > 50 SHIP tickets, open the board, scroll the SHIP column to its bottom → more tickets append, spinner shows while loading, no button exists, badge reads `100/N`.

### Tests for User Story 1

> Write these first and confirm they FAIL before implementation.

- [ ] T005 [P] [US1] Create `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` (render `StageColumn` for `stage="SHIP"` inside `DndContext` following `tests/unit/components/board/stage-column-selection.test.tsx`; install a controllable `IntersectionObserver` stub via `vi.stubGlobal` that captures `callback` and `options` and exposes a `trigger(isIntersecting)` helper; restore with `vi.unstubAllGlobals()` in `afterEach`). Cases: (a) `queryByRole('button', { name: /load more/i })` is null and no text matches `/load more/i` (FR-001); (b) `trigger(true)` with `hasMore=true, isLoading=false, error=null, paused=false` calls `onLoadMore` exactly once (FR-002); (c) `isLoading=true` renders `getByRole('status')` containing sr-only text "Loading more shipped tickets" (FR-003/FR-015); (d) `hasMore=false` → no `data-testid="ship-scroll-sentinel"`, no `role="status"`, and `trigger` never calls `onLoadMore` (FR-006); (e) header badge shows `50/120` when 50 tickets and `totalCount=120` (FR-007); (f) observer `options.root` is the Radix viewport element (closest `[data-radix-scroll-area-viewport]` ancestor of the sentinel) and `options.rootMargin === '0px 0px 300px 0px'` (FR-002)

### Implementation for User Story 1

- [ ] T006 [US1] Change `useLoadMoreShipTickets(projectId)` in `app/lib/hooks/queries/useTickets.ts` to the contract shape `{ loadMore: () => void; isLoading: boolean; error: Error | null }`: `loadMore()` takes no argument and computes `offset = countShipTickets(queryClient.getQueryData(queryKeys.projects.tickets(projectId)))` at call time; `mutationFn` requests `?stage=SHIP&offset=${offset}&limit=${SHIP_BATCH_SIZE}` and still throws on `!response.ok`; `loadMore` wrapped in `useCallback` depending on the stable `mutation.mutate` reference (not the `mutation` object). Keep the existing append in `onSuccess` for now (dedupe added in US2)
- [ ] T007 [P] [US1] Create `components/board/ship-infinite-scroll-footer.tsx` (`'use client'`) per `contracts/ship-column-ui.md`: props `{ rootRef: RefObject<HTMLDivElement | null>; ticketCount: number; hasMore: boolean; isLoading: boolean; error: Error | null; paused: boolean; onLoadMore: () => void }`. `useEffect` (deps `[hasMore, isLoading, error, paused, ticketCount, onLoadMore, rootRef]`): return early if `typeof IntersectionObserver === 'undefined'` or no sentinel; create `new IntersectionObserver(cb, { root: rootRef.current, rootMargin: '0px 0px 300px 0px' })`, `observe(sentinel)`, `disconnect()` in cleanup; `cb` calls `onLoadMore()` only when `entry.isIntersecting && hasMore && !isLoading && !error && !paused`. Render: `!hasMore` → `null`; otherwise wrapper `<div aria-live="polite" className="min-h-8 flex items-center justify-center">` containing the 1px `<div data-testid="ship-scroll-sentinel" aria-hidden="true" />` plus, when `isLoading`, `<div role="status">` with `<Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-muted-foreground" />` and `<span className="sr-only">Loading more shipped tickets</span>`. Static class strings, semantic tokens only (error UI added in US2)
- [ ] T008 [US1] Update `components/board/stage-column.tsx`: replace props `onLoadMore` / `isLoadingMore` (~L35-36, ~L159-160) with optional `shipInfiniteScroll?: { hasMore: boolean; isLoading: boolean; error: Error | null; paused: boolean; onLoadMore: () => void }`; delete the "Load more (N remaining)" `<Button>` block (~L310-328); render `<ShipInfiniteScrollFooter rootRef={scrollViewportRef} ticketCount={tickets.length} {...shipInfiniteScroll} />` right after the ticket map inside the `ScrollArea` viewport when `shipInfiniteScroll` is provided; remove now-unused imports (`ChevronDown`, `Button`, `Loader2` if no longer used). Leave the header `loaded/total` badge (~L263-265) and mobile scroll buttons untouched
- [ ] T009 [US1] Update `components/board/board-grid.tsx`: replace props `hasMoreShipTickets` / `onLoadMoreShip` / `isLoadingMoreShip` (~L29-32, ~L67-70) with `shipLoadState: { hasMore: boolean; isLoading: boolean; error: Error | null; onLoadMore: () => void }`; for the SHIP column (~L138-142) always pass `totalCount: shipTotal` and `shipInfiniteScroll: { ...shipLoadState, paused: isDragging }`
- [ ] T010 [US1] Update `components/board/board.tsx` (~L54-59, ~L341-344): `const { loadMore, isLoading, error } = useLoadMoreShipTickets(projectId)`; `hasMore = shipTicketCount < shipTotal`; `const shipLoadState = useMemo(() => ({ hasMore, isLoading, error, onLoadMore: loadMore }), [...])`; pass `shipLoadState` to `BoardGrid`; delete `handleLoadMoreShip`
- [ ] T011 [US1] Run `bun run test:unit tests/unit/components/board/stage-column-infinite-scroll.test.tsx` until T005 passes; run `grep -rn -i "load more" components/board` → zero hits (FR-001), `components/activity/activity-feed.tsx` untouched (FR-016)

**Checkpoint**: SHIP column auto-loads with spinner and accurate badge; MVP demonstrable.

---

## Phase 4: User Story 2 — Safe loading: no duplicates, no concurrent requests, recoverable errors (Priority: P1)

**Goal**: At most one batch in flight, no ticket ever shown twice (including when `updatedAt` ties or SHIP shifts between loads), empty batches stop loading, and failures pause auto-loading behind an accessible Retry.

**Independent Test**: Fire two `loadMore()` calls in the same tick → one fetch; return a batch containing already-loaded ids → not appended; make the fetch fail → error + Retry, no auto request until Retry; Retry succeeds → tickets appended, auto-loading resumes.

### Tests for User Story 2

- [ ] T012 [P] [US2] Extend `tests/integration/tickets/ship-pagination.test.ts`: create ≥ 60 `[e2e]` SHIP tickets and set identical `updatedAt` on all via Prisma; assert `?stage=SHIP&offset=0&limit=50` ∪ `?stage=SHIP&offset=50&limit=50` contains no duplicate ids and covers every SHIP ticket; assert order is `updatedAt DESC, id DESC` in both the offset branch and the default grouped response's `SHIP` slice (FR-005, contract §2)
- [ ] T013 [P] [US2] Create `tests/unit/use-load-more-ship-tickets.test.ts` (`renderHook` + `QueryClientProvider` wrapper, pattern from `tests/unit/useJobPolling.test.ts`; mock global `fetch` with `vi.fn`; seed `queryKeys.projects.tickets(projectId)` and `queryKeys.projects.shipTotal(projectId)` via `queryClient.setQueryData`). Cases: (a) two synchronous `loadMore()` calls → `fetch` called once (FR-004); (b) request URL offset equals SHIP count in cache (ignores non-SHIP tickets); (c) batch containing an id already in cache (any stage) is not appended, new ids are (FR-005); (d) empty batch (or only duplicates) sets `shipTotal` cache to loaded SHIP count (FR-006); (e) `fetch` resolves `ok: false` → `error` is set, `isLoading` false, tickets cache unchanged; subsequent `loadMore()` with successful fetch appends tickets and `error` becomes `null` (FR-008); (f) after settle (success or failure) a new `loadMore()` is allowed (guard released)
- [ ] T014 [P] [US2] Extend `tests/unit/components/board/stage-column-infinite-scroll.test.tsx`: (a) `isLoading=true` → `trigger(true)` does not call `onLoadMore` (FR-004); (b) `error=new Error()` → `getByRole('alert')` contains "Couldn't load more shipped tickets.", `trigger(true)` does not call `onLoadMore`, and `userEvent.click(getByRole('button', { name: 'Retry' }))` calls `onLoadMore` once (FR-008/FR-015); (c) error state shows no spinner

### Implementation for User Story 2

- [ ] T015 [P] [US2] Add deterministic tie-breaker in `lib/db/tickets.ts`: SHIP `orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]` in `getTicketsByStage` (~L218), `getMoreShipTickets` (~L261), and `getTicketsWithJobs` SHIP query (~L677) so SSR first page matches API order (research D5)
- [ ] T016 [US2] Harden `useLoadMoreShipTickets` in `app/lib/hooks/queries/useTickets.ts`: add `inFlightRef = useRef(false)`; `loadMore` returns early when `inFlightRef.current`, else sets it `true` before `mutate`; `onSettled` resets it to `false`; `onSuccess(newTickets)` uses `setQueryData(ticketsKey, (old) => { const r = appendUniqueTickets(old ?? [], newTickets); addedCount = r.addedCount; return r.tickets; })` and when `addedCount === 0` sets `setQueryData(queryKeys.projects.shipTotal(projectId), countShipTickets(queryClient.getQueryData(ticketsKey)))`; return `error: mutation.error ?? null` (research D3/D4/D6/D7)
- [ ] T017 [US2] Add the error state to `components/board/ship-infinite-scroll-footer.tsx`: when `error` (and not loading) render `<div role="alert" className="flex items-center gap-2 text-xs text-destructive">Couldn't load more shipped tickets.<Button variant="ghost" size="sm" onClick={onLoadMore}>Retry</Button></div>` (shadcn `Button` from `@/components/ui/button`) inside the same `min-h-8` `aria-live="polite"` wrapper; keep the observer gate `!error` so scrolling never re-triggers a failed request
- [ ] T018 [US2] Run `bun run test:unit tests/unit/use-load-more-ship-tickets.test.ts tests/unit/components/board/stage-column-infinite-scroll.test.tsx` and `bun run test:integration tests/integration/tickets/ship-pagination.test.ts` until T012–T014 pass

**Checkpoint**: Loading is single-flight, duplicate-free, stops on empty batches, and recovers via Retry.

---

## Phase 5: User Story 3 — Works on mobile touch scrolling (Priority: P1)

**Goal**: Auto-loading works with touch scrolling inside the SHIP column on iOS Safari / Chrome Android; appending never jumps the view; floating scroll buttons and horizontal swipe still work.

**Independent Test**: On a mobile viewport, swipe to SHIP, swipe down inside the column → batches load; tap the floating "scroll to bottom"/"scroll to top" buttons; swipe horizontally between columns.

### Tests for User Story 3

- [ ] T019 [P] [US3] Extend `tests/unit/components/board/stage-column-infinite-scroll.test.tsx`: (a) sentinel is rendered after the last SHIP card inside the Radix viewport element (DOM order check — observation is geometry-based, so wheel/touch/keyboard/floating-button scrolling all trigger it); (b) re-rendering with additional tickets keeps existing card elements (same DOM nodes by `ticket.id` key — no remount, FR-013); (c) unmount calls the stub's `disconnect` (no errors after leaving the page)

### Implementation for User Story 3

- [ ] T020 [US3] Verify in `components/board/stage-column.tsx` that the footer is rendered inside the `ScrollArea` viewport after the ticket list (not in the column footer outside the scroll region), that ticket keys remain `ticket.id`, that no `scrollTop` manipulation was added, and that `checkScrollPosition` still re-runs on `tickets` change (~L223-225) so the mobile "scroll down" button stays visible as batches append (FR-013/FR-014). Fix any deviation
- [ ] T021 [US3] Manual mobile verification per `specs/AIB-894-infinite-scroll-sur/quickstart.md` (iOS Safari + Chrome Android or device emulation): touch scroll triggers loads, no jump on append, floating up/down buttons work, horizontal swipe between columns unchanged (FR-012/FR-014)

**Checkpoint**: Mobile behavior confirmed; no regression in mobile navigation.

---

## Phase 6: User Story 4 — Fill tall columns automatically (Priority: P2)

**Goal**: If the first batch doesn't fill the column, batches keep loading one at a time until the column overflows, all tickets are loaded, or an error occurs.

**Independent Test**: In a very tall viewport with > 50 SHIP tickets, the column keeps loading until scrollable or complete; a failure stops the chain with the Retry state.

### Tests for User Story 4

- [ ] T022 [P] [US4] Extend `tests/unit/components/board/stage-column-infinite-scroll.test.tsx`: make the IO stub emit an initial `isIntersecting: true` entry on `observe()` (mirrors browser behavior); (a) initial render → `onLoadMore` called once; (b) rerender with `isLoading=true` → not called again; (c) rerender with `isLoading=false` and more tickets (`ticketCount` changed) → called again (one at a time, FR-009); (d) rerender with `hasMore=false` → no further call; (e) rerender with `error` set → no further call (US4 scenario 2)

### Implementation for User Story 4

- [ ] T023 [US4] Confirm `components/board/ship-infinite-scroll-footer.tsx` observer effect dependency list includes `ticketCount`, `hasMore`, `isLoading`, `error`, `paused` so each change recreates the observer and its initial entry re-evaluates the sentinel (research D2); confirm `stage-column.tsx` passes `ticketCount={tickets.length}`. No timers or loops. Run T022 until it passes

**Checkpoint**: Tall screens reach all tickets without any scroll.

---

## Phase 7: User Story 5 — Stable during polling and drag & drop (Priority: P2)

**Goal**: Background refetches keep every SHIP batch already loaded (server returns `shipLimit` SHIP tickets), and loading pauses while a drag is in progress.

**Independent Test**: Load 2+ batches, trigger a board refetch → loaded tickets remain and badge is correct; start a drag → no batch loads until drop; dropped ticket is not duplicated.

### Tests for User Story 5

- [ ] T024 [P] [US5] Extend `tests/integration/tickets/ship-pagination.test.ts` (contract §1): (a) default `GET /api/projects/:id/tickets?shipLimit=75` with ≥ 80 SHIP tickets returns 75 in `SHIP` and correct `_shipTotal`; (b) no `shipLimit` returns 50 (regression); (c) `shipLimit=0`, `-1`, `1001`, `1.5`, `abc` → 400 with `code: 'VALIDATION_ERROR'`; (d) `shipLimit` does not route to the filtered branch (response still grouped by stage)
- [ ] T025 [P] [US5] Extend `tests/unit/use-load-more-ship-tickets.test.ts` (or the same file's `describe('tickets refetch')`): with 120 SHIP tickets in cache, invoking the tickets query function (via `useTicketsByStage` / `queryClient.refetchQueries` on `queryKeys.projects.tickets(projectId)`) requests `?shipLimit=120`; with 10 SHIP tickets requests `?shipLimit=50`; `_shipTotal` from the response is written to the `shipTotal` cache (FR-010)
- [ ] T026 [P] [US5] Extend `tests/unit/components/board/stage-column-infinite-scroll.test.tsx`: `paused=true` → `trigger(true)` does not call `onLoadMore`; rerender with `paused=false` while sentinel intersecting → `onLoadMore` called once (FR-011, research D9)

### Implementation for User Story 5

- [ ] T027 [US5] Update `app/api/projects/[projectId]/tickets/route.ts`: add `shipLimit: z.coerce.number().int().min(1).max(SHIP_REFETCH_MAX).optional()` to `ticketFiltersSchema` (~L46), read `searchParams.get('shipLimit') ?? undefined` into the parsed input, and use `getTicketsByStage(projectId, shipLimit ?? SHIP_BATCH_SIZE)` in the default branch (~L83). Do NOT add `shipLimit` to the filtered-branch condition (~L72). Keep the existing `VALIDATION_ERROR` 400 response
- [ ] T028 [US5] Update `app/lib/hooks/queries/useTickets.ts`: `fetchTicketsFromAPI(projectId, shipLimit)` calls `/api/projects/${projectId}/tickets?shipLimit=${shipLimit}`; `makeTicketsQueryFn` reads `countShipTickets(queryClient.getQueryData(queryKeys.projects.tickets(projectId)))` before fetching and passes `computeShipRefetchLimit(loaded)`; keep writing `_shipTotal` to the `shipTotal` cache (research D8)
- [ ] T029 [US5] Verify `components/board/board-grid.tsx` passes `paused: isDragging` (from `components/board/hooks/use-board-drag-state.ts`) in `shipInfiniteScroll` (done in T009) and that an optimistically dropped SHIP ticket is not re-appended by a later batch (covered by `appendUniqueTickets` any-stage dedupe, T016). Run T024–T026 until they pass

**Checkpoint**: Polling and drag & drop no longer drop or duplicate SHIP tickets.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T030 [P] Confirm no remaining references to the old API: `grep -rn "onLoadMoreShip\|isLoadingMoreShip\|hasMoreShipTickets\|isLoadingMore\|handleLoadMoreShip" components app` → zero hits; `grep -rn -i "load more" components/board` → zero hits; `components/activity/activity-feed.tsx` unchanged (FR-016)
- [ ] T031 [P] Confirm no hardcoded colors or dynamic Tailwind classes in `components/board/ship-infinite-scroll-footer.tsx` and `components/board/stage-column.tsx` (CLAUDE.md color rules)
- [ ] T032 Run `bun run type-check` and `bun run lint`; fix all errors
- [ ] T033 Run the feature test set: `bun run test:unit tests/unit/ship-pagination.test.ts tests/unit/use-load-more-ship-tickets.test.ts tests/unit/components/board/stage-column-infinite-scroll.test.tsx tests/unit/components/board/stage-column-selection.test.tsx` and `bun run test:integration tests/integration/tickets/ship-pagination.test.ts`
- [ ] T034 Run the remaining manual checks in `specs/AIB-894-infinite-scroll-sur/quickstart.md` (desktop scroll smoothness with 300px margin, keyboard-only reachability, screen reader announcement of loading/error)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories
- **US1 (Phase 3)**: depends on Phase 2. MVP
- **US2 (Phase 4)**: depends on US1 (extends the hook from T006 and the footer from T007). T012/T015 (server ordering) only depend on Phase 2
- **US3 (Phase 5)**: depends on US1 (footer placement)
- **US4 (Phase 6)**: depends on US1 footer (T007); best after US2 (error gate)
- **US5 (Phase 7)**: API + refetch tasks (T024, T027, T028) only depend on Phase 2; pause test/verification (T026, T029) depend on US1 (T007, T009)
- **Polish (Phase 8)**: after all stories

### Story completion order
```
Phase 2 ──▶ US1 ──▶ US2 ──▶ US4
              │        
              ├──▶ US3
              └──▶ US5 (pause part)
Phase 2 ──▶ US5 (API shipLimit + refetch part, can start in parallel with US1)
```

### Within each story
Tests first (must fail) → implementation → re-run tests.

### Same-file serialization
- `app/lib/hooks/queries/useTickets.ts`: T006 → T016 → T028
- `components/board/ship-infinite-scroll-footer.tsx`: T007 → T017 → T023
- `tests/unit/components/board/stage-column-infinite-scroll.test.tsx`: T005 → T014 → T019 → T022 → T026
- `tests/integration/tickets/ship-pagination.test.ts`: T012 → T024
- `lib/db/tickets.ts`: T004 → T015
- `app/api/projects/[projectId]/tickets/route.ts`: T004 → T027

---

## Parallel Examples

### Phase 2
```
T002 tests/unit/ship-pagination.test.ts   (in parallel with reading lib/db/tickets.ts for T004)
```

### User Story 1
```
T005 tests/unit/components/board/stage-column-infinite-scroll.test.tsx
T007 components/board/ship-infinite-scroll-footer.tsx
(T006 useTickets.ts can also proceed in parallel — different file)
```

### User Story 2
```
T012 tests/integration/tickets/ship-pagination.test.ts
T013 tests/unit/use-load-more-ship-tickets.test.ts
T014 tests/unit/components/board/stage-column-infinite-scroll.test.tsx
T015 lib/db/tickets.ts
```

### User Story 5
```
T024 tests/integration/tickets/ship-pagination.test.ts   (after T012)
T025 tests/unit/use-load-more-ship-tickets.test.ts       (after T013)
T026 tests/unit/components/board/stage-column-infinite-scroll.test.tsx (after T022)
T027 app/api/projects/[projectId]/tickets/route.ts
```

---

## Implementation Strategy

### MVP First (User Story 1)
1. Phase 1 + Phase 2 (helpers + constant)
2. Phase 3 (US1): button removed, sentinel auto-load with spinner
3. **Validate**: T011 passes; manual scroll check on the board

### Incremental Delivery
1. US1 → auto-load works (MVP)
2. US2 → single-flight, dedupe, deterministic order, error/Retry (required before shipping: explicit acceptance criteria)
3. US3 → mobile verification
4. US4 → fill-tall-columns tests lock in observer re-evaluation
5. US5 → `shipLimit` refetch + drag pause
6. Polish → type-check, lint, full feature test set, quickstart manual checks

All P1 stories (US1–US3) should land together; P2 stories (US4, US5) complete the feature and are required by FR-009/FR-010/FR-011.

---

## Notes
- [P] = different files, no dependency on incomplete tasks
- No Prisma schema change, no migration
- No E2E tests added (plan: RTL + IO stub covers observer gating; touch/visual stability checked manually)
- Test data must use the `[e2e]` prefix and projects 1–2
