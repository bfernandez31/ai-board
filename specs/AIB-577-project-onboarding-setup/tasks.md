# Tasks: Project Onboarding Setup Page, API, and Job Tracking

**Input**: Design documents from `/specs/AIB-577-project-onboarding-setup/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/setup-jobs-api.md

**Tests**: Included by default (constitution).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Data model and shared dispatch infrastructure needed by all user stories

- [ ] T001 Add `SetupJobStatus` enum and `ProjectSetupJob` model to `prisma/schema.prisma` per data-model.md (includes indexes, cascade delete, relation on Project)
- [ ] T002 Run Prisma migration and generate client (`bunx prisma migrate dev --name add-project-setup-job && bunx prisma generate`)
- [ ] T003 Create onboard workflow dispatch function in `lib/workflows/dispatch-onboard.ts` following `lib/health/scan-dispatch.ts` pattern (test mode bypass, credential resolution, Octokit dispatch)
- [ ] T004 [P] Add setup job query keys to `app/lib/query-keys.ts` (`setupJob(projectId)`, `credentialCheck(projectId, agent)`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API endpoints and polling hook that ALL user stories depend on

**CRITICAL**: No user story UI/integration work can begin until these endpoints exist

- [ ] T005 Implement POST handler in `app/api/projects/[projectId]/setup/jobs/route.ts` (create setup job + dispatch workflow, Zod validation, pre-flight checks per contracts/setup-jobs-api.md)
- [ ] T006 Implement GET handler in `app/api/projects/[projectId]/setup/jobs/route.ts` (latest setup job + configSyncedAt)
- [ ] T007 Implement PATCH handler in `app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts` (workflow callback, state transitions, config sync on COMPLETED, error persistence on FAILED)
- [ ] T008 [P] Implement GET handler in `app/api/projects/[projectId]/setup/credential-check/route.ts` (agent-to-provider mapping, credential existence check)
- [ ] T009 [P] Create setup job polling hook in `app/lib/hooks/useSetupJobPolling.ts` following `app/lib/hooks/useJobPolling.ts` pattern (2s interval, terminal state detection, staleTime: 0)

**Checkpoint**: All API endpoints and polling infrastructure ready

---

## Phase 3: User Story 1 - First-Time Project Setup (Priority: P1) MVP

**Goal**: Owner imports a repo without config, gets directed to setup page, selects agent, initializes, and is redirected to board on completion.

**Independent Test**: Import a repo without `.ai-board/config.yml`, complete setup, verify redirect to board.

### Tests for User Story 1

- [ ] T010 [P] [US1] Create integration tests for setup job POST/GET happy path in `tests/integration/projects/setup-job.test.ts` (POST creates job 201, GET returns latest job, GET returns null when none exists)
- [ ] T011 [P] [US1] Create integration tests for setup redirect in `tests/integration/projects/setup-redirect.test.ts` (board redirects to setup when unconfigured, setup redirects to board when configured)
- [ ] T012 [P] [US1] Create component tests for setup page in `tests/unit/components/setup/setup-page.test.tsx` (renders agent selection, shows running state with spinner, calls dispatch API on initialize)

### Implementation for User Story 1

- [ ] T013 [US1] Create setup page server component in `app/projects/[projectId]/setup/page.tsx` (force-dynamic, verify project exists, redirect to board if configSyncedAt set, pass props to client)
- [ ] T014 [US1] Create setup page client component in `components/setup/setup-page-client.tsx` (agent selection radio/cards with shadcn/ui, credential check query on agent change, initialize button, status display with polling via useSetupJobPolling, redirect to board on configSyncedAt, aurora theme classes)
- [ ] T015 [US1] Add board redirect for unconfigured projects in `app/projects/[projectId]/board/page.tsx` (check configSyncedAt null, redirect to setup page)

**Checkpoint**: Core happy path works — owner can complete setup and reach the board

---

## Phase 4: User Story 2 - Setup Page Guards and Access Control (Priority: P1)

**Goal**: Enforce ownership, prevent redundant operations, block non-owners, skip setup for configured projects.

**Independent Test**: Attempt setup as non-owner (403), navigate to setup for configured project (redirect), attempt duplicate dispatch (409).

### Tests for User Story 2

- [ ] T016 [P] [US2] Extend integration tests in `tests/integration/projects/setup-job.test.ts` with guard scenarios (POST rejects non-owner 403, POST rejects already-configured 409, POST rejects active job 409)
- [ ] T017 [P] [US2] Extend integration tests in `tests/integration/projects/setup-redirect.test.ts` with access control scenarios (non-owner access denied)

### Implementation for User Story 2

- [ ] T018 [US2] Add owner-only access guard to setup page server component in `app/projects/[projectId]/setup/page.tsx` (verify ownership, return error for non-owners)
- [ ] T019 [US2] Add duplicate dispatch prevention UI in `components/setup/setup-page-client.tsx` (disable initialize button when job is PENDING/RUNNING, show current job status)

**Checkpoint**: All access control and guard rails enforced

---

## Phase 5: User Story 3 - Missing Credential Handling (Priority: P2)

**Goal**: Block dispatch when credential missing, show actionable guidance with link to settings.

**Independent Test**: Select agent without credential, verify button disabled and guidance displayed, switch agent to one with credential and verify button enabled.

### Tests for User Story 3

- [ ] T020 [P] [US3] Extend integration tests in `tests/integration/projects/setup-job.test.ts` with credential guard (POST rejects when credential missing 409)
- [ ] T021 [P] [US3] Extend component tests in `tests/unit/components/setup/setup-page.test.tsx` with credential scenarios (button disabled when credential missing, button enabled when valid, guidance displayed)

### Implementation for User Story 3

- [ ] T022 [US3] Add credential check integration in `components/setup/setup-page-client.tsx` (query credential-check endpoint on agent change, disable button + show guidance when hasCredential is false, link to settingsUrl)

**Checkpoint**: Credential validation fully integrated into setup flow

---

## Phase 6: User Story 4 - Setup Failure and Retry (Priority: P2)

**Goal**: Display error details on failure, offer retry that creates a new job.

**Independent Test**: Simulate workflow failure callback, verify error display, click retry, verify new job created.

### Tests for User Story 4

- [ ] T023 [P] [US4] Extend integration tests in `tests/integration/projects/setup-job.test.ts` with retry scenario (retry after failure creates new job)
- [ ] T024 [P] [US4] Extend component tests in `tests/unit/components/setup/setup-page.test.tsx` with failure/retry scenarios (shows error and retry button on failure)

### Implementation for User Story 4

- [ ] T025 [US4] Add failure state display and retry logic in `components/setup/setup-page-client.tsx` (show errorMessage from failed job, retry button dispatches POST to create new job, reset polling on retry)

**Checkpoint**: Error recovery and retry flow fully functional

---

## Phase 7: User Story 5 - Workflow Status Callback Pipeline (Priority: P2)

**Goal**: Authenticated callbacks update job status, trigger config sync on completion, log errors on failure.

**Independent Test**: Send authenticated PATCH callbacks (PENDING→RUNNING→COMPLETED), verify job updates and config sync trigger. Send unauthenticated callback, verify 401.

### Tests for User Story 5

- [ ] T026 [P] [US5] Extend integration tests in `tests/integration/projects/setup-job.test.ts` with callback scenarios (PATCH PENDING→RUNNING, PATCH RUNNING→COMPLETED triggers config sync, PATCH RUNNING→FAILED with errorMessage, PATCH invalid transition 400, PATCH unauthenticated 401, PATCH idempotent same status 200)

### Implementation for User Story 5

- [ ] T027 [US5] Verify and refine PATCH handler state machine logic in `app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts` (ensure all transitions match contract, config sync fires non-blocking on COMPLETED, errorMessage persisted on FAILED)

**Checkpoint**: Full dispatch-callback-sync pipeline validated end-to-end

---

## Phase 8: Stub Workflow

**Purpose**: GitHub Actions workflow to validate the full dispatch-callback pipeline

- [ ] T028 Create stub onboard workflow in `.github/workflows/onboard.yml` (workflow_dispatch with inputs: project_id, job_id, githubRepository, agent; steps: PATCH RUNNING, sleep 5, PATCH COMPLETED; error handler: PATCH FAILED)

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and validation across all stories

- [ ] T029 Verify all setup page surfaces use aurora theme classes per `globals.css` aurora utilities
- [ ] T030 Run `bun run type-check && bun run lint` and fix any errors across all new files
- [ ] T031 Run full test suite (`bun run test:unit` and `bun run test:integration`) and fix any failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Prisma model + dispatch function)
- **US1 (Phase 3)**: Depends on Phase 2 (API endpoints + polling hook)
- **US2 (Phase 4)**: Depends on Phase 3 (setup page exists to add guards to)
- **US3 (Phase 5)**: Depends on Phase 3 (setup page exists to add credential check to)
- **US4 (Phase 6)**: Depends on Phase 3 (setup page exists to add retry to)
- **US5 (Phase 7)**: Depends on Phase 2 (PATCH endpoint exists to test callbacks)
- **Stub Workflow (Phase 8)**: Depends on Phase 2 (callback endpoint must exist)
- **Polish (Phase 9)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational — no other story dependencies
- **US2 (P1)**: Depends on US1 (guards added to existing setup page components)
- **US3 (P2)**: Depends on US1 (credential check added to existing setup page)
- **US4 (P2)**: Depends on US1 (retry added to existing setup page)
- **US5 (P2)**: Can start after Foundational (tests callback endpoints directly)

### Parallel Opportunities

- T003 and T004 can run in parallel (different files)
- T005/T006 and T008 can run in parallel (different route files)
- T008 and T009 can run in parallel (different files)
- All test tasks within a phase marked [P] can run in parallel
- US3, US4, US5 can run in parallel after US1 completes (different concerns)
- US5 and Phase 8 can start after Phase 2 (independent of frontend)

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests in parallel:
Task T010: "Integration tests for setup job POST/GET in tests/integration/projects/setup-job.test.ts"
Task T011: "Integration tests for redirect in tests/integration/projects/setup-redirect.test.ts"
Task T012: "Component tests for setup page in tests/unit/components/setup/setup-page.test.tsx"

# Then implementation (T013 and T014 can be parallel, T015 independent):
Task T013: "Setup page server component in app/projects/[projectId]/setup/page.tsx"
Task T014: "Setup page client component in components/setup/setup-page-client.tsx"
# T015 depends on nothing from T013/T014 but is a small change:
Task T015: "Board redirect in app/projects/[projectId]/board/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T009)
3. Complete Phase 3: User Story 1 (T010-T015)
4. **STOP and VALIDATE**: Test the full happy path independently
5. Deploy/demo if ready — imported projects now have a working setup flow

### Incremental Delivery

1. Setup + Foundational → API and infrastructure ready
2. Add US1 → Core happy path works (MVP!)
3. Add US2 → Access control and guards enforced
4. Add US3/US4/US5 in parallel → Credential check, retry, callback pipeline
5. Add stub workflow → End-to-end validation
6. Polish → Type-check, lint, theme consistency

### Parallel Execution Strategy

1. Complete Setup + Foundational sequentially (T001 → T002 → T003+T004 → T005-T009)
2. US1 sequentially (core page must exist before other stories enhance it)
3. After US1, run in parallel:
   - Parallel task A: US3 (credential handling)
   - Parallel task B: US4 (failure/retry)
   - Parallel task C: US5 + Phase 8 (callback pipeline + stub workflow)
4. US2 guards can be applied during or after US1

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All new test files are justified: no existing tests cover the setup domain
- Existing files modified: `prisma/schema.prisma`, `app/projects/[projectId]/board/page.tsx`, `app/lib/query-keys.ts`
- Pattern references: `lib/health/scan-dispatch.ts`, `app/api/jobs/[id]/status/route.ts`, `app/lib/hooks/useJobPolling.ts`
