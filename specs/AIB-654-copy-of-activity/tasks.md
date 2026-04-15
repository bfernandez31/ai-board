# Tasks: Activity Heatmap on Projects Page

**Input**: Design documents from `/specs/AIB-654-copy-of-activity/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/heatmap-api.md

**Tests**: Included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Types, query keys, and CSS utilities shared across all user stories

- [ ] T001 [P] Create heatmap type definitions (`HeatmapDay`, `ShippedTicketInfo`, `HeatmapData`, `HeatmapFilters`) in `lib/heatmap/types.ts`
- [ ] T002 [P] Add `heatmap: { data: (year, agent) => ['heatmap', year, agent] as const }` to `app/lib/query-keys.ts`
- [ ] T003 [P] Add heatmap intensity CSS utility classes (`.heatmap-level-0` through `.heatmap-level-4`) under `@layer utilities` in `app/globals.css`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data layer and server integration that MUST be complete before ANY user story UI can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Implement `getHeatmapData(userId, filters)` in `lib/heatmap/queries.ts`: fetch user's project IDs (owner OR member), query jobs grouped by `DATE(startedAt)`, aggregate `jobCount`/`costUsd` per day, query shipped tickets (`command='ship'`, `status='COMPLETED'`, dedupe by ticket ID), build agent options via `buildEffectiveAgentWhere` pattern from `lib/analytics/queries.ts`, fetch `user.createdAt` for year range
- [ ] T005 Create `GET /api/heatmap` route in `app/api/heatmap/route.ts`: auth check (401), Zod validation for `year`/`agent` query params (400), call `getHeatmapData`, return JSON per contract in `contracts/heatmap-api.md`
- [ ] T006 Create `useHeatmap(initialData, filters)` hook in `app/lib/hooks/queries/use-heatmap.ts`: TanStack Query with `queryKeys.heatmap.data(year, agent)`, `refetchInterval: 60_000`, `staleTime: 30_000`, `initialData` prop — follow pattern from `hooks/use-usage.ts`
- [ ] T007 Extend `app/projects/page.tsx`: parse `year`/`agent` from `searchParams`, call `getHeatmapData(userId, filters)` server-side alongside existing `getProjects()`, pass `heatmapData` as `initialData` prop to new `<ActivityHeatmap>` component rendered below `<ProjectsContainer>`
- [ ] T008 Remove `overflow-y-auto max-h-[calc(100vh-200px)]` scroll constraint from `components/projects/projects-container.tsx` to allow natural page scrolling (FR-026)

**Checkpoint**: Foundation ready — data layer returns correct heatmap data, API route is functional, server-side integration passes data to client

---

## Phase 3: User Story 1 — View Activity Heatmap (Priority: P1) 🎯 MVP

**Goal**: GitHub-style heatmap grid renders below project cards showing job activity intensity across all user projects for the selected period

**Independent Test**: Navigate to `/projects` as a user with job history → heatmap grid renders with correct date boundaries, 7 rows (Sun–Sat), month labels, day-of-week labels, violet intensity coloring, legend, and empty state when no jobs exist

### Tests for User Story 1

- [ ] T009 [P] [US1] Create unit tests for heatmap query helpers in `tests/unit/lib/heatmap-queries.test.ts`: date range calculation (rolling vs calendar year), cost aggregation (null handling, partial nulls), shipped ticket deduplication (first completed ship job per ticket), intensity level mapping (quartile calculation)
- [ ] T010 [P] [US1] Create RTL component tests in `tests/unit/components/heatmap/activity-heatmap.test.tsx`: grid renders correct cell count for date range, chipped corners for partial weeks, month labels in correct positions, empty state message when `totalJobs === 0`, legend renders with graduated color blocks. Mock `useSearchParams`, `useRouter`, `useHeatmap` hook
- [ ] T011 [P] [US1] Create integration tests in `tests/integration/heatmap/heatmap-route.test.ts`: 401 when unauthenticated, valid data structure with correct field types, empty `days` for user with no jobs, filters by calendar year, returns correct `userCreatedYear`. Use `x-test-user-id` auth pattern from `tests/integration/projects/projects-with-health.test.ts`

### Implementation for User Story 1

- [ ] T012 [P] [US1] Create heatmap grid component in `components/heatmap/heatmap-grid.tsx`: 7 rows (Sun–Sat), week columns for period, `<div>` cells with `heatmap-level-*` classes for intensity (quartile mapping), month labels above columns, day-of-week labels (Mon, Wed, Fri) on left, chipped corners for partial weeks, cell size 12px with 3px gap
- [ ] T013 [US1] Create main `ActivityHeatmap` client component in `components/heatmap/activity-heatmap.tsx`: `"use client"`, wire `useHeatmap` hook with `initialData`, render `<HeatmapGrid>` with day data, intensity legend ("Less" → graduated blocks → "More" at bottom-right), empty state message when `totalJobs === 0` ("No activity to show yet — your AI work will appear here"), wrap grid in `<TooltipProvider>`, `aurora-bg-section` container styling

**Checkpoint**: Heatmap grid visible on `/projects` with correct data, intensity colors, legend, and empty state — User Story 1 is independently testable

---

## Phase 4: User Story 2 — Header Summary and Year Selector (Priority: P1)

**Goal**: Summary counter ("X jobs · Y tickets shipped {periodLabel}") and year selector dropdown above the heatmap grid

**Independent Test**: Verify counter values match job/shipped ticket counts for selected period; switch years and confirm grid + counter update; year selector hidden when user created in current year

### Tests for User Story 2

- [ ] T014 [P] [US2] Extend component tests in `tests/unit/components/heatmap/activity-heatmap.test.tsx`: header counter displays correct "X jobs · Y tickets shipped" text, year selector shows options from `userCreatedYear` to current year plus "Last 12 months", year selector hidden when `userCreatedYear` equals current year, selecting year updates URL params
- [ ] T015 [P] [US2] Extend integration tests in `tests/integration/heatmap/heatmap-route.test.ts`: validate `year` param returns 400 for invalid values, calendar year filtering returns correct date-bounded data, `periodLabel` returns `"in the last year"` for rolling and `"in 2025"` for calendar year

### Implementation for User Story 2

- [ ] T016 [US2] Add header section to `components/heatmap/activity-heatmap.tsx`: counter displaying `"{totalJobs} jobs · {totalShipped} tickets shipped {periodLabel}"`, year selector `<Select>` dropdown with "Last 12 months" (value: `rolling`) + calendar years from `userCreatedYear` to current year, hide year selector when user created in current year (FR-012), read/write `year` URL query param via `useSearchParams` + `useRouter` (FR-019)

**Checkpoint**: Header counter and year selector functional — switching years updates grid and counter; URL reflects filter state

---

## Phase 5: User Story 3 — Tooltip on Hover/Tap (Priority: P2)

**Goal**: Hovering (desktop) or tapping (mobile) a heatmap cell shows a tooltip with shipped tickets, job count, cost (if available), and formatted date

**Independent Test**: Hover over cells with known data → tooltip shows correct shipped ticket info, job count, cost (omitted when all null), and formatted date ("Tuesday, March 15, 2026")

### Tests for User Story 3

- [ ] T017 [P] [US3] Extend component tests in `tests/unit/components/heatmap/activity-heatmap.test.tsx`: tooltip shows shipped ticket key + title, tooltip shows job count + cost, tooltip omits cost line when all costs null, tooltip shows partial cost when some jobs have cost, date formatted correctly in tooltip

### Implementation for User Story 3

- [ ] T018 [P] [US3] Create tooltip content component in `components/heatmap/heatmap-tooltip.tsx`: display shipped tickets (ticketKey + title), job count + formatted cost (`$X.XX`, only when at least one job has cost), formatted date (e.g., "Tuesday, March 15, 2026"), uses shadcn/ui `<Tooltip>` wrapping each grid cell
- [ ] T019 [US3] Integrate tooltip into `components/heatmap/heatmap-grid.tsx`: wrap each cell `<div>` with `<Tooltip>` + `<HeatmapTooltip>` content, pass day data to tooltip component

**Checkpoint**: Tooltips display correct data on hover — cost handling and shipped ticket display verified

---

## Phase 6: User Story 4 — Agent Filter (Priority: P2)

**Goal**: Agent filter dropdown appears when user has jobs from 2+ distinct effective agents, allowing filtered heatmap view per agent

**Independent Test**: Create jobs under tickets with different agents (including inherited defaults) → filter options appear, filtering isolates activity correctly, grid boundaries unchanged

### Tests for User Story 4

- [ ] T020 [P] [US4] Extend component tests in `tests/unit/components/heatmap/activity-heatmap.test.tsx`: agent filter visible when `agents.length > 2` (more than just "all"), agent filter hidden when 0-1 distinct agents, selecting agent updates URL params
- [ ] T021 [P] [US4] Extend integration tests in `tests/integration/heatmap/heatmap-route.test.ts`: filters by agent correctly (including effective agent resolution via project `defaultAgent`), validates `agent` param returns 400 for invalid values, `agents` array includes only agents with jobs

### Implementation for User Story 4

- [ ] T022 [US4] Add agent filter to `components/heatmap/activity-heatmap.tsx`: `<Select>` dropdown with agent options from `data.agents`, shown only when `agents.length > 2` (i.e., "all" + 2+ agents) per FR-015, read/write `agent` URL query param via `useSearchParams` + `useRouter` (FR-019), grid boundaries unchanged when filtering (FR-018)

**Checkpoint**: Agent filter functional — filtering shows correct per-agent data, hidden when single agent, URL reflects filter state

---

## Phase 7: User Story 5 — Mobile Experience (Priority: P3)

**Goal**: Heatmap scrolls horizontally on mobile with sticky day-of-week labels; cells never shrink below tappable size

**Independent Test**: View `/projects` on mobile viewport (< 768px) → grid scrolls horizontally, day labels pinned on left, cells maintain minimum tappable size, tap-to-tooltip works

### Tests for User Story 5

- [ ] T023 [US5] Extend component tests in `tests/unit/components/heatmap/activity-heatmap.test.tsx`: verify grid container has `overflow-x-auto` class, day-of-week labels have sticky positioning classes

### Implementation for User Story 5

- [ ] T024 [US5] Add mobile responsive styles to `components/heatmap/heatmap-grid.tsx`: outer container `overflow-x-auto`, day-of-week labels `sticky left-0 z-10` with background, ensure minimum cell size for touch targets, test tap-to-show tooltip behavior (Radix Tooltip handles this natively)

**Checkpoint**: Mobile experience verified — horizontal scroll, sticky labels, tappable cells

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility and final integration quality

- [ ] T025 [P] Add ARIA attributes to heatmap components: grid container `role="grid"` + `aria-label="Activity heatmap"`, each cell `role="gridcell"` + `aria-label="{jobCount} jobs on {date}"`, legend `aria-hidden="true"` — in `components/heatmap/heatmap-grid.tsx` and `components/heatmap/activity-heatmap.tsx`
- [ ] T026 Verify cost aggregation edge cases in `tests/integration/heatmap/heatmap-route.test.ts`: all costs null → `costUsd: null` in response, partial null → sum of non-null only, shipped ticket deduplication (multiple completed ship jobs → counted once)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001 types needed for T004 queries) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 completion
- **US2 (Phase 4)**: Depends on Phase 3 (extends activity-heatmap.tsx created in T013)
- **US3 (Phase 5)**: Depends on Phase 3 (integrates into heatmap-grid.tsx created in T012)
- **US4 (Phase 6)**: Depends on Phase 3 (extends activity-heatmap.tsx created in T013)
- **US5 (Phase 7)**: Depends on Phase 3 (modifies heatmap-grid.tsx created in T012)
- **Polish (Phase 8)**: Depends on Phases 3–7

### User Story Dependencies

- **US1 (P1)**: Foundation → US1 — no other story dependencies — **MVP**
- **US2 (P1)**: Foundation → US1 → US2 (extends same orchestrating component)
- **US3 (P2)**: Foundation → US1 → US3 (adds tooltip to grid cells)
- **US4 (P2)**: Foundation → US1 → US4 (adds filter to orchestrating component)
- **US5 (P3)**: Foundation → US1 → US5 (adds mobile CSS to grid)

### Within Each User Story

- Tests written FIRST, verified to FAIL before implementation
- Types/models before services
- Services before endpoints/UI
- Core implementation before integration

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 all parallel (different files)
- **Phase 3 tests**: T009, T010, T011 all parallel (different test files)
- **Phase 3 impl**: T012 (grid) is parallel-ready, T013 depends on T012
- **Phase 5 + Phase 6**: US3 and US4 can run in parallel after US1 (different files: tooltip vs filter)
- **Phase 4 tests**: T014, T015 parallel (different test files)

---

## Parallel Example: User Story 1

```bash
# Launch all Phase 1 setup tasks together:
Task T001: "Create heatmap types in lib/heatmap/types.ts"
Task T002: "Add heatmap query key to app/lib/query-keys.ts"
Task T003: "Add heatmap CSS utilities to app/globals.css"

# Launch all US1 tests together (after Phase 2):
Task T009: "Unit tests for heatmap queries in tests/unit/lib/heatmap-queries.test.ts"
Task T010: "Component tests in tests/unit/components/heatmap/activity-heatmap.test.tsx"
Task T011: "Integration tests in tests/integration/heatmap/heatmap-route.test.ts"

# After US1, launch US3 + US4 in parallel:
Task T018: "Tooltip component in components/heatmap/heatmap-tooltip.tsx"  (US3)
Task T022: "Agent filter in components/heatmap/activity-heatmap.tsx"      (US4)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T008)
3. Complete Phase 3: User Story 1 (T009–T013)
4. **STOP and VALIDATE**: Heatmap grid renders on `/projects` with intensity colors, legend, and empty state
5. Deploy/demo if ready — core visualization is complete

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Grid renders with intensity → **MVP!**
3. Add US2 → Header counter + year selector → Historical exploration
4. Add US3 + US4 (parallel) → Tooltips + agent filter → Full analytical depth
5. Add US5 → Mobile responsive → Full device coverage
6. Polish → ARIA + edge case verification → Production ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No new database models — all data from existing Job, Ticket, Project, User tables (FR-027)
- CSS utility classes avoid dynamic Tailwind class construction (CLAUDE.md rule)
- 60s polling interval (not 15s) due to expensive cross-project aggregate query
- Existing test files referenced for patterns only — all heatmap tests are new files (distinct domain)
