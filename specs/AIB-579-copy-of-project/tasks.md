---
description: "Actionable task list for AIB-579 implementation"
---

# Tasks: Project onboarding hybrid workflow with stack detection and generated AI Board guidance

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-579-copy-of-project/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-579-copy-of-project/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-579-copy-of-project/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-579-copy-of-project/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-579-copy-of-project/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-579-copy-of-project/contracts/`

**Tests**: Test tasks are included by default. Existing setup and config-sync suites must be extended before implementation; new test files are limited to the new pure onboarding domain under `/home/runner/work/ai-board/ai-board/target/tests/unit/lib/onboarding/`.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently once foundational work is complete.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel because the task touches different files and does not depend on incomplete work in the same phase
- **[Story]**: User story label for story-specific phases only (`[US1]`, `[US2]`, `[US3]`)
- Every task includes real existing file paths or justified new file paths in currently empty onboarding directories

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the empty onboarding implementation surface that later phases will fill.

- [X] T001 Create the new onboarding domain files `/home/runner/work/ai-board/ai-board/target/lib/onboarding/detect-stack.ts`, `/home/runner/work/ai-board/ai-board/target/lib/onboarding/generate-config.ts`, and `/home/runner/work/ai-board/ai-board/target/lib/onboarding/artifacts.ts`
- [X] T002 [P] Create the workflow helper entrypoints `/home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/report-status.ts`, `/home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/detect-stack.ts`, and `/home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/assemble-artifacts.ts`
- [X] T003 [P] Create the onboarding-specific agent command `/home/runner/work/ai-board/ai-board/target/.claude-plugin/commands/ai-board.onboard.md` and the new pure-function test files `/home/runner/work/ai-board/ai-board/target/tests/unit/lib/onboarding/detect-stack.test.ts`, `/home/runner/work/ai-board/ai-board/target/tests/unit/lib/onboarding/generate-config.test.ts`, and `/home/runner/work/ai-board/ai-board/target/tests/unit/lib/onboarding/artifacts.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the shared persistence, validation, and API contract changes that all stories depend on.

**⚠️ CRITICAL**: No user story work should start until these tasks are complete.

- [X] T004 Extend `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` and generate the corresponding migration under `/home/runner/work/ai-board/ai-board/target/prisma/migrations/` for `ProjectSetupJob.partial`, `commitSha`, `errorCode`, and `logs`
- [X] T005 [P] Extend `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts` to validate and persist additive callback fields, enforce partial/failure field rules, and keep idempotent state transitions
- [X] T006 [P] Extend `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/route.ts` to return `partial`, `commitSha`, `errorCode`, and `logs` in the latest-job payload without changing owner-only authorization or dispatch semantics
- [X] T007 [P] Extend `/home/runner/work/ai-board/ai-board/target/lib/validations/config.ts` and `/home/runner/work/ai-board/ai-board/target/lib/config-sync.ts` to admit Ruby and PHP onboarding configs while preserving credential stripping and optimistic sync behavior
- [X] T008 [P] Extend `/home/runner/work/ai-board/ai-board/target/lib/workflows/dispatch-onboard.ts` to preserve the stable workflow input contract and onboarding credential guard behavior required by the richer workflow

**Checkpoint**: Setup-job persistence, callback validation, and config-schema support are ready for story implementation.

---

## Phase 3: User Story 1 - Initialize a newly imported repository (Priority: P1) 🎯 MVP

**Goal**: Deterministically analyze an imported repository, generate a valid operational config, and commit deterministic onboarding artifacts in one update.

**Independent Test**: Dispatch onboarding against representative supported repositories and verify that `/home/runner/work/ai-board/ai-board/target/.github/workflows/onboard.yml` produces a valid `.ai-board/config.yml`, an analysis artifact summary, a single commit SHA, and a completed setup job.

### Tests for User Story 1

- [X] T009 [P] [US1] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-job.test.ts` with deterministic happy-path callback coverage for `workflowRunId`, `commitSha`, and created artifact summaries returned by `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/route.ts`
- [X] T010 [P] [US1] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/config-sync.test.ts` with generated-config compatibility cases for newly supported primary stacks and config-sync stripping behavior
- [X] T011 [P] [US1] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/lib/onboarding/detect-stack.test.ts` and `/home/runner/work/ai-board/ai-board/target/tests/unit/lib/onboarding/generate-config.test.ts` with deterministic precedence, command inference, and config-validation scenarios

### Implementation for User Story 1

- [X] T012 [P] [US1] Implement deterministic repository analysis in `/home/runner/work/ai-board/ai-board/target/lib/onboarding/detect-stack.ts` for manifests, lockfiles, framework signals, commands, services, and conflict resolution
- [X] T013 [P] [US1] Implement validated config generation in `/home/runner/work/ai-board/ai-board/target/lib/onboarding/generate-config.ts` so repository analysis produces a schema-valid `.ai-board/config.yml`
- [X] T014 [P] [US1] Implement the workflow CLI wrappers in `/home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/detect-stack.ts` and `/home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/report-status.ts` for analysis execution and typed setup-job callbacks
- [X] T015 [US1] Replace the stub workflow in `/home/runner/work/ai-board/ai-board/target/.github/workflows/onboard.yml` so it checks out the target repository, reports `RUNNING`, runs deterministic analysis, commits deterministic artifacts once, and reports `COMPLETED` with the commit reference

**Checkpoint**: User Story 1 should make an imported repository operational even before guidance generation is added.

---

## Phase 4: User Story 2 - Receive project-specific guidance instead of generic templates (Priority: P2)

**Goal**: Generate repository-specific guidance artifacts while preserving protected existing guidance files.

**Independent Test**: Run onboarding on repositories with and without pre-existing guidance files and verify that the workflow creates project-specific guidance, preserves protected files when present, and records those outcomes in the artifact summary.

### Tests for User Story 2

- [X] T016 [US2] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-job.test.ts` with onboarding rerun cases that assert created versus preserved guidance artifacts and preserved protected-file summaries
- [X] T017 [P] [US2] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/lib/onboarding/artifacts.test.ts` with protected-file preservation, missing-artifact, and artifact-kind classification scenarios

### Implementation for User Story 2

- [X] T018 [US2] Implement deterministic and guidance artifact merging in `/home/runner/work/ai-board/ai-board/target/lib/onboarding/artifacts.ts`, including preservation of `CLAUDE.md`, `AGENTS.md`, and `.ai-board/memory/constitution.md`
- [X] T019 [P] [US2] Implement guidance assembly in `/home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/assemble-artifacts.ts` and author the onboarding prompt contract in `/home/runner/work/ai-board/ai-board/target/.claude-plugin/commands/ai-board.onboard.md`
- [X] T020 [US2] Extend `/home/runner/work/ai-board/ai-board/target/.github/workflows/onboard.yml` to fetch the owner credential through `/home/runner/work/ai-board/ai-board/target/app/api/internal/credentials/route.ts`, run `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh`, preserve existing guidance files, and include generated guidance in the single repository update

**Checkpoint**: User Story 2 should produce repository-specific onboarding guidance without overwriting protected user-authored files.

---

## Phase 5: User Story 3 - Understand failures and partial completion clearly (Priority: P3)

**Goal**: Report structured success, partial success, and failure states end-to-end in workflow callbacks and setup UI.

**Independent Test**: Force guidance-generation, configuration-generation, and commit failures, then verify that setup-job polling and the setup page distinguish usable partial completion from terminal failure with the correct error category and artifact summary.

### Tests for User Story 3

- [X] T021 [US3] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-job.test.ts` with partial-success, configuration-failure, and commit-failure callback scenarios plus GET polling assertions for `partial`, `errorCode`, and `logs`
- [X] T022 [P] [US3] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/components/setup/setup-page.test.tsx` with full-success, partial-success, missing-guidance, and failure-category rendering states
- [X] T023 [P] [US3] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/credential-dispatch-guard.test.ts` with onboarding-specific missing-credential and dispatch-failure coverage

### Implementation for User Story 3

- [X] T024 [US3] Extend `/home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/report-status.ts` and `/home/runner/work/ai-board/ai-board/target/.github/workflows/onboard.yml` to emit `CONFIGURATION_GENERATION_FAILED`, `GUIDANCE_GENERATION_FAILED`, and `COMMIT_FAILED` payloads with `partial`, `commitSha`, `errorCode`, `logs`, and missing-artifact summaries
- [X] T025 [US3] Extend `/home/runner/work/ai-board/ai-board/target/components/setup/setup-page-client.tsx` to render created, preserved, and missing artifact groups; show commit references; and distinguish partial completion from failure
- [X] T026 [US3] Extend `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/setup/page.tsx` to pass the richer setup-job payload into the client while keeping the existing ownership gate and configured-project redirect behavior intact

**Checkpoint**: All three user stories should now be independently testable and observable through the existing setup flow.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency checks and repo-wide verification across the completed feature.

- [X] T027 [P] Regenerate Prisma client from `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` and verify the final onboarding behavior against `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-job.test.ts` and `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/config-sync.test.ts` with `bunx prisma generate`, `bun run test:integration`, and `bun run test:unit`
- [X] T028 [P] Run `bun run type-check` and `bun run lint`, then resolve any cross-cutting failures surfaced in `/home/runner/work/ai-board/ai-board/target/lib/onboarding/`, `/home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/`, `/home/runner/work/ai-board/ai-board/target/components/setup/setup-page-client.tsx`, and `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies and establishes the empty onboarding implementation surface.
- **Phase 2: Foundational** depends on Phase 1 and blocks every user story because persistence, callback validation, and config-schema support must exist first.
- **Phase 3: US1** depends on Phase 2 and delivers the MVP deterministic onboarding path.
- **Phase 4: US2** depends on US1 because guidance generation builds on the deterministic analysis, generated config, and commit flow from the MVP.
- **Phase 5: US3** depends on US1 for callback fields and is best completed after US2 so partial guidance states are fully represented in workflow and UI behavior.
- **Phase 6: Polish** depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Starts immediately after Foundational and has no story-level dependency.
- **US2 (P2)**: Depends on US1 because it extends the same onboarding workflow with guidance generation and artifact preservation.
- **US3 (P3)**: Depends on US1 callback semantics and should follow US2 so partial guidance outcomes are fully modeled in both workflow payloads and setup UI.

### Within Each User Story

- Tests must be written and fail before implementation.
- Pure onboarding domain modules come before workflow integration.
- Workflow wrappers come before workflow YAML changes.
- API/state reporting must exist before UI rendering depends on those fields.

### Parallel Opportunities

- `T002` and `T003` can run in parallel once the feature surface is agreed.
- `T005`, `T006`, `T007`, and `T008` can run in parallel after the Prisma schema shape in `T004` is defined.
- In US1, `T009`, `T010`, and `T011` can run in parallel; `T012`, `T013`, and `T014` can also run in parallel before `T015`.
- In US2, `T017` and `T019` can run in parallel while `T016` and `T018` proceed sequentially on the shared artifact-contract behavior.
- In US3, `T022` and `T023` can run in parallel before UI and workflow reporting work converge in `T024` to `T026`.

---

## Parallel Example: User Story 1

```bash
# Launch the US1 test work together:
Task T009 - Extend /home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-job.test.ts
Task T010 - Extend /home/runner/work/ai-board/ai-board/target/tests/integration/projects/config-sync.test.ts
Task T011 - Extend /home/runner/work/ai-board/ai-board/target/tests/unit/lib/onboarding/detect-stack.test.ts and /home/runner/work/ai-board/ai-board/target/tests/unit/lib/onboarding/generate-config.test.ts

# Launch the independent US1 implementation modules together:
Task T012 - Implement /home/runner/work/ai-board/ai-board/target/lib/onboarding/detect-stack.ts
Task T013 - Implement /home/runner/work/ai-board/ai-board/target/lib/onboarding/generate-config.ts
Task T014 - Implement /home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/detect-stack.ts and /home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/report-status.ts
```

## Parallel Example: User Story 2

```bash
# Run guidance-domain work in parallel after US1 lands:
Task T017 - Extend /home/runner/work/ai-board/ai-board/target/tests/unit/lib/onboarding/artifacts.test.ts
Task T019 - Implement /home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/assemble-artifacts.ts and /home/runner/work/ai-board/ai-board/target/.claude-plugin/commands/ai-board.onboard.md
```

## Parallel Example: User Story 3

```bash
# Split UI and guard coverage before the final reporting integration:
Task T022 - Extend /home/runner/work/ai-board/ai-board/target/tests/unit/components/setup/setup-page.test.tsx
Task T023 - Extend /home/runner/work/ai-board/ai-board/target/tests/unit/credential-dispatch-guard.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 so the new onboarding directories and test files exist.
2. Complete Phase 2 so setup-job persistence, callback validation, and config validation are ready.
3. Complete Phase 3 to deliver deterministic repository analysis, valid config generation, and single-commit onboarding.
4. Validate the MVP by running the focused integration and unit coverage for `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-job.test.ts`, `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/config-sync.test.ts`, and `/home/runner/work/ai-board/ai-board/target/tests/unit/lib/onboarding/`.

### Incremental Delivery

1. Ship Setup + Foundational changes first to stabilize contracts and persistence.
2. Ship US1 as the first usable onboarding increment.
3. Ship US2 to add project-specific guidance and preservation behavior without regressing US1.
4. Ship US3 to surface structured outcome reporting and partial-success UX on top of the working workflow.

### Parallel Execution Strategy

1. Complete Phase 1 and Phase 2 sequentially because they unblock every story.
2. Use the `[P]` tasks inside each story to split test creation, pure-function modules, and workflow wrappers across parallel workers.
3. Keep shared-file tasks such as `/home/runner/work/ai-board/ai-board/target/.github/workflows/onboard.yml` and `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-job.test.ts` serialized within their respective phases.

---

## Notes

- All task file paths were validated against the current repository, except the justified new onboarding paths in `/home/runner/work/ai-board/ai-board/target/lib/onboarding/`, `/home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/`, `/home/runner/work/ai-board/ai-board/target/.claude-plugin/commands/`, and `/home/runner/work/ai-board/ai-board/target/tests/unit/lib/onboarding/`, which do not exist yet and are intentionally introduced by this feature.
- Existing test files were extended wherever research identified relevant coverage; new test files are limited to the new pure onboarding domain.
- Every checklist item follows the required `- [ ] T### ...` format and includes a concrete file path.
