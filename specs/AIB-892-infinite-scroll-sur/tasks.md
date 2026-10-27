# Tasks: Infinite Scroll on the SHIP Column

**Input**: `specs/AIB-892-infinite-scroll-sur/` (plan.md, spec.md, research.md, data-model.md, contracts/api.md)
**Tests**: Included (constitution). Extend existing files where a domain is covered; all assertions unconditional; test data uses `[e2e]` prefixes.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 ✅ DONE Read `node_modules/next/dist/docs/` guidance relevant to route handlers and client components, then review `components/board/stage-column.tsx`, `components/board/board-grid.tsx`, `components/board/board.tsx`, `app/lib/hooks/queries/useTickets.ts`, `app/api/projects/[projectId]/tickets/route.ts`, and `lib/db/tickets.ts` (`getTicketsByStage`, `getMoreShipTickets`) to confirm the current "Load more" wiring before editing

## Phase 2: Foundational (blocks all stories)

**Purpose**: Hook and API changes that every story depends on.

- [x] T002 ✅ DONE Extend the zod query schema in `app/api/projects/[projectId]/tickets/route.ts` with `shipLimit: z.coerce.number().int().min(1).max(500).optional()`; in the default grouped response branch call `getTicketsByStage(projectId, shipLimit ?? 50)`; invalid values return 400 in the same error shape as other params; ignore `shipLimit` when `stage`/`offset`/`limit`/`updatedSince`/`workflowType` paths are used
- [x] T003 ✅ DONE Update `useLoadMoreShipTickets` in `app/lib/hooks/queries/useTickets.ts`: add a `useRef` in-flight guard so `loadMore(currentShipCount)` is a no-op while a request is pending (FR-004); in `onSuccess` merge appended tickets into the `queryKeys.projects.tickets(projectId)` cache via functional `setQueryData`, skipping ids already present (FR-005); return `{ loadMore, isLoading, isError, reset }` per contracts/api.md; release the guard in `onSettled`
- [x] T004 ✅ DONE Update `fetchTicketsFromAPI` and `makeTicketsQueryFn` in `app/lib/hooks/queries/useTickets.ts` so board refetches preserve loaded SHIP tickets: read cached SHIP count via `queryClient.getQueryData(queryKeys.projects.tickets(projectId))`, request `?shipLimit=max(50, cachedShipCount)` (append param only when > 50), keep `_shipTotal` handling unchanged (FR-008)

**Checkpoint**: API accepts `shipLimit`; hook dedupes, guards, exposes error state.

## Phase 3: User Story 1 - Automatic loading while scrolling SHIP (P1) 🎯 MVP

**Goal**: Next batch loads automatically near the bottom; no button; spinner while loading; stops when exhausted.
**Independent Test**: Render SHIP column with `onLoadMore`, fire the observer callback, verify `onLoadMore` called, no "Load more" button, spinner shown while loading, no sentinel once `onLoadMore` is absent.

### Tests for User Story 1

- [x] T005 ✅ DONE [P] [US1] Create `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` (new file: existing `stage-column-selection.test.tsx` covers bulk selection only) with a mocked `IntersectionObserver`, rendering `StageColumn` inside `DndContext` with `renderWithProviders` (pattern from `stage-column-selection.test.tsx`); cover: no "Load more" button (FR-001), sentinel `data-testid="ship-load-sentinel"` present when `onLoadMore` set, `onLoadMore` called on intersect (FR-002), `role="status"` spinner with `aria-label="Loading more tickets"` while `isLoadingMore` (FR-003), no sentinel/observer when `onLoadMore` undefined (FR-006), header counter shows `loaded/total` vs plain count when equal
- [x] T006 ✅ DONE [P] [US1] Extend `tests/integration/tickets/ship-pagination.test.ts` ("Load More endpoint" describe): add cases for consecutive offset pages that do not overlap, empty array when offset ≥ total, and `_shipTotal` accuracy

### Implementation for User Story 1

- [x] T007 ✅ DONE [US1] In `components/board/stage-column.tsx` remove the "Load more" `Button` block and drop `Button`/`ChevronDown` imports only if no longer used elsewhere in the file (FR-001)
- [x] T008 ✅ DONE [US1] In `components/board/stage-column.tsx` add, after the rendered tickets and only when `onLoadMore` is set and tickets are non-empty: an `aria-hidden` sentinel `div` (`data-testid="ship-load-sentinel"`, rendered only when `!loadMoreError`) and a fixed min-height footer containing a `Loader2` spinner row (`role="status"`, `aria-label="Loading more tickets"`, static class strings, `text-muted-foreground`) while `isLoadingMore` (FR-003, FR-013)
- [x] T009 ✅ DONE [US1] In `components/board/stage-column.tsx` add an effect creating `new IntersectionObserver(cb, { root: scrollViewportRef.current, rootMargin: '0px 0px 100% 0px' })` observing the sentinel; on intersect call `onLoadMore()` when `!isLoadingMore && !loadMoreError`; disconnect on cleanup; do not create when `onLoadMore` is undefined; deps include `tickets.length`, `isLoadingMore`, `loadMoreError`, `onLoadMore` so it re-observes after each batch (FR-002, FR-006, FR-010, FR-011)

**Checkpoint**: US1 works end to end with existing wiring in `board-grid.tsx`/`board.tsx`.

## Phase 4: User Story 2 - Reliable under fast scrolling and failures (P1)

**Goal**: No concurrent requests, no duplicates, error + Retry with no automatic loop.
**Independent Test**: Hook test with mocked `fetch` for concurrency/dedupe/error; component test for error row and Retry.

### Tests for User Story 2

- [x] T010 ✅ DONE [P] [US2] Create `tests/unit/hooks/use-load-more-ship-tickets.test.tsx` (new file and dir: no existing `useTickets` hook tests) using a test QueryClient (`tests/helpers/test-query-client.ts`) and mocked `fetch`; cover: second `loadMore` while pending makes only one request (FR-004), appended tickets deduped by id when pages overlap (FR-005), `isError` true on failed fetch and `reset()` clears it (FR-007), cache preserved on failure
- [x] T011 ✅ DONE [P] [US2] Extend `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` with: `onLoadMore` not called while `isLoadingMore`; with `loadMoreError` render `role="alert"` "Couldn't load more tickets" + Retry button, no sentinel, and no automatic `onLoadMore` call; `userEvent` click on Retry calls `onLoadMore` once (FR-007)

### Implementation for User Story 2

- [x] T012 ✅ DONE [US2] In `components/board/stage-column.tsx` add the `loadMoreError?: boolean` prop and render, in the footer, a `role="alert"` row with text "Couldn't load more tickets" (`text-destructive`) and a shadcn `Button` "Retry" (variant outline, size sm) calling `onLoadMore`; keep footer min-height reserved to avoid layout shift
- [x] T013 ✅ DONE [US2] In `components/board/board.tsx` read `isError` and `reset` from `useLoadMoreShipTickets`; make `handleLoadMoreShip` call `reset()` then `loadMore(shipTicketCount)`; keep the `hasMoreShipTickets = shipTicketCount < shipTotal` gate; pass `loadMoreShipError` down
- [x] T014 ✅ DONE [US2] In `components/board/board-grid.tsx` add `loadMoreShipError?: boolean` to props and pass it as `loadMoreError` to the SHIP `StageColumn` alongside `onLoadMoreShip`/`isLoadingMoreShip`/`shipTotal`

**Checkpoint**: Failure shows Retry; no request loops; no duplicates.

## Phase 5: User Story 3 - Large screens and board refresh (P2)

**Goal**: Tall screens auto-fill; refresh keeps loaded SHIP tickets; DnD unaffected.
**Independent Test**: API/hook tests for `shipLimit` and refetch preservation; component test for re-observe after batch.

### Tests for User Story 3

- [x] T015 ✅ DONE [P] [US3] Extend `tests/integration/tickets/ship-pagination.test.ts` with `shipLimit` cases: default returns ≤50 SHIP, `shipLimit=N` returns up to N (seed >50 `[e2e]` SHIP tickets if not already seeded), `0` and `501` return 400, `_shipTotal` accurate
- [x] T016 ✅ DONE [P] [US3] Extend `tests/unit/hooks/use-load-more-ship-tickets.test.tsx` with a case verifying a tickets refetch after loading >50 SHIP requests `shipLimit=<cached count>` and keeps the loaded tickets (FR-008)
- [x] T017 ✅ DONE [P] [US3] Extend `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` to verify the observer is re-created after `tickets.length` changes and that `onLoadMore` fires again when the new observer reports intersecting (FR-010)

### Implementation for User Story 3

- [x] T018 ✅ DONE [US3] Verify in `components/board/stage-column.tsx` that the sentinel sits outside `TicketCard`/droppable elements and tickets use stable `key={ticket.id}`; adjust if not (FR-009, FR-013). No other code expected since T004/T009 already implement refresh preservation and re-observation

## Phase 6: User Story 4 - Mobile touch scrolling (P1)

**Goal**: Auto-loading works with touch scrolling in the column's own scroller, floating buttons, and horizontal swipe.
**Independent Test**: Mobile viewport browser test.

### Tests for User Story 4

- [x] T019 ✅ DONE [US4] Extend `tests/e2e/board/responsive.spec.ts` with an optional mobile-viewport case (use `[e2e]` prefixed data): scroll the SHIP column viewport to the bottom, assert more SHIP tickets render and no "Load more" button exists; assert horizontal column navigation still works. Real iOS Safari/Chrome Android validation remains manual

### Implementation for User Story 4

- [x] T020 ✅ DONE [US4] Confirm in `components/board/stage-column.tsx` that the observer `root` is the Radix viewport (`scrollViewportRef`) and the floating up/down buttons scroll that same viewport, so no code change is needed for FR-011/FR-012; fix only if the root differs

## Phase 7: Polish & Cross-Cutting

- [x] T021 ✅ DONE Confirm the other "Load more" UIs (activity feed, drawer history, comparisons; locate with `grep -rn "Load more" components app`) are untouched (FR-014) via `git diff --stat`
- [x] T022 ✅ DONE Run `bun run type-check` and `bun run lint`; fix all errors, including pre-existing ones
- [x] T023 ✅ DONE Run `bun run test:unit tests/unit/components/board/stage-column-infinite-scroll.test.tsx`, `bun run test:unit tests/unit/hooks/use-load-more-ship-tickets.test.tsx`, `bun run test:unit tests/unit/components/board/stage-column-selection.test.tsx`, and `bun run test:integration tests/integration/tickets/ship-pagination.test.ts`; fix failures

## Dependencies

- Phase 1 → Phase 2 → stories. T002–T004 block all stories.
- US1 (T005–T009) is the MVP. US2's T012 depends on T007–T009 (same file); T013/T014 depend on T003.
- US3 tests depend on T002/T004/T009; US4 depends on US1.
- Same-file tasks are sequential: `stage-column.tsx` (T007→T008→T009→T012→T018→T020), `useTickets.ts` (T003→T004), `ship-pagination.test.ts` (T006→T015), `stage-column-infinite-scroll.test.tsx` (T005→T011→T017), hook test (T010→T016).

## Parallel Examples

- After Phase 2: T005 and T006 in parallel (different files).
- US2: T010 and T011 in parallel; T013 and T014 in parallel with each other.
- US3: T015, T016, T017 in parallel (different files).

## Implementation Strategy

- **MVP**: Phase 1–3 (US1) delivers auto-loading with spinner and no button.
- **Incremental**: add US2 (reliability/error) → US3 (refresh/tall screens verification) → US4 (mobile e2e) → polish.
