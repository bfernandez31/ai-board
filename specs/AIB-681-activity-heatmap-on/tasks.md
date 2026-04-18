# Tasks: Activity Heatmap on Projects Page (AIB-681)

**Input**: Design documents from `/specs/AIB-681-activity-heatmap-on/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/heatmap-api.md

**Tests**: Included by default (constitution).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in every task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and shared utilities that all stories depend on.

- [x] T001 Define heatmap TypeScript interfaces (`HeatmapCell`, `HeatmapData`, `HeatmapFilters`, `HeatmapPeriod`, `HeatmapAgentOption`) in `lib/heatmap/types.ts`
- [x] T002 [P] Export `buildEffectiveAgentWhere()` from `lib/analytics/queries.ts` (currently private; needed by heatmap queries)
- [x] T003 [P] Add `heatmap` query key namespace to `app/lib/query-keys.ts` with `all` and `data(year, agent)` keys

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data layer and API endpoint — MUST complete before any UI story.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Implement `getHeatmapData(userId, filters)` in `lib/heatmap/queries.ts` — aggregate jobs by UTC date across user's projects (owned + member), count shipped tickets (`command='ship'`, `status='COMPLETED'`, keyed by `completedAt`), sum `costUsd` (null-safe), compute percentile-based intensity thresholds, resolve available agents and years. Import `buildEffectiveAgentWhere()` from `lib/analytics/queries.ts`. Use `Promise.all` for parallel sub-queries.
- [x] T005 Create `GET /api/heatmap` route in `app/api/heatmap/route.ts` — Zod-validated `year` and `agent` query params, session auth (user-scoped, not project-scoped), `Cache-Control: no-store`, structured error responses (400/401/500). Follow pattern from `app/api/projects/[projectId]/analytics/route.ts`.
- [x] T006 Create `useHeatmap(filters, initialData)` TanStack Query hook in `app/lib/hooks/queries/use-heatmap.ts` — query key from `queryKeys.heatmap.data(year, agent)`, `initialData` for SSR, `staleTime: 60_000`, `refetchInterval: 60_000`, `refetchOnWindowFocus: true`. Follow pattern from `app/lib/hooks/queries/use-project-activity.ts`.

**Checkpoint**: Data layer ready — API returns correct heatmap data for any filter combination.

---

## Phase 3: User Story 1 — View Activity Heatmap (Priority: P1) MVP

**Goal**: Render a GitHub-style heatmap grid below project cards showing AI job activity across all user projects over the past year, with summary counter and intensity legend.

**Independent Test**: Navigate to `/projects` as a user with job history. The heatmap grid renders below project cards with correct cell intensities based on job counts. The summary counter matches actual data.

### Tests for User Story 1

- [ ] T007 [P] [US1] Create unit tests for grid date math in `tests/unit/heatmap-grid.test.ts` — test grid dimensions for rolling 12-month window, specific calendar years (leap/non-leap), chipped corners for periods starting/ending mid-week, intensity level assignment from thresholds, UTC date normalization, available years calculation
- [ ] T008 [P] [US1] Create component tests in `tests/unit/components/activity-heatmap.test.tsx` — test heatmap renders correct number of cells, month labels and day-of-week labels display, intensity legend renders 5 color swatches with "Less"/"More" labels, summary counter displays correct totals, empty state message shown when no cells
- [ ] T009 [P] [US1] Create integration tests for `GET /api/heatmap` in `tests/integration/heatmap/heatmap-route.test.ts` — test returns aggregated data for authenticated user, returns correct `summary.totalJobs` and `summary.totalShipped`, returns percentile-based `thresholds`, returns 401 for unauthenticated, returns 400 for invalid params, returns empty cells for period with no activity, excludes projects where user is neither owner nor member

### Implementation for User Story 1

- [ ] T010 [P] [US1] Create heatmap grid component in `components/heatmap/heatmap-grid.tsx` — CSS Grid with 7 rows (Sun–Sat) x N weeks, `grid-auto-flow: column`, month labels along top, day-of-week labels (Mon/Wed/Fri) on left, cell intensity colors using 5-level violet scale (`bg-muted/30` for empty, violet gradient levels 1–4 via CSS custom properties `--primary-violet`), chipped corners (omit cells before first day / after last day of period)
- [ ] T011 [P] [US1] Create intensity legend component in `components/heatmap/heatmap-legend.tsx` — flex row with 5 color swatches matching grid cell colors, "Less" and "More" labels, positioned bottom-right
- [ ] T012 [P] [US1] Create heatmap header component in `components/heatmap/heatmap-header.tsx` — summary counter "X jobs · Y tickets shipped in the last year" (or period label). Year selector and agent filter will be added in US3/US4.
- [ ] T013 [US1] Create main orchestrator component in `components/heatmap/activity-heatmap.tsx` — `"use client"`, reads filters from `useSearchParams()`, manages filter state with `useState`, calls `useHeatmap(filters, initialData)`, renders `HeatmapHeader`, `HeatmapGrid` (or empty state message "No activity to show yet — your AI work will appear here"), `HeatmapLegend`. Follow pattern from `components/analytics/analytics-dashboard.tsx`.
- [ ] T014 [US1] Integrate heatmap into projects page in `app/projects/page.tsx` — server-side call to `getHeatmapData()` with default filters, render `<ActivityHeatmap initialData={heatmapData} />` below `ProjectsContainer`, wrap in section with appropriate spacing
- [ ] T015 [US1] Remove scroll constraint from `components/projects/projects-container.tsx` — remove `max-h-[calc(100vh-200px)]` from outer div so the page scrolls naturally to reveal the heatmap below project cards (FR-021)

**Checkpoint**: Heatmap grid renders on `/projects` with correct cell intensities, summary counter, and legend. No loading flash on first render.

---

## Phase 4: User Story 2 — Tooltip with Day Details (Priority: P1)

**Goal**: Hover/tap a heatmap cell to see tooltip with tickets shipped, job count, cost (if available), and formatted date.

**Independent Test**: Hover over a cell with activity; tooltip shows accurate data. Hover over empty cell; tooltip shows "No activity". On mobile, tap-to-show and tap-outside-to-dismiss works.

### Tests for User Story 2

- [ ] T016 [P] [US2] Add tooltip component tests to `tests/unit/components/activity-heatmap.test.tsx` — tooltip appears on hover with correct data (job count, shipped count, cost), tooltip shows "No activity" for empty cells, cost line omitted when `totalCost` is null (never shows "$0" or "$NaN"), tooltip shows formatted date

### Implementation for User Story 2

- [ ] T017 [US2] Create tooltip component in `components/heatmap/heatmap-tooltip.tsx` — absolute positioned tooltip showing formatted date ("March 15, 2025"), "X tickets shipped" (if any), "Y jobs" or "Y jobs · $Z.ZZ" (cost only when non-null), "No activity" for empty cells. Desktop: show on hover. Mobile: tap-to-show, tap-outside-to-dismiss (only one tooltip visible at a time). Clamp position to viewport.
- [ ] T018 [US2] Wire tooltip into heatmap grid in `components/heatmap/heatmap-grid.tsx` — add hover/click handlers to cells, pass cell data to `HeatmapTooltip`, manage active tooltip state

**Checkpoint**: Tooltip shows correct data on hover/tap for all cell states (active, empty, with/without cost).

---

## Phase 5: User Story 3 — Year Selector (Priority: P2)

**Goal**: Year selector dropdown in heatmap header defaults to "Last 12 months" and offers each calendar year from account creation to current year.

**Independent Test**: Click year selector; correct options appear. Select a year; heatmap grid updates to show that calendar year with correct boundaries.

### Tests for User Story 3

- [ ] T019 [P] [US3] Add year selector tests to `tests/unit/components/activity-heatmap.test.tsx` — year selector shows correct options based on `accountCreatedYear`, year selector hidden (static label) when `accountCreatedYear === currentYear`, selecting a year updates the grid period and summary counter
- [ ] T020 [P] [US3] Add year filter integration tests to `tests/integration/heatmap/heatmap-route.test.ts` — API filters by rolling window vs specific calendar year, returns correct `availableYears` based on user creation date

### Implementation for User Story 3

- [ ] T021 [US3] Add year selector to `components/heatmap/heatmap-header.tsx` — shadcn `Select` dropdown with "Last 12 months" as default + year options from `availableYears`. Hide dropdown (render static label) when `accountCreatedYear === currentYear`. Follow pattern from `components/analytics/time-range-selector.tsx`.
- [ ] T022 [US3] Wire year selector to filter state in `components/heatmap/activity-heatmap.tsx` — on year change, update local state and refetch via query key change, update summary counter period label

**Checkpoint**: Year selector works with correct options, hidden for new users, updates grid on selection.

---

## Phase 6: User Story 4 — Agent Filter (Priority: P2)

**Goal**: Agent filter lets users view heatmap activity for a specific AI agent, using effective agent resolution.

**Independent Test**: As user with CLAUDE and CODEX jobs, agent filter appears. Select "CLAUDE"; heatmap shows only CLAUDE activity (including tickets inheriting CLAUDE from project default).

### Tests for User Story 4

- [ ] T023 [P] [US4] Add agent filter tests to `tests/unit/components/activity-heatmap.test.tsx` — agent filter hidden when ≤1 distinct agent, agent filter shows correct options when multiple agents exist, selecting agent updates grid
- [ ] T024 [P] [US4] Add agent filter integration tests to `tests/integration/heatmap/heatmap-route.test.ts` — API filters by agent using effective agent resolution (ticket agent AND project default), returns correct `availableAgents` list with job counts

### Implementation for User Story 4

- [ ] T025 [US4] Add agent filter to `components/heatmap/heatmap-header.tsx` — shadcn `Select` dropdown with "All" default + agent options from `availableAgents`. Hide filter entirely when `availableAgents.length <= 2` (only "all" + one agent).
- [ ] T026 [US4] Wire agent filter to filter state in `components/heatmap/activity-heatmap.tsx` — on agent change, update local state and refetch

**Checkpoint**: Agent filter shows/hides correctly, filters data with effective agent resolution.

---

## Phase 7: User Story 5 — URL-Shareable Filters (Priority: P2)

**Goal**: Active filter selections reflected in URL query params. Shared URLs reproduce the same filtered view.

**Independent Test**: Set year to "2025" and agent to "CLAUDE"; URL contains `?year=2025&agent=CLAUDE`. Open URL in new tab; same filters applied.

### Tests for User Story 5

- [ ] T027 [P] [US5] Add URL sync tests to `tests/unit/components/activity-heatmap.test.tsx` — default filters produce no query params (clean URL), non-default filters add correct query params, filters restore from URL params on mount

### Implementation for User Story 5

- [ ] T028 [US5] Implement URL filter sync in `components/heatmap/activity-heatmap.tsx` — on filter change push URL params via `router.replace()`, read initial filters from `useSearchParams()` on mount. Default values ("rolling", "all") produce NO query params. Follow `buildFilterSearchParams` / `getInitialFilters` pattern from `components/analytics/analytics-dashboard.tsx`.

**Checkpoint**: URL reflects filter state; shared URLs reproduce identical views; default state has clean URL.

---

## Phase 8: User Story 6 — Empty State (Priority: P2)

**Goal**: When selected period has zero activity, show centered message while keeping legend and filters visible.

**Independent Test**: As new user with no jobs, visit `/projects`. Empty state message appears. Filters and legend still visible.

### Tests for User Story 6

- [ ] T029 [P] [US6] Add empty state tests to `tests/unit/components/activity-heatmap.test.tsx` — empty state message shown when cells array is empty, counter shows "0 jobs · 0 tickets shipped", legend and filters remain visible, switching to a year with data replaces empty state with grid

### Implementation for User Story 6

- [ ] T030 [US6] Refine empty state rendering in `components/heatmap/activity-heatmap.tsx` — ensure "No activity to show yet — your AI work will appear here" centered message replaces ONLY the grid, header (counter + filters) and legend remain visible and interactive, counter shows "0 jobs · 0 tickets shipped"

**Checkpoint**: Empty state displays correctly; filters/legend remain functional; switching periods toggles between empty and grid states.

---

## Phase 9: User Story 7 — Mobile Horizontal Scroll (Priority: P3)

**Goal**: Heatmap grid scrolls horizontally on mobile with sticky day-of-week labels and tappable cell sizes.

**Independent Test**: View `/projects` on mobile viewport. Grid scrolls horizontally. Day-of-week labels stay pinned. Cells are tappable.

### Tests for User Story 7

- [ ] T031 [P] [US7] Add mobile layout tests to `tests/unit/components/activity-heatmap.test.tsx` — grid container has `overflow-x-auto`, day-of-week labels have sticky positioning, cells maintain minimum size

### Implementation for User Story 7

- [ ] T032 [US7] Implement mobile scroll behavior in `components/heatmap/heatmap-grid.tsx` — outer container with `overflow-x-auto`, day-of-week labels with `position: sticky; left: 0` and `z-index` to stay pinned during scroll, cells maintain minimum 11px size with 44px touch target area via padding/spacing, tooltip clamped to viewport on mobile

**Checkpoint**: Grid scrolls horizontally on mobile with sticky labels and tappable cells.

---

## Phase 10: User Story 8 — No Loading Flash (Priority: P3)

**Goal**: Heatmap renders with data immediately on first load (server-rendered initial data). Background refetches update silently.

**Independent Test**: Navigate to `/projects`. Heatmap appears with data immediately — no spinner. Subsequent refetches update cells without visual disruption.

### Tests for User Story 8

- [ ] T033 [P] [US8] Add SSR initial data tests to `tests/unit/components/activity-heatmap.test.tsx` — component renders with `initialData` without showing loading state, background refetch does not cause visual blank

### Implementation for User Story 8

- [ ] T034 [US8] Verify SSR data flow in `app/projects/page.tsx` and `components/heatmap/activity-heatmap.tsx` — ensure `initialData` is passed from server component to client component, `useHeatmap` hook uses `initialData` to render immediately, no loading/skeleton state exists, background refetches silently replace data without blanking the grid

**Checkpoint**: No loading flash on initial render; background updates are seamless.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, contrast verification, and cross-story refinements.

- [ ] T035 [P] Verify WCAG AA 4.5:1 contrast for all 5 violet intensity levels against dark theme background (`--background`) and ensure empty cell color is distinguishable from page background in `components/heatmap/heatmap-grid.tsx`
- [ ] T036 [P] Add keyboard accessibility to heatmap cells in `components/heatmap/heatmap-grid.tsx` — cells focusable via `tabIndex`, tooltip shown on Enter/Space, focus ring visible

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core grid, no other story dependencies
- **US2 (Phase 4)**: Depends on US1 (needs grid cells to attach tooltips)
- **US3 (Phase 5)**: Depends on US1 (needs header component to add selector)
- **US4 (Phase 6)**: Depends on US1 (needs header component to add filter)
- **US5 (Phase 7)**: Depends on US3 + US4 (needs filter controls to sync to URL)
- **US6 (Phase 8)**: Depends on US1 (needs orchestrator for empty state logic)
- **US7 (Phase 9)**: Depends on US1 (enhances grid component)
- **US8 (Phase 10)**: Depends on US1 (verifies SSR data flow)
- **Polish (Phase 11)**: Depends on US1 at minimum; best after all stories complete

### User Story Dependencies

- **US1 (P1)**: Foundation only — no story dependencies. **MVP target.**
- **US2 (P1)**: Depends on US1 (grid must exist for tooltip attachment)
- **US3 (P2)**: Depends on US1 only
- **US4 (P2)**: Depends on US1 only
- **US5 (P2)**: Depends on US3 + US4 (filters must exist to sync)
- **US6 (P2)**: Depends on US1 only
- **US7 (P3)**: Depends on US1 only
- **US8 (P3)**: Depends on US1 only

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Data layer before UI components
- Components before integration
- Story complete before checkpoint

### Parallel Opportunities

After Phase 2 completes:
- **US2, US3, US4, US6, US7, US8** can all start in parallel (all depend only on US1)
- **US5** must wait for US3 + US4

Within phases:
- All `[P]` tasks within a phase can run simultaneously
- Test tasks within a story can run in parallel with each other

---

## Parallel Example: Phase 1 (Setup)

```
# All three tasks target different files — run in parallel:
Task T001: lib/heatmap/types.ts
Task T002: lib/analytics/queries.ts
Task T003: app/lib/query-keys.ts
```

## Parallel Example: User Story 1 Tests

```
# All three test files are independent — run in parallel:
Task T007: tests/unit/heatmap-grid.test.ts
Task T008: tests/unit/components/activity-heatmap.test.tsx
Task T009: tests/integration/heatmap/heatmap-route.test.ts
```

## Parallel Example: User Story 1 Implementation

```
# Grid, legend, and header target different files — run in parallel:
Task T010: components/heatmap/heatmap-grid.tsx
Task T011: components/heatmap/heatmap-legend.tsx
Task T012: components/heatmap/heatmap-header.tsx
# Then sequentially:
Task T013: components/heatmap/activity-heatmap.tsx (depends on T010-T012)
Task T014: app/projects/page.tsx (depends on T013)
Task T015: components/projects/projects-container.tsx (independent but logically grouped)
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T006)
3. Complete Phase 3: User Story 1 — core heatmap grid (T007–T015)
4. Complete Phase 4: User Story 2 — tooltip (T016–T018)
5. **STOP and VALIDATE**: Heatmap renders with correct data and tooltips work
6. Deploy/demo as MVP

### Incremental Delivery

1. Setup + Foundational → Data layer ready
2. US1 (grid) + US2 (tooltip) → MVP deployed
3. US3 (year selector) + US4 (agent filter) + US6 (empty state) → Filters and edge cases
4. US5 (URL sync) → Shareable views
5. US7 (mobile scroll) + US8 (no loading flash) → Polish
6. Phase 11 → Accessibility and contrast

### Parallel Execution Strategy

1. Complete Setup + Foundational sequentially (T001–T006)
2. US1 must complete first (grid is the foundation)
3. Then parallelize:
   - Worker A: US2 (tooltip)
   - Worker B: US3 (year selector) + US4 (agent filter)
   - Worker C: US6 (empty state) + US7 (mobile scroll)
4. US5 (URL sync) after US3 + US4 complete
5. US8 (SSR verification) can run anytime after US1
6. Polish phase last

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps task to specific user story for traceability
- `buildEffectiveAgentWhere()` must be exported from `lib/analytics/queries.ts` before heatmap queries can import it (T002)
- All new component files go in `components/heatmap/`; all new lib files in `lib/heatmap/`
- No new database models or migrations required — reads from existing Job, Ticket, Project tables
- Zero-activity days omitted from API response; client fills grid and treats missing dates as empty
- All dates UTC-normalized to avoid DST boundary issues
