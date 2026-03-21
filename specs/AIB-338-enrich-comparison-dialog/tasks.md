# Tasks: AIB-338 Enrich Comparison Dialog

**Input**: Design documents from `/specs/AIB-338-enrich-comparison-dialog/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/GET-comparison-detail.yaml`, `quickstart.md`
**Tests**: Tests are required for this feature because the specification and plan call for TDD-oriented unit, component, integration, and targeted E2E coverage.
**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Every task includes the exact file path to change or validate

## Phase 1: Setup

**Purpose**: Initialize feature-specific implementation context before shared code changes.

- [ ] T001 Refresh the agent context for this feature with `./.claude-plugin/scripts/bash/update-agent-context.sh` and validate the target docs in `specs/AIB-338-enrich-comparison-dialog/plan.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared DTOs and aggregation infrastructure required by all user stories.

**⚠️ CRITICAL**: Complete this phase before starting user story work.

- [ ] T002 [P] Extend comparison DTOs for operational metrics, model summaries, and quality detail payloads in `lib/types/comparison.ts`
- [ ] T003 [P] Update comparison component prop types for enriched participant data and inline tray state in `components/comparison/types.ts`
- [ ] T004 [P] Create the shared aggregation and best-value helper module in `lib/comparison/comparison-operational-metrics.ts`
- [ ] T005 Update participant normalization to attach operational aggregates and quality-detail eligibility in `lib/comparison/comparison-record.ts`
- [ ] T006 Update the comparison detail read path to fetch participant jobs, compute enriched aggregates, and return the new DTO shape in `lib/comparison/comparison-detail.ts`

**Checkpoint**: The API read model can now supply all enriched comparison data needed by the UI.

---

## Phase 3: User Story 1 - Compare operational efficiency across candidate implementations (Priority: P1) 🎯 MVP

**Goal**: Show ticket-level aggregated operational metrics, best-value highlighting, and correct pending/unavailable states directly in the comparison dialog.

**Independent Test**: Open a comparison with at least two tickets and confirm the dialog shows an `Operational Metrics` section with aggregated totals, best-value highlighting, and distinct pending versus not-available states.

### Tests for User Story 1

**NOTE**: Write these tests first and confirm they fail before implementation.

- [ ] T007 [P] [US1] Add aggregation and dominance edge-case coverage for totals, ties, and pending/unavailable classification in `tests/unit/comparison/comparison-detail-aggregation.test.ts`
- [ ] T008 [P] [US1] Extend the enriched comparison detail API expectations for operational aggregates in `tests/integration/comparisons/comparison-detail-route.test.ts`
- [ ] T009 [P] [US1] Add component coverage for the Operational Metrics grid rows, best badges, and pending/not-available labels in `tests/unit/components/comparison-operational-metrics.test.tsx`

### Implementation for User Story 1

- [ ] T010 [US1] Return the enriched comparison detail contract from `GET /api/projects/[projectId]/tickets/[id]/comparisons/[comparisonId]` in `app/api/projects/[projectId]/tickets/[id]/comparisons/[comparisonId]/route.ts`
- [ ] T011 [US1] Carry the enriched comparison detail payload through the client query layer in `hooks/use-comparisons.ts`
- [ ] T012 [US1] Implement the Operational Metrics section with metric rows, best-value rendering, and quality summary cells in `components/comparison/comparison-operational-metrics.tsx`
- [ ] T013 [US1] Insert the new `Operational Metrics` section after `Implementation Metrics` while preserving the remaining section order in `components/comparison/comparison-viewer.tsx`

**Checkpoint**: User Story 1 is complete when operational efficiency can be compared side by side without leaving the dialog.

---

## Phase 4: User Story 2 - Understand ranking context without opening secondary views (Priority: P2)

**Goal**: Enrich ranking cards and operational column headers with workflow, agent, and quality context so users can interpret results immediately.

**Independent Test**: Open a comparison with mixed workflow types and agents and confirm each ranking card shows workflow type, agent context when present, and compact quality score/threshold context without losing existing ranking content.

### Tests for User Story 2

- [ ] T014 [P] [US2] Extend ranking-card component coverage for workflow badges, agent labels, and compact quality context in `tests/unit/components/comparison-ranking.test.tsx`
- [ ] T015 [P] [US2] Extend Operational Metrics header coverage for ticket key, workflow type, agent, and model context in `tests/unit/components/comparison-operational-metrics.test.tsx`

### Implementation for User Story 2

- [ ] T016 [US2] Render workflow type, agent context, and quality threshold badges in ranking cards in `components/comparison/comparison-ranking.tsx`
- [ ] T017 [US2] Render ticket key, workflow type, agent context, and dominant-model/multi-model labels in the Operational Metrics column headers in `components/comparison/comparison-operational-metrics.tsx`

**Checkpoint**: User Story 2 is complete when ranking context is visible in the dialog without opening any secondary surfaces.

---

## Phase 5: User Story 3 - Inspect quality details in place (Priority: P3)

**Goal**: Let users open an inline quality-detail tray for eligible FULL workflow tickets while preserving responsive readability from two to six columns.

**Independent Test**: Open a comparison with at least one eligible FULL workflow ticket and confirm the quality cell opens an inline tray with the summary, threshold, and dimension breakdown, while ineligible tickets remain non-interactive and the dialog stays horizontally navigable on desktop and mobile.

### Tests for User Story 3

- [ ] T018 [P] [US3] Extend the comparison detail API coverage for quality-detail eligibility and summary-only states in `tests/integration/comparisons/comparison-detail-route.test.ts`
- [ ] T019 [P] [US3] Add component coverage for inline quality-detail tray behavior and non-interactive cells in `tests/unit/components/comparison-operational-metrics.test.tsx`
- [ ] T020 [P] [US3] Add a focused browser scenario for comparison-dialog horizontal scrolling and inline quality inspection in `tests/e2e/comparison-dialog.spec.ts`

### Implementation for User Story 3

- [ ] T021 [US3] Add inline quality-detail tray interactions, eligibility gating, and detail rendering in `components/comparison/comparison-operational-metrics.tsx`
- [ ] T022 [US3] Manage the selected quality-detail state inside the dialog without nested modals in `components/comparison/comparison-viewer.tsx`

**Checkpoint**: User Story 3 is complete when eligible tickets expose in-place quality details and the dialog remains readable across supported viewport sizes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final regression coverage, validation, and repository gates across all stories.

- [ ] T023 [P] Extend dashboard regression coverage for section order and coexistence of comparison sections in `tests/unit/components/comparison-dashboard-sections.test.tsx`
- [ ] T024 [P] Execute the feature validation checklist from `specs/AIB-338-enrich-comparison-dialog/quickstart.md` and fix any issues in `components/comparison/`, `lib/comparison/`, `hooks/use-comparisons.ts`, and `app/api/projects/[projectId]/tickets/[id]/comparisons/[comparisonId]/route.ts`
- [ ] T025 Resolve final type and lint issues in `components/comparison/comparison-ranking.tsx`, `components/comparison/comparison-viewer.tsx`, `components/comparison/comparison-operational-metrics.tsx`, `lib/comparison/comparison-detail.ts`, and `lib/types/comparison.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) has no dependencies and starts immediately.
- Foundational (Phase 2) depends on Setup and blocks all user stories.
- User Story 1 (Phase 3) depends on Foundational because it establishes the enriched API contract and first consumer UI.
- User Story 2 (Phase 4) depends on Foundational and should follow User Story 1 because it reuses the enriched payload and the new operational component.
- User Story 3 (Phase 5) depends on User Story 1 because the inline tray lives inside the Operational Metrics section.
- Polish (Phase 6) depends on all implemented user stories.

### User Story Dependency Graph

- `US1 -> US2 -> US3` is the recommended completion order.
- `US2` can begin after Phase 2 if the team accepts parallel coordination on `components/comparison/comparison-operational-metrics.tsx`.
- `US3` should wait for `US1` because it extends the quality row and scrollable layout introduced there.

### Within Each User Story

- Write failing tests before implementation tasks.
- Complete server/data tasks before client rendering tasks when both are in the same story.
- Finish story-specific UI integration before moving to the next story’s polish.

### Parallel Opportunities

- `T002`, `T003`, and `T004` can run together after `T001`.
- `T007`, `T008`, and `T009` can run together for User Story 1.
- `T014` and `T015` can run together for User Story 2.
- `T018`, `T019`, and `T020` can run together for User Story 3.
- `T023` and `T024` can run together in the polish phase.

---

## Parallel Example: User Story 1

```bash
Task: "Add aggregation and dominance edge-case coverage in tests/unit/comparison/comparison-detail-aggregation.test.ts"
Task: "Extend the enriched comparison detail API expectations in tests/integration/comparisons/comparison-detail-route.test.ts"
Task: "Add component coverage for the Operational Metrics grid in tests/unit/components/comparison-operational-metrics.test.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "Extend ranking-card component coverage in tests/unit/components/comparison-ranking.test.tsx"
Task: "Extend Operational Metrics header coverage in tests/unit/components/comparison-operational-metrics.test.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "Extend API coverage for quality-detail eligibility in tests/integration/comparisons/comparison-detail-route.test.ts"
Task: "Add component coverage for inline quality-detail tray behavior in tests/unit/components/comparison-operational-metrics.test.tsx"
Task: "Add a focused browser scenario in tests/e2e/comparison-dialog.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete all User Story 1 tests and implementation tasks.
3. Validate the dialog against the User Story 1 independent test before moving on.

### Incremental Delivery

1. Deliver `US1` to establish the enriched API payload and new Operational Metrics section.
2. Layer `US2` on top of the same payload to improve ranking interpretability.
3. Finish with `US3` to add inline detail inspection and responsive browser validation.

### Parallel Execution Strategy

1. Run Setup, then complete the Foundational phase in sequence.
2. Parallelize only the tasks marked `[P]` inside each phase.
3. Avoid parallelizing `T017` and `T021` because both modify `components/comparison/comparison-operational-metrics.tsx`.

---

## Notes

- All checklist items follow the required `- [ ] T### [P] [US#] Description with file path` format.
- Tests are intentionally included because the design artifacts explicitly require TDD-style validation.
- The suggested MVP scope is Phase 3 (`US1`) because it delivers the primary comparison value on its own.
