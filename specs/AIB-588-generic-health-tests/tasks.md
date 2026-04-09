---
description: "Actionable task list for Generic Health Tests: Make TESTS Scan Work on Any Project"
---

# Tasks: Generic Health Tests: Make TESTS Scan Work on Any Project

**Input**: Design documents from `/specs/AIB-588-generic-health-tests/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Test tasks are included by default per constitution requirements.

**Organization**: Tasks are grouped by user story so each increment can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel with other `[P]` tasks in the same phase when they touch different files
- **[Story]**: User story label for story-scoped work (`[US1]`, `[US2]`, `[US3]`)
- Every task below includes an exact file path and maps back to the validated repository inventory

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the typed config surface the generic TESTS scan will consume.

- [X] T001 Extend `lib/validations/config.ts` with `testCapabilities` and primary test-command key validation for `.ai-board/config.yml`
- [X] T002 [P] Extend `tests/unit/config-schema.test.ts` with contract coverage from `specs/AIB-588-generic-health-tests/contracts/project-config-tests-profile.md` for optional test commands and `testCapabilities`
- [X] T003 [P] Extend `tests/unit/config-loader.test.ts` to load `.ai-board/config.yml` files that include `testCapabilities` and nullable test command fields

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Make shared command/config access work before user-story implementation starts.

**⚠️ CRITICAL**: Complete this phase before starting user story work.

- [X] T004 Extend `lib/config-loader.ts` to expose validated `testCapabilities` data to downstream TESTS orchestration code
- [X] T005 Extend `.github/scripts/run-command.sh` to resolve target-repo test command keys generically and treat missing test commands as a clean skip path instead of an ai-board-only assumption
- [X] T006 [P] Extend `tests/unit/scripts/run-command.test.ts` with target-repo command resolution and missing-command skip cases used by the generic TESTS scan

**Checkpoint**: Shared config validation and generic command execution are ready for story work.

---

## Phase 3: User Story 1 - Run a TESTS Scan on an External Project Without Custom Orchestration (Priority: P1) 🎯 MVP

**Goal**: Route TESTS scans through ai-board-owned orchestration so external repositories can run tests from shared config without copying platform scripts.

**Independent Test**: Trigger a TESTS scan against a repository that has a valid `.ai-board/config.yml` test command but no repo-local TESTS orchestrator, then confirm the scan completes with a result envelope and findings instead of a missing-script failure.

### Tests for User Story 1

- [X] T007 [P] [US1] Create `tests/unit/scripts/run-health-tests.test.ts` to cover `specs/AIB-588-generic-health-tests/contracts/tests-health-result.md`, target-repo execution, skipped result envelopes, first-run score preservation, and retry limits
- [X] T008 [P] [US1] Extend `tests/unit/health/command-output-validation.test.ts` with assertions for generic TESTS result payloads emitted by `scripts/run-health-tests.sh`

### Implementation for User Story 1

- [X] T009 [US1] Refactor `scripts/run-tests-with-reports.sh` to execute against an explicit target repository path and always emit JSON summaries for the TESTS orchestrator
- [X] T010 [US1] Refactor `scripts/run-health-tests.sh` to run from the ai-board checkout, read target-repo config, select the configured primary test command, preserve first-run scoring, and emit skipped results with `skipReason`
- [X] T011 [US1] Update `.github/workflows/health-scan.yml` to invoke the ai-board-owned TESTS orchestrator against the checked-out target repository instead of requiring target-local scripts
- [X] T012 [US1] Update `lib/health/scan-dispatch.ts` to pass the TESTS workflow inputs required by the platform-owned orchestrator for external repositories

**Checkpoint**: External repositories with valid test config can complete a TESTS scan without custom orchestration assets.

---

## Phase 4: User Story 2 - Generate Reusable Test Configuration During Stack Detection (Priority: P2)

**Goal**: Make stack detection write durable test capability metadata and runnable commands into shared project config for later TESTS scans.

**Independent Test**: Run stack detection against repositories from different ecosystems and confirm the generated `.ai-board/config.yml` records the detected test command, framework classification, E2E signal, and quality-check commands when they are defensible.

### Tests for User Story 2

- [X] T013 [P] [US2] Extend `tests/unit/detect-stack.test.ts` with contract coverage from `specs/AIB-588-generic-health-tests/contracts/project-config-tests-profile.md` for normalized test, lint, and type-check commands plus `framework` and `hasE2E`

### Implementation for User Story 2

- [X] T014 [US2] Extend `.github/scripts/detect-stack.sh` to write normalized `commands.test_unit`, `commands.test_integration`, `commands.test_e2e`, `commands.lint`, `commands.type_check`, and `testCapabilities` into generated `.ai-board/config.yml`
- [X] T015 [US2] Update `lib/config-sync.ts` to preserve sanitized stack-detected test capability metadata in `Project.config` during config refreshes

**Checkpoint**: Stack detection produces reusable TESTS capability metadata that later scans can consume without repo-specific customization.

---

## Phase 5: User Story 3 - Preserve Existing ai-board TESTS Behavior While Expanding Compatibility (Priority: P3)

**Goal**: Allow `TESTS` scans to skip cleanly and keep ai-board self-scan behavior, score handling, and reporting stable while the generic path rolls out.

**Independent Test**: Run the updated TESTS status flow for ai-board and skipped external-repo scenarios, then confirm `RUNNING -> SKIPPED` persists with `skipReason`, no aggregate score regression, and unchanged completed-scan reporting.

### Tests for User Story 3

- [X] T016 [P] [US3] Extend `tests/integration/health/scan-status.test.ts` with contract coverage from `specs/AIB-588-generic-health-tests/contracts/health-scan-status-patch.md` for `TESTS` `RUNNING -> SKIPPED`, `skipReason`, and aggregate preservation
- [X] T017 [P] [US3] Extend `tests/unit/health/report-schemas.test.ts` to confirm existing ai-board TESTS report bodies remain valid while skipped status moves through the workflow envelope

### Implementation for User Story 3

- [X] T018 [US3] Update `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` to allow `TESTS` skips, require `skipReason`, and keep `HealthScore.testsScore` unchanged on skipped runs
- [X] T019 [US3] Update `.github/workflows/health-scan.yml` to stop coercing `TESTS` skips to completed and propagate `skipped` plus `skipReason` from `/tmp/health-scan-result.json`

**Checkpoint**: ai-board self-scans still behave as before, and skipped TESTS scans persist as a first-class status instead of a workflow error or coerced completion.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Align feature docs with the final implementation and preserve operator clarity across workflows.

- [X] T020 [P] Update `specs/AIB-588-generic-health-tests/workflows/tests-health-scan-workflow.md` with the final platform-owned TESTS routing, target-repo arguments, and skipped-result handling
- [X] T021 [P] Update `specs/AIB-588-generic-health-tests/workflows/stack-detection-workflow.md` to document the generated test capability profile and normalized command fields
- [X] T022 [P] Update `specs/AIB-588-generic-health-tests/workflows/tests-health-scan-command.md` with the final `scripts/run-health-tests.sh` CLI contract and result-file expectations

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies and starts immediately.
- **Phase 2: Foundational** depends on Phase 1 and blocks all user-story work.
- **Phase 3: US1** depends on Phase 2 and is the MVP slice.
- **Phase 4: US2** depends on Phase 2; implement after US1 for delivery order, even though the config-generation work is largely independent once the foundation exists.
- **Phase 5: US3** depends on Phase 3 because it hardens the shared TESTS path and skip persistence introduced by the routing work.
- **Phase 6: Polish** depends on the user stories you intend to ship.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 and delivers the first shippable increment.
- **US2 (P2)**: Starts after Phase 2; it improves onboarding and configuration generation for the generic TESTS path.
- **US3 (P3)**: Starts after US1; it validates skip-state persistence and ai-board compatibility on the generic path.

### Within Each User Story

- Tests MUST be written and fail before implementation work in the same story.
- Script and config primitives land before workflow routing that depends on them.
- Workflow or API persistence changes land after the tests that assert the new contract.

### Parallel Opportunities

- Phase 1: `T002` and `T003` can run in parallel after `T001`.
- Phase 2: `T006` can run in parallel once `T005` is scoped.
- US1: `T007` and `T008` can run in parallel; `T011` and `T012` can be split across workflow and dispatch code after the script refactors settle.
- US2: `T013` can run ahead of `T014` to lock the detection contract.
- US3: `T016` and `T017` can run in parallel before the workflow/API changes.
- Polish: `T020`, `T021`, and `T022` can run in parallel.

---

## Parallel Example: User Story 1

```bash
Task T007: Create tests/unit/scripts/run-health-tests.test.ts
Task T008: Extend tests/unit/health/command-output-validation.test.ts

Task T011: Update .github/workflows/health-scan.yml
Task T012: Update lib/health/scan-dispatch.ts
```

## Parallel Example: User Story 2

```bash
Task T013: Extend tests/unit/detect-stack.test.ts
Task T015: Update lib/config-sync.ts
```

## Parallel Example: User Story 3

```bash
Task T016: Extend tests/integration/health/scan-status.test.ts
Task T017: Extend tests/unit/health/report-schemas.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1.
2. Complete Phase 2.
3. Complete Phase 3.
4. Validate the external-repository TESTS scan path independently before moving on.

### Incremental Delivery

1. Ship Setup + Foundational to establish typed config and generic command execution.
2. Ship US1 so external repositories can run TESTS scans through platform-owned orchestration.
3. Ship US2 so onboarding auto-generates the reusable config that US1 consumes.
4. Ship US3 so skipped scans and ai-board self-management behavior are fully hardened.
5. Finish Phase 6 doc updates to keep workflow operators aligned with the new path.
