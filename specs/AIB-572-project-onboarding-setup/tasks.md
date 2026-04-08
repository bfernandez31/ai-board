# Tasks: Project Onboarding — Setup Page + Hybrid Workflow

**Input**: Design documents from `/specs/AIB-572-project-onboarding-setup/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema changes and config enum extensions required by all subsequent phases

- [x] T001 Add SetupJob model, SetupJobStatus enum, and Project.setupJobs relation to prisma/schema.prisma ✅ DONE
- [x] T002 Run Prisma migration to create SetupJob table with indexes on (projectId, status) and (projectId, createdAt DESC) ✅ DONE
- [x] T003 [P] Extend language, framework, and package manager enums (add ruby, php, rails, laravel, bundler, composer) in lib/validations/config.ts ✅ DONE

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend services, API routes, and hooks that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create SetupJob service with CRUD operations, duplicate guard (reject when PENDING/RUNNING exists), and status update methods in lib/setup/service.ts ✅ DONE
- [x] T005 [P] Create onboard workflow dispatch logic following lib/health/scan-dispatch.ts pattern (credential validation, Octokit dispatch, rollback on failure) in lib/setup/dispatch.ts ✅ DONE
- [x] T006 Create setup API route with POST (dispatch workflow) and GET (latest job status) handlers using verifyProjectOwnership guard in app/api/projects/[projectId]/setup/route.ts ✅ DONE
- [x] T007 [P] Create credential-check API route (GET with ?agent= query param, maps agent to provider via AGENT_PROVIDER_MAP, returns availability + guidance) in app/api/projects/[projectId]/setup/credential-check/route.ts ✅ DONE
- [x] T008 [P] Create TanStack Query polling hook with 2s refetchInterval for setup job status in hooks/use-setup-job.ts ✅ DONE
- [x] T009 Extend PATCH /api/jobs/[id]/status to handle SetupJob status callbacks (accept setupJobId field, update SetupJob record, trigger config sync on COMPLETED) in app/api/jobs/[id]/status/route.ts ✅ DONE

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 — Complete Onboarding of an Imported Repository (Priority: P1) 🎯 MVP

**Goal**: Owner imports a repo without `.ai-board/config.yml`, completes setup flow (agent selection → credential check → dispatch → poll → success), and lands on a working project board with synced configuration.

**Independent Test**: Import a repository without config, complete the setup flow, verify project board loads with valid configuration.

### Tests for User Story 1
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**
**RULE (constitution): No existing test files cover the "setup" domain — all test files below are new.**

- [x] T010 [P] [US1] Create SetupJob service unit tests (CRUD, duplicate guard logic, status transitions, config sync trigger) in tests/unit/setup/service.test.ts ✅ DONE
- [x] T011 [P] [US1] Create setup dispatch integration tests (POST /api/projects/[projectId]/setup — valid dispatch, owner-only guard, config-exists rejection, duplicate rejection, missing credential rejection) in tests/integration/setup/dispatch.test.ts ✅ DONE
- [x] T012 [P] [US1] Create setup status polling integration tests (GET /api/projects/[projectId]/setup — latest job retrieval, null when no jobs, hasConfig flag) in tests/integration/setup/status.test.ts ✅ DONE

### Implementation for User Story 1

- [x] T013 [US1] Create setup page server component with ownership guard and config-exists redirect in app/projects/[projectId]/setup/page.tsx ✅ DONE
- [x] T014 [P] [US1] Create agent-selector radio group component (Claude Code / Codex options, shadcn/ui RadioGroup) in components/setup/agent-selector.tsx ✅ DONE
- [x] T015 [P] [US1] Create credential-status indicator component (loading, available, unavailable states) in components/setup/credential-status.tsx ✅ DONE
- [x] T016 [P] [US1] Create setup-progress state display component (pending, running with elapsed time, completed, failed states) in components/setup/setup-progress.tsx ✅ DONE
- [x] T017 [P] [US1] Create setup-file-list component (displays list of committed files on success) in components/setup/setup-file-list.tsx ✅ DONE
- [x] T018 [US1] Create setup-wizard orchestrator client component (state machine: initial → checking-credential → ready/no-credential → dispatching → polling → completed/failed) in components/setup/setup-wizard.tsx ✅ DONE
- [x] T019 [US1] Create onboard workflow definition (two-phase: repo clone + agent setup → Phase 1 detection + Phase 2 LLM → commit + callback) in .github/workflows/onboard.yml ✅ DONE
- [x] T020 [US1] Add config sync trigger on setup job completion (call syncProjectConfig after COMPLETED status) in lib/setup/service.ts ✅ DONE
- [x] T021 [P] [US1] Create setup-wizard component tests (state transitions, dispatch flow, polling lifecycle, success/redirect) in tests/unit/components/setup/setup-wizard.test.tsx ✅ DONE
- [x] T022 [P] [US1] Create agent-selector component tests (selection change events, default selection, radio group behavior) in tests/unit/components/setup/agent-selector.test.tsx ✅ DONE

**Checkpoint**: At this point, the complete happy-path onboarding flow should be functional and testable independently

---

## Phase 4: User Story 4 — Deterministic Stack Detection (Priority: P1)

**Goal**: Phase 1 of the onboard workflow scans the target repository for manifest files and lockfiles, producing a valid `config.yml` and `analysis.json` for the LLM phase.

**Independent Test**: Run the detection script against repositories with known tech stacks and validate generated `config.yml` against the configuration schema.

### Tests for User Story 4

- [x] T023 [P] [US4] Create unit tests for stack detection (TypeScript/Next.js/Bun, Rust/Actix/Cargo, Python/FastAPI, Ruby/Rails/Bundler, PHP/Laravel/Composer, Go, Java/Kotlin, unknown/minimal fallback) in tests/unit/setup/detect-stack.test.ts ✅ DONE

### Implementation for User Story 4

- [x] T024 [US4] Create deterministic stack detection script (scan for package.json, Cargo.toml, pyproject.toml, Gemfile, composer.json, go.mod, pom.xml/build.gradle; detect language, framework, package manager, services, test framework; output config.yml + analysis.json) in .specify/scripts/bash/detect-stack.sh ✅ DONE

**Checkpoint**: Stack detection script produces valid, schema-compliant config.yml for all 7+ language ecosystems

---

## Phase 5: User Story 2 — Setup Page Guards and State Recovery (Priority: P2)

**Goal**: Setup page enforces access controls (owner-only), redirects configured projects, and correctly resumes in-progress onboarding state after page refresh.

**Independent Test**: Access setup page as non-owner (denied), with existing config (redirected), with running job (shows progress), attempt duplicate dispatch (rejected).

### Tests for User Story 2

- [ ] T025 [US2] Extend import integration tests to verify setup redirect when no config detected in tests/integration/projects/import.test.ts
- [ ] T026 [P] [US2] Create guard integration tests (non-owner access returns 403, configured project returns redirect, duplicate dispatch returns 409, running state recovery after refresh) in tests/integration/setup/guards.test.ts

### Implementation for User Story 2

- [ ] T027 [US2] Add config-exists redirect logic (check configSyncedAt, redirect to /projects/[id]/board) to setup page in app/projects/[projectId]/setup/page.tsx
- [ ] T028 [US2] Add running-state recovery on page refresh (on mount, check for existing PENDING/RUNNING job via GET, resume polling instead of showing initial state) in components/setup/setup-wizard.tsx
- [ ] T029 [US2] Add import flow integration: verify import-project-modal.tsx routes to /projects/${id}/setup when no config in components/projects/import-project-modal.tsx

**Checkpoint**: Guards prevent all unauthorized access, duplicate dispatch, and state is preserved across refreshes

---

## Phase 6: User Story 3 — Credential Validation Before Dispatch (Priority: P2)

**Goal**: Setup page verifies credential availability for the selected agent before enabling dispatch. Missing credentials show guidance messaging.

**Independent Test**: Select agent with configured credential (button enabled), select agent without credential (button disabled + guidance shown), switch agents (new check fires).

### Tests for User Story 3

- [ ] T030 [US3] Create credential-check integration tests (GET /api/projects/[projectId]/setup/credential-check — available=true with valid credential, available=false with guidance when missing, provider mapping for CLAUDE→ANTHROPIC and CODEX→OPENAI) in tests/integration/setup/credential-check.test.ts

### Implementation for User Story 3

- [ ] T031 [US3] Add credential guidance messaging (provider-specific help text, link to Settings → Credentials) and disabled button state to credential-status component in components/setup/credential-status.tsx
- [ ] T032 [US3] Add debounced credential re-check on agent switch (300ms debounce, cancel previous request, update button state) in components/setup/setup-wizard.tsx

**Checkpoint**: Users cannot dispatch without a valid credential and receive clear guidance to resolve missing credentials

---

## Phase 7: User Story 5 — LLM-Powered Content Generation (Priority: P2)

**Goal**: Phase 2 of the onboard workflow uses an AI agent to generate project-specific CLAUDE.md, constitution.md, and AGENTS.md based on analysis.json and codebase inspection.

**Independent Test**: Run the agent command against a known codebase and verify generated files contain project-specific content (not generic templates).

### Implementation for User Story 5

- [ ] T033 [US5] Create agent onboard command (receive analysis.json context, browse target repo, generate CLAUDE.md with tech stack/commands/models/testing/architecture sections, generate constitution.md with observed-pattern principles, create AGENTS.md symlink, skip CLAUDE.md if already exists) in .claude/commands/onboard.md
- [ ] T034 [US5] Add Phase 2 LLM generation steps to onboard workflow (install agent CLI, run onboard command with analysis.json, handle skip-if-exists logic, partial success on Phase 2 failure) in .github/workflows/onboard.yml

**Checkpoint**: Onboard workflow produces intelligent, project-specific configuration files via LLM analysis

---

## Phase 8: User Story 6 — Error Recovery and Retry (Priority: P3)

**Goal**: Failed onboarding shows error details and allows retry. Partial success (Phase 1 ok, Phase 2 failed) shows which files were committed and which were not.

**Independent Test**: Simulate workflow failure, verify error state UI, click retry, verify new job is dispatched. Simulate partial success, verify completed/missing file lists.

### Tests for User Story 6

- [ ] T035 [US6] Create error recovery and retry integration tests (FAILED status shows error, retry creates new SetupJob, partial completion with isPartial=true shows correct file lists) in tests/integration/setup/retry.test.ts

### Implementation for User Story 6

- [ ] T036 [US6] Add error state display with errorMessage and "Retry" button to setup-progress component in components/setup/setup-progress.tsx
- [ ] T037 [US6] Add partial completion UI (isPartial flag handling, split display of committed files vs. missing LLM files, warning banner) in components/setup/setup-wizard.tsx
- [ ] T038 [US6] Add retry dispatch logic (create new SetupJob via POST, reset wizard to polling state) in components/setup/setup-wizard.tsx

**Checkpoint**: Users can recover from any failure state and understand exactly what succeeded and what did not

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T039 [P] Add .gitignore handling to onboard workflow (add .ai-board/ if not present, idempotent) in .github/workflows/onboard.yml
- [ ] T040 [P] Performance validation: verify setup page load < 1s and credential check < 500ms
- [ ] T041 Cross-story integration validation: end-to-end onboarding flow (import → setup → detect → generate → commit → config sync → board redirect)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Prisma migration must complete first) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core onboarding flow
- **US4 (Phase 4)**: Depends on Phase 1 only (detection script is standalone) — can run in parallel with Phase 2/3
- **US2 (Phase 5)**: Depends on Phase 3 (guards extend existing setup page and wizard)
- **US3 (Phase 6)**: Depends on Phase 2 (credential-check API) and Phase 3 (credential-status component)
- **US5 (Phase 7)**: Depends on Phase 4 (needs analysis.json from detection) — can run in parallel with US2/US3
- **US6 (Phase 8)**: Depends on Phase 3 (extends setup-progress and setup-wizard)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **US4 (P1)**: Can start after Setup (Phase 1) — independent shell script, parallelizable with all other stories
- **US2 (P2)**: Depends on US1 (extends setup page/wizard) — independently testable
- **US3 (P2)**: Depends on US1 (extends credential-status/wizard) — independently testable
- **US5 (P2)**: Depends on US4 (uses analysis.json output) — independently testable
- **US6 (P3)**: Depends on US1 (extends progress/wizard components) — independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/schema before services
- Services before API routes
- API routes before UI components
- Sub-components before orchestrator (setup-wizard)
- Core implementation before integration

### Parallel Opportunities

- T003 can run in parallel with T001-T002 (different files)
- T005, T007, T008 can run in parallel (different files, no dependencies)
- T010, T011, T012 can all run in parallel (different test files)
- T014, T015, T016, T017 can all run in parallel (independent sub-components)
- T021, T022 can run in parallel (different test files)
- US4 (Phase 4) can run entirely in parallel with US1 (Phase 3)
- US5 (Phase 7) can run in parallel with US2 (Phase 5) and US3 (Phase 6)

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (T010, T011, T012):
Task: "Create SetupJob service unit tests in tests/unit/setup/service.test.ts"
Task: "Create setup dispatch integration tests in tests/integration/setup/dispatch.test.ts"
Task: "Create setup status polling integration tests in tests/integration/setup/status.test.ts"

# Launch all US1 sub-components together (T014, T015, T016, T017):
Task: "Create agent-selector component in components/setup/agent-selector.tsx"
Task: "Create credential-status component in components/setup/credential-status.tsx"
Task: "Create setup-progress component in components/setup/setup-progress.tsx"
Task: "Create setup-file-list component in components/setup/setup-file-list.tsx"

# Launch US1 component tests together (T021, T022):
Task: "Create setup-wizard component tests in tests/unit/components/setup/setup-wizard.test.tsx"
Task: "Create agent-selector component tests in tests/unit/components/setup/agent-selector.test.tsx"
```

## Parallel Example: Cross-Story

```bash
# After Phase 2 completes, US1 and US4 can start simultaneously:
Parallel Track A (US1): T010-T022 (setup page + API flow)
Parallel Track B (US4): T023-T024 (stack detection script)

# After US1 completes, US2, US3, and US6 can start simultaneously:
Parallel Track A (US2): T025-T029 (guards and state recovery)
Parallel Track B (US3): T030-T032 (credential validation)
Parallel Track C (US6): T035-T038 (error recovery)

# US5 can start as soon as US4 completes (independent of US2/US3/US6):
Parallel Track D (US5): T033-T034 (LLM content generation)
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 4 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T009)
3. Complete Phase 3: User Story 1 (T010-T022) — in parallel with Phase 4
4. Complete Phase 4: User Story 4 (T023-T024)
5. **STOP and VALIDATE**: Test end-to-end onboarding flow independently
6. Deploy/demo if ready — project is functional with config detection + basic setup flow

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 + US4 → Core onboarding works → Deploy/Demo (**MVP!**)
3. US2 → Guards and state recovery hardened → Deploy/Demo
4. US3 → Credential validation polished → Deploy/Demo
5. US5 → LLM-generated content added → Deploy/Demo
6. US6 → Error recovery complete → Deploy/Demo
7. Polish → Performance validated, integration tested → Final Deploy

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup + Foundational phases sequentially (T001-T009)
2. Once Foundational is done, two P1 stories run in parallel:
   - Parallel task 1: User Story 1 (T010-T022)
   - Parallel task 2: User Story 4 (T023-T024)
3. Once US1 completes, three P2/P3 stories run in parallel:
   - Parallel task 1: User Story 2 (T025-T029)
   - Parallel task 2: User Story 3 (T030-T032)
   - Parallel task 3: User Story 6 (T035-T038)
4. Once US4 completes, US5 can also start:
   - Parallel task 4: User Story 5 (T033-T034)
5. Polish phase after all stories complete (T039-T041)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- All new test files are confirmed NEW — no existing test files cover the "setup" domain
- All source file paths verified against current repository state
- Existing patterns to follow: lib/health/scan-dispatch.ts (dispatch), lib/ai-credentials/workflow.ts (credential check), app/projects/[projectId]/board/page.tsx (server component guard)
