# Tasks: Redesign Comparisons Hub as Vertical List with Inline Expand

**Input**: Design documents from `/specs/AIB-365-redesign-comparisons-hub/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-changes.md, quickstart.md

**Tests**: Included per Testing Strategy in plan.md (component tests for US1/US2, integration tests for US3/US4).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (API Response + Types)

**Purpose**: Add winnerScore to the API response and define new TypeScript interfaces needed by all user stories.

- [x] T001 Add `winnerScore: number | null` field to `ProjectComparisonSummary` interface in `lib/types/comparison.ts`
- [x] T002 Update Prisma query in `lib/comparison/project-comparison-summary.ts` to select `score` from winner participant and map it to `winnerScore` in `normalizeProjectComparisonSummary`
- [x] T003 [P] Add `ComparisonCardProps` interface to `components/comparison/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infinite query hook and ScrollArea removal that MUST be complete before user story implementation.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Add `useProjectComparisonListInfinite` hook using `useInfiniteQuery` in `hooks/use-comparisons.ts`, following the existing activity feed pattern in `hooks/queries/use-project-activity.ts`
- [x] T005 [P] Remove `ScrollArea` wrapper (`h-[68vh]`) from `ComparisonDashboard` in `components/comparison/comparison-viewer.tsx` and add `overflow-y-auto` to the `ComparisonViewer` dialog content wrapper instead

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Browse Recent Comparisons (Priority: P1) MVP

**Goal**: Display comparisons as a vertical list of compact cards showing winner info, score, and date in reverse chronological order with a single scroll context.

**Independent Test**: Load the comparisons page with existing data and verify the list renders as compact cards in reverse chronological order with no nested scroll containers.

### Tests for User Story 1

- [x] T006 [P] [US1] Write component test for ComparisonCard compact rendering (winner key, title, summary, score badge, date) in `tests/unit/components/comparison-card.test.tsx`

### Implementation for User Story 1

- [x] T007 [US1] Create `ComparisonCard` component with compact header layout (winner ticket key, title, summary snippet, score badge, formatted date) using Radix `Collapsible` in `components/comparison/comparison-card.tsx`
- [x] T008 [US1] Rewrite `ProjectComparisonsPage` to replace 2-column grid with single-column vertical list of `ComparisonCard` components, using `useProjectComparisonListInfinite` for data, in `components/comparison/project-comparisons-page.tsx`

**Checkpoint**: Comparisons display as scannable compact cards in a single-column layout with native page scroll.

---

## Phase 4: User Story 2 - Expand Comparison Detail Inline (Priority: P1)

**Goal**: Clicking a card expands the full comparison dashboard inline below it using accordion behavior (single-expand, smooth animation).

**Independent Test**: Click a comparison card and verify all 6 sub-components render at full width below it; click again to collapse; click a different card to switch.

### Tests for User Story 2

- [ ] T009 [P] [US2] Write component test for accordion expand/collapse behavior (click to expand, click to collapse, single-expand switching) in `tests/unit/components/comparison-card.test.tsx`

### Implementation for User Story 2

- [x] T010 [US2] Add CSS grid animation (`grid-template-rows: 0fr -> 1fr`) and Radix `data-[state]` attributes for smooth expand/collapse transition in `components/comparison/comparison-card.tsx`
- [x] T011 [US2] Wire `expandedId` state management and on-demand detail fetching via `useProjectComparisonDetail` in `components/comparison/project-comparisons-page.tsx`, rendering `ComparisonDashboard` inside the expanded `Collapsible` content

**Checkpoint**: Cards expand/collapse with smooth animation; only one card expanded at a time; all 6 sub-components render at full page width.

---

## Phase 5: User Story 3 - Load More Comparisons (Priority: P2)

**Goal**: Users with many comparisons can append older items via a "Load More" button without losing scroll position or expanded state.

**Independent Test**: Load a project with 25+ comparisons, click "Load More", and verify older items append without page replacement.

### Tests for User Story 3

- [ ] T012 [P] [US3] Write integration test for Load More accumulation (button visibility, page append, button disappears when all loaded, expanded card preserved) in `tests/integration/comparisons/comparisons-hub.test.ts`

### Implementation for User Story 3

- [x] T013 [US3] Add "Load More" button below the card list using `hasNextPage` and `fetchNextPage` from `useProjectComparisonListInfinite`, with `isFetchingNextPage` loading state, in `components/comparison/project-comparisons-page.tsx`

**Checkpoint**: Load More appends older comparisons; button shows loading state; disappears when all loaded; scroll position preserved.

---

## Phase 6: User Story 4 - Deep Link to Specific Comparison (Priority: P2)

**Goal**: URLs with `?comparisonId=X` auto-expand the targeted comparison on page load, fetching additional pages if needed.

**Independent Test**: Navigate to the hub with `?comparisonId=X` and verify comparison X is auto-expanded and scrolled into view.

### Tests for User Story 4

- [ ] T014 [P] [US4] Write integration test for deep link auto-expand (initial page hit, multi-page fetch, invalid ID graceful handling) in `tests/integration/comparisons/comparisons-hub.test.ts`

### Implementation for User Story 4

- [x] T015 [US4] Implement deep link auto-expand: initialize `expandedId` from `initialComparisonId` prop, add `useEffect` with ref guard to `fetchNextPage` in a loop until target comparison is found or all pages exhausted, in `components/comparison/project-comparisons-page.tsx`
- [x] T016 [US4] Add `scrollIntoView({ behavior: 'smooth' })` to scroll the deep-linked `ComparisonCard` into view after expansion, using a ref callback in `components/comparison/project-comparisons-page.tsx`

**Checkpoint**: Deep-linked comparisons auto-expand and scroll into view; invalid IDs degrade gracefully (normal list, no error).

---

## Phase 7: User Story 5 - Launch New Comparison (Priority: P2)

**Goal**: Verify the existing "Compare VERIFY tickets" launch button and pending indicator remain fully functional in the new layout.

**Independent Test**: Click the launch button, verify the sheet opens with VERIFY candidates, and confirm the pending indicator displays during generation.

### Implementation for User Story 5

- [x] T017 [US5] Verify "Compare VERIFY tickets" button and `ProjectComparisonLaunchSheet` remain accessible in the page header, and pending comparison indicator displays correctly, in `components/comparison/project-comparisons-page.tsx`

**Checkpoint**: Launch flow works identically to before the redesign; new comparisons appear at the top of the list.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, edge cases, and code quality.

- [ ] T018 Run `bun run type-check` and `bun run lint` and fix all errors
- [ ] T019 [P] Validate all quickstart.md scenarios end-to-end (7 steps)
- [ ] T020 [P] Verify edge cases: rapid card clicking (only last-clicked expanded), detail load failure (error in card section), mobile 320px layout (no horizontal scroll), duplicate Load More prevention

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on T001 completion (winnerScore type needed by hook) - BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) completion
- **US2 (Phase 4)**: Depends on US1 (Phase 3) completion (ComparisonCard and page must exist)
- **US3 (Phase 5)**: Depends on US1 (Phase 3) completion (list must exist to add Load More)
- **US4 (Phase 6)**: Depends on US2 (Phase 4) completion (expand must work for auto-expand)
- **US5 (Phase 7)**: Depends on US1 (Phase 3) completion (page rewrite must preserve launch button)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **US2 (P1)**: Depends on US1 — needs ComparisonCard and page to exist before adding expand behavior
- **US3 (P2)**: Depends on US1 — needs the card list to exist before adding Load More
- **US4 (P2)**: Depends on US2 — needs expand behavior to work before adding auto-expand
- **US5 (P2)**: Depends on US1 — needs page rewrite to verify launch button preserved

### Within Each User Story

- Tests written FIRST, verified to FAIL before implementation
- Component creation before page integration
- Core behavior before polish

### Parallel Opportunities

- T001 and T003 can run in parallel (different files)
- T004 and T005 can run in parallel (different files)
- T006 (US1 test) can run parallel with T007 (US1 component creation)
- US3 (Phase 5) and US5 (Phase 7) can run in parallel after US1 completes
- T018, T019, T020 in Polish phase can run in parallel

---

## Parallel Example: After Foundational Phase

```bash
# After Phase 2 completes, start US1:
Task T006: "Write component test for ComparisonCard in tests/unit/components/comparison-card.test.tsx"
Task T007: "Create ComparisonCard component in components/comparison/comparison-card.tsx"
# T006 and T007 can run in parallel (different files)

# After US1 completes, US3 and US5 can run in parallel:
Task T013: "[US3] Add Load More button in project-comparisons-page.tsx"
Task T017: "[US5] Verify launch button in project-comparisons-page.tsx"
# Note: US3 and US5 touch same file but different sections — sequential recommended
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (API + types)
2. Complete Phase 2: Foundational (infinite hook + ScrollArea removal)
3. Complete Phase 3: US1 — Browse as vertical card list
4. Complete Phase 4: US2 — Expand detail inline
5. **STOP and VALIDATE**: Core browsing + expanding works independently
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational -> Foundation ready
2. Add US1 (Browse) -> Test independently -> Vertical list works (MVP!)
3. Add US2 (Expand) -> Test independently -> Accordion detail works
4. Add US3 (Load More) -> Test independently -> Pagination works
5. Add US4 (Deep Link) -> Test independently -> Sharing works
6. Add US5 (Launch) -> Verify unchanged -> Full feature complete
7. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No new database migrations — purely UI + one API field addition
- All 6 sub-components (HeroCard, ParticipantGrid, StatCards, UnifiedMetrics, DecisionPoints, ComplianceHeatmap) reused without modification (FR-007)
- Single scroll context enforced (FR-009) — no ScrollArea in page layout
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
