# Tasks: Activity Heatmap on Projects Page

**Input**: Design documents from `/specs/AIB-643-activity-heatmap-on/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create TypeScript types and query layer shared by all user stories.

- [x] T001 [P] Create heatmap TypeScript types (`HeatmapDayData`, `HeatmapResponse`, `HeatmapFilters`, `HeatmapCell`, `AgentOption`) in `lib/activity-heatmap/types.ts` per `data-model.md`
- [x] T002 [P] Create Prisma query functions (`getHeatmapData`, `getAvailableYears`, `getAvailableAgents`) in `lib/activity-heatmap/queries.ts` — use owner+member OR pattern from `lib/db/projects.ts:32-35`, `buildEffectiveAgentWhere` pattern from `lib/analytics/queries.ts:51-69`, aggregate Jobs with `status IN (COMPLETED, FAILED)` grouped by `DATE(completedAt)`
- [x] T003 Add `heatmap` key factory to `app/lib/query-keys.ts` following existing pattern (keys for filters: year, agent)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API endpoint and client hook that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Create API route `GET /api/activity-heatmap` in `app/api/activity-heatmap/route.ts` — auth via `requireAuth(request)` from `lib/db/users.ts`, Zod validation for `year` and `agent` query params, call query functions from `lib/activity-heatmap/queries.ts`, return `HeatmapResponse` shape per `contracts/activity-heatmap-api.md`
- [x] T005 Create TanStack Query hook `useActivityHeatmap(filters)` in `hooks/use-activity-heatmap.ts` — 15s `refetchInterval`, 10s `staleTime`, use `heatmap` query keys from `app/lib/query-keys.ts`, follow pattern from `hooks/use-usage.ts`

**Checkpoint**: API and data layer ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — View Activity Heatmap (Priority: P1) 🎯 MVP

**Goal**: Display a GitHub-style heatmap grid below the project cards on `/projects` with 52×7 day cells, violet intensity coloring, header metrics, legend, and mobile scroll support.

**Independent Test**: Navigate to `/projects` with existing job data → heatmap renders with correct day-cell coloring, month labels, day-of-week labels, header metrics ("X jobs · Y tickets shipped"), and intensity legend.

### Tests for User Story 1

- [x] T006 [P] [US1] Create integration test for heatmap API endpoint in `tests/integration/activity-heatmap/route.test.ts` — use `getTestContext()` + `ctx.api.get()` pattern from `tests/fixtures/vitest/setup.ts`. Test scenarios: (1) returns heatmap data for user with jobs across multiple projects, (2) returns empty data for user with no jobs, (3) returns 401 for unauthenticated requests, (4) includes jobs from member projects (not just owned)
- [x] T007 [P] [US1] Create component test for heatmap rendering in `tests/unit/components/activity-heatmap.test.tsx` — use `renderWithProviders()` from `tests/utils/component-test-utils.tsx`. Test scenarios: (1) renders 7 rows × 52 columns grid, (2) shows correct header metrics, (3) renders empty state with zero counts, (4) legend shows 5 intensity levels, (5) mobile horizontal scroll container present

### Implementation for User Story 1

- [x] T008 [US1] Create main heatmap client component in `components/projects/activity-heatmap.tsx` — `"use client"` component containing: header with aggregate metrics ("X jobs · Y tickets shipped in the last year"), 52-column × 7-row grid with month labels top and day-of-week labels left, cells as colored divs with 5 static violet intensity classes (`bg-ctp-surface0/50`, `bg-ctp-mauve/25`, `bg-ctp-mauve/40`, `bg-ctp-mauve/60`, `bg-ctp-mauve`), "Less"→"More" legend at bottom-right, empty state (all transparent, "0 jobs · 0 tickets shipped"), `overflow-x-auto` wrapper for mobile (FR-011), aurora Card styling with `border-ctp-mauve/15 aurora-bg-subtle`
- [x] T009 [US1] Remove `overflow-y-auto max-h-[calc(100vh-200px)]` from wrapper div in `components/projects/projects-container.tsx:15` to enable natural page scrolling (D5 in research)
- [x] T010 [US1] Mount `<ActivityHeatmap />` below `<ProjectsContainer />` in `app/projects/page.tsx`

**Checkpoint**: Heatmap is visible on `/projects` with correct grid, coloring, metrics, legend, and scroll behavior. MVP complete.

---

## Phase 4: User Story 2 — Tooltip on Hover (Priority: P2)

**Goal**: Show a tooltip on cell hover with tickets shipped, job count + cost, and formatted date.

**Independent Test**: Hover over populated heatmap cells → tooltip appears with correct per-day data matching actual job/ticket records.

### Tests for User Story 2

- [x] T011 [P] [US2] Extend component test in `tests/unit/components/activity-heatmap.test.tsx` with tooltip scenarios: (1) tooltip displays on cell hover with correct data (tickets shipped, job count, cost, date), (2) tooltip shows "No activity" for empty cells, (3) tooltip hides cost when `costUsd` is null

### Implementation for User Story 2

- [x] T012 [US2] Add tooltip functionality to heatmap cells in `components/projects/activity-heatmap.tsx` — wrap cells with shadcn `TooltipProvider`/`Tooltip`/`TooltipTrigger`/`TooltipContent` per P4 pattern from research, display tickets shipped count, job count + formatted cost (when available), and formatted date (e.g., "Monday, March 15, 2026")

**Checkpoint**: Hovering any cell shows accurate tooltip data.

---

## Phase 5: User Story 3 — Year Selector (Priority: P3)

**Goal**: Add a year selector dropdown to the heatmap header, defaulting to "Last 12 months" with options for specific calendar years.

**Independent Test**: Select different years from dropdown → heatmap grid, header metrics, and cell data update to reflect the chosen period.

### Tests for User Story 3

- [x] T013 [P] [US3] Extend integration test in `tests/integration/activity-heatmap/route.test.ts` with year filter scenarios: (1) filters by specific year correctly, (2) validates invalid year param returns 400
- [x] T014 [P] [US3] Extend component test in `tests/unit/components/activity-heatmap.test.tsx` with year selector scenarios: (1) year selector defaults to "Last 12 months", (2) selecting a year changes displayed period and re-fetches data

### Implementation for User Story 3

- [x] T015 [US3] Add year selector control (shadcn `Select`) to heatmap header in `components/projects/activity-heatmap.tsx` — populate options from `availableYears` in API response plus "Last 12 months" default, update `HeatmapFilters.year` state on change, trigger re-fetch via `useActivityHeatmap` hook

**Checkpoint**: Year selector works — switching years updates the entire heatmap view.

---

## Phase 6: User Story 4 — Agent Filter (Priority: P4)

**Goal**: Add an agent filter control that filters heatmap data by AI agent.

**Independent Test**: Select different agents from filter → heatmap cells, header counts, and tooltip data change to show only matching jobs.

### Tests for User Story 4

- [x] T016 [P] [US4] Extend integration test in `tests/integration/activity-heatmap/route.test.ts` with agent filter scenarios: (1) filters by agent correctly, (2) validates invalid agent param returns 400
- [x] T017 [P] [US4] Extend component test in `tests/unit/components/activity-heatmap.test.tsx` with agent filter scenarios: (1) agent filter defaults to "All", (2) selecting an agent changes displayed data

### Implementation for User Story 4

- [x] T018 [US4] Add agent filter control (shadcn `Select`) to heatmap header in `components/projects/activity-heatmap.tsx` — populate options from `availableAgents` in API response using `AGENT_LABELS` from `app/lib/utils/agent-resolution.ts`, update `HeatmapFilters.agent` state on change, trigger re-fetch

**Checkpoint**: Agent filter works — selecting an agent updates heatmap, metrics, and tooltips.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and hardening across all stories.

- [x] T019 Run `bun run type-check` and `bun run lint` — fix any errors in new/modified files
- [x] T020 Run `bun run test:unit tests/unit/components/activity-heatmap.test.tsx` and `bun run test:integration tests/integration/activity-heatmap/route.test.ts` — verify all tests pass
- [x] T021 Verify WCAG AA contrast for all 5 violet intensity levels against dark theme background in `components/projects/activity-heatmap.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (types + queries) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core heatmap rendering
- **US2 (Phase 4)**: Depends on Phase 3 (needs rendered cells to attach tooltips)
- **US3 (Phase 5)**: Depends on Phase 2 — can run in parallel with US2
- **US4 (Phase 6)**: Depends on Phase 2 — can run in parallel with US2 and US3
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Requires Foundational — no other story dependencies
- **US2 (P2)**: Requires US1 (tooltips attach to existing cells)
- **US3 (P3)**: Requires Foundational only — independent of US1/US2 (adds controls to component)
- **US4 (P4)**: Requires Foundational only — independent of US1/US2/US3 (adds controls to component)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Query layer before API endpoint
- API endpoint before client hook
- Client hook before UI component
- Core rendering before interactive features

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 can all run in parallel (different files)
- **Phase 2**: T004 depends on T001+T002; T005 depends on T003+T004
- **Phase 3 tests**: T006, T007 can run in parallel (different test files)
- **Phase 3 impl**: T008 first, then T009 and T010 can run in parallel
- **After US1**: US3 and US4 can run in parallel (different controls, same component but different sections)
- **Cross-story test extensions**: T013+T014 (US3) and T016+T017 (US4) can run in parallel

---

## Parallel Example: Phase 1 (Setup)

```bash
# All three tasks target different files — run in parallel:
Task T001: "Create types in lib/activity-heatmap/types.ts"
Task T002: "Create queries in lib/activity-heatmap/queries.ts"
Task T003: "Add query keys in app/lib/query-keys.ts"
```

## Parallel Example: User Story 1 Tests

```bash
# Both test files are independent — run in parallel:
Task T006: "Integration test in tests/integration/activity-heatmap/route.test.ts"
Task T007: "Component test in tests/unit/components/activity-heatmap.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T005)
3. Complete Phase 3: User Story 1 (T006–T010)
4. **STOP and VALIDATE**: Heatmap visible on `/projects` with grid, coloring, metrics, legend
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Data layer ready
2. Add US1 → Heatmap renders on page (MVP!)
3. Add US2 → Tooltips on hover
4. Add US3 → Year selector
5. Add US4 → Agent filter
6. Polish → Type-check, lint, full test suite

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Complete US1 (required for US2 tooltips)
3. Once US1 is done, US2, US3, and US4 can run in parallel:
   - Parallel task 1: US2 (tooltips)
   - Parallel task 2: US3 (year selector)
   - Parallel task 3: US4 (agent filter)
4. Polish phase after all stories complete

---

## Notes

- No new database models — all data derived from existing `Job` and `Ticket` tables (SC-008)
- No new dependencies — custom SVG/HTML grid, shadcn/ui components, existing TanStack Query
- All Tailwind classes must be static literals (never dynamic construction per CLAUDE.md)
- Cost null handling: include in job counts, exclude from cost totals
- Agent filter uses `buildEffectiveAgentWhere` pattern (ticket.agent ?? project.defaultAgent)
