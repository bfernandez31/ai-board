# Tasks: Health Dashboard - Passive Modules (Quality Gate & Last Clean)

**Input**: Design documents from `/specs/AIB-374-health-dashboard-modules/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Included — specified in plan.md testing strategy and quickstart.md Phase G.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend shared types and define derived data structures needed by all modules

- [x] T001 Extend `lib/health/types.ts` with `QualityGateAggregate`, `QualityGateTrend`, `ThresholdDistribution`, `DimensionAverage`, `QualityGateTicketItem`, `TrendDataPoint`, `QualityGateModuleStatus`, `LastCleanAggregate`, `LastCleanHistoryItem`, `LastCleanModuleStatus` interfaces per data-model.md and contracts/health-api.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend aggregation modules that provide data for all card and drawer components

**⚠️ CRITICAL**: No user story UI work can begin until these aggregation functions exist

- [x] T002 [P] Create `lib/health/quality-gate.ts` with `getQualityGateAggregate(projectId: number)` — queries SHIP tickets with COMPLETED verify jobs + non-null qualityScore in 30-day window, computes average score, ticket count, threshold distribution (Excellent 90-100, Good 70-89, Fair 50-69, Poor 0-49), trend vs previous 30 days, per-dimension averages from parsed qualityScoreDetails, weekly trend data points, and recent tickets list. Handles duplicate verify jobs per ticket (most recent wins). Uses existing `parseQualityScoreDetails()` from `lib/quality-score.ts`
- [x] T003 [P] Create `lib/health/last-clean.ts` with `getLastCleanAggregate(projectId: number)` — queries completed clean jobs ordered by completedAt DESC, extracts filesCleaned and remainingIssues (default 0), computes daysAgo and isOverdue (>30 days), determines status ('ok'/'overdue'/'never'), builds summary text, returns history of up to 10 recent cleanup jobs with ticketKey

**Checkpoint**: Backend aggregation modules ready — API and UI work can now begin

---

## Phase 3: User Story 1 — Quality Gate Card Overview (Priority: P1) 🎯 MVP

**Goal**: Display the Quality Gate card with average score, ticket count, trend indicator, and threshold distribution on the Health Dashboard

**Independent Test**: Create a project with SHIP-stage tickets that have quality scores, load the Health Dashboard API, and verify the response includes correct average score, ticket count, trend, and threshold distribution

### Tests for User Story 1

- [x] T004 [P] [US1] Integration test for QG aggregation + API response in `tests/integration/health/quality-gate.test.ts` — test cases: (1) 5 SHIP tickets with scores verify average/distribution/dimensions, (2) no qualifying tickets returns empty state, (3) trend with both periods having data, (4) trend with only current period returns "new", (5) multiple verify jobs per ticket uses most recent

### Implementation for User Story 1

- [x] T005 [US1] Extend `app/api/projects/[projectId]/health/route.ts` — call `getQualityGateAggregate(projectId)` and populate `modules.qualityGate` with ticketCount, trend, distribution, and detail fields per contracts/health-api.md response schema
- [x] T006 [US1] Update `components/health/health-module-card.tsx` — for Quality Gate card: show ticket count in summary, trend indicator (arrow + delta value, "N/A" when type is 'new'/'no_data'), and threshold distribution mini-bar (Excellent/Good/Fair/Poor counts). Conditional rendering based on `ticketCount > 0`

**Checkpoint**: Quality Gate card displays correct data on Health Dashboard

---

## Phase 4: User Story 5 — Quality Gate Global Score Integration (Priority: P1) 🎯 MVP

**Goal**: Verify Quality Gate average score is included in the global Health Score at correct weight with proper redistribution when no data exists

**Independent Test**: Verify global score calculation includes Quality Gate at equal weight with other contributing modules, and that weight redistributes correctly when QG has no data

### Tests for User Story 5

- [x] T007 [P] [US5] Integration test for global score with QG in `tests/integration/health/quality-gate.test.ts` — test cases: (1) all 5 modules have scores, verify weighted average, (2) only QG + Security have data, verify proportional redistribution, (3) QG has no qualifying tickets, verify exclusion and redistribution

### Implementation for User Story 5

- [x] T008 [US5] Verify `lib/health/score-calculator.ts` correctly includes qualityGate in `calculateGlobalScore` with equal weight redistribution — confirm existing logic handles QG with/without data. Apply fixes only if tests reveal issues

**Checkpoint**: Global Health Score correctly reflects Quality Gate contribution

---

## Phase 5: User Story 2 — Quality Gate Drawer Detail (Priority: P2)

**Goal**: Display the Quality Gate drawer with dimension breakdown, recent tickets list, and trend graph

**Independent Test**: Open the Quality Gate drawer and verify dimension averages match ticket data, ticket list is correct, and trend graph renders weekly data points

### Tests for User Story 2

- [x] T009 [P] [US2] Component test for QG drawer in `tests/unit/components/quality-gate-drawer.test.tsx` — test cases: (1) renders dimensions table with correct averages, (2) renders recent tickets list with score badges, (3) renders trend chart (Recharts LineChart renders), (4) renders empty state when detail is null

### Implementation for User Story 2

- [x] T010 [US2] Create `components/health/drawer/quality-gate-drawer-content.tsx` — "use client" component receiving QualityGateModuleStatus as props. Sections: (1) dimensions table with aurora-glass pattern showing name, average score with `getScoreColor()`, and weight, (2) recent SHIP tickets list with ticketKey, title, score badge with label, (3) Recharts `LineChart` in `ResponsiveContainer` for trend data with theme-aware colors following `components/analytics/quality-score-trend-chart.tsx` pattern, (4) empty state using DrawerStates passive_no_data pattern
- [x] T011 [US2] Update `components/health/scan-detail-drawer.tsx` — when `moduleType === 'QUALITY_GATE'`, render `QualityGateDrawerContent` with data from health response modules.qualityGate instead of using `useScanReport`

**Checkpoint**: Quality Gate drawer shows full dimension breakdown and trend analysis

---

## Phase 6: User Story 3 — Last Clean Card Overview (Priority: P2)

**Goal**: Display the Last Clean card with date, files cleaned, remaining issues, and staleness status indicator

**Independent Test**: Create a project with a completed cleanup job and verify the card shows correct date, files count, remaining issues, and appropriate status (OK/overdue/never)

### Tests for User Story 3

- [x] T012 [P] [US3] Integration test for Last Clean derivation + API response in `tests/integration/health/last-clean.test.ts` — test cases: (1) recent cleanup job shows OK state with correct counts, (2) old cleanup job (>30 days) shows overdue state, (3) no cleanup jobs shows never state, (4) history returns up to 10 entries, (5) Last Clean does NOT affect global score

### Implementation for User Story 3

- [x] T013 [US3] Extend `app/api/projects/[projectId]/health/route.ts` — call `getLastCleanAggregate(projectId)` and populate `modules.lastClean` with filesCleaned, remainingIssues, daysAgo, isOverdue, status, and detail fields per contracts/health-api.md response schema
- [x] T014 [US3] Update `components/health/health-module-card.tsx` — for Last Clean card: show staleness indicator with visual alert styling when `isOverdue === true`, display daysAgo in summary, show filesCleaned and remainingIssues counts. "No cleanup yet" empty state when status is 'never'

**Checkpoint**: Last Clean card displays correct status and cleanup information

---

## Phase 7: User Story 4 — Last Clean Drawer Detail (Priority: P3)

**Goal**: Display the Last Clean drawer with cleanup summary and chronological history of past cleanups

**Independent Test**: Open the Last Clean drawer and verify summary matches last cleanup data and history lists previous cleanups in reverse chronological order

### Tests for User Story 4

- [x] T015 [P] [US4] Component test for Last Clean drawer in `tests/unit/components/last-clean-drawer.test.tsx` — test cases: (1) renders summary card with files cleaned and remaining issues, (2) renders history list in reverse chronological order, (3) renders overdue alert when status is 'overdue', (4) renders empty state when no cleanup

### Implementation for User Story 4

- [x] T016 [US4] Create `components/health/drawer/last-clean-drawer-content.tsx` — "use client" component receiving LastCleanModuleStatus as props. Sections: (1) summary card with files cleaned, remaining issues, and text summary using aurora-glass pattern, (2) history list of up to 10 past cleanups with date, filesCleaned, result status, and ticketKey, (3) empty state using DrawerStates passive_no_data pattern
- [x] T017 [US4] Update `components/health/scan-detail-drawer.tsx` — when `moduleType === 'LAST_CLEAN'`, render `LastCleanDrawerContent` with data from health response modules.lastClean

**Checkpoint**: Last Clean drawer shows full cleanup summary and history

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation, edge cases, and final quality checks

- [x] T018 Run `bun run type-check` and fix any TypeScript errors across all modified/new files
- [x] T019 Run `bun run lint` and fix any linting issues across all modified/new files
- [x] T020 Run quickstart.md validation — verify all implementation phases (A through G) are complete and all acceptance scenarios from spec.md are covered

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (types) — BLOCKS all user stories
- **US1 + US5 (Phases 3-4)**: Depend on Phase 2 — P1 priority, MVP scope
- **US2 + US3 (Phases 5-6)**: Depend on Phase 2 — P2 priority, can run in parallel with each other
- **US4 (Phase 7)**: Depends on Phase 2 — P3 priority
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (QG Card)**: Requires T001 (types) + T002 (quality-gate.ts) — no dependency on other stories
- **US5 (Global Score)**: Requires T002 (quality-gate.ts) — can run in parallel with US1
- **US2 (QG Drawer)**: Requires T002 (quality-gate.ts) + T005 (API route extended) — depends on US1 API work
- **US3 (Last Clean Card)**: Requires T001 (types) + T003 (last-clean.ts) — independent from US1/US2
- **US4 (Last Clean Drawer)**: Requires T003 (last-clean.ts) + T013 (API route extended) — depends on US3 API work

### Within Each User Story

- Tests written first (TDD)
- Backend (API route) before frontend (card/drawer)
- Card before drawer (drawer depends on data flowing through card module)

### Parallel Opportunities

- T002 (quality-gate.ts) and T003 (last-clean.ts) can run in parallel
- T004 (QG integration test) and T012 (Last Clean integration test) can run in parallel
- T009 (QG drawer test) and T015 (Last Clean drawer test) can run in parallel
- US1+US5 and US3 can run in parallel after foundational phase
- US2 and US4 can run in parallel after their respective card stories

---

## Parallel Example: Foundational Phase

```bash
# Launch both aggregation modules in parallel (different files, no dependencies):
Task: T002 "Create lib/health/quality-gate.ts"
Task: T003 "Create lib/health/last-clean.ts"
```

## Parallel Example: Integration Tests

```bash
# Launch both integration test files in parallel:
Task: T004 "QG integration test in tests/integration/health/quality-gate.test.ts"
Task: T012 "Last Clean integration test in tests/integration/health/last-clean.test.ts"
```

## Parallel Example: Component Tests

```bash
# Launch both component test files in parallel:
Task: T009 "QG drawer test in tests/unit/components/quality-gate-drawer.test.tsx"
Task: T015 "Last Clean drawer test in tests/unit/components/last-clean-drawer.test.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US5 Only)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (aggregation modules)
3. Complete Phase 3: US1 — Quality Gate Card
4. Complete Phase 4: US5 — Global Score Integration
5. **STOP and VALIDATE**: Test QG card and global score independently
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Backend aggregation ready
2. Add US1 + US5 → QG card + global score → Test → Deploy (MVP!)
3. Add US2 + US3 → QG drawer + Last Clean card → Test → Deploy
4. Add US4 → Last Clean drawer → Test → Deploy
5. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done:
   - Parallel track A: US1 (QG Card) → US2 (QG Drawer)
   - Parallel track B: US3 (Last Clean Card) → US4 (Last Clean Drawer)
   - US5 (Global Score) can run alongside US1
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No new DB migrations — all data derived from existing Job model
- Drawer components are "use client" but receive data as props (no internal fetching)
- Uses existing patterns: aurora-glass, DrawerStates, getScoreColor(), parseQualityScoreDetails()
- Recharts LineChart pattern from components/analytics/quality-score-trend-chart.tsx
