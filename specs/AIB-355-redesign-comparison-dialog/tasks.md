# Tasks: Redesign Comparison Dialog as Mission Control Dashboard

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/spec.md`

**Tests**: Include component and integration coverage because the feature plan explicitly requires Vitest protection for the redesigned dashboard and the unchanged read APIs.

**Organization**: Tasks are grouped by user story so each story can be implemented, verified, and shipped independently once the shared foundation is in place.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel after dependencies are satisfied because the task owns different files
- **[Story]**: Maps the task to a specific user story from `/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/spec.md`
- Every task below includes absolute file paths

## Phase 1: Setup (Shared Dashboard Scaffolding)

**Purpose**: Prepare shared fixtures, view-model contracts, and API regression targets for the redesign without changing runtime behavior yet.

- [ ] T001 Extend dashboard comparison fixtures for 2/4/6 participant, pending, and missing-data scenarios in /home/runner/work/ai-board/ai-board/target/tests/helpers/comparison-fixtures.ts
- [ ] T002 [P] Add mission-control dashboard prop helpers and normalized metric row descriptors in /home/runner/work/ai-board/ai-board/target/components/comparison/types.ts
- [ ] T003 [P] Snapshot the dashboard-required read contract fields in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-dashboard-api.test.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared normalization and viewer plumbing required by every user story.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T004 Normalize winner, score-band, headline-metric, and neutral-state dashboard data in /home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-detail.ts
- [ ] T005 [P] Preserve shared comparison payload typings needed by the dashboard sections in /home/runner/work/ai-board/ai-board/target/lib/types/comparison.ts
- [ ] T006 [P] Update comparison selection and detail-loading hooks for the dashboard data flow in /home/runner/work/ai-board/ai-board/target/hooks/use-comparisons.ts
- [ ] T007 Create the shared mission-control section order and scroll-container skeleton in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-viewer.tsx

**Checkpoint**: Shared dashboard data and shell are ready; story work can proceed in priority order.

---

## Phase 3: User Story 1 - Identify the Best Candidate Immediately (Priority: P1) 🎯 MVP

**Goal**: Make the winner immediately obvious through a dominant hero that absorbs recommendation and metadata context.

**Independent Test**: Open a saved comparison with multiple participants and confirm the first viewport shows exactly one winner hero, embedded generation/source context, and the winner's headline cost, duration, and quality details before any deeper scrolling.

### Tests for User Story 1

- [ ] T008 [P] [US1] Add winner-hero component coverage for recommendation copy, absorbed metadata, and headline metrics in /home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-ranking.test.tsx
- [ ] T009 [P] [US1] Extend detail-route assertions for winner metadata and headline metric fields in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-detail-route.test.ts

### Implementation for User Story 1

- [ ] T010 [US1] Finalize hero-specific ranking props and metadata contracts in /home/runner/work/ai-board/ai-board/target/components/comparison/types.ts
- [ ] T011 [US1] Implement the dominant winner hero with embedded generation/source metadata and headline summary values in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-ranking.tsx
- [ ] T012 [US1] Remove the standalone metadata block and mount the winner hero first in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-viewer.tsx

**Checkpoint**: User Story 1 is independently functional when the winner can be identified instantly from the initial dialog viewport.

---

## Phase 4: User Story 2 - Compare All Participants Visually (Priority: P1)

**Goal**: Keep every participant visible and scannable in the same session with ranked non-winner cards and clear score-band differentiation.

**Independent Test**: Open comparisons with two, four, and six participants and verify that every participant remains visible in one dialog session, appears in rank order, and shows distinct score strength cues without secondary navigation.

### Tests for User Story 2

- [ ] T013 [P] [US2] Add ranked-card coverage for 2/4/6 participant comparisons and score-band treatments in /home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-ranking.test.tsx
- [ ] T014 [P] [US2] Add six-participant layout and overflow regression coverage for the dashboard shell in /home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-dashboard-sections.test.tsx

### Implementation for User Story 2

- [ ] T015 [US2] Implement ranked non-winner participant cards with rationale, ticket identity, and score-band styling in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-ranking.tsx
- [ ] T016 [US2] Harden the participant summary layout for up to six visible participants without hidden overflow in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-viewer.tsx

**Checkpoint**: User Story 2 is independently functional when all participants remain visible and visually differentiated in one session.

---

## Phase 5: User Story 3 - Read Relative Metrics Without Manual Calculation (Priority: P2)

**Goal**: Replace split metric sections with one relative dashboard matrix plus headline comparisons that preserve the existing quality popover.

**Independent Test**: Open a comparison with varied metric values and confirm headline metric summaries and the detailed matrix reveal strongest and weakest participants without manual calculation, while quality-score interactions still expose the existing breakdown.

### Tests for User Story 3

- [ ] T017 [P] [US3] Add unified metric-matrix and sticky-row-label coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-operational-metrics.test.tsx
- [ ] T018 [P] [US3] Add quality-score interaction regression coverage for the merged dashboard layout in /home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-quality-popover.test.tsx
- [ ] T019 [P] [US3] Extend detail-route assertions for headline and detailed metric payload fidelity in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-detail-route.test.ts

### Implementation for User Story 3

- [ ] T020 [US3] Implement headline metric summaries and the unified relative comparison matrix in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-metrics-grid.tsx
- [ ] T021 [US3] Replace the legacy split operational-metrics layout with the unified matrix wrapper in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-operational-metrics.tsx
- [ ] T022 [US3] Preserve quality-score breakdown access inside the merged matrix in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-quality-popover.tsx
- [ ] T023 [US3] Wire the merged headline-and-detail metrics section into the dashboard flow in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-viewer.tsx

**Checkpoint**: User Story 3 is independently functional when metric winners and laggards are obvious row by row and quality details remain accessible.

---

## Phase 6: User Story 4 - Spot Compliance and Decision Patterns Quickly (Priority: P2)

**Goal**: Surface pass/mixed/fail/missing compliance outcomes and verdict-first decision cues before expansion.

**Independent Test**: Open a comparison with mixed compliance and decision outcomes and verify that users can distinguish participant compliance states, see verdict summaries before expanding, and find the first decision already open.

### Tests for User Story 4

- [ ] T024 [P] [US4] Add compliance-grid and decision-verdict coverage for pass, mixed, fail, and missing states in /home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-dashboard-sections.test.tsx
- [ ] T025 [P] [US4] Extend dashboard API regression coverage for ordered decision points and sparse compliance assessments in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-dashboard-api.test.ts

### Implementation for User Story 4

- [ ] T026 [US4] Implement pattern-focused compliance cells with non-hover note access and neutral missing-state treatment in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-compliance-grid.tsx
- [ ] T027 [US4] Implement verdict-first decision triggers and default-open the first decision point in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-decision-points.tsx
- [ ] T028 [US4] Place compliance and decision sections into the final scan order in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-viewer.tsx

**Checkpoint**: User Story 4 is independently functional when compliance and decision outcomes can be understood before expanding dense detail.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finish cross-story consistency, validation, and cleanup.

- [ ] T029 [P] Audit semantic-token-only status styling and neutral copy across /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-ranking.tsx, /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-metrics-grid.tsx, /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-compliance-grid.tsx, and /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-decision-points.tsx
- [ ] T030 Run the validation checklist from /home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/quickstart.md and stabilize any remaining failures in /home/runner/work/ai-board/ai-board/target/tests/unit/components/ and /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies
- **Phase 2: Foundational**: Depends on Phase 1 and blocks every user story
- **Phase 3: US1**: Depends on Phase 2
- **Phase 4: US2**: Depends on US1 because it extends the same ranking and viewer surfaces
- **Phase 5: US3**: Depends on Phase 2 and should land after US1 so the merged metrics plug into the finalized dashboard shell
- **Phase 6: US4**: Depends on Phase 2 and should land after US1 so compliance and decision sections plug into the finalized dashboard shell
- **Phase 7: Polish**: Depends on all implemented stories

### User Story Dependency Graph

```text
Setup -> Foundational -> US1
US1 -> US2
US1 -> US3
US1 -> US4
US2, US3, US4 -> Polish
```

### Within Each User Story

- Write the listed test tasks first and confirm they fail before implementation
- Update shared types before component rendering logic when both appear in the same story
- Land component implementation before viewer wiring when the viewer depends on the new section output
- Complete the story checkpoint before moving on to the next priority slice

### Parallel Opportunities

- T002 and T003 can run in parallel after T001
- T005 and T006 can run in parallel after T004
- T008 and T009 can run in parallel for US1
- T013 and T014 can run in parallel for US2
- T017, T018, and T019 can run in parallel for US3
- T024 and T025 can run in parallel for US4
- After US1 is stable, US3 and US4 can proceed in parallel because they own different component files

---

## Parallel Example: User Story 1

```bash
Task: "T008 [US1] Add winner-hero component coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-ranking.test.tsx"
Task: "T009 [US1] Extend detail-route assertions in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-detail-route.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T013 [US2] Add ranked-card coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-ranking.test.tsx"
Task: "T014 [US2] Add six-participant layout regression coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-dashboard-sections.test.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T017 [US3] Add unified metric-matrix coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-operational-metrics.test.tsx"
Task: "T018 [US3] Add quality-score interaction regression coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-quality-popover.test.tsx"
Task: "T019 [US3] Extend metric payload assertions in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-detail-route.test.ts"
```

## Parallel Example: User Story 4

```bash
Task: "T024 [US4] Add compliance-grid and decision-verdict coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-dashboard-sections.test.tsx"
Task: "T025 [US4] Extend sparse compliance and decision ordering coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-dashboard-api.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2
2. Deliver Phase 3 for the winner hero MVP
3. Validate the US1 checkpoint before expanding the rest of the dashboard

### Incremental Delivery

1. Finish Setup and Foundational work once
2. Ship US1 as the MVP
3. Add US2 for full participant scanability
4. Add US3 for unified metric comparisons
5. Add US4 for compliance and decision scanability
6. Finish with Phase 7 validation and polish

### Parallel Execution Strategy

1. Execute Phases 1 and 2 sequentially
2. Complete US1 to stabilize the dashboard shell
3. Run US3 and US4 in parallel while US2 proceeds when ranking/viewer ownership is available
4. Reserve Phase 7 for final token, accessibility, and validation cleanup

---

## Notes

- All tasks follow the required checklist format with task ID, optional `[P]`, optional `[US#]`, and absolute file paths
- Tests are included because the feature plan and quickstart explicitly require component and integration coverage
- No Prisma schema, write-path, or new endpoint tasks are included because the design artifacts explicitly scope this feature to the existing comparison read APIs and frontend component set
