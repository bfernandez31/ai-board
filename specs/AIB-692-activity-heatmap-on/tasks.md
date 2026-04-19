# Tasks: Activity Heatmap on Projects Page

**Input**: Design documents from `/specs/AIB-692-activity-heatmap-on/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create shared types, query keys, and project structure for the heatmap feature

- [ ] T001 [P] Create shared heatmap API types (ActivityHeatmapResponse, ActivityDayData, IntensityThresholds, AgentOption, HeatmapFilters) in `lib/heatmap/types.ts`
- [ ] T002 [P] Create client-side prop and component types in `components/activity-heatmap/types.ts`
- [ ] T003 Add `heatmap` query key under `projects` in `app/lib/query-keys.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Server-side data aggregation and API endpoint that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Implement `getActivityHeatmapData(userId, filters)` in `lib/heatmap/queries.ts` — date range computation (rolling vs calendar year), Prisma job query with ownership filter (userId + members), GROUP BY date aggregation, shipped ticket counting (COMPLETED ship jobs only), quantile threshold calculation, available years/agents derivation
- [ ] T005 Implement GET endpoint with `requireAuth()`, Zod validation for `year`/`agent` query params, and structured error responses (401/400/500) in `app/api/projects/activity-heatmap/route.ts`

**Checkpoint**: API endpoint returns correct heatmap data — client work can begin

---

## Phase 3: User Story 1 — View Activity Heatmap (Priority: P1) 🎯 MVP

**Goal**: Display a full-width activity heatmap below project cards with violet-gradient cells, month/day labels, summary counters, intensity legend, and server-rendered initial data (no loading flash)

**Independent Test**: Verify heatmap renders with correct grid layout, proper cell coloring from existing job data, accurate summary counters, month/day labels, and intensity legend. Empty state shows centered message with legend visible.

### Tests for User Story 1
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T006 [P] [US1] Create unit tests for pure heatmap logic in `tests/unit/heatmap-queries.test.ts` — quantile threshold calculation, intensity level mapping from count + thresholds, period date range computation (rolling and calendar year), grid date generation with chipped corners, edge cases (all same count → mid-intensity, single active day → max intensity)
- [ ] T007 [P] [US1] Create component tests in `tests/unit/components/activity-heatmap.test.tsx` using `renderWithProviders()` from `tests/utils/component-test-utils.tsx` — renders grid with correct cell count, displays summary counters (jobs + shipped tickets), shows month labels and day-of-week labels, applies correct intensity classes based on thresholds, shows empty state message when `summary.totalJobs === 0` with legend still visible, no loading flash with initialData
- [ ] T008 [P] [US1] Create integration tests for heatmap API in `tests/integration/activity-heatmap/api.test.ts` — returns 401 when unauthenticated, returns correct daily job counts for authenticated user, returns correct shipped ticket count (only `ship` command COMPLETED jobs), cost aggregation (sums non-null costs, returns null when all null), rolling period returns ~365 days of data

### Implementation for User Story 1

- [ ] T009 [US1] Implement the `ActivityHeatmap` client component in `components/activity-heatmap/activity-heatmap.tsx` — accepts `initialData` prop, `useQuery` with `queryKeys.projects.heatmap(year, agent)` and `refetchInterval: 60000` / `staleTime: 30000`, renders Card with `border-ctp-mauve/15 aurora-bg-subtle`, summary header ("X jobs + Y tickets shipped"), CSS Grid heatmap (7 rows Sun–Sat, columns = weeks, `gap-[3px]`, cell size `w-[13px] h-[13px]`), month labels along top, day-of-week labels on left, chipped corners for partial first/last weeks, 5 static violet intensity classes (`bg-ctp-surface0/50`, `bg-violet-900/60`, `bg-violet-700/70`, `bg-violet-500/80`, `bg-violet-400`), intensity legend ("Less" to "More"), empty state centered message "No activity to show yet — your AI work will appear here"
- [ ] T010 [US1] Integrate heatmap into projects page in `app/projects/page.tsx` — import and call `getActivityHeatmapData(userId, defaultFilters)` alongside existing `getProjects()`, render `<ActivityHeatmap initialData={heatmapData} />` below `<ProjectsContainer />`
- [ ] T011 [US1] Remove scroll constraint from `components/projects/projects-container.tsx` — remove `overflow-y-auto max-h-[calc(100vh-200px)]` so the page scrolls naturally to reveal the heatmap below project cards (FR-023)

**Checkpoint**: Heatmap renders on projects page with correct data, violet gradient cells, labels, legend, and empty state. No loading flash. Page scrolls naturally.

---

## Phase 4: User Story 2 — Filter by Time Period (Priority: P2)

**Goal**: Year selector dropdown in heatmap header lets users switch between "Last 12 months" (default rolling) and specific calendar years derived from account creation date

**Independent Test**: Switch between periods and verify grid boundaries, counters, and cell data update correctly. Year selector hidden when only "Last 12 months" available.

### Tests for User Story 2

- [ ] T012 [P] [US2] Extend component tests in `tests/unit/components/activity-heatmap.test.tsx` — year selector renders with correct options from `availableYears`, year selector hidden when only one option (FR-008), selecting a year triggers data refetch with updated year param
- [ ] T013 [P] [US2] Extend integration tests in `tests/integration/activity-heatmap/api.test.ts` — returns correct `availableYears` from user creation date, calendar year returns Jan 1 – Dec 31 data, returns 400 for invalid `year` parameter

### Implementation for User Story 2

- [ ] T014 [US2] Add year selector to `ActivityHeatmap` component in `components/activity-heatmap/activity-heatmap.tsx` — shadcn `Select` dropdown in CardHeader, options from `data.availableYears`, "Last 12 months" label for `'rolling'`, hide when `availableYears.length <= 1` (FR-008), selection updates `filters.year` state and triggers `useQuery` refetch
- [ ] T015 [US2] Add `year` filter to Zod validation in `app/api/projects/activity-heatmap/route.ts` — validate `'rolling'` or 4-digit year string, return 400 for invalid values

**Checkpoint**: Users can switch between time periods. Grid, counters, and thresholds update per selected period.

---

## Phase 5: User Story 3 — Filter by Agent (Priority: P2)

**Goal**: Agent filter dropdown derived from distinct effective agents in user's job data. Uses effective agent resolution (ticket agent or inherited project default). Grid boundaries unchanged; only intensities and counters update.

**Independent Test**: Verify filter options match actual agent usage, effective agent resolution is correct, and selecting an agent updates heatmap data without changing grid shape.

### Tests for User Story 3

- [ ] T016 [P] [US3] Extend component tests in `tests/unit/components/activity-heatmap.test.tsx` — agent filter renders with correct options from `availableAgents`, agent filter hidden when `availableAgents.length <= 1` (FR-010 — only "All"), selecting agent triggers data refetch with updated agent param
- [ ] T017 [P] [US3] Extend integration tests in `tests/integration/activity-heatmap/api.test.ts` — returns correct `availableAgents` from user's job data, filters by agent correctly (explicit and inherited via `buildEffectiveAgentWhere` pattern from `lib/analytics/queries.ts:51-69`)

### Implementation for User Story 3

- [ ] T018 [US3] Add agent filter to `ActivityHeatmap` component in `components/activity-heatmap/activity-heatmap.tsx` — shadcn `Select` dropdown next to year selector, options from `data.availableAgents`, "All" selected by default, hide when `availableAgents.length <= 1` (FR-010), selection updates `filters.agent` state and triggers refetch
- [ ] T019 [US3] Add agent filter logic to `lib/heatmap/queries.ts` — use `buildEffectiveAgentWhere()` pattern for Prisma ticket filtering, derive `availableAgents` from distinct effective agents across user's jobs

**Checkpoint**: Users can filter by agent. Only intensities and counters change; grid boundaries stay the same.

---

## Phase 6: User Story 4 — View Activity Details via Tooltip (Priority: P3)

**Goal**: Hover (desktop) or tap (mobile) a heatmap cell to see tooltip with tickets shipped, job count, total cost (if available), and formatted date. Empty cells show "No activity" + date only.

**Independent Test**: Hover over cells with various data conditions (multiple jobs, zero activity, jobs with/without cost) and verify tooltip content accuracy.

### Tests for User Story 4

- [ ] T020 [P] [US4] Extend component tests in `tests/unit/components/activity-heatmap.test.tsx` — tooltip shows correct content on hover (job count, shipped count, cost, date), tooltip for empty cell shows "No activity" and date only, tooltip omits cost line when all costs are null, follows tooltip pattern from `components/comparison/comparison-compliance-heatmap.tsx:102-114`

### Implementation for User Story 4

- [ ] T021 [US4] Add tooltips to heatmap cells in `components/activity-heatmap/activity-heatmap.tsx` — wrap each cell in shadcn `Tooltip`/`TooltipTrigger`/`TooltipContent`, active day shows formatted date + "N jobs" + "N tickets shipped" (if any) + "$X.XX" cost (if non-null), empty day shows formatted date + "No activity", mobile tap-to-show/tap-outside-dismiss via Radix Tooltip

**Checkpoint**: All cells show accurate tooltips. Cost omitted when all null. Mobile tap works.

---

## Phase 7: User Story 5 — Share Filtered View via URL (Priority: P3)

**Goal**: Active filters (year, agent) reflected in URL query parameters. Shared URLs reproduce the same filtered view. Default filters produce a clean URL.

**Independent Test**: Apply filters, copy URL, open in new session, verify same filters pre-applied.

### Tests for User Story 5

- [ ] T022 [P] [US5] Extend component tests in `tests/unit/components/activity-heatmap.test.tsx` — year/agent filter selection updates URL query params, restores filters from URL query params on load, default filters produce clean URL (no query params)

### Implementation for User Story 5

- [ ] T023 [US5] Add URL sync to `ActivityHeatmap` component in `components/activity-heatmap/activity-heatmap.tsx` — initialize filter state from `useSearchParams()` (follow pattern from `components/analytics/analytics-dashboard.tsx:60-72`), `updateFilters()` using `router.push('?...', { scroll: false })` (follow `components/analytics/analytics-dashboard.tsx:105-109`), remove query params when resetting to defaults

**Checkpoint**: URLs reflect filter state. Shared URLs reproduce the view. Defaults produce clean URL.

---

## Phase 8: User Story 6 — Mobile Heatmap Experience (Priority: P3)

**Goal**: Grid scrolls horizontally on mobile with pinned day-of-week labels. Cells maintain minimum tappable size. No scroll constraint clips the heatmap.

**Independent Test**: On mobile viewport, scroll horizontally and verify labels stay pinned, cells remain tappable, grid doesn't wrap.

### Tests for User Story 6

- [ ] T024 [US6] Extend component tests in `tests/unit/components/activity-heatmap.test.tsx` — grid container has `overflow-x-auto`, day-of-week labels have sticky positioning, cells use mobile-sized classes (`w-[16px] h-[16px]` at mobile breakpoint)

### Implementation for User Story 6

- [ ] T025 [US6] Add mobile optimizations to `components/activity-heatmap/activity-heatmap.tsx` — `overflow-x-auto` on grid container, day-of-week labels `sticky left-0 z-10` with `aurora-bg-subtle` background (follow pattern from `components/comparison/comparison-compliance-heatmap.tsx:66,79`), cell size `w-[16px] h-[16px]` on mobile (min tappable size via responsive class), ensure no wrapping on small viewports

**Checkpoint**: Mobile users can scroll horizontally with pinned labels. Cells are tappable. Heatmap is reachable by scrolling past project cards.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and refinements across all user stories

- [ ] T026 [P] Verify WCAG AA contrast for all 5 violet intensity levels on dark theme background — check `bg-ctp-surface0/50`, `bg-violet-900/60`, `bg-violet-700/70`, `bg-violet-500/80`, `bg-violet-400` against dark background (SC-007)
- [ ] T027 [P] Run `bun run type-check` and `bun run lint` to verify no type errors or lint issues across all new files
- [ ] T028 Run full test suite `bun run test:unit` and `bun run test:integration` to verify all heatmap tests pass and no regressions in existing tests

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (types) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (API endpoint) — delivers MVP
- **US2 (Phase 4)**: Depends on Phase 3 (base component exists to add year selector)
- **US3 (Phase 5)**: Depends on Phase 3 (base component exists to add agent filter). Can run in parallel with US2.
- **US4 (Phase 6)**: Depends on Phase 3 (cells exist to add tooltips). Can run in parallel with US2/US3.
- **US5 (Phase 7)**: Depends on Phase 4 + Phase 5 (filters must exist before URL sync)
- **US6 (Phase 8)**: Depends on Phase 3 (grid must exist for mobile optimizations). Can run in parallel with US2/US3/US4.
- **Polish (Phase 9)**: Depends on all user story phases being complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — no other story dependencies
- **US2 (P2)**: Depends on US1 (component must exist to add year selector)
- **US3 (P2)**: Depends on US1 (component must exist to add agent filter). Independent of US2.
- **US4 (P3)**: Depends on US1 (cells must exist for tooltips). Independent of US2/US3.
- **US5 (P3)**: Depends on US2 + US3 (filters must exist for URL sync)
- **US6 (P3)**: Depends on US1 (grid must exist for mobile work). Independent of US2/US3/US4.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types/models before services
- Services before endpoints/components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T001, T002 can run in parallel (Phase 1 — different files)
- T006, T007, T008 can run in parallel (US1 tests — different files)
- T012, T013 can run in parallel (US2 tests — different files)
- T016, T017 can run in parallel (US3 tests — different files)
- US2 (Phase 4), US3 (Phase 5), US4 (Phase 6), US6 (Phase 8) can all start in parallel after US1 completes
- T026, T027 can run in parallel (Polish — independent checks)

---

## Parallel Example: After US1 Completes

```
# These story phases can run in parallel after Phase 3 is done:
Phase 4 (US2 - Year Filter):    T012 + T013 → T014 → T015
Phase 5 (US3 - Agent Filter):   T016 + T017 → T018 → T019
Phase 6 (US4 - Tooltips):       T020 → T021
Phase 8 (US6 - Mobile):         T024 → T025

# After US2 + US3 complete:
Phase 7 (US5 - URL Sync):       T022 → T023
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational API (T004–T005)
3. Complete Phase 3: US1 — View Activity Heatmap (T006–T011)
4. **STOP and VALIDATE**: Test US1 independently — heatmap renders with data, empty state works, no loading flash
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → API ready
2. US1 → Heatmap visible with data → **MVP!**
3. US2 + US3 (parallel) → Filtering works → Deploy
4. US4 + US6 (parallel) → Tooltips + mobile → Deploy
5. US5 → URL sharing → Deploy
6. Polish → Contrast verified, tests green → Ship

### Suggested MVP Scope

**US1 only** (Phases 1–3, tasks T001–T011). This delivers the core heatmap visualization with summary counters, violet gradient, labels, legend, and empty state — the primary value of the feature.
