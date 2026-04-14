# Tasks: Activity Heatmap on Projects Page

**Input**: Design documents from `/specs/AIB-647-activity-heatmap-on/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/heatmap-api.md

**Tests**: Included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create type definitions and shared query infrastructure for the heatmap feature

- [x] T001 [P] Create TypeScript interfaces (`HeatmapData`, `HeatmapDayCell`, `HeatmapFilters`, `IntensityLevel`) in `lib/heatmap/types.ts`
- [x] T002 [P] Add `heatmap` query key section to `app/lib/query-keys.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API data layer that ALL user stories depend on — query functions and API route

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Implement Prisma query functions (daily jobs aggregation, daily shipped tickets, available years, available agents) in `lib/heatmap/queries.ts` — reuse `buildEffectiveAgentWhere` pattern from `lib/analytics/queries.ts`
- [x] T004 Implement `GET /api/heatmap` route with Zod validation, `requireAuth()`, and JSON response in `app/api/heatmap/route.ts` — follow pattern from `app/api/projects/[projectId]/analytics/route.ts`
- [x] T005 Create `useHeatmap()` TanStack Query hook with 15s polling in `app/lib/hooks/queries/use-heatmap.ts` — follow pattern from `app/lib/hooks/queries/use-project-activity.ts`

**Checkpoint**: API endpoint and query hook ready — UI stories can now begin

---

## Phase 3: User Story 1 — View Activity Heatmap (Priority: P1) 🎯 MVP

**Goal**: Display a GitHub-style heatmap grid (52x7) on the projects page with violet color scale showing daily job activity across all user projects

**Independent Test**: Load the projects page with existing job data and verify the heatmap renders with correct cell colors, month labels, day labels, and intensity legend

### Tests for User Story 1
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T006 [P] [US1] Create API integration tests (response shape, daily aggregation accuracy, empty state, auth 401) in `tests/integration/heatmap/heatmap-route.test.ts` — follow pattern from `tests/integration/analytics/analytics-route.test.ts`
- [x] T007 [P] [US1] Create component tests (grid renders 7 rows, month labels, day labels, intensity legend, empty state message) in `tests/unit/components/activity-heatmap.test.tsx` — follow pattern from `tests/unit/components/analytics-dashboard.test.tsx`

### Implementation for User Story 1

- [x] T008 [P] [US1] Create `<HeatmapGrid />` — pure presentational CSS grid (52x7) with colored cells, month labels, day-of-week labels in `components/heatmap/heatmap-grid.tsx`
- [x] T009 [P] [US1] Create `<HeatmapCell />` — single cell div with intensity color class in `components/heatmap/heatmap-cell.tsx`
- [x] T010 [P] [US1] Create `<HeatmapLegend />` — intensity scale from "Less" to "More" in `components/heatmap/heatmap-legend.tsx`
- [x] T011 [US1] Create `<ActivityHeatmap />` — main client component orchestrating grid, legend, loading/empty states, mobile horizontal scroll in `components/heatmap/activity-heatmap.tsx`
- [x] T012 [US1] Add `<ActivityHeatmap />` section below `ProjectsContainer` in `app/projects/page.tsx`
- [x] T013 [US1] Remove `overflow-y-auto max-h-[calc(100vh-200px)]` scroll constraint from `components/projects/projects-container.tsx` (FR-015)

**Checkpoint**: Heatmap grid visible on projects page with correct colors — MVP complete

---

## Phase 4: User Story 2 — Hover Tooltip with Activity Details (Priority: P1)

**Goal**: Show tooltip on cell hover with tickets shipped, job count + cost, and formatted date

**Independent Test**: Hover over cells with known data and verify tooltip content matches underlying records

### Tests for User Story 2

- [x] T014 [US2] Add tooltip component tests (hover shows correct content, no-activity tooltip, null-cost display) to `tests/unit/components/activity-heatmap.test.tsx`

### Implementation for User Story 2

- [x] T015 [US2] Add shadcn `Tooltip` wrapping to `<HeatmapCell />` with tooltip content logic (tickets shipped, jobs + cost, formatted date, "No activity" for empty cells) in `components/heatmap/heatmap-cell.tsx`

**Checkpoint**: Hovering any cell shows accurate tooltip — Stories 1+2 complete

---

## Phase 5: User Story 3 — Header with Summary Metrics (Priority: P2)

**Goal**: Display "X jobs · Y tickets shipped in the last year" summary above the heatmap grid

**Independent Test**: Verify header counters match the sum of all daily values in the displayed period

### Tests for User Story 3

- [x] T016 [US3] Add header component tests (correct summary text, updates with period change) to `tests/unit/components/activity-heatmap.test.tsx`

### Implementation for User Story 3

- [x] T017 [P] [US3] Create `<HeatmapHeader />` — summary line with total jobs and shipped tickets in `components/heatmap/heatmap-header.tsx`
- [x] T018 [US3] Integrate `<HeatmapHeader />` into `<ActivityHeatmap />` above the grid in `components/heatmap/activity-heatmap.tsx`

**Checkpoint**: Summary metrics visible above heatmap

---

## Phase 6: User Story 4 — Year Selector (Priority: P2)

**Goal**: Dropdown to switch between rolling 12-month view and specific calendar years

**Independent Test**: Switch between year options and verify heatmap grid, header, and tooltips all update to reflect the selected period

### Tests for User Story 4

- [x] T019 [P] [US4] Add year filter API tests (rolling vs specific year date ranges, empty year) to `tests/integration/heatmap/heatmap-route.test.ts`
- [x] T020 [P] [US4] Add year selector component tests (default "Last 12 months", year change updates view) to `tests/unit/components/activity-heatmap.test.tsx`

### Implementation for User Story 4

- [x] T021 [P] [US4] Create `<HeatmapFilters />` with year selector dropdown (shadcn Select) in `components/heatmap/heatmap-filters.tsx` — follow pattern from `components/analytics/time-range-selector.tsx`
- [x] T022 [US4] Wire year filter state and query params into `<ActivityHeatmap />` in `components/heatmap/activity-heatmap.tsx`

**Checkpoint**: Year selector functional, heatmap updates on year change

---

## Phase 7: User Story 5 — Agent Filter (Priority: P3)

**Goal**: Filter heatmap activity by specific AI agent or all agents combined

**Independent Test**: Select different agent filters and verify heatmap cells, tooltips, and header counters reflect only jobs for the selected agent

### Tests for User Story 5

- [x] T023 [P] [US5] Add agent filter API tests (filter by agent, agent with no activity) to `tests/integration/heatmap/heatmap-route.test.ts`
- [x] T024 [P] [US5] Add agent filter component tests (default "All agents", filter change updates view) to `tests/unit/components/activity-heatmap.test.tsx`

### Implementation for User Story 5

- [x] T025 [US5] Add agent filter dropdown to `<HeatmapFilters />` in `components/heatmap/heatmap-filters.tsx`
- [x] T026 [US5] Wire agent filter state and query params into `<ActivityHeatmap />` in `components/heatmap/activity-heatmap.tsx`

**Checkpoint**: Agent filter functional, all filters combine correctly

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Mobile responsiveness, accessibility, and edge cases

- [ ] T027 [P] Verify mobile horizontal scroll with sticky day labels on narrow viewports (FR-017) in `components/heatmap/activity-heatmap.tsx`
- [ ] T028 [P] Validate all 5 violet intensity levels meet WCAG AA contrast on dark theme (SC-003) in `components/heatmap/heatmap-grid.tsx`
- [ ] T029 Verify combined year + agent filter interaction works correctly end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (types) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 — core heatmap grid
- **User Story 2 (Phase 4)**: Depends on Phase 3 (needs cells to add tooltips to)
- **User Story 3 (Phase 5)**: Depends on Phase 2 — can run parallel with US1
- **User Story 4 (Phase 6)**: Depends on Phase 3 (needs working heatmap to filter)
- **User Story 5 (Phase 7)**: Depends on Phase 6 (extends filter component)
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: After Foundational → standalone MVP
- **US2 (P1)**: After US1 → enhances cells with tooltips
- **US3 (P2)**: After Foundational → can parallel with US1 (independent header component)
- **US4 (P2)**: After US1 → adds year filter to working heatmap
- **US5 (P3)**: After US4 → extends filter component with agent dropdown

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Presentational components before orchestrating components
- Core rendering before integration into page
- Story complete before moving to next priority

### Parallel Opportunities

- T001, T002 (setup) can run in parallel
- T006, T007 (US1 tests) can run in parallel
- T008, T009, T010 (US1 presentational components) can run in parallel
- T017 (US3 header) can run parallel with US1 implementation
- T019, T020 (US4 tests) can run in parallel
- T023, T024 (US5 tests) can run in parallel
- T027, T028 (polish) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests in parallel:
Task T006: "Create API integration tests in tests/integration/heatmap/heatmap-route.test.ts"
Task T007: "Create component tests in tests/unit/components/activity-heatmap.test.tsx"

# Launch US1 presentational components in parallel:
Task T008: "Create HeatmapGrid in components/heatmap/heatmap-grid.tsx"
Task T009: "Create HeatmapCell in components/heatmap/heatmap-cell.tsx"
Task T010: "Create HeatmapLegend in components/heatmap/heatmap-legend.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (types + query keys)
2. Complete Phase 2: Foundational (queries, API route, hook)
3. Complete Phase 3: User Story 1 (heatmap grid on page)
4. Complete Phase 4: User Story 2 (tooltips)
5. **STOP and VALIDATE**: Heatmap renders with correct colors and tooltips work
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → API ready
2. US1 (grid) + US2 (tooltips) → Core heatmap usable (MVP!)
3. US3 (header) → Summary metrics visible
4. US4 (year selector) → Historical browsing
5. US5 (agent filter) → Analytical depth
6. Polish → Mobile, accessibility, edge cases

### Parallel Execution Strategy

1. Complete Setup + Foundational sequentially
2. Once Foundational is done:
   - Parallel track A: US1 → US2 → US4 → US5
   - Parallel track B: US3 (independent header component)
3. Polish after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No new database models (SC-008) — all queries use existing Job and Ticket tables
- CSS grid rendering (no Recharts) — pure div grid with Tailwind classes
- Violet color palette via CSS custom properties for aurora theme coherence
- 15s TanStack Query polling matches existing analytics pattern
- All file paths verified against current codebase — all referenced source files exist, all new files are in new directories
