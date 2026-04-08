# Tasks: Project Onboarding — Setup Page, API, and Job Tracking

**Input**: Design documents from `/specs/AIB-574-project-onboarding-setup/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/api-endpoints.md, workflows/onboard-workflow.md

**Tests**: Test tasks are included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Data model, migration, and shared utilities needed by all user stories

- [x] T001 Add `ProjectSetupJob` model to `prisma/schema.prisma` with fields per data-model.md (id, projectId, agent, status, workflowRunId, logs, artifactSummary, startedAt, completedAt, createdAt, updatedAt) and add `setupJobs ProjectSetupJob[]` relation to `Project` model
- [x] T002 Run Prisma migration (`bunx prisma migrate dev --name add_project_setup_job`) and regenerate client (`bunx prisma generate`)
- [x] T003 Add setup query keys to `app/lib/query-keys.ts`: `setupStatus: (projectId: number) => ['projects', projectId, 'setup', 'status']`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API routes and polling hook that MUST be complete before user story UI work can begin

**CRITICAL**: No user story UI work can begin until this phase is complete

- [x] T004 Create `app/api/projects/[projectId]/setup/route.ts` with GET handler: derive setup state from latest `ProjectSetupJob` + `configSyncedAt`, return response per contracts/api-endpoints.md, auth via `verifyProjectAccess()`
- [x] T005 Add POST handler in `app/api/projects/[projectId]/setup/route.ts`: validate owner-only via `verifyProjectOwnership()`, check no active job (409), check not already configured (409), verify credential via `getOwnerCredential()`, create `ProjectSetupJob`, dispatch workflow via Octokit (skip in test mode via `isWorkflowTestMode()`), return 201
- [x] T006 Create `app/api/projects/[projectId]/setup/status/route.ts` with PATCH handler: authenticate via `validateWorkflowAuth()`, validate status transition via `canTransition()` from `app/lib/job-state-machine.ts`, update job record, set `completedAt` on terminal states, call `syncProjectConfig()` on COMPLETED, persist `logs` on FAILED
- [x] T007 Create `app/lib/hooks/useSetupPolling.ts`: TanStack Query hook that polls GET `/api/projects/{projectId}/setup` at 2s interval, auto-stops on CONFIGURED or terminal job state, returns `{ setupState, latestJob, isPolling }`

---

## Phase 3: User Story 1 — First-Time Project Setup (Priority: P1) MVP

**Goal**: Owner imports a project without config, is directed to setup page, selects agent, dispatches onboarding, sees real-time progress, and is redirected to board on completion.

**Independent Test**: Import a repo without `.ai-board/config.yml`, complete the setup flow, verify redirect to project board.

### Tests for User Story 1

- [x] T008 [P] [US1] Create integration tests for setup dispatch API in `tests/integration/projects/setup.test.ts`: POST dispatch creates job (201), GET returns NEEDS_SETUP for new project, GET returns IN_PROGRESS for active job, PATCH callback RUNNING updates status, PATCH callback COMPLETED triggers config sync
- [x] T009 [P] [US1] Create component tests for setup page happy path in `tests/unit/components/setup-page.test.tsx`: renders agent selection options, shows progress state during RUNNING, shows success state on COMPLETED
- [x] T010 [P] [US1] Create unit tests for polling hook in `tests/unit/useSetupPolling.test.ts`: polls at 2s interval, stops polling on terminal state, returns correct setup state derivation

### Implementation for User Story 1

- [x] T011 [US1] Create server page at `app/projects/[projectId]/setup/page.tsx`: auth check (redirect unauthenticated), fetch project with `configSyncedAt` and membership, redirect to board if already configured, check owner/member access, render `SetupPageClient` with project data and `isOwner` flag
- [x] T012 [US1] Create client component at `components/setup/setup-page-client.tsx`: agent selection (CLAUDE/CODEX radio using shadcn/ui), "Initialize Project" button dispatching POST to setup API, progress state with elapsed time counter and loading spinner using `useSetupPolling()`, success state with "Go to Board" link

**Checkpoint**: At this point, the core happy path (select agent -> dispatch -> poll -> success -> redirect) should be fully functional

---

## Phase 4: User Story 2 — Credential Validation Before Setup (Priority: P1)

**Goal**: Block dispatch when credential is missing and show guidance on how to add it.

**Independent Test**: Select an agent with no configured credential, verify button is disabled with guidance shown.

### Tests for User Story 2

- [x] T013 [P] [US2] Add component tests for credential validation in `tests/unit/components/setup-page.test.tsx`: disables button when credential missing, enables button when credential present, updates on agent selection change

### Implementation for User Story 2

- [x] T014 [US2] Add credential status indicator to `components/setup/setup-page-client.tsx`: fetch credential status via `GET /api/credentials` filtered by agent's provider (using `AGENT_PROVIDER_MAP`), show inline credential status with guidance when missing, disable "Initialize Project" button when no valid credential

**Checkpoint**: Setup page now validates credentials before allowing dispatch

---

## Phase 5: User Story 3 — Setup Failure and Retry (Priority: P2)

**Goal**: Display error details on failure and allow retry with a fresh workflow run.

**Independent Test**: Simulate a workflow failure callback, verify error display and retry functionality.

### Tests for User Story 3

- [x] T015 [P] [US3] Add integration tests for failure flow in `tests/integration/projects/setup.test.ts`: PATCH callback FAILED persists logs, POST dispatch succeeds after previous job FAILED
- [x] T016 [P] [US3] Add component tests for error/retry UI in `tests/unit/components/setup-page.test.tsx`: shows error details and retry button on FAILED state

### Implementation for User Story 3

- [x] T017 [US3] Add error and retry states to `components/setup/setup-page-client.tsx`: display error details from `latestJob.logs` on FAILED, add "Retry" button that dispatches a new POST (creates fresh job, FR-014), show loading state during retry dispatch

**Checkpoint**: Full failure recovery flow works — error display + retry creates new job

---

## Phase 6: User Story 4 — Already-Configured Project Bypass (Priority: P2)

**Goal**: Projects with config synced never show setup page — redirect to board.

**Independent Test**: Navigate to `/projects/{id}/setup` for a configured project, verify redirect to board.

### Tests for User Story 4

- [x] T018 [P] [US4] Add integration tests for already-configured guard in `tests/integration/projects/setup.test.ts`: POST rejects with 409 when already configured, GET returns CONFIGURED state when `configSyncedAt` is set

### Implementation for User Story 4

- [x] T019 [US4] Verify redirect logic in `app/projects/[projectId]/setup/page.tsx` handles `configSyncedAt` check (already implemented in T011), and POST guard rejects dispatch for configured projects (already implemented in T005) — add any missing edge case handling

**Checkpoint**: Configured projects are fully bypassed

---

## Phase 7: User Story 5 — Concurrent Dispatch Prevention (Priority: P2)

**Goal**: Block duplicate dispatch when a job is PENDING or RUNNING.

**Independent Test**: Dispatch a setup job, immediately attempt second dispatch, verify 409 rejection.

### Tests for User Story 5

- [x] T020 [P] [US5] Add integration tests for concurrent dispatch guard in `tests/integration/projects/setup.test.ts`: POST rejects with 409 when job is PENDING, POST rejects with 409 when job is RUNNING, POST succeeds after previous job COMPLETED or FAILED

### Implementation for User Story 5

- [x] T021 [US5] Verify concurrent dispatch prevention in `app/api/projects/[projectId]/setup/route.ts` POST handler (already implemented in T005 — active job check), and add disabled state to "Initialize Project" button in `components/setup/setup-page-client.tsx` when `setupState` is `IN_PROGRESS`

**Checkpoint**: No duplicate workflow runs possible

---

## Phase 8: User Story 6 — Page Refresh During Setup (Priority: P3)

**Goal**: Page refresh correctly resumes showing current job state.

**Independent Test**: Start a setup job, refresh the browser, verify running state displayed immediately.

### Tests for User Story 6

- [x] T022 [P] [US6] Add component tests for state restoration in `tests/unit/components/setup-page.test.tsx`: shows running state with elapsed time on initial load when job is RUNNING, shows success state when job COMPLETED while page was closed

### Implementation for User Story 6

- [x] T023 [US6] Verify state restoration in `components/setup/setup-page-client.tsx`: initial render reads `latestJob` from `useSetupPolling()` and displays correct state (progress/success/error) based on current status — ensure elapsed time is calculated from `latestJob.startedAt` relative to now, not from page load

**Checkpoint**: Page refresh always shows correct state

---

## Phase 9: Workflow Stub & Post-Import Redirect

**Purpose**: Workflow file and integration with project import flow

- [x] T024 [P] Create `.github/workflows/onboard.yml` workflow stub: `workflow_dispatch` trigger with inputs (projectId, setupJobId, githubRepository, agent, callbackUrl, workflowToken), runs on ubuntu-latest, steps: callback RUNNING → sleep 5s → callback COMPLETED (or FAILED on error) per workflows/onboard-workflow.md
- [x] T025 Add post-import redirect: in the project import success flow (check `app/api/projects/import/route.ts` and `components/projects/import-project-modal.tsx`), redirect to `/projects/{id}/setup` when `configSyncedAt` is null after project creation

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Auth edge cases, validation hardening, and status callback security

- [ ] T026 [P] Add integration tests for auth edge cases in `tests/integration/projects/setup.test.ts`: POST rejects non-owner with 403, PATCH rejects unauthorized callback (401), PATCH rejects invalid status transition (400), GET returns 403 for non-member
- [ ] T027 Add Zod validation schemas to both setup route handlers for request body validation (POST: `{ agent: z.enum(['CLAUDE', 'CODEX']) }`, PATCH: `{ jobId: z.number(), status: z.enum([...]), logs: z.string().optional(), artifactSummary: z.unknown().optional() }`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (migration must complete) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core happy path, implement first
- **US2 (Phase 4)**: Depends on Phase 3 (extends setup-page-client.tsx)
- **US3 (Phase 5)**: Depends on Phase 3 (extends setup-page-client.tsx)
- **US4 (Phase 6)**: Depends on Phase 2 — guard logic mostly in T005/T011
- **US5 (Phase 7)**: Depends on Phase 2 — guard logic mostly in T005
- **US6 (Phase 8)**: Depends on Phase 3 (extends setup-page-client.tsx)
- **Workflow/Redirect (Phase 9)**: Can start after Phase 2
- **Polish (Phase 10)**: Depends on Phases 3-9

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2. No other story dependencies. **MVP scope.**
- **US2 (P1)**: Extends US1 client component. Can run after US1.
- **US3 (P2)**: Extends US1 client component. Can run after US1.
- **US4 (P2)**: Mostly server-side guards already in Phase 2. Can run after Phase 2.
- **US5 (P2)**: Mostly server-side guards already in Phase 2. Can run after Phase 2.
- **US6 (P3)**: Extends US1 client component. Can run after US1.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/schemas before services
- Services before endpoints
- Core implementation before integration

### Parallel Opportunities

- T008, T009, T010 can run in parallel (different test files)
- T013, T015, T016, T018, T020, T022 can each run in parallel with non-conflicting tasks
- T024 (workflow stub) can run in parallel with any Phase 3+ task
- US4 and US5 can run in parallel (different guard concerns)

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (different files):
Task T008: "Integration tests for setup dispatch API in tests/integration/projects/setup.test.ts"
Task T009: "Component tests for setup page in tests/unit/components/setup-page.test.tsx"
Task T010: "Unit tests for polling hook in tests/unit/useSetupPolling.test.ts"

# After tests fail, implement sequentially:
Task T011: "Server page at app/projects/[projectId]/setup/page.tsx"
Task T012: "Client component at components/setup/setup-page-client.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (migration + query keys)
2. Complete Phase 2: Foundational (API routes + polling hook)
3. Complete Phase 3: User Story 1 (setup page + client component)
4. **STOP and VALIDATE**: Test the full flow end-to-end
5. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Add US1 → Happy path works (MVP!)
3. Add US2 → Credential validation adds safety
4. Add US3 → Failure recovery adds robustness
5. Add US4 + US5 → Guards prevent misuse
6. Add US6 → Polish for page refresh
7. Phase 9 → Workflow stub + import redirect
8. Phase 10 → Auth hardening + validation

### Parallel Execution Strategy

1. Complete Phases 1-2 sequentially (migration must precede API routes)
2. Once Phase 2 is done:
   - Parallel track A: US1 → US2 → US3 → US6 (client component extensions)
   - Parallel track B: US4 + US5 (server-side guards)
   - Parallel track C: Phase 9 (workflow stub + redirect)
3. Phase 10 after all tracks complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All new test files are justified: no existing tests cover setup API, setup UI, or setup polling
- `tests/integration/projects/config-sync.test.ts` may be extended in Phase 10 if post-setup config sync needs additional coverage
- Zod validation (T027) should be added during implementation of T004/T005/T006, not deferred — listed in Polish for explicit tracking
- Workflow dispatch uses test mode check (`isWorkflowTestMode()`) to skip actual GitHub API calls in integration tests
