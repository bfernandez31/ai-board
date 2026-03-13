# Tasks: Analytics Filters by Agent and Status, Period-Aware Shipped Card

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-288-analytics-filtres-agent/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-288-analytics-filtres-agent/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-288-analytics-filtres-agent/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-288-analytics-filtres-agent/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-288-analytics-filtres-agent/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-288-analytics-filtres-agent/contracts/analytics-filters-api.yaml`

**Tests**: Vitest coverage is required by the implementation plan. Include integration tests for the analytics API, unit tests for filter/query-key helpers, and component tests for dashboard controls and summary cards.

**Organization**: Tasks are grouped by user story so each increment can be implemented and validated independently once the shared analytics foundation is in place.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel with other tasks in the same phase because it touches different files and has no dependency on unfinished tasks
- **[Story]**: Maps implementation work to a specific user story (`[US1]`, `[US2]`, `[US3]`)
- Every task below includes an exact repository file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared test harnesses and UI test entry points used across the analytics filter work

- [ ] T001 Create analytics API integration test scaffold in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/analytics.test.ts
- [ ] T002 [P] Create analytics contract test scaffold for filter query permutations in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/analytics-contract.test.ts
- [ ] T003 [P] Create analytics dashboard component test scaffold in /home/runner/work/ai-board/ai-board/target/tests/unit/components/analytics-dashboard.test.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared filter model, cache keys, and server-side normalization that every user story depends on

**⚠️ CRITICAL**: Complete this phase before starting user story implementation

- [ ] T004 Define shared analytics filter, agent option, and overview response types in /home/runner/work/ai-board/ai-board/target/lib/analytics/types.ts
- [ ] T005 [P] Extend analytics React Query cache keys for range, statusScope, and agentScope in /home/runner/work/ai-board/ai-board/target/app/lib/query-keys.ts
- [ ] T006 [P] Add unit coverage for analytics filter normalization and period-label helpers in /home/runner/work/ai-board/ai-board/target/tests/unit/analytics-filter-state.test.ts
- [ ] T007 Implement range, statusScope, and agentScope query parsing with Zod validation in /home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/analytics/route.ts
- [ ] T008 Implement shared filter-aware analytics query primitives and available-agent lookup in /home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts

**Checkpoint**: The analytics endpoint can normalize all filters, cache entries can segment by full filter state, and story work can proceed safely

---

## Phase 3: User Story 1 - Analyze Delivered Work Only by Default (Priority: P1) 🎯 MVP

**Goal**: Make shipped-only the default analytics scope and ensure every chart and summary stays synchronized when the status filter changes

**Independent Test**: Open analytics for a project with both shipped and closed tickets, confirm the default view is shipped-only, then switch to `closed` and `shipped+closed` and verify every metric changes coherently with zero stale data

### Tests for User Story 1 ⚠️

- [ ] T009 [P] [US1] Add contract assertions for shipped, closed, and shipped+closed query responses in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/analytics-contract.test.ts
- [ ] T010 [P] [US1] Add integration coverage for shipped-only defaults, status-only filtering, and zero-match states in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/analytics.test.ts

### Implementation for User Story 1

- [ ] T011 [US1] Update the analytics API contract for statusScope filters and normalized filter metadata in /home/runner/work/ai-board/ai-board/target/specs/AIB-288-analytics-filtres-agent/contracts/analytics-filters-api.yaml
- [ ] T012 [US1] Apply status-scope inclusion rules to all analytics aggregations in /home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts
- [ ] T013 [US1] Thread statusScope through the initial analytics page load in /home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/analytics/page.tsx
- [ ] T014 [US1] Add a shared status filter control and synchronized refetch flow in /home/runner/work/ai-board/ai-board/target/components/analytics/analytics-dashboard.tsx

**Checkpoint**: User Story 1 is complete when the default shipped-only analytics view is correct and status changes refresh the entire dashboard as one filtered slice

---

## Phase 4: User Story 2 - Compare Analytics by Agent (Priority: P1)

**Goal**: Let stakeholders scope the dashboard to one agent or all agents while keeping the agent list stable across date-range changes

**Independent Test**: Load a project with jobs from multiple agents, verify the default `all` scope, select a specific agent, and confirm all summaries and charts update to that agent only while agents with no activity in the active period still remain selectable

### Tests for User Story 2 ⚠️

- [ ] T015 [P] [US2] Add integration coverage for agentScope filtering and stable availableAgents metadata in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/analytics.test.ts
- [ ] T016 [P] [US2] Add query-key coverage for agentScope-specific cache entries in /home/runner/work/ai-board/ai-board/target/tests/unit/query-keys.test.ts

### Implementation for User Story 2

- [ ] T017 [US2] Add effective-agent derivation and project-wide available-agent options to analytics queries in /home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts
- [ ] T018 [US2] Thread agentScope through server-rendered analytics page state in /home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/analytics/page.tsx
- [ ] T019 [US2] Add an agent filter control and URL/query synchronization in /home/runner/work/ai-board/ai-board/target/components/analytics/analytics-dashboard.tsx

**Checkpoint**: User Story 2 is complete when any agent selection produces a fully scoped dashboard and the selector remains stable across time-range changes

---

## Phase 5: User Story 3 - See Period-Accurate Ticket Totals (Priority: P2)

**Goal**: Replace the fixed monthly shipped summary with period-aware shipped and closed summary cards whose counts and labels match the active filters

**Independent Test**: Switch between `7d`, `30d`, `90d`, and `all`, and verify that shipped and closed summary cards both update values and labels to match the selected period while still honoring status and agent filters

### Tests for User Story 3 ⚠️

- [ ] T020 [P] [US3] Add integration coverage for period-aware shipped and closed summary counts across all supported ranges in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/analytics.test.ts
- [ ] T021 [P] [US3] Add component coverage for shipped and closed summary card labels in /home/runner/work/ai-board/ai-board/target/tests/unit/components/overview-cards.test.tsx

### Implementation for User Story 3

- [ ] T022 [US3] Compute shippedCount, closedCount, and ticket period labels from the active filter state in /home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts
- [ ] T023 [US3] Render period-aware shipped and closed summary cards in /home/runner/work/ai-board/ai-board/target/components/analytics/overview-cards.tsx
- [ ] T024 [US3] Surface period-aware ticket summary data through the dashboard props and empty-state handling in /home/runner/work/ai-board/ai-board/target/components/analytics/analytics-dashboard.tsx

**Checkpoint**: User Story 3 is complete when ticket summaries always match the active range, status scope, and agent scope with accurate labels

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish validation, documentation, and regression protection across all stories

- [ ] T025 [P] Document manual verification for status, agent, and period filters in /home/runner/work/ai-board/ai-board/target/specs/AIB-288-analytics-filtres-agent/quickstart.md
- [ ] T026 Refine no-match filter messaging for shared analytics empty states in /home/runner/work/ai-board/ai-board/target/components/analytics/empty-state.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies and can start immediately
- **Phase 2: Foundational** depends on Phase 1 and blocks all user story work
- **Phase 3: US1** depends on Phase 2 and delivers the MVP baseline
- **Phase 4: US2** depends on Phase 2 and builds on the shared filter contract introduced in US1
- **Phase 5: US3** depends on Phase 2 and reuses the filter state delivered in US1 and US2 for period-aware summaries
- **Phase 6: Polish** depends on the user stories you choose to ship

### User Story Dependencies

- **US1 (P1)**: Starts first after Foundational because it establishes the default status-scoped analytics behavior
- **US2 (P1)**: Can begin after Foundational, but integration risk is lowest if it lands after US1 because both stories edit the same analytics query and dashboard files
- **US3 (P2)**: Should land after US1 because it relies on the finalized shared filter state; it can follow US2 or proceed once the shared query outputs are stable

### Within Each User Story

- Tests must be written and failing before implementation tasks begin
- Contract and integration coverage come before API/UI changes
- Query-layer updates come before page-state and component wiring
- Shared file edits in `lib/analytics/queries.ts` and `components/analytics/analytics-dashboard.tsx` should stay sequential within each story

### Parallel Opportunities

- `T002` and `T003` can run alongside `T001` during setup
- `T005` and `T006` can run in parallel after `T004`
- `T009` and `T010` can run in parallel inside US1
- `T015` and `T016` can run in parallel inside US2
- `T020` and `T021` can run in parallel inside US3
- `T025` can run independently once implementation stabilizes

---

## Parallel Example: User Story 1

```bash
Task: "T009 [US1] Add contract assertions for shipped, closed, and shipped+closed query responses in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/analytics-contract.test.ts"
Task: "T010 [US1] Add integration coverage for shipped-only defaults, status-only filtering, and zero-match states in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/analytics.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T015 [US2] Add integration coverage for agentScope filtering and stable availableAgents metadata in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/analytics.test.ts"
Task: "T016 [US2] Add query-key coverage for agentScope-specific cache entries in /home/runner/work/ai-board/ai-board/target/tests/unit/query-keys.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T020 [US3] Add integration coverage for period-aware shipped and closed summary counts across all supported ranges in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/analytics.test.ts"
Task: "T021 [US3] Add component coverage for shipped and closed summary card labels in /home/runner/work/ai-board/ai-board/target/tests/unit/components/overview-cards.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate shipped-only defaults, status changes, and zero-state behavior before expanding scope

### Incremental Delivery

1. Ship Setup + Foundational so the analytics stack understands the full filter model
2. Ship US1 to establish coherent status-scoped analytics across the whole dashboard
3. Ship US2 to add agent segmentation without changing the meaning of existing metrics
4. Ship US3 to make shipped and closed summary cards period-aware and label-correct
5. Finish with quickstart updates and regression execution

### Parallel Execution Strategy

1. Run setup and foundational work sequentially where files overlap
2. Parallelize only test tasks and independent helper updates marked `[P]`
3. Keep edits to `lib/analytics/queries.ts`, `app/projects/[projectId]/analytics/page.tsx`, and `components/analytics/analytics-dashboard.tsx` serialized to avoid merge conflicts

---

## Notes

- All tasks use the required checklist format: checkbox, task ID, optional `[P]`, required story label for user story phases, and an exact file path
- Tests are included because the spec and plan explicitly require Vitest-first coverage for this feature
- The recommended MVP scope is Phase 3 (`US1`) after Setup and Foundational are complete
