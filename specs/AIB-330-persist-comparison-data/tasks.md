# Tasks: Persist comparison data to database via workflow

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/contracts/comparison-persistence.openapi.yaml`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/quickstart.md`

**Tests**: Include unit and integration coverage because the specification explicitly requests test coverage for serializers, endpoint behavior, graceful degradation, and idempotent persistence.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the shared artifact and request contract used by the compare generator, workflow bridge, and persistence route.

- [X] T001 Extend comparison artifact/request types in /home/runner/work/ai-board/ai-board/target/lib/types/comparison.ts
- [X] T002 [P] Add shared comparison persistence schema and normalization helpers in /home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-payload.ts
- [X] T003 [P] Extend reusable workflow persistence fixtures in /home/runner/work/ai-board/ai-board/target/tests/helpers/comparison-fixtures.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared persistence and validation primitives that all user stories depend on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T004 Add compare-run idempotency support to the persistence service in /home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-record.ts
- [X] T005 [P] Add workflow-auth request parsing and scoped validation helpers in /home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts
- [X] T006 [P] Add shared unit coverage for artifact schema parsing and idempotency helpers in /home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-payload.test.ts and /home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-record.test.ts

**Checkpoint**: Shared artifact, validation, and idempotent persistence primitives are ready for story implementation.

---

## Phase 3: User Story 1 - Save comparison records during a compare run (Priority: P1) 🎯 MVP

**Goal**: Persist a durable comparison record from `/compare` without changing the markdown artifact workflow.

**Independent Test**: Run `/compare` for a ticket with participants, confirm the markdown file still exists under `specs/<branch>/comparisons/`, submit the generated payload through the workflow-authenticated route, and verify the comparison dashboard can read the new record.

### Tests for User Story 1

- [X] T007 [P] [US1] Add unit coverage for JSON artifact generation in /home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-generator.test.ts
- [X] T008 [P] [US1] Add integration coverage for successful workflow POST persistence in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-persistence.test.ts
- [X] T009 [P] [US1] Extend dashboard retrieval coverage for newly persisted records in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-dashboard-api.test.ts

### Implementation for User Story 1

- [X] T010 [US1] Emit markdown-linked comparison JSON artifacts from /home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-generator.ts
- [X] T011 [US1] Add the workflow-only `POST /api/projects/{projectId}/tickets/{ticketId}/comparisons` handler in /home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts
- [X] T012 [US1] Wire workflow compare persistence submission and success logging in /home/runner/work/ai-board/ai-board/target/.github/workflows/ai-board-assist.yml

**Checkpoint**: `/compare` can create a durable comparison record that the dashboard can read, while markdown remains the primary artifact.

---

## Phase 4: User Story 2 - Preserve existing compare behavior when persistence is unavailable (Priority: P2)

**Goal**: Keep `/compare` and the assist workflow successful when JSON generation or persistence fails after markdown creation.

**Independent Test**: Force JSON serialization failure, missing artifact, malformed payload, and endpoint rejection paths; verify markdown generation still succeeds, the workflow remains successful, and logs distinguish skipped vs rejected vs server-failure outcomes.

### Tests for User Story 2

- [X] T013 [P] [US2] Add unit coverage for missing, malformed, and incomplete artifact detection in /home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-payload.test.ts
- [X] T014 [P] [US2] Add integration coverage for invalid payload and wrong-scope rejection with no writes in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-persistence.test.ts
- [X] T015 [P] [US2] Add workflow-side regression coverage for non-fatal persistence failures in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-api.test.ts

### Implementation for User Story 2

- [X] T016 [US2] Make JSON serialization failures non-fatal while preserving markdown success in /home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-generator.ts
- [X] T017 [US2] Return categorized validation, auth, not-found, and internal errors from /home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts
- [X] T018 [US2] Log skip and failure categories and continue successfully after compare persistence issues in /home/runner/work/ai-board/ai-board/target/.github/workflows/ai-board-assist.yml

**Checkpoint**: Persistence failures no longer threaten compare completion, and operators can diagnose which failure mode occurred.

---

## Phase 5: User Story 3 - Trust persisted comparison records to match the original report (Priority: P3)

**Goal**: Ensure persisted records preserve the same winner, rankings, rationale, decision points, compliance, and markdown provenance as the generated report.

**Independent Test**: Compare the markdown artifact and persisted record from the same run, then retry the same payload and verify the stored winner, ordering, recommendation, decision points, compliance rows, and markdown path all match while the retry reuses the same durable record.

### Tests for User Story 3

- [X] T019 [P] [US3] Add unit coverage for compare-run retry idempotency in /home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-record.test.ts
- [X] T020 [P] [US3] Add integration coverage for persisted report fidelity and duplicate retry handling in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-history-persistence.test.ts

### Implementation for User Story 3

- [X] T021 [US3] Persist compare-run provenance, duplicate detection, and report fidelity mappings in /home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-record.ts
- [X] T022 [US3] Enforce markdown-path, ticket-scope, and participant consistency checks before writes in /home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts

**Checkpoint**: Persisted comparison history is retry-safe and auditably consistent with the original markdown report.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, contract alignment, and cross-story cleanup.

- [X] T023 [P] Align the workflow persistence contract examples with the final payload shape in /home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/contracts/comparison-persistence.openapi.yaml
- [X] T024 Run quickstart verification commands against the finished implementation from /home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/quickstart.md
- [X] T025 [P] Perform final comparison-fixture cleanup and remove transient JSON commit leakage paths in /home/runner/work/ai-board/ai-board/target/tests/helpers/comparison-fixtures.ts and /home/runner/work/ai-board/ai-board/target/.github/workflows/ai-board-assist.yml

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies.
- **Phase 2: Foundational**: Depends on Phase 1 and blocks all user stories.
- **Phase 3: User Story 1**: Depends on Phase 2 and delivers the MVP persistence bridge.
- **Phase 4: User Story 2**: Depends on Phase 3 because graceful-degradation behavior hardens the new generator, route, and workflow submission path added for US1.
- **Phase 5: User Story 3**: Depends on Phase 3 and should follow Phase 4 so fidelity checks cover the final validated payload path.
- **Phase 6: Polish**: Depends on all selected user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational and has no dependency on later stories.
- **US2 (P2)**: Builds on the US1 artifact, route, and workflow bridge.
- **US3 (P3)**: Builds on the US1 persistence path and should be finalized after US2 validation/error handling is stable.

### Within Each User Story

- Tests should be written before implementation and should fail before the related code changes land.
- Shared serializers and schemas should be in place before route and workflow wiring.
- Generator and persistence service changes should be complete before end-to-end workflow behavior is finalized.

### Suggested Completion Order

1. Complete Phase 1.
2. Complete Phase 2.
3. Complete Phase 3 for the MVP.
4. Complete Phase 4 for graceful degradation.
5. Complete Phase 5 for fidelity and retry safety.
6. Complete Phase 6 for final validation.

---

## Parallel Opportunities

- T002 and T003 can run in parallel after T001.
- T005 and T006 can run in parallel after T004.
- T007, T008, and T009 can run in parallel within US1.
- T013, T014, and T015 can run in parallel within US2.
- T019 and T020 can run in parallel within US3.
- T023 and T025 can run in parallel during polish after implementation stabilizes.

---

## Parallel Example: User Story 1

```bash
Task: "T007 [US1] Add unit coverage for JSON artifact generation in /home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-generator.test.ts"
Task: "T008 [US1] Add integration coverage for successful workflow POST persistence in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-persistence.test.ts"
Task: "T009 [US1] Extend dashboard retrieval coverage for newly persisted records in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-dashboard-api.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T013 [US2] Add unit coverage for missing, malformed, and incomplete artifact detection in /home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-payload.test.ts"
Task: "T014 [US2] Add integration coverage for invalid payload and wrong-scope rejection with no writes in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-persistence.test.ts"
Task: "T015 [US2] Add workflow-side regression coverage for non-fatal persistence failures in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-api.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T019 [US3] Add unit coverage for compare-run retry idempotency in /home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-record.test.ts"
Task: "T020 [US3] Add integration coverage for persisted report fidelity and duplicate retry handling in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-history-persistence.test.ts"
```

---

## Implementation Strategy

### MVP First

1. Finish Phase 1 and Phase 2.
2. Deliver Phase 3 only.
3. Validate that `/compare` still produces markdown and that the dashboard can read the persisted record.

### Incremental Delivery

1. Ship US1 to create the workflow persistence bridge.
2. Add US2 to make persistence failures non-fatal and diagnosable.
3. Add US3 to guarantee fidelity and retry-safe history.

### Validation Focus

1. Preserve markdown-first compare behavior.
2. Prevent orphaned or duplicate records.
3. Keep workflow logging explicit enough to diagnose missing JSON vs rejected payload vs service failure.
