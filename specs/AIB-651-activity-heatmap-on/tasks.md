# Tasks: Activity Heatmap on Projects Page

**Input**: Design documents from `/specs/AIB-651-activity-heatmap-on/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/heatmap-api.md

**Tests**: Included by default (constitution).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and query key registration shared across all user stories.

- [ ] T001 [P] Create heatmap TypeScript interfaces (`HeatmapDay`, `HeatmapData`, `HeatmapFilters`, `HeatmapCell`) in `lib/heatmap/types.ts` — reuse `AgentOption` from `lib/analytics/types`
- [ ] T002 [P] Register heatmap query keys in `app/lib/query-keys.ts` — add `heatmap: { data: (year, agent) => [...] }` following existing analytics pattern

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data layer and utility functions that MUST be complete before ANY user story can be implemented.

**Warning**: No user story work can begin until this phase is complete.

### Tests for Foundational Phase
**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**
**All test files are NEW — no existing heatmap test coverage exists.**

- [ ] T003 [P] Create unit tests for heatmap utils in `tests/unit/lib/heatmap-utils.test.ts` — test `buildHeatmapGrid` (7x53 matrix, chipped corners, Sunday alignment), `computeIntensityLevels` (quartile bucketing, edge cases: 1 day, all same count, sparse data), `getPeriodBounds` ("last-12-months" Sunday start, calendar year bounds), `getMonthLabels` (correct positions), `getDayLabels`
- [ ] T004 [P] Create integration tests for heatmap API route in `tests/integration/heatmap/heatmap-route.test.ts` — follow pattern from `tests/integration/analytics/analytics-route.test.ts`; test: 401 for unauthenticated, correct daily job counts for seeded data, agent filter with effective agent resolution, calendar year filter, cost aggregation (null when no costs, correct sum with partial), shipped tickets (only COMPLETED ship jobs, dedup same-day), available years from actual data, invalid filter values return 400

### Implementation for Foundational Phase

- [ ] T005 [P] Create heatmap query functions in `lib/heatmap/queries.ts` — implement `getHeatmapData(userId, filters)`: query COMPLETED jobs across all user projects, group by date, sum costUsd (null-safe), collect shipped ticketKeys (COMPLETED `ship` jobs only, deduped), compute availableAgents (reuse `buildEffectiveAgentWhere()` from `lib/analytics/queries.ts`), compute availableYears from distinct years in data
- [ ] T006 [P] Create heatmap utility functions in `lib/heatmap/utils.ts` — implement `buildHeatmapGrid(days, periodStart, periodEnd)` (7x53 cell matrix with chipped corners), `computeIntensityLevels(cells)` (quartile-based 0-4 bucketing), `getPeriodBounds(year)` (returns start/end dates; "last-12-months" = today - 364 days Sunday-aligned), `getMonthLabels(periodStart)` (month label positions), `getDayLabels()` (Mon, Wed, Fri abbreviations)
- [ ] T007 Create heatmap API route in `app/api/heatmap/route.ts` — follow pattern from `app/api/projects/[projectId]/analytics/route.ts`; Zod schema for `year` (enum "last-12-months" + dynamic years) and `agent` (AGENT_FILTER_VALUES); auth via `requireAuth()` (user-scoped); error handling: ZodError→400, auth→401, fallback→500; return `HeatmapData` response per `contracts/heatmap-api.md`

**Checkpoint**: Data layer ready — heatmap API returns correct data, utils compute grids and intensity levels.

---

## Phase 3: User Story 1 + 6 — View Activity Heatmap + Page Layout (Priority: P1) MVP

**Goal**: User sees a full-width heatmap below project cards with violet intensity grid, month/day labels, summary counter, and legend. Page scrolls naturally.

**Independent Test**: Navigate to /projects as a user with job data. Verify heatmap grid renders with correct day/week alignment, violet cells, month labels, day labels, summary counter "X jobs · Y tickets shipped", and legend with 5 intensity levels. Page scrolls naturally past project cards.

### Tests for User Story 1+6
**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**
**All test files are NEW — no existing heatmap component test coverage exists.**

- [ ] T008 [P] [US1] Create component tests in `tests/unit/components/heatmap/activity-heatmap.test.tsx` — follow pattern from `tests/unit/components/analytics-dashboard.test.tsx`; test: renders grid with correct cell count for known period, shows summary counter with correct totals, renders legend with 5 intensity levels, empty state message when zero activity ("No activity to show yet — your AI work will appear here"), filters and legend remain visible during empty state, renders immediately with initialData (no loading flash)

### Implementation for User Story 1+6

- [ ] T009 [P] [US1] Create heatmap grid component in `components/heatmap/heatmap-grid.tsx` — CSS Grid with 7 rows x N columns, ~14px cells with 2px gap, violet gradient colors using aurora theme tokens (`--ctp-mauve`, `--primary-violet`), 5 intensity levels (`bg-muted` for 0, 4 violet opacity steps), chipped corners for cells outside period bounds, month labels along top (FR-005), day-of-week labels on left (FR-005)
- [ ] T010 [P] [US1] Create legend component in `components/heatmap/heatmap-legend.tsx` — "Less" label → 5 colored squares → "More" label (FR-006), uses same violet gradient as grid cells
- [ ] T011 [US1] Create main heatmap container in `components/heatmap/activity-heatmap.tsx` (client component) — TanStack Query `useQuery` with `queryKeys.heatmap.data(year, agent)`, 15s `refetchInterval`, `initialData` prop from server component (FR-011); header with summary line "X jobs · Y tickets shipped in the last year" (FR-007); empty state inline when zero activity after filters (FR-021); delegates to grid, legend, and future filter/tooltip sub-components
- [ ] T012 [US1] Modify `components/projects/projects-container.tsx` — remove `overflow-y-auto max-h-[calc(100vh-200px)]` scroll constraint so page scrolls naturally (FR-022)
- [ ] T013 [US1] Modify `app/projects/page.tsx` — add `getHeatmapData()` call parallel with `getProjects()`, pass heatmap initial data as prop to `ActivityHeatmap` component, render `ActivityHeatmap` below `ProjectsContainer`

**Checkpoint**: Core heatmap visible on /projects with grid, legend, summary. Page scrolls naturally. MVP complete.

---

## Phase 4: User Story 2 — Hover/Tap Tooltip (Priority: P2)

**Goal**: Hovering (desktop) or tapping (mobile) a heatmap cell reveals a tooltip with formatted date, job count, cost (when available), and shipped tickets.

**Independent Test**: Hover over a cell with job data and verify tooltip shows correct date, job count, cost, and shipped tickets. Hover over a cell with no recorded cost and verify cost line is omitted.

### Tests for User Story 2
**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [ ] T014 [P] [US2] Extend component tests in `tests/unit/components/heatmap/activity-heatmap.test.tsx` — add tooltip test cases: tooltip shows correct content on cell hover (date, job count, cost, shipped tickets), tooltip omits cost when no jobs have recorded cost (no "$0" or "$NaN"), tooltip shows cost as sum of only non-null costs, mobile tap shows tooltip and outside tap dismisses

### Implementation for User Story 2

- [ ] T015 [US2] Create tooltip component in `components/heatmap/heatmap-tooltip.tsx` — desktop: show on mouseenter/mouseleave; mobile: show on tap, dismiss on outside tap (FR-014); content: formatted date, job count, cost (only if non-null per FR-013), shipped ticket list (FR-012); positioning: above cell by default, below near top edge; absolute positioning relative to grid container
- [ ] T016 [US2] Integrate tooltip into `components/heatmap/heatmap-grid.tsx` — wire cell hover/tap events to tooltip component, pass cell data (date, jobCount, costUsd, shippedTickets)

**Checkpoint**: Tooltip displays correct data on hover/tap for all cell states.

---

## Phase 5: User Story 3 — Year Selector (Priority: P2)

**Goal**: User can select a calendar year or "Last 12 months" from a dropdown. Grid, summary, and tooltips update to reflect the selected period.

**Independent Test**: Select a past calendar year and verify grid boundaries match Jan 1–Dec 31 with correct chipped corners. Verify year selector is hidden when user created this year.

### Tests for User Story 3
**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [ ] T017 [P] [US3] Extend component tests in `tests/unit/components/heatmap/activity-heatmap.test.tsx` — add year selector test cases: year selector hidden when user created this year (only "Last 12 months" available per FR-010), year selector shows available years from data, filter change updates displayed data and URL params (FR-018)

### Implementation for User Story 3

- [ ] T018 [US3] Create filter controls component in `components/heatmap/heatmap-filters.tsx` — year selector using shadcn/ui `Select` with "Last 12 months" default + available years (FR-009); hidden when only "Last 12 months" available (FR-010); filter changes update URL params via `router.replace()` and trigger re-fetch
- [ ] T019 [US3] Integrate year filter into `components/heatmap/activity-heatmap.tsx` — add `year` state from URL search params, wire to `HeatmapFilters` component, include in query key for cache separation, sync to URL on change (FR-018)

**Checkpoint**: Year selection works end-to-end with URL persistence.

---

## Phase 6: User Story 4 — Agent Filter (Priority: P3)

**Goal**: User can filter heatmap by AI agent. Filter dynamically built from user's actual agent data with effective agent resolution. Hidden when 0 or 1 agents.

**Independent Test**: As a user with jobs across two agents, verify filter shows "All" plus both agents. Select one agent and verify heatmap updates with same grid boundaries but different cell intensities.

### Tests for User Story 4
**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [ ] T020 [P] [US4] Extend component tests in `tests/unit/components/heatmap/activity-heatmap.test.tsx` — add agent filter test cases: agent filter hidden when ≤1 agent (FR-016), agent filter shows available agents from data, agent filter selection updates heatmap and URL params, grid boundaries unchanged when agent filter active (FR-017)

### Implementation for User Story 4

- [ ] T021 [US4] Extend `components/heatmap/heatmap-filters.tsx` — add agent filter using shadcn/ui `Select` with "All" default + available agents (FR-015); hidden when 0 or 1 agents (FR-016); follow effective agent resolution pattern from `lib/analytics/queries.ts`
- [ ] T022 [US4] Integrate agent filter into `components/heatmap/activity-heatmap.tsx` — add `agent` state from URL search params, wire to `HeatmapFilters` component, include in query key, sync to URL on change (FR-018)

**Checkpoint**: Agent filtering works with effective agent resolution and URL persistence.

---

## Phase 7: User Story 5 — Mobile Horizontal Scroll (Priority: P3)

**Goal**: Mobile users can scroll the heatmap grid horizontally with pinned day-of-week labels and tappable cell sizes.

**Independent Test**: On a 375px viewport, verify grid scrolls horizontally, day labels stay fixed on left edge, and cells maintain minimum tappable size.

### Tests for User Story 5
**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [ ] T023 [P] [US5] Extend component tests in `tests/unit/components/heatmap/activity-heatmap.test.tsx` — add mobile responsiveness test cases: grid container has horizontal scroll on narrow viewport, day-of-week labels have sticky positioning

### Implementation for User Story 5

- [ ] T024 [US5] Update `components/heatmap/heatmap-grid.tsx` — add horizontal scroll container for mobile, make day-of-week labels sticky on left edge (FR-019), ensure cells maintain minimum tappable size with adequate spacing (FR-020)

**Checkpoint**: Heatmap usable on mobile with horizontal scroll and pinned labels.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Refinements that affect multiple user stories.

- [ ] T025 [P] Verify all heatmap components use semantic Tailwind tokens (`text-foreground`, `bg-card`, `text-muted-foreground`) and aurora theme utilities — no hardcoded hex/rgb colors
- [ ] T026 [P] Verify tooltip does not clip outside viewport at grid edges (all four corners)
- [ ] T027 Run full test suite (`bun run test:unit` and `bun run test:integration`) and fix any failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (types) — BLOCKS all user stories
- **US1+US6 (Phase 3)**: Depends on Phase 2 — core visual + layout
- **US2 (Phase 4)**: Depends on Phase 3 (grid component must exist for tooltip wiring)
- **US3 (Phase 5)**: Depends on Phase 3 (container must exist for filter state)
- **US4 (Phase 6)**: Depends on Phase 5 (filter component must exist to extend)
- **US5 (Phase 7)**: Depends on Phase 3 (grid component must exist for scroll behavior)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1+US6 (P1)**: Can start after Foundational (Phase 2) — no other story dependencies
- **US2 (P2)**: Requires US1 grid component — extends grid with hover/tap events
- **US3 (P2)**: Requires US1 container — adds filter state and controls
- **US4 (P3)**: Requires US3 filter component — extends with agent filter
- **US5 (P3)**: Requires US1 grid component — adds mobile scroll behavior. Can run in parallel with US2, US3, US4

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/types before services/queries
- Services before API routes
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel
- T003 and T004 (Foundational tests) can run in parallel
- T005 and T006 (Foundational implementation) can run in parallel
- T009 and T010 (US1 grid + legend) can run in parallel
- US3 (Year Selector) and US5 (Mobile Scroll) can run in parallel after US1
- T025 and T026 (Polish) can run in parallel

---

## Parallel Example: Foundational Phase

```
# Launch tests in parallel:
Task T003: "Create unit tests for heatmap utils in tests/unit/lib/heatmap-utils.test.ts"
Task T004: "Create integration tests for heatmap API in tests/integration/heatmap/heatmap-route.test.ts"

# Launch implementations in parallel:
Task T005: "Create heatmap query functions in lib/heatmap/queries.ts"
Task T006: "Create heatmap utility functions in lib/heatmap/utils.ts"
```

## Parallel Example: User Story 1

```
# Launch parallel components:
Task T009: "Create heatmap grid component in components/heatmap/heatmap-grid.tsx"
Task T010: "Create legend component in components/heatmap/heatmap-legend.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 6 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T007) — CRITICAL, blocks all stories
3. Complete Phase 3: US1+US6 (T008-T013)
4. **STOP and VALIDATE**: Heatmap visible on /projects with grid, legend, summary, natural page scroll
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Data layer ready
2. US1+US6 → Core heatmap visible (MVP!)
3. US2 → Tooltips add data exploration
4. US3 → Year selection adds historical view
5. US4 → Agent filter adds power-user filtering
6. US5 → Mobile polish
7. Each story adds value without breaking previous stories

### Parallel Execution Strategy

1. Complete Setup + Foundational sequentially
2. Once US1 is done:
   - Parallel track A: US2 (Tooltip)
   - Parallel track B: US3 (Year Selector) → US4 (Agent Filter)
   - Parallel track C: US5 (Mobile Scroll)
3. Polish after all tracks complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No new database models (FR-023) — uses existing Job, Ticket, Project, User tables
- All new files — no existing heatmap directories or test files exist
- Reuse patterns from `lib/analytics/` and `components/analytics/` extensively
- Follow aurora theme tokens for violet gradient — never hardcode hex colors
