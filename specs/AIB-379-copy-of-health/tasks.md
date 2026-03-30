# Tasks: Health Dashboard — Passive Modules (Quality Gate & Last Clean)

**Input**: Design documents from `/specs/AIB-379-copy-of-health/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included per plan.md testing strategy.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No project initialization needed — existing codebase. This phase is intentionally empty.

**Checkpoint**: Proceed directly to foundational work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type definitions and shared computation helpers that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T001 Extend `HealthModuleStatus` with optional fields (`ticketCount`, `trend`, `trendDelta`, `distribution`, `stalenessStatus`, `filesCleaned`) in `lib/health/types.ts`
- [x] T002 [P] Create Quality Gate computation helper with `getQualityGateData(projectId)` returning `QualityGateDetails` in `lib/health/quality-gate.ts`
- [x] T003 [P] Create Last Clean computation helper with `getLastCleanData(projectId)` returning `LastCleanDetails` in `lib/health/last-clean.ts`

**Checkpoint**: Foundation ready — type definitions and shared helpers available for all user stories

---

## Phase 3: User Story 1 — View Quality Gate Score on Health Dashboard (Priority: P1) 🎯 MVP

**Goal**: Display the Quality Gate card with 30-day average score, ticket count, trend indicator, and threshold distribution on the Health Dashboard

**Independent Test**: Ship tickets with quality scores, load Health page, verify card displays correct average, count, trend, and distribution

### Tests for User Story 1

- [x] T004 [P] [US1] Create unit tests for Quality Gate aggregation logic (average, trend, distribution) in `tests/unit/health/quality-gate.test.ts`
- [x] T005 [P] [US1] Create integration tests for Quality Gate details API endpoint in `tests/integration/health/quality-gate-details.test.ts`
- [x] T006 [P] [US1] Extend health score integration tests with 30-day average, trend, and distribution assertions in `tests/integration/health/health-score.test.ts`

### Implementation for User Story 1

- [x] T007 [US1] Create Quality Gate details API endpoint (`GET` handler with auth) in `app/api/projects/[projectId]/health/quality-gate/route.ts`
- [x] T008 [US1] Update health endpoint to use 30-day average from `getQualityGateData()`, add `ticketCount`, `trend`, `trendDelta`, `distribution` to qualityGate module response in `app/api/projects/[projectId]/health/route.ts`
- [x] T009 [US1] Update `HealthModuleCard` to render ticket count, trend arrow (up/down/stable with color), and threshold distribution for Quality Gate module in `components/health/health-module-card.tsx`
- [x] T010 [US1] Update global Health Score calculation to pass 30-day average `qualityGate` score and update `HealthScore.qualityGate` cache field in `app/api/projects/[projectId]/health/route.ts`

**Checkpoint**: Quality Gate card displays correct 30-day average, trend, and distribution. Global Health Score uses 30-day average.

---

## Phase 4: User Story 2 — Explore Quality Gate Details in Drawer (Priority: P2)

**Goal**: Clicking the Quality Gate card opens a detail drawer showing dimension averages, recent tickets with scores, and a trend chart

**Independent Test**: Click Quality Gate card, verify drawer displays dimension breakdown, ticket list, and trend chart

### Tests for User Story 2

- [x] T011 [P] [US2] Create component tests for Quality Gate drawer (dimensions, tickets, chart, empty/loading states) in `tests/unit/components/quality-gate-drawer.test.tsx`

### Implementation for User Story 2

- [x] T012 [P] [US2] Create `useQualityGateDetails` TanStack Query hook fetching `GET /api/projects/:projectId/health/quality-gate` in `app/lib/hooks/useQualityGateDetails.ts`
- [x] T013 [US2] Create `QualityGateDrawer` component with header (score badge, ticket count, trend), dimension breakdown (5 dimensions with bars), threshold distribution, Recharts trend chart, and recent tickets list in `components/health/drawer/quality-gate-drawer.tsx`
- [x] T014 [US2] Make Quality Gate card clickable by removing `ACTIVE_SCAN_SET` gate on `onClick` and routing clicks to `QualityGateDrawer` in `components/health/health-dashboard.tsx`

**Checkpoint**: Quality Gate card is clickable, drawer shows dimension breakdown, ticket list, and trend chart.

---

## Phase 5: User Story 3 — View Last Clean Status on Health Dashboard (Priority: P2)

**Goal**: Display the Last Clean card with cleanup date, file count summary, and staleness visual indicator (OK/warning/alert)

**Independent Test**: Run a cleanup job to completion, load Health page, verify card shows correct date, summary, and staleness status

### Tests for User Story 3

- [x] T015 [P] [US3] Create unit tests for Last Clean staleness calculation and output parsing in `tests/unit/health/last-clean.test.ts`
- [x] T016 [P] [US3] Create integration tests for Last Clean details API endpoint (staleness thresholds, graceful degradation, empty state) in `tests/integration/health/last-clean-details.test.ts`

### Implementation for User Story 3

- [x] T017 [US3] Create Last Clean details API endpoint (`GET` handler with auth) in `app/api/projects/[projectId]/health/last-clean/route.ts`
- [x] T018 [US3] Update health endpoint to add `stalenessStatus` and `filesCleaned` to lastClean module response in `app/api/projects/[projectId]/health/route.ts`
- [x] T019 [US3] Update `HealthModuleCard` to render staleness visual state (green/yellow/red border or background tint), file count, and days since cleanup for Last Clean module in `components/health/health-module-card.tsx`

**Checkpoint**: Last Clean card shows date, file count, and correct staleness visual indicator. Does NOT contribute to global Health Score.

---

## Phase 6: User Story 4 — Explore Last Clean Details in Drawer (Priority: P3)

**Goal**: Clicking the Last Clean card opens a detail drawer showing the latest cleanup summary and chronological cleanup history

**Independent Test**: Click Last Clean card, verify drawer shows latest cleanup summary and history list

### Tests for User Story 4

- [x] T020 [P] [US4] Create component tests for Last Clean drawer (staleness badge, history list, graceful degradation, empty state) in `tests/unit/components/last-clean-drawer.test.tsx`

### Implementation for User Story 4

- [x] T021 [P] [US4] Create `useLastCleanDetails` TanStack Query hook fetching `GET /api/projects/:projectId/health/last-clean` in `app/lib/hooks/useLastCleanDetails.ts`
- [x] T022 [US4] Create `LastCleanDrawer` component with header (date, staleness badge, days since), summary (files cleaned, remaining issues), and chronological history list in `components/health/drawer/last-clean-drawer.tsx`
- [x] T023 [US4] Make Last Clean card clickable by removing `ACTIVE_SCAN_SET` gate and routing clicks to `LastCleanDrawer` in `components/health/health-dashboard.tsx`

**Checkpoint**: Last Clean card is clickable, drawer shows cleanup summary and history.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Visual consistency, extended test coverage, and validation across all stories

- [x] T024 [P] Extend `HealthModuleCard` component tests with trend indicator, distribution, and staleness visual state assertions in `tests/unit/components/health-module-card.test.tsx`
- [x] T025 [P] Extend score calculator unit tests to verify 30-day average flows through correctly in `tests/unit/health/score-calculator.test.ts`
- [x] T026 Run `bun run type-check` and `bun run lint` to verify no type or lint errors across all changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Empty — skip
- **Foundational (Phase 2)**: BLOCKS all user stories — type definitions and shared helpers must be complete first
- **User Story 1 (Phase 3)**: Depends on Phase 2 — Quality Gate card + API + global score
- **User Story 2 (Phase 4)**: Depends on Phase 3 (T007 for the API endpoint) — Quality Gate drawer
- **User Story 3 (Phase 5)**: Depends on Phase 2 — can run in parallel with Phase 3
- **User Story 4 (Phase 6)**: Depends on Phase 5 (T017 for the API endpoint) — Last Clean drawer
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no dependencies on other stories
- **US2 (P2)**: After US1 (needs Quality Gate API endpoint from T007)
- **US3 (P2)**: After Phase 2 — independent of US1/US2, can run in parallel with Phase 3
- **US4 (P3)**: After US3 (needs Last Clean API endpoint from T017)

### Within Each User Story

- Tests written first (fail before implementation)
- Helpers/API before UI components
- Card updates before drawer components
- Core implementation before integration

### Parallel Opportunities

- T002 and T003 (Quality Gate helper + Last Clean helper) can run in parallel
- T004, T005, T006 (US1 tests) can all run in parallel
- T015 and T016 (US3 tests) can all run in parallel
- **Phase 3 (US1) and Phase 5 (US3) can run in parallel** after Phase 2
- **Phase 4 (US2) and Phase 6 (US4) can run in parallel** once their respective API endpoints exist

---

## Parallel Example: Foundational Phase

```bash
# After T001 completes, launch helpers in parallel:
Task: "Create Quality Gate computation helper in lib/health/quality-gate.ts"
Task: "Create Last Clean computation helper in lib/health/last-clean.ts"
```

## Parallel Example: US1 + US3 in parallel

```bash
# After Phase 2 completes, launch both story tracks:
Track A (US1): T004 → T005 → T006 → T007 → T008 → T009 → T010
Track B (US3): T015 → T016 → T017 → T018 → T019
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (types + helpers)
2. Complete Phase 3: User Story 1 (Quality Gate card + API + global score)
3. **STOP and VALIDATE**: Quality Gate card displays correct 30-day data
4. Deploy/demo if ready

### Incremental Delivery

1. Complete Phase 2 → Foundation ready
2. Add US1 (Phase 3) → Quality Gate card on dashboard (MVP!)
3. Add US2 (Phase 4) → Quality Gate drawer with details
4. Add US3 (Phase 5) → Last Clean card on dashboard
5. Add US4 (Phase 6) → Last Clean drawer with history
6. Complete Phase 7 → Polish and extended test coverage

### Parallel Execution Strategy

1. Complete Phase 2 sequentially (types first, then helpers in parallel)
2. Once Phase 2 is done, run US1 and US3 in parallel:
   - Track A: Quality Gate card + API + global score
   - Track B: Last Clean card + API
3. Once Track A done → US2 (Quality Gate drawer)
4. Once Track B done → US4 (Last Clean drawer)
5. Phase 7: Polish after all stories complete

---

## Notes

- No schema changes required — all data read from existing `Job`, `Ticket`, `HealthScore` models
- Recharts 2.x already in project — no new dependencies
- Quality Gate uses `DIMENSION_CONFIG` from `lib/quality-score.ts` for dimension names/weights
- Last Clean gracefully degrades when job `output` lacks structured data
- `ACTIVE_SCAN_SET` gate removal in `health-dashboard.tsx` enables passive module click handling
- All new API endpoints use `verifyProjectAccess()` for authorization
