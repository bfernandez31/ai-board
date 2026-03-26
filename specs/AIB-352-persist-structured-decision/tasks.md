# Tasks: Persist Structured Decision Points in Comparison Data

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/contracts/comparison-decision-persistence.openapi.yaml`

**Tests**: Tests are required for this feature per the implementation plan and constitution check.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently once the shared contract work is complete.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel when they touch different files and do not depend on incomplete tasks
- **[Story]**: Maps work to a specific user story from `spec.md`
- Every task below includes an exact file path

## Phase 1: Setup (Shared Test Scaffolding)

**Purpose**: Prepare reusable comparison fixtures so all phases can exercise enriched and legacy decision-point payloads without duplicating setup.

- [X] T001 Extend shared structured and legacy comparison payload builders in `/home/runner/work/ai-board/ai-board/target/tests/helpers/comparison-fixtures.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared comparison-report contract and request validation that every user story depends on.

**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [X] T002 Extend comparison report types with structured decision-point interfaces in `/home/runner/work/ai-board/ai-board/target/lib/types/comparison.ts`
- [X] T003 [P] Add Zod schemas and normalization for `report.decisionPoints` in `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-payload.ts`
- [X] T004 Align workflow POST validation with the expanded report contract in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts`

**Checkpoint**: Shared contracts, fixtures, and route validation are ready. User story work can now proceed in priority order or in parallel where file ownership stays separate.

---

## Phase 3: User Story 1 - Review Distinct Decision Points in the Comparison Dialog (Priority: P1) 🎯 MVP

**Goal**: Make newly saved comparisons surface distinct decision-point verdicts, rationales, and per-ticket approaches in the comparison dialog instead of repeated global fallback content.

**Independent Test**: Persist a comparison fixture with multiple decision points, open the saved detail payload and dialog, and confirm each accordion item shows decision-specific title, verdict, rationale, and participant approaches in order.

### Tests for User Story 1

- [X] T005 [P] [US1] Extend structured persistence regression coverage for multi-decision comparisons in `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-persistence.test.ts`
- [X] T006 [P] [US1] Extend comparison detail API assertions for ordered decision-specific content in `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-detail-route.test.ts`
- [X] T007 [P] [US1] Extend decision-point accordion rendering assertions for unique saved content in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-dashboard-sections.test.tsx`
- [X] T008 [P] [US1] Extend structured decision-point persistence mapping coverage in `/home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-record.test.ts`

### Implementation for User Story 1

- [X] T009 [US1] Replace new-comparison decision-point fallback synthesis with direct structured persistence mapping in `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-record.ts`
- [X] T010 [US1] Preserve saved decision-point ordering and participant approach hydration in `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-detail.ts`
- [X] T011 [US1] Render distinct saved decision-point verdicts, rationales, and participant approaches in `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-decision-points.tsx`

**Checkpoint**: User Story 1 is complete when newly saved comparisons show distinct decision-point content throughout persistence, detail retrieval, and dialog rendering.

---

## Phase 4: User Story 2 - Preserve Backward Compatibility for Historical Comparisons (Priority: P1)

**Goal**: Keep older comparison records readable by preserving the current fallback and empty-state behavior when decision-point-specific fields are absent or partial.

**Independent Test**: Load a legacy comparison fixture without enriched decision-point fields and confirm the detail route and dialog still render the existing fallback behavior without crashing or requiring migration.

### Tests for User Story 2

- [X] T012 [P] [US2] Add legacy comparison detail-route regression coverage for fallback decision points in `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-detail-route.test.ts`
- [X] T013 [P] [US2] Add empty and partial legacy decision-point rendering coverage in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-dashboard-sections.test.tsx`

### Implementation for User Story 2

- [X] T014 [US2] Keep legacy decision-point normalization tolerant of sparse saved rows in `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-record.ts`
- [X] T015 [US2] Preserve fallback and empty-state rendering for historical comparisons in `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-decision-points.tsx`

**Checkpoint**: User Story 2 is complete when pre-feature comparison records remain viewable and keep their existing fallback semantics unchanged.

---

## Phase 5: User Story 3 - Save Decision-Point Structure at Comparison Time (Priority: P2)

**Goal**: Make new comparison generation emit structured decision-point data that stays materially aligned with the markdown report and can be persisted without fabrication.

**Independent Test**: Generate a new comparison payload, persist it, and verify the saved decision-point count, order, verdicts, rationales, and participant approaches match the markdown and structured report for that run.

### Tests for User Story 3

- [X] T016 [P] [US3] Extend payload normalization coverage for structured decision-point contracts in `/home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-payload.test.ts`
- [X] T017 [P] [US3] Extend markdown/report generation coverage for ordered decision points in `/home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-generator.test.ts`
- [X] T018 [P] [US3] Extend persistence integration coverage for saved decision-point count and order in `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-persistence.test.ts`

### Implementation for User Story 3

- [X] T019 [US3] Generate markdown and serialized report output from shared structured decision points in `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-generator.ts`
- [X] T020 [US3] Require structured decision-point JSON output in `/home/runner/work/ai-board/ai-board/target/.claude-plugin/commands/ai-board.compare.md`

**Checkpoint**: User Story 3 is complete when new comparison runs produce decision-point structure once, render it in markdown, and persist the same ordered content without inventing missing details.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Close remaining viewer-level regression gaps and keep the feature documentation aligned with the final validation flow.

- [X] T021 [P] Add viewer-level saved comparison regression coverage for structured decision points in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/markdown-table-rendering.test.tsx`
- [X] T022 Update final validation steps and command expectations in `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies and starts immediately.
- **Phase 2: Foundational** depends on Phase 1 and blocks all user stories.
- **Phase 3: US1**, **Phase 4: US2**, and **Phase 5: US3** all depend on Phase 2.
- **Phase 6: Polish** depends on the user stories you intend to ship.

### User Story Dependencies

- **US1 (P1)** can start as soon as the shared contract and fixture work in Phases 1-2 is complete.
- **US2 (P1)** can start as soon as the shared contract and fixture work in Phases 1-2 is complete.
- **US3 (P2)** can start as soon as the shared contract and fixture work in Phases 1-2 is complete.
- **Recommended completion order for delivery**: US1 → US2 → US3, with US1 as the MVP slice and US2/US3 following as independently testable increments.

### Within Each User Story

- Write the listed tests first and confirm they fail for the intended gap.
- Update core mapping or generation logic before touching the consuming route or UI.
- Finish the story-specific validation before moving to Polish.

---

## Parallel Opportunities

- T003 and T004 can proceed in parallel after T002 if the payload schema and route validation are coordinated against the same contract.
- In US1, T005-T008 can run in parallel because they touch separate test files.
- In US2, T012 and T013 can run in parallel because they cover different layers.
- In US3, T016-T018 can run in parallel because they cover unit and integration files independently.
- T021 can run in parallel with T022 during the polish phase.

---

## Parallel Example: User Story 1

```bash
Task: "T005 [US1] Extend structured persistence regression coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-persistence.test.ts"
Task: "T006 [US1] Extend comparison detail API assertions in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-detail-route.test.ts"
Task: "T007 [US1] Extend decision-point accordion rendering assertions in /home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-dashboard-sections.test.tsx"
Task: "T008 [US1] Extend structured decision-point persistence mapping coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-record.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T012 [US2] Add legacy comparison detail-route regression coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-detail-route.test.ts"
Task: "T013 [US2] Add empty and partial legacy decision-point rendering coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-dashboard-sections.test.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T016 [US3] Extend payload normalization coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-payload.test.ts"
Task: "T017 [US3] Extend markdown/report generation coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-generator.test.ts"
Task: "T018 [US3] Extend persistence integration coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-persistence.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational contract work.
3. Complete Phase 3: User Story 1.
4. Validate the saved comparison persistence, detail route, and dialog rendering for distinct decision points.
5. Ship the MVP slice if the project only needs the visible regression fixed first.

### Incremental Delivery

1. Add US2 to guarantee historical comparison compatibility after US1 lands.
2. Add US3 to make comparison generation and markdown output the authoritative source for future saved decision points.
3. Finish Phase 6 to close remaining viewer-level regressions and align the quickstart validation steps with the delivered implementation.

### Suggested MVP Scope

- Phase 1: Setup
- Phase 2: Foundational
- Phase 3: User Story 1

---

## Notes

- No Prisma migration task is included because `data-model.md` explicitly keeps the existing comparison schema.
- Tasks touching the same file are intentionally serialized even when they belong to separate stories.
- Every task follows the required checklist format with task ID, optional `[P]`, optional story label, and an exact file path.
