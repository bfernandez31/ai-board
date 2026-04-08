# Tasks: Project Onboarding Setup Flow

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-576-copy-of-project/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/project-setup-api.md`

**Tests**: Test tasks are included by default per the constitution. Existing test files are extended first; new test files are introduced only where the feature adds a distinct setup domain with no clean existing home.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an independently testable increment.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel with other `[P]` tasks in the same phase because the tasks touch different files and have no incomplete-task dependency
- **[Story]**: User story label for story-specific work only (`[US1]`, `[US2]`, `[US3]`)
- Every task below includes an exact file path or a justified new file path from the implementation plan

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Introduce the shared schema and setup-domain module scaffolding that every story depends on.

- [ ] T001 Extend `prisma/schema.prisma` with the `ProjectSetupStatus` enum, `ProjectSetupAttempt` model, and `Project.setupAttempts` relation.
- [ ] T002 [P] Create shared setup DTOs and derived-state types in `lib/project-setup/types.ts`.
- [ ] T003 [P] Create setup lifecycle transition helpers in `lib/project-setup/state.ts`.
- [ ] T004 Create setup workflow dispatch helpers in `lib/project-setup/workflow-dispatch.ts`.
- [ ] T005 Create the core setup orchestration service in `lib/project-setup/service.ts`.

**Checkpoint**: The schema and setup domain module exist, but no user-facing flow is exposed yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire the shared loaders, workflow plumbing, and project metadata surfaces required before story work can proceed.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T006 Extend `lib/db/projects.ts` with project loaders that join the latest setup attempt and authoritative config-sync state.
- [ ] T007 [P] Extend `app/api/projects/[projectId]/route.ts` to include setup-related project metadata used by project navigation and status surfaces.
- [ ] T008 [P] Extend `tests/integration/projects/crud.test.ts` with coverage for the project detail response fields added in `app/api/projects/[projectId]/route.ts`.
- [ ] T009 Create the project onboarding workflow in `.github/workflows/project-onboarding.yml` with dispatch inputs and workflow-auth callback steps.

**Checkpoint**: Shared persistence, loading, and workflow plumbing are ready for story-specific API and UI work.

---

## Phase 3: User Story 1 - Start Project Setup for an Imported Repository (Priority: P1) 🎯 MVP

**Goal**: Imported projects without synced config land on a working setup screen where the owner can choose an eligible agent and start onboarding.

**Independent Test**: Import an unconfigured repository, land on `/projects/{id}/setup`, confirm owner-only access and credential readiness messaging, then start setup successfully with an eligible agent.

### Tests for User Story 1

- [ ] T010 [P] [US1] Extend `tests/integration/projects/import.test.ts` with coverage for config-missing imports redirecting to `/projects/{id}/setup`.
- [ ] T011 [P] [US1] Create owner/member setup read/start endpoint coverage in `tests/integration/projects/setup.test.ts`.
- [ ] T012 [P] [US1] Extend `tests/integration/credentials/workflow-credential.test.ts` with selected-agent credential readiness scenarios used by setup start validation.
- [ ] T013 [P] [US1] Extend `tests/unit/components/projects/import-project-modal.test.tsx` with setup redirect handling and missing-config messaging assertions.

### Implementation for User Story 1

- [ ] T014 [P] [US1] Create the canonical project entry redirect page in `app/projects/[projectId]/page.tsx`.
- [ ] T015 [P] [US1] Create the setup status read endpoint in `app/api/projects/[projectId]/setup/route.ts`.
- [ ] T016 [P] [US1] Create the owner-only setup start endpoint in `app/api/projects/[projectId]/setup/attempts/route.ts`.
- [ ] T017 [P] [US1] Create the setup route page shell in `app/projects/[projectId]/setup/page.tsx`.
- [ ] T018 [P] [US1] Create the setup page container in `components/projects/project-setup-page.tsx`.
- [ ] T019 [P] [US1] Create the owner start/retry form in `components/projects/project-setup-start-form.tsx`.
- [ ] T020 [P] [US1] Create the initial setup state renderer in `components/projects/project-setup-status.tsx`.
- [ ] T021 [US1] Extend `lib/ai-credentials/workflow.ts` with the setup agent-to-provider readiness lookup used by the setup endpoints.
- [ ] T022 [US1] Extend `components/projects/import-project-modal.tsx` to preserve the setup redirect path and owner guidance copy after import.
- [ ] T023 [US1] Extend `components/projects/project-card.tsx` so project entry routes through `/projects/[projectId]` instead of hardcoding `/board`.
- [ ] T024 [US1] Extend `app/projects/[projectId]/board/page.tsx` to redirect unconfigured projects to `/projects/[projectId]/setup`.

**Checkpoint**: Owners can start setup from a real setup page, while members can only view status and all entry paths respect setup gating.

---

## Phase 4: User Story 2 - Monitor Setup Progress and Recover from Failure (Priority: P2)

**Goal**: Setup progress persists across refreshes, duplicate starts are rejected, failures stay visible, and retries create a fresh attempt.

**Independent Test**: Start setup, refresh while it is pending/running, observe status continuity and elapsed time, force a failure through the callback, then retry and confirm a new attempt is tracked while duplicate starts are blocked.

### Tests for User Story 2

- [ ] T025 [P] [US2] Extend `tests/integration/projects/setup.test.ts` with duplicate-start rejection, refresh/resume, failure display, and retry-history scenarios.
- [ ] T026 [P] [US2] Extend `tests/integration/jobs/status.test.ts` with workflow-auth callback assertions reused by the setup status callback contract.
- [ ] T027 [P] [US2] Create component coverage for polling, failure, and retry UI states in `tests/unit/components/projects/project-setup-page.test.tsx`.

### Implementation for User Story 2

- [ ] T028 [P] [US2] Create the workflow-authenticated setup callback route in `app/api/projects/[projectId]/setup/attempts/[attemptId]/status/route.ts`.
- [ ] T029 [P] [US2] Extend `lib/project-setup/service.ts` with duplicate-attempt prevention, retry creation, and callback update orchestration.
- [ ] T030 [P] [US2] Extend `lib/project-setup/state.ts` with stale-callback handling, elapsed-time derivation, and latest-attempt-wins logic.
- [ ] T031 [P] [US2] Extend `.github/workflows/project-onboarding.yml` to post `RUNNING` and `FAILED` status updates with human-readable messages.
- [ ] T032 [US2] Extend `app/api/projects/[projectId]/setup/route.ts` to return persisted latest-attempt progress, elapsed time, and member-visible status details.
- [ ] T033 [US2] Extend `components/projects/project-setup-page.tsx` with polling, refresh-safe state restoration, and retry mutation wiring.
- [ ] T034 [US2] Extend `components/projects/project-setup-status.tsx` to render in-progress progress text, elapsed time, failure details, and retry affordances.

**Checkpoint**: Setup state survives refreshes, old failures remain visible, and each retry becomes a new authoritative attempt without allowing duplicate active runs.

---

## Phase 5: User Story 3 - Complete Setup and Enter the Project Board (Priority: P3)

**Goal**: Successful onboarding synchronizes project config, shows artifact summary, and transitions the project into the normal board experience.

**Independent Test**: Complete a setup attempt through the callback, verify config sync succeeds before the attempt is treated as complete, review the artifact summary, and confirm subsequent project entry bypasses setup and opens the board.

### Tests for User Story 3

- [ ] T035 [P] [US3] Extend `tests/integration/projects/config-sync.test.ts` with setup-completion sync success and sync-failure persistence scenarios.
- [ ] T036 [P] [US3] Extend `tests/integration/projects/setup.test.ts` with completion, artifact-summary rendering, and post-completion redirect coverage.
- [ ] T037 [P] [US3] Extend `tests/integration/projects/crud.test.ts` with canonical `/projects/{id}` redirect behavior after setup completion.

### Implementation for User Story 3

- [ ] T038 [P] [US3] Extend `lib/config-sync.ts` with the setup-completion sync entry point required by the setup callback flow.
- [ ] T039 [P] [US3] Extend `lib/project-setup/service.ts` so `COMPLETED` callbacks run config sync before persisting terminal success and preserve artifact summaries on sync failure.
- [ ] T040 [P] [US3] Extend `.github/workflows/project-onboarding.yml` to post `COMPLETED` callbacks with artifact summary payloads.
- [ ] T041 [US3] Extend `app/api/projects/[projectId]/setup/attempts/[attemptId]/status/route.ts` to finalize completion responses only after config sync succeeds.
- [ ] T042 [US3] Extend `app/projects/[projectId]/page.tsx` so completed projects redirect straight to `/projects/[projectId]/board`.
- [ ] T043 [US3] Extend `app/projects/[projectId]/board/page.tsx` so completed projects bypass setup while incomplete projects still redirect to `/projects/[projectId]/setup`.
- [ ] T044 [US3] Extend `components/projects/project-setup-status.tsx` to render the completed artifact summary and board-entry CTA before redirecting away from setup.

**Checkpoint**: A successful onboarding run makes the project board-accessible on the next visit, while sync failures remain visible and retryable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Tighten the end-to-end setup experience across stories and lock in regression coverage.

- [ ] T045 [P] Harden shared setup serialization and response typing in `lib/project-setup/types.ts`.
- [ ] T046 [P] Harden setup response typing in `app/api/projects/[projectId]/setup/route.ts`.
- [ ] T047 [P] Add cross-story regression assertions for the full onboarding lifecycle in `tests/integration/projects/setup.test.ts`.
- [ ] T048 Validate import-to-setup guidance copy in `components/projects/import-project-modal.tsx`.
- [ ] T049 Validate setup page instructional copy in `components/projects/project-setup-page.tsx`.
- [ ] T050 Validate status, failure, and completion copy consistency in `components/projects/project-setup-status.tsx`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies and should start first.
- **Phase 2: Foundational** depends on Phase 1 and blocks all story work.
- **Phase 3: US1** depends on Phase 2 and delivers the MVP onboarding entry/start flow.
- **Phase 4: US2** depends on US1 because monitoring, retry, and duplicate-prevention build on the start flow and its endpoints.
- **Phase 5: US3** depends on US2 because completion semantics rely on the callback, history, and latest-attempt state model already being in place.
- **Phase 6: Polish** depends on the desired story phases being complete.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational; no dependency on later stories.
- **US2 (P2)**: Starts after US1; requires the start/read flow and setup page shell from US1.
- **US3 (P3)**: Starts after US2; requires callback persistence and retry-safe attempt state before completion sync and final redirects.

### Within Each User Story

- Tests must be written and observed failing before implementation changes begin.
- API read/start/callback tasks depend on the shared `lib/project-setup/` service and state helpers from Phases 1-2.
- UI page and component tasks depend on the corresponding route/read model for realistic data contracts.
- Integration of redirects should happen after the affected routes and setup status surfaces are implemented.

### Parallel Opportunities

- Phase 1 tasks `T002` and `T003` can run in parallel after `T001` starts schema work.
- Phase 2 tasks `T007` and `T008` can run in parallel once `T006` defines the shared loader shape.
- In US1, tests `T010`-`T013` can run in parallel, and implementation tasks `T014`-`T020` can be split across route and component files.
- In US2, tests `T025`-`T027` can run in parallel, and implementation tasks `T028`-`T031` can proceed concurrently because they touch separate files.
- In US3, tests `T035`-`T037` can run in parallel, and implementation tasks `T038`-`T040` can run in parallel before route/UI integration.

---

## Parallel Example: User Story 1

```bash
# Launch US1 test work together
Task: "Extend tests/integration/projects/import.test.ts with setup redirect coverage"
Task: "Create tests/integration/projects/setup.test.ts for owner/member setup read/start scenarios"
Task: "Extend tests/integration/credentials/workflow-credential.test.ts with selected-agent readiness checks"
Task: "Extend tests/unit/components/projects/import-project-modal.test.tsx with setup redirect assertions"

# Split US1 implementation by independent files
Task: "Create app/projects/[projectId]/page.tsx"
Task: "Create app/api/projects/[projectId]/setup/route.ts"
Task: "Create app/api/projects/[projectId]/setup/attempts/route.ts"
Task: "Create components/projects/project-setup-page.tsx"
Task: "Create components/projects/project-setup-start-form.tsx"
Task: "Create components/projects/project-setup-status.tsx"
```

## Parallel Example: User Story 2

```bash
# Launch US2 tests together
Task: "Extend tests/integration/projects/setup.test.ts with retry and duplicate-start scenarios"
Task: "Extend tests/integration/jobs/status.test.ts with setup callback auth coverage"
Task: "Create tests/unit/components/projects/project-setup-page.test.tsx for polling and retry states"

# Split US2 implementation by callback, workflow, and UI concerns
Task: "Create app/api/projects/[projectId]/setup/attempts/[attemptId]/status/route.ts"
Task: "Extend lib/project-setup/service.ts with retry/callback orchestration"
Task: "Extend lib/project-setup/state.ts with stale-callback and elapsed-time logic"
Task: "Extend .github/workflows/project-onboarding.yml with RUNNING/FAILED callbacks"
```

## Parallel Example: User Story 3

```bash
# Launch US3 tests together
Task: "Extend tests/integration/projects/config-sync.test.ts with setup completion sync coverage"
Task: "Extend tests/integration/projects/setup.test.ts with artifact summary and redirect assertions"
Task: "Extend tests/integration/projects/crud.test.ts with canonical project-entry redirect coverage"

# Split US3 implementation by sync, workflow, and UI concerns
Task: "Extend lib/config-sync.ts with setup completion sync support"
Task: "Extend lib/project-setup/service.ts with COMPLETED->sync finalization"
Task: "Extend .github/workflows/project-onboarding.yml with COMPLETED artifact callbacks"
Task: "Extend components/projects/project-setup-status.tsx with completion summary rendering"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: US1.
4. Validate the MVP by importing an unconfigured project and starting setup from `/projects/{id}/setup`.

### Incremental Delivery

1. Finish Setup + Foundational to establish the schema, loaders, and workflow plumbing.
2. Deliver US1 for working onboarding entry/start behavior.
3. Deliver US2 for long-running visibility, failure recovery, and retry safety.
4. Deliver US3 for completion sync, artifact review, and board entry.
5. Finish with Phase 6 regression hardening.

### Parallel Execution Strategy

1. Run Phase 1 and Phase 2 sequentially because they define shared types, loaders, and workflow plumbing.
2. Within each story phase, dispatch `[P]` tasks across independent files first.
3. Keep US2 after US1 and US3 after US2 to preserve the lifecycle dependency chain while still parallelizing work inside each phase.

---

## Notes

- All task descriptions use validated existing paths or justified new paths from `plan.md` and `research.md`.
- `tests/integration/projects/setup.test.ts` is the only new integration test file because the setup lifecycle would overcrowd unrelated project tests.
- `tests/unit/components/projects/project-setup-page.test.tsx` is justified because no existing component test file covers the new setup page domain.
- Contract coverage is implemented through Vitest integration tests because API tests in this repo use Vitest rather than Playwright.
