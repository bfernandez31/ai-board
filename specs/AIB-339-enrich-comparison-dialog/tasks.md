# Tasks: Enrich comparison dialog with operational metrics and quality data

**Input**: Design documents from `/specs/AIB-339-enrich-comparison-dialog/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included because the feature plan explicitly requires unit, component, and integration coverage for each user story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish shared comparison contracts that all server and UI changes will use.

- [X] T001 Expand comparison detail contracts for operational metrics, quality summaries, and breakdown payloads in `lib/types/comparison.ts`
- [X] T002 [P] Update shared comparison component prop/types for the enriched participant shape in `components/comparison/types.ts`

**Checkpoint**: Shared comparison types are ready for API and UI work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared read-model plumbing that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Implement shared operational aggregation helpers for metric states, best-value selection, and primary-model tie-breaking in `lib/comparison/comparison-detail.ts`
- [X] T004 Update comparison participant normalization to emit operational and quality read models in `lib/comparison/comparison-record.ts`
- [X] T005 Wire the expanded comparison detail response through `app/api/projects/[projectId]/tickets/[id]/comparisons/[comparisonId]/route.ts`

**Checkpoint**: The enriched comparison detail payload is ready for story-specific tests and UI work.

---

## Phase 3: User Story 1 - Compare implementation efficiency at a glance (Priority: P1) 🎯 MVP

**Goal**: Show aggregated operational metrics and richer ranking metadata so users can compare efficiency and cost beside existing code metrics.

**Independent Test**: Open a saved comparison with multiple completed tickets and confirm the dialog shows the Ranking section first, the Operational Metrics section after Implementation Metrics, correct best-value emphasis, and the expected ticket metadata in each comparison column.

### Tests for User Story 1 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [X] T006 [P] [US1] Add aggregation unit coverage for totals, pending/unavailable states, best-value flags, and primary-model selection in `tests/unit/comparison/comparison-detail.test.ts`
- [X] T007 [P] [US1] Add ranking card rendering coverage for workflow type, optional agent, and quality summary in `tests/unit/components/comparison-ranking.test.tsx`
- [X] T008 [P] [US1] Add integration coverage for enriched operational metrics on the comparison detail route in `tests/integration/comparisons/comparison-detail-route.test.ts`

### Implementation for User Story 1

- [X] T009 [US1] Aggregate total tokens, input tokens, output tokens, duration, cost, and job count across all participant jobs in `lib/comparison/comparison-detail.ts`
- [X] T010 [US1] Map aggregated operational data and best-value flags onto the comparison detail payload in `lib/comparison/comparison-record.ts`
- [X] T011 [US1] Update ranking cards to always show workflow type plus optional agent and quality threshold metadata in `components/comparison/comparison-ranking.tsx`
- [X] T012 [US1] Create the operational metrics grid with participant headers, metric rows, and best-value emphasis in `components/comparison/comparison-operational-metrics-grid.tsx`
- [X] T013 [US1] Insert the Operational Metrics section after Implementation Metrics in `components/comparison/comparison-viewer.tsx`

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Understand quality results without leaving the dialog (Priority: P2)

**Goal**: Let users inspect a complete quality score breakdown inline from the comparison dialog when a participant is eligible.

**Independent Test**: Open a comparison containing one eligible FULL-workflow ticket with a completed verify result and confirm the inline detail view opens with overall score, threshold label, and all five weighted dimensions, while ineligible tickets offer no interaction.

### Tests for User Story 2 ⚠️

- [X] T014 [P] [US2] Add unit coverage for FULL-workflow verify eligibility and five-dimension quality parsing in `tests/unit/comparison/comparison-quality-eligibility.test.ts`
- [X] T015 [P] [US2] Add component coverage for inline quality breakdown interaction and ineligible quality cells in `tests/unit/components/comparison-operational-quality-breakdown.test.tsx`
- [X] T016 [P] [US2] Add integration coverage for eligible and ineligible comparison quality payloads in `tests/integration/comparisons/comparison-detail-quality.test.ts`

### Implementation for User Story 2

- [X] T017 [US2] Enforce comparison-specific quality breakdown eligibility and threshold derivation in `lib/comparison/comparison-detail.ts`
- [X] T018 [US2] Serialize quality breakdown payloads and detail-availability flags for each participant in `lib/comparison/comparison-record.ts`
- [X] T019 [US2] Add inline quality detail rendering that reuses dimension metadata from `lib/quality-score.ts` in `components/comparison/comparison-operational-metrics-grid.tsx`

**Checkpoint**: User Stories 1 and 2 are both functional, and quality breakdown review stays inside the dialog.

---

## Phase 5: User Story 3 - Compare larger sets of tickets on any device (Priority: P3)

**Goal**: Keep the comparison dialog readable for 2-6 participants on desktop and mobile, with a visible metric label column during horizontal scrolling.

**Independent Test**: Open a six-ticket comparison on desktop and a mobile-sized viewport and confirm the metric label column stays visible while the participant columns scroll horizontally without overlapping or obscuring critical values.

### Tests for User Story 3 ⚠️

- [X] T020 [P] [US3] Add component coverage for sticky metric labels and six-column overflow behavior in `tests/unit/components/comparison-operational-metrics-layout.test.tsx`
- [X] T021 [P] [US3] Add integration coverage for 2-6 participant headers and scroll-ready payload shapes in `tests/integration/comparisons/comparison-dashboard-api.test.ts`

### Implementation for User Story 3

- [X] T022 [US3] Add sticky first-column, min-width column sizing, and native horizontal scrolling styles in `components/comparison/comparison-operational-metrics-grid.tsx`
- [X] T023 [US3] Tune comparison dialog section layout for desktop and mobile readability in `components/comparison/comparison-viewer.tsx`

**Checkpoint**: All three user stories are independently testable and support 2-6 ticket comparisons.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, validation, and quickstart-driven verification across all stories.

- [X] T024 [P] Reconcile section ordering, best-value copy, and `Pending`/`N/A` states across `components/comparison/comparison-viewer.tsx` and `components/comparison/comparison-operational-metrics-grid.tsx`
- [X] T025 [P] Run the comparison dialog verification checklist in `specs/AIB-339-enrich-comparison-dialog/quickstart.md`
- [X] T026 Run targeted comparison test suites referenced by `specs/AIB-339-enrich-comparison-dialog/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies and can start immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user story work.
- **User Story 1 (Phase 3)**: Starts after Foundational and delivers the MVP comparison experience.
- **User Story 2 (Phase 4)**: Starts after Foundational but builds on the operational grid introduced in User Story 1.
- **User Story 3 (Phase 5)**: Starts after Foundational but should land after User Story 1 because it refines the operational grid layout; if the same engineer owns the grid, land it after User Story 2 to avoid file conflicts in `components/comparison/comparison-operational-metrics-grid.tsx`.
- **Polish (Phase 6)**: Depends on the user stories you intend to ship.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories once Foundational is complete.
- **User Story 2 (P2)**: Depends on User Story 1’s operational grid and enriched participant payload.
- **User Story 3 (P3)**: Depends on User Story 1’s operational grid; coordinate carefully with User Story 2 because both touch `components/comparison/comparison-operational-metrics-grid.tsx`.

### Within Each User Story

- Tests must be written and fail before implementation.
- Server aggregation and normalization changes must land before UI integration.
- Ranking and operational grid updates should land before final viewer wiring.
- Story validation should complete before moving to the next priority if you are delivering incrementally.

### Dependency Graph

- **Execution order**: Phase 1 → Phase 2 → User Story 1 → User Story 2 → User Story 3 → Phase 6
- **Parallelizable after Phase 2**: User Story 1 test tasks can run together first; later, User Story 2 test tasks and User Story 3 test tasks can run in parallel with non-conflicting work, but implementation on `components/comparison/comparison-operational-metrics-grid.tsx` remains sequential.

---

## Parallel Example: User Story 1

```bash
Task: "Add aggregation unit coverage for totals, pending/unavailable states, best-value flags, and primary-model selection in tests/unit/comparison/comparison-detail.test.ts"
Task: "Add ranking card rendering coverage for workflow type, optional agent, and quality summary in tests/unit/components/comparison-ranking.test.tsx"
Task: "Add integration coverage for enriched operational metrics on the comparison detail route in tests/integration/comparisons/comparison-detail-route.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add unit coverage for FULL-workflow verify eligibility and five-dimension quality parsing in tests/unit/comparison/comparison-quality-eligibility.test.ts"
Task: "Add component coverage for inline quality breakdown interaction and ineligible quality cells in tests/unit/components/comparison-operational-quality-breakdown.test.tsx"
Task: "Add integration coverage for eligible and ineligible comparison quality payloads in tests/integration/comparisons/comparison-detail-quality.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add component coverage for sticky metric labels and six-column overflow behavior in tests/unit/components/comparison-operational-metrics-layout.test.tsx"
Task: "Add integration coverage for 2-6 participant headers and scroll-ready payload shapes in tests/integration/comparisons/comparison-dashboard-api.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate User Story 1 independently before expanding quality details or responsive refinements.

### Incremental Delivery

1. Finish Setup and Foundational so the enriched comparison payload is stable.
2. Deliver User Story 1 as the MVP for operational comparison.
3. Add User Story 2 for inline quality explanation without changing navigation.
4. Add User Story 3 for six-ticket and mobile readability.
5. Finish with Phase 6 validation and cleanup.

### Parallel Execution Strategy

1. Complete Phases 1 and 2 sequentially.
2. Run story-specific test tasks marked `[P]` in parallel.
3. Implement non-conflicting ranking, route, and test-file work in parallel where possible.
4. Keep `lib/comparison/comparison-detail.ts`, `lib/comparison/comparison-record.ts`, and `components/comparison/comparison-operational-metrics-grid.tsx` as single-owner files during implementation to avoid merge churn.

---

## Notes

- [P] tasks are limited to work on different files without incomplete-task dependencies.
- The contract in `specs/AIB-339-enrich-comparison-dialog/contracts/comparison-detail.openapi.yaml` maps entirely to the comparison detail route work in Phases 2 through 4.
- The data model in `specs/AIB-339-enrich-comparison-dialog/data-model.md` introduces read-model entities only; no Prisma migration tasks are required.
- MVP scope is User Story 1 because it delivers the new operational comparison value and preserves existing dialog content.
