# Tasks: Project Onboarding Setup Page and Hybrid Initialization Workflow

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/contracts/project-setup-api.yaml`

**Tests**: Test tasks are included by default per constitution requirements. Existing test owners are extended first; new test files are added only where the research inventory identified a real ownership gap.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the foundational phase.

## Phase 1: Setup

**Purpose**: Establish shared setup DTOs, validation, and query key scaffolding used across the feature.

- [x] T001 Create setup request/response validation schemas in `/home/runner/work/ai-board/ai-board/target/app/lib/schemas/project-setup.ts` ✅ DONE
- [x] T002 [P] Create onboarding DTO and artifact manifest types in `/home/runner/work/ai-board/ai-board/target/lib/onboarding/types.ts` ✅ DONE
- [x] T003 [P] Extend setup, status, and artifact review query keys in `/home/runner/work/ai-board/ai-board/target/app/lib/query-keys.ts` ✅ DONE

---

## Phase 2: Foundational

**Purpose**: Build the blocking persistence, access-resolution, and orchestration foundation required by every user story.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [x] T004 Add `ProjectSetupJob` schema, status enum, and `Project.setupJobs` relation in `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` ✅ DONE
- [x] T005 Generate the Prisma migration for `ProjectSetupJob` in `/home/runner/work/ai-board/ai-board/target/prisma/migrations/` and regenerate the client from `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` ✅ DONE
- [x] T006 [P] Create setup-required access resolution helpers in `/home/runner/work/ai-board/ai-board/target/lib/onboarding/access.ts` ✅ DONE
- [x] T007 [P] Create authoritative setup job lifecycle orchestration in `/home/runner/work/ai-board/ai-board/target/lib/onboarding/service.ts` ✅ DONE
- [x] T008 [P] Create repository-backed onboarding artifact helpers in `/home/runner/work/ai-board/ai-board/target/lib/onboarding/artifacts.ts` ✅ DONE
- [x] T009 [P] Extend provider credential lookup and workflow secret mapping in `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/workflow.ts` and `/home/runner/work/ai-board/ai-board/target/app/api/internal/credentials/route.ts` ✅ DONE

**Checkpoint**: Persistence, access gating, credential resolution, and artifact helpers are ready for story implementation.

---

## Phase 3: User Story 1 - Initialize an imported project (Priority: P1) 🎯 MVP

**Goal**: Route imported projects without synced config into a functional owner-only setup flow, start onboarding, and return successful runs to the normal board.

**Independent Test**: Import a repository with no synced config, open the project, select an eligible agent on `/projects/{projectId}/setup`, start onboarding, observe a running setup job, and confirm the completed run unlocks the board.

### Tests for User Story 1

- [x] T010 [P] [US1] Extend missing-config import redirect coverage in `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/import.test.ts` ✅ DONE
- [x] T011 [P] [US1] Create setup state, dispatch, polling, and callback API coverage in `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup.test.ts` ✅ DONE
- [x] T012 [P] [US1] Extend import modal board-to-setup handoff coverage in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/projects/import-project-modal.test.tsx` ✅ DONE
- [x] T013 [P] [US1] Extend post-onboarding config sync and setup-bypass coverage in `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/config-sync.test.ts` ✅ DONE

### Implementation for User Story 1

- [x] T014 [US1] Extend project-level setup gating in `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/layout.tsx` ✅ DONE
- [x] T015 [P] [US1] Extend setup-aware project entry navigation in `/home/runner/work/ai-board/ai-board/target/components/projects/project-card.tsx` and `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/board/page.tsx` ✅ DONE
- [x] T016 [US1] Create the owner-only setup route in `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/setup/page.tsx` ✅ DONE
- [x] T017 [P] [US1] Create setup page client components for agent selection, running progress, and completion summary in `/home/runner/work/ai-board/ai-board/target/components/projects/setup/` ✅ DONE
- [x] T018 [US1] Implement setup state and onboarding dispatch handlers in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/route.ts` ✅ DONE
- [x] T019 [US1] Implement setup polling and workflow callback handling in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/status/route.ts` ✅ DONE
- [x] T020 [US1] Create the hybrid onboarding workflow in `/home/runner/work/ai-board/ai-board/target/.github/workflows/project-onboarding.yml` ✅ DONE
- [x] T021 [P] [US1] Add onboarding command and workflow helper scripts in `/home/runner/work/ai-board/ai-board/target/.github/scripts/` and `/home/runner/work/ai-board/ai-board/target/.claude/commands/` ✅ DONE
- [x] T022 [US1] Reuse config synchronization after successful onboarding in `/home/runner/work/ai-board/ai-board/target/lib/config-sync.ts` and `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/status/route.ts` ✅ DONE

**Checkpoint**: Imported projects that need onboarding can be initialized end-to-end and reach the board after a successful run.

---

## Phase 4: User Story 2 - Prevent invalid or duplicate onboarding runs (Priority: P2)

**Goal**: Block setup starts when credentials are not ready or an authoritative onboarding run is already pending/running, while making the active state resumable after refresh.

**Independent Test**: Open the setup page with a missing credential and verify dispatch stays blocked with actionable guidance; then revisit the page during an active onboarding run and confirm the current job resumes instead of allowing a duplicate start.

### Tests for User Story 2

- [x] T023 [P] [US2] Extend setup credential-readiness response coverage in `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/credentials-api.test.ts` ✅ DONE
- [x] T024 [P] [US2] Extend onboarding workflow credential handoff coverage for `CLAUDE` and `CODEX` in `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/workflow-credential.test.ts` ✅ DONE
- [x] T025 [P] [US2] Extend provider-aware dispatch guard coverage in `/home/runner/work/ai-board/ai-board/target/tests/unit/credential-dispatch-guard.test.ts` ✅ DONE
- [x] T026 [P] [US2] Extend duplicate active setup job rejection and resume coverage in `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup.test.ts` ✅ DONE

### Implementation for User Story 2

- [x] T027 [US2] Extend setup validation and selected-agent readiness parsing in `/home/runner/work/ai-board/ai-board/target/app/lib/schemas/project-setup.ts` and `/home/runner/work/ai-board/ai-board/target/app/lib/schemas/agent.ts` ✅ DONE
- [x] T028 [US2] Extend duplicate-run prevention and authoritative active-job reuse in `/home/runner/work/ai-board/ai-board/target/lib/onboarding/service.ts` ✅ DONE
- [x] T029 [US2] Enforce owner-only credential readiness and duplicate dispatch rejection in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/route.ts` ✅ DONE
- [x] T030 [US2] Surface resumable running and blocked states in `/home/runner/work/ai-board/ai-board/target/components/projects/setup/` and `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/status/route.ts` ✅ DONE

**Checkpoint**: Setup cannot be started in invalid states, and active runs resume cleanly after reloads or revisits.

---

## Phase 5: User Story 3 - Recover from onboarding failure and review outputs (Priority: P3)

**Goal**: Let owners retry after failed onboarding runs and review or edit generated onboarding artifacts from project settings after successful completion.

**Independent Test**: Force an onboarding failure, confirm the setup page shows actionable failure details and starts a fresh retry, then complete a later run and verify the generated artifacts are reviewable and editable from project settings.

### Tests for User Story 3

- [x] T031 [P] [US3] Extend failed callback, terminal error, and fresh-retry coverage in `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup.test.ts` ✅ DONE
- [x] T032 [P] [US3] Extend onboarding artifact review and update API coverage in `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/settings.test.ts` ✅ DONE
- [x] T033 [P] [US3] Extend settings UI coverage for onboarding artifact review and editing in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/config-card.test.tsx` ✅ DONE

### Implementation for User Story 3

- [x] T034 [US3] Persist terminal failure details, completion summaries, and fresh-retry semantics in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/status/route.ts` and `/home/runner/work/ai-board/ai-board/target/lib/onboarding/service.ts` ✅ DONE
- [x] T035 [US3] Create onboarding artifact review and update handlers in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/settings/onboarding-artifacts/route.ts` ✅ DONE
- [x] T036 [P] [US3] Create the onboarding artifact review card in `/home/runner/work/ai-board/ai-board/target/components/settings/onboarding-artifacts-card.tsx` ✅ DONE
- [x] T037 [US3] Extend the settings surface to mount onboarding artifact review alongside config in `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/settings/page.tsx` and `/home/runner/work/ai-board/ai-board/target/components/settings/config-card.tsx` ✅ DONE
- [x] T038 [US3] Implement repository-backed artifact fetch, edit, and commit helpers in `/home/runner/work/ai-board/ai-board/target/lib/onboarding/artifacts.ts` ✅ DONE

**Checkpoint**: Failed runs can be retried safely, and successful runs expose editable onboarding artifacts from project settings.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Close remaining browser-only validation, telemetry, and cache coherence gaps across the completed stories.

- [x] T039 [P] Add selective browser-only setup journey coverage in `/home/runner/work/ai-board/ai-board/target/tests/e2e/project-setup-onboarding.spec.ts` ✅ DONE
- [x] T040 [P] Harden workflow callback telemetry and authoritative transition logging in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/status/route.ts` and `/home/runner/work/ai-board/ai-board/target/.github/workflows/project-onboarding.yml` ✅ DONE
- [x] T041 [P] Finalize setup success invalidation and navigation cache behavior in `/home/runner/work/ai-board/ai-board/target/app/lib/query-keys.ts` and `/home/runner/work/ai-board/ai-board/target/components/projects/setup/` ✅ DONE

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies and can start immediately.
- **Phase 2: Foundational** depends on Phase 1 and blocks all story work.
- **Phase 3: US1** depends on Phase 2 and delivers the MVP.
- **Phase 4: US2** depends on the setup APIs and UI introduced in US1.
- **Phase 5: US3** depends on the setup job lifecycle from US1 and the authoritative status handling tightened in US2.
- **Phase 6: Polish** depends on the stories you intend to ship.

### User Story Dependencies

- **US1 (P1)**: Starts after foundational work and has no dependency on later stories.
- **US2 (P2)**: Builds on US1 setup APIs and UI, especially active-job persistence and dispatch flow.
- **US3 (P3)**: Builds on US1 completion flow and US2 authoritative status handling.

### Within Each User Story

- Tests must be written first and should fail before implementation starts.
- Persistence and validation changes precede route handlers.
- Route handlers precede UI wiring for running, completed, and error states.
- Workflow and repository commit logic must be in place before success-path integration is considered complete.

### Suggested Story Completion Order

1. Complete Setup and Foundational phases.
2. Deliver **US1** as the MVP.
3. Add **US2** to protect integrity and resume behavior.
4. Add **US3** for recovery and long-term settings review.
5. Finish Polish tasks that remain necessary for release confidence.

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`.
- `T006`, `T007`, `T008`, and `T009` can run in parallel once `T004` is defined.
- In **US1**, `T010` through `T013` can run in parallel, then `T015`, `T017`, and `T021` can proceed alongside the main API/workflow path.
- In **US2**, `T023` through `T026` can run in parallel, then `T028` and `T030` can proceed once schema updates are settled.
- In **US3**, `T031` through `T033` can run in parallel, then `T036` can proceed alongside `T035` and `T038`.

---

## Parallel Example: User Story 1

```bash
Task: "Extend missing-config import redirect coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/import.test.ts"
Task: "Create setup state, dispatch, polling, and callback API coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup.test.ts"
Task: "Extend import modal board-to-setup handoff coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/components/projects/import-project-modal.test.tsx"
Task: "Extend post-onboarding config sync and setup-bypass coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/config-sync.test.ts"
```

```bash
Task: "Extend setup-aware project entry navigation in /home/runner/work/ai-board/ai-board/target/components/projects/project-card.tsx and /home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/board/page.tsx"
Task: "Create setup page client components for agent selection, running progress, and completion summary in /home/runner/work/ai-board/ai-board/target/components/projects/setup/"
Task: "Add onboarding command and workflow helper scripts in /home/runner/work/ai-board/ai-board/target/.github/scripts/ and /home/runner/work/ai-board/ai-board/target/.claude/commands/"
```

## Parallel Example: User Story 2

```bash
Task: "Extend setup credential-readiness response coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/credentials/credentials-api.test.ts"
Task: "Extend onboarding workflow credential handoff coverage for CLAUDE and CODEX in /home/runner/work/ai-board/ai-board/target/tests/integration/credentials/workflow-credential.test.ts"
Task: "Extend provider-aware dispatch guard coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/credential-dispatch-guard.test.ts"
Task: "Extend duplicate active setup job rejection and resume coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup.test.ts"
```

```bash
Task: "Extend duplicate-run prevention and authoritative active-job reuse in /home/runner/work/ai-board/ai-board/target/lib/onboarding/service.ts"
Task: "Surface resumable running and blocked states in /home/runner/work/ai-board/ai-board/target/components/projects/setup/ and /home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/status/route.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Extend failed callback, terminal error, and fresh-retry coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup.test.ts"
Task: "Extend onboarding artifact review and update API coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/settings.test.ts"
Task: "Extend settings UI coverage for onboarding artifact review and editing in /home/runner/work/ai-board/ai-board/target/tests/unit/components/config-card.test.tsx"
```

```bash
Task: "Create onboarding artifact review and update handlers in /home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/settings/onboarding-artifacts/route.ts"
Task: "Create the onboarding artifact review card in /home/runner/work/ai-board/ai-board/target/components/settings/onboarding-artifacts-card.tsx"
Task: "Implement repository-backed artifact fetch, edit, and commit helpers in /home/runner/work/ai-board/ai-board/target/lib/onboarding/artifacts.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate the import → setup → onboarding → board path before taking on later stories.

### Incremental Delivery

1. Ship **US1** once imported projects can be initialized successfully.
2. Add **US2** to protect state integrity, credential gating, and resume behavior.
3. Add **US3** to cover failure recovery and settings-based artifact review.
4. Finish cross-cutting E2E, telemetry, and cache invalidation work needed for release confidence.

### Notes

- `[P]` marks tasks that can proceed in parallel because they target separate files or separate ownership areas.
- New file paths were limited to areas explicitly called out by the plan or justified by the research ownership inventory: `/lib/onboarding/`, `/app/projects/[projectId]/setup/`, `/app/api/projects/[projectId]/setup/`, `/app/api/projects/[projectId]/settings/onboarding-artifacts/`, `/components/projects/setup/`, `/components/settings/onboarding-artifacts-card.tsx`, `/tests/integration/projects/setup.test.ts`, `/tests/e2e/project-setup-onboarding.spec.ts`, and `/.github/workflows/project-onboarding.yml`.
- Existing test ownership was preserved by extending real files from the research inventory instead of introducing duplicate suites.
