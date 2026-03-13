# Tasks: Analytics Filters and Dynamic Shipping Metrics

**Input**: Design documents from `/specs/AIB-289-copy-of-analytics/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/analytics-api.yaml, quickstart.md

**Tests**: Include Vitest unit and integration coverage because the specification and plan explicitly require analytics-focused tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align shared analytics types, defaults, and test scaffolding before query and UI work begins.

- [ ] T001 Audit existing analytics implementation touchpoints in `lib/analytics/types.ts`, `lib/analytics/aggregations.ts`, `lib/analytics/queries.ts`, `app/api/projects/[projectId]/analytics/route.ts`, `app/lib/query-keys.ts`, `app/projects/[projectId]/analytics/page.tsx`, `components/analytics/analytics-dashboard.tsx`, `components/analytics/overview-cards.tsx`, and `components/analytics/empty-state.tsx`
- [ ] T002 [P] Add canonical analytics filter unions, defaults, agent metadata, and completion metric types in `lib/analytics/types.ts`
- [ ] T003 [P] Add shared range-label and filter helper exports in `lib/analytics/aggregations.ts`
- [ ] T004 [P] Prepare analytics test fixtures/helpers for mixed outcomes and agents in `tests/integration/analytics/analytics-route.test.ts` and `tests/unit/components/analytics-dashboard.test.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the shared query, API, and cache foundations that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Refactor `getAnalyticsData` inputs and shared filter application flow in `lib/analytics/queries.ts`
- [ ] T006 Implement reusable Prisma filter builders for range, outcome membership, and effective agent resolution in `lib/analytics/queries.ts`
- [ ] T007 Implement project-scoped available-agent derivation and filter echo metadata in `lib/analytics/queries.ts`
- [ ] T008 Expand analytics response shaping for `filters`, `availableAgents`, `ticketsShipped`, `ticketsClosed`, `jobCount`, and `hasData` in `lib/analytics/queries.ts`
- [ ] T009 Validate `range`, `outcome`, and `agent` query params with Zod and wire the expanded analytics service in `app/api/projects/[projectId]/analytics/route.ts`
- [ ] T010 Update analytics React Query keys to include `range`, `outcome`, and `agent` in `app/lib/query-keys.ts`
- [ ] T011 Parse all analytics filter search params and hydrate initial filter state in `app/projects/[projectId]/analytics/page.tsx`

**Checkpoint**: Foundation ready - one analytics endpoint returns the full filtered payload and the page can hydrate all filter dimensions consistently.

---

## Phase 3: User Story 1 - Filter Analytics by Ticket Outcome (Priority: P1) 🎯 MVP

**Goal**: Let users switch analytics between shipped, closed, and combined completed tickets without any chart or metric drifting out of sync.

**Independent Test**: Load analytics, switch `outcome` among `shipped`, `closed`, and `all-completed`, and verify the overview metrics and every chart update from the same filtered dataset with no stale values.

### Tests for User Story 1

- [ ] T012 [P] [US1] Add integration coverage for shipped, closed, and all-completed API filtering in `tests/integration/analytics/analytics-route.test.ts`
- [ ] T013 [P] [US1] Add query-key coverage for the outcome filter dimension in `tests/unit/query-keys.test.ts`
- [ ] T014 [P] [US1] Add dashboard filter-state coverage for outcome selection and stale-data prevention in `tests/unit/components/analytics-dashboard.test.tsx`

### Implementation for User Story 1

- [ ] T015 [US1] Update outcome-aware job, stage, tool, token, workflow, and velocity aggregations in `lib/analytics/queries.ts`
- [ ] T016 [US1] Add the outcome selector UI and single-path filter state updates in `components/analytics/analytics-dashboard.tsx`
- [ ] T017 [US1] Propagate the selected outcome through analytics fetches, URL params, and child chart props in `components/analytics/analytics-dashboard.tsx`

**Checkpoint**: User Story 1 is independently functional when outcome changes refresh the entire dashboard coherently.

---

## Phase 4: User Story 2 - Filter Analytics by Agent (Priority: P1)

**Goal**: Let users compare all agents versus one effective agent using only agents with project job history.

**Independent Test**: Open a project with mixed Claude and Codex history, confirm the agent selector lists `all` plus only present agents, then switch agents and verify all dashboard metrics and charts recalculate correctly.

### Tests for User Story 2

- [ ] T018 [P] [US2] Add integration coverage for effective-agent filtering and available agent options in `tests/integration/analytics/analytics-route.test.ts`
- [ ] T019 [P] [US2] Add query-key coverage for the agent filter dimension in `tests/unit/query-keys.test.ts`
- [ ] T020 [P] [US2] Add dashboard coverage for agent option rendering and agent-specific refresh behavior in `tests/unit/components/analytics-dashboard.test.tsx`

### Implementation for User Story 2

- [ ] T021 [US2] Apply effective-agent filtering across all job-backed analytics queries in `lib/analytics/queries.ts`
- [ ] T022 [US2] Add the agent selector, default all-agents behavior, and available-agent wiring in `components/analytics/analytics-dashboard.tsx`
- [ ] T023 [US2] Ensure analytics child components receive agent-aware empty-state context from `components/analytics/analytics-dashboard.tsx` and `components/analytics/empty-state.tsx`

**Checkpoint**: User Story 2 is independently functional when the dashboard can isolate analytics to one effective agent without exposing irrelevant filter options.

---

## Phase 5: User Story 3 - Read Period-Accurate Completion Cards (Priority: P1)

**Goal**: Replace the month-based shipped card with period-accurate shipped and closed cards that always match the active range.

**Independent Test**: Switch among `7d`, `30d`, `90d`, and `all`, then verify shipped and closed overview cards both update counts and labels to match the selected period.

### Tests for User Story 3

- [ ] T024 [P] [US3] Add integration coverage for range-accurate shipped and closed completion metrics in `tests/integration/analytics/analytics-route.test.ts`
- [ ] T025 [P] [US3] Add dashboard coverage for completion-card label updates across time ranges in `tests/unit/components/analytics-dashboard.test.tsx`

### Implementation for User Story 3

- [ ] T026 [US3] Replace month-based completion calculations with range-aware shipped and closed metrics in `lib/analytics/queries.ts`
- [ ] T027 [US3] Update overview card formatting and labels for separate shipped and closed metrics in `components/analytics/overview-cards.tsx`
- [ ] T028 [US3] Ensure initial page hydration and client refresh both surface the period-accurate completion metrics in `app/projects/[projectId]/analytics/page.tsx` and `components/analytics/analytics-dashboard.tsx`

**Checkpoint**: User Story 3 is independently functional when completion cards stay accurate for every supported time range.

---

## Phase 6: User Story 4 - Understand Empty and Sparse Results (Priority: P2)

**Goal**: Show filter-aware empty states per section while keeping valid overview information visible.

**Independent Test**: Select filters that produce no matching jobs or only partial data and verify populated sections still render, empty sections explain the current filtered absence, and no stale results remain visible.

### Tests for User Story 4

- [ ] T029 [P] [US4] Add integration coverage for no-job filter combinations that still return zeroed completion metrics in `tests/integration/analytics/analytics-route.test.ts`
- [ ] T030 [P] [US4] Add dashboard coverage for per-section empty states and overview persistence in `tests/unit/components/analytics-dashboard.test.tsx`

### Implementation for User Story 4

- [ ] T031 [US4] Remove the dashboard-level no-data bailout and keep section rendering keyed to the active payload in `components/analytics/analytics-dashboard.tsx`
- [ ] T032 [US4] Update filter-aware empty copy and sparse-state behavior in `components/analytics/empty-state.tsx`, `components/analytics/cost-over-time-chart.tsx`, `components/analytics/cost-by-stage-chart.tsx`, `components/analytics/token-usage-chart.tsx`, `components/analytics/cache-efficiency-chart.tsx`, `components/analytics/top-tools-chart.tsx`, `components/analytics/workflow-distribution-chart.tsx`, and `components/analytics/velocity-chart.tsx`
- [ ] T033 [US4] Align `hasData` semantics with job-backed sections only while preserving completion cards in `lib/analytics/queries.ts` and `components/analytics/analytics-dashboard.tsx`

**Checkpoint**: User Story 4 is independently functional when empty combinations are clearly explained without hiding valid completion data.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and cross-story consistency.

- [ ] T034 [P] Normalize filter labels, selector copy, and shared helper usage across `components/analytics/analytics-dashboard.tsx`, `components/analytics/overview-cards.tsx`, and `lib/analytics/aggregations.ts`
- [ ] T035 [P] Run the analytics validation sequence from `specs/AIB-289-copy-of-analytics/quickstart.md` by updating any missing assertions in `tests/unit/query-keys.test.ts`, `tests/unit/components/analytics-dashboard.test.tsx`, and `tests/integration/analytics/analytics-route.test.ts`
- [ ] T036 Run `bun run test:unit`, `bun run test:integration -- analytics`, `bun run type-check`, and `bun run lint` from `/home/runner/work/ai-board/ai-board/target`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational completion
- **Polish (Phase 7)**: Depends on all targeted user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational - establishes coherent outcome-filtered analytics behavior
- **User Story 2 (P1)**: Starts after Foundational and benefits from US1 filter wiring in `components/analytics/analytics-dashboard.tsx`, but remains independently testable once merged
- **User Story 3 (P1)**: Starts after Foundational and can proceed alongside US1/US2 because its core work is in overview metrics
- **User Story 4 (P2)**: Starts after US1, US2, and US3 because empty-state behavior depends on the final filter payload and completion-card semantics

### Recommended Story Order

1. US1 - Outcome filtering
2. US2 - Agent filtering
3. US3 - Period-accurate completion cards
4. US4 - Empty and sparse results

### Within Each User Story

- Tests MUST be written and fail before implementation
- Query/data changes before UI wiring that depends on them
- Dashboard integration before polish for that story

### Parallel Opportunities

- T002, T003, and T004 can run in parallel during Setup
- T012, T013, and T014 can run in parallel for US1
- T018, T019, and T020 can run in parallel for US2
- T024 and T025 can run in parallel for US3
- T029 and T030 can run in parallel for US4
- T034 and T035 can run in parallel during Polish

---

## Parallel Example: User Story 1

```bash
Task: "Add integration coverage for shipped, closed, and all-completed API filtering in tests/integration/analytics/analytics-route.test.ts"
Task: "Add query-key coverage for the outcome filter dimension in tests/unit/query-keys.test.ts"
Task: "Add dashboard filter-state coverage for outcome selection and stale-data prevention in tests/unit/components/analytics-dashboard.test.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "Add integration coverage for effective-agent filtering and available agent options in tests/integration/analytics/analytics-route.test.ts"
Task: "Add query-key coverage for the agent filter dimension in tests/unit/query-keys.test.ts"
Task: "Add dashboard coverage for agent option rendering and agent-specific refresh behavior in tests/unit/components/analytics-dashboard.test.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "Add integration coverage for range-accurate shipped and closed completion metrics in tests/integration/analytics/analytics-route.test.ts"
Task: "Add dashboard coverage for completion-card label updates across time ranges in tests/unit/components/analytics-dashboard.test.tsx"
```

## Parallel Example: User Story 4

```bash
Task: "Add integration coverage for no-job filter combinations that still return zeroed completion metrics in tests/integration/analytics/analytics-route.test.ts"
Task: "Add dashboard coverage for per-section empty states and overview persistence in tests/unit/components/analytics-dashboard.test.tsx"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate outcome-filtered analytics independently before expanding scope

### Incremental Delivery

1. Setup + Foundational establish the shared payload, filters, and cache semantics
2. Deliver US1 so the dashboard outcome filter works end to end
3. Deliver US2 so agent-specific analysis works on the same payload
4. Deliver US3 so overview completion metrics become range-accurate
5. Deliver US4 so narrow filters degrade cleanly with section-level empty states
6. Finish with cross-cutting validation and regression checks

### Suggested MVP Scope

- **MVP**: Phase 1 + Phase 2 + Phase 3 (US1 only)
- **Why**: US1 fixes the core analytics credibility issue by making the primary outcome filter coherent across the entire dashboard

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Tasks** | 36 |
| **Setup Tasks** | 4 |
| **Foundational Tasks** | 7 |
| **US1 Tasks** | 6 |
| **US2 Tasks** | 6 |
| **US3 Tasks** | 5 |
| **US4 Tasks** | 5 |
| **Polish Tasks** | 3 |
| **Parallelizable Tasks** | 15 |

### Independent Test Criteria

- **US1**: Outcome selector updates all metrics and charts to the same shipped, closed, or combined dataset without stale data
- **US2**: Agent selector shows only project agents plus `all`, and every metric/chart recalculates for the selected effective agent
- **US3**: Shipped and closed cards both change counts and period labels correctly for `7d`, `30d`, `90d`, and `all`
- **US4**: Empty combinations show per-section no-data states while valid overview completion metrics remain visible

### Parallel Opportunities Identified

- Shared setup helper work can start in parallel
- Test-first tasks inside each story can be parallelized
- Polish validation prep can run in parallel before the final command suite

### Format Validation

All checklist tasks use the required `- [ ] T### [P?] [Story?] Description with file path` format.
