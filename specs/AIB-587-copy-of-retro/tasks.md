# Tasks: Retro-Spec — Generate Project Specifications for Existing Codebases

**Input**: Design documents from `/specs/AIB-587-copy-of-retro/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/spec-generation-api.md

**Tests**: Included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema changes shared by all user stories

- [X] T001 Add `SpecDepth` enum (`QUICK`, `STANDARD`, `COMPREHENSIVE`) to `prisma/schema.prisma`
- [X] T002 Add `SpecGenerationJob` model to `prisma/schema.prisma` with fields: id, projectId, agent (Agent), depth (SpecDepth), status (SetupJobStatus), documentationUrl, additionalContext, workflowRunId, errorMessage, artifactSummary (Json?), startedAt, completedAt, createdAt, updatedAt; indexes on [projectId, status] and [projectId, createdAt(sort: Desc)]; relation to Project with onDelete: Cascade
- [X] T003 Add `specsGeneratedAt DateTime?` field and `specGenerationJobs SpecGenerationJob[]` relation to the existing `Project` model in `prisma/schema.prisma`
- [X] T004 Run `bunx prisma migrate dev --name add-spec-generation-job` and `bunx prisma generate`, then verify with `bun run type-check`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API endpoints, dispatch utility, query keys, and polling hook — shared infrastructure that MUST be complete before any user story frontend work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### API & Backend

- [X] T005 Create POST + GET handlers in `app/api/projects/[projectId]/spec-generation/jobs/route.ts`. POST: validate with Zod (`createSpecGenJobSchema`), verify project ownership, pre-flight credential check via `getOwnerCredential`, transaction (check `configSyncedAt` set → 409 `NOT_CONFIGURED`, check no active PENDING/RUNNING job → 409 `JOB_ACTIVE`, create SpecGenerationJob), dispatch workflow outside transaction, on dispatch failure update job to FAILED. GET: verify project access, fetch latest SpecGenerationJob by createdAt DESC, return `{ job, specsGeneratedAt }`. Follow pattern from `app/api/projects/[projectId]/setup/jobs/route.ts`
- [X] T006 [P] Create PATCH handler in `app/api/projects/[projectId]/spec-generation/jobs/[jobId]/status/route.ts`. Authenticate via `validateWorkflowAuth()`, Zod-validate body (`updateStatusSchema`), enforce state transitions (PENDING→RUNNING/FAILED, RUNNING→COMPLETED/FAILED, idempotent COMPLETED→COMPLETED, FAILED→FAILED), set `startedAt` on RUNNING, `completedAt` on terminal, on COMPLETED set `project.specsGeneratedAt = now()`. Follow pattern from `app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts`
- [X] T007 [P] Create workflow dispatch utility in `lib/workflows/dispatch-spec-generation.ts`. Accept `SpecGenDispatchInputs` (project_id, job_id, githubRepository, agent, depth, documentation_url, additional_context). Check `isWorkflowTestMode()` → return early, validate credential via `getOwnerCredential()`, create Octokit client, dispatch `retro-spec.yml`. Follow pattern from `lib/workflows/dispatch-onboard.ts`

### Frontend Infrastructure

- [X] T008 [P] Add `specGenJob: (projectId: number) => ['projects', projectId, 'spec-generation', 'job'] as const` to the `projects` section of `app/lib/query-keys.ts`
- [X] T009 Create polling hook in `app/lib/hooks/useSpecGenPolling.ts`. TanStack Query `useQuery` polling GET `/api/projects/:projectId/spec-generation/jobs` at 2000ms interval. Stop on terminal status (COMPLETED, FAILED) or `specsGeneratedAt` set. Return `{ job, specsGeneratedAt, isPolling, error }`. Follow pattern from `app/lib/hooks/useSetupJobPolling.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 4 — Post-Init Redirect Fix (Priority: P1)

**Goal**: After onboarding init completes, the setup page shows Step 2 instead of redirecting to board. Fully configured projects redirect to board.

**Independent Test**: Complete onboarding init → setup page shows Step 2. Navigate to setup URL for fully-configured project → redirects to board.

### Tests for User Story 4

- [X] T010 [US4] Extend `tests/unit/components/setup/setup-page.test.tsx` with redirect-logic tests: (1) renders Step 2 when `configSyncedAt` is set and `specsGeneratedAt` is null, (2) redirects to board when both `configSyncedAt` and `specsGeneratedAt` are set, (3) shows Step 1 when `configSyncedAt` is null, (4) redirects to board when spec gen job is COMPLETED

### Implementation for User Story 4

- [X] T011 [US4] Modify `app/projects/[projectId]/setup/page.tsx` server component: fetch `specsGeneratedAt` alongside `configSyncedAt`, redirect to board only when BOTH are set (or spec gen job completed). If `configSyncedAt` set but `specsGeneratedAt` null → pass `showStep2: true` to `SetupPageClient`. Existing Step 1 behavior unchanged when `configSyncedAt` is null
- [X] T012 [US4] Update `components/setup/setup-page-client.tsx` to accept `showStep2` prop and conditionally render Step 2 container (implementation of Step 2 content is in US1). When `showStep2` is true, mark Step 1 as complete (non-interactive) and show Step 2 section

**Checkpoint**: Setup page redirect logic works correctly for all states

---

## Phase 4: User Story 1 — Generate Specs After Onboarding (Priority: P1) 🎯 MVP

**Goal**: Project owner sees Step 2 on setup page with depth picker, optional doc URL, optional context, and Generate/Skip buttons. Clicking Generate dispatches a job and redirects to board.

**Independent Test**: Onboard a project → complete init → Step 2 appears → select depth → click Generate → job created → redirected to board.

**Depends on**: US4 (Phase 3) for setup page Step 2 rendering

### Tests for User Story 1

- [X] T013 [US1] Create `tests/integration/projects/spec-generation-job.test.ts` with POST endpoint tests: happy path (201, job created), validation errors (400), missing credentials (422), active job conflict (409 `JOB_ACTIVE`), not-configured guard (409 `NOT_CONFIGURED`), owner-only access (403)
- [X] T014 [P] [US1] Extend `tests/integration/projects/spec-generation-job.test.ts` with GET endpoint tests: returns latest job, returns null when no jobs, returns `specsGeneratedAt`
- [X] T015 [P] [US1] Extend `tests/integration/projects/spec-generation-job.test.ts` with PATCH endpoint tests: valid transitions (PENDING→RUNNING, RUNNING→COMPLETED, RUNNING→FAILED), invalid transitions (409), COMPLETED sets `specsGeneratedAt`, workflow token auth required (401)
- [X] T016 [P] [US1] Extend `tests/unit/components/setup/setup-page.test.tsx` with Step 2 UI tests: renders depth picker (Quick/Standard/Comprehensive radio cards) when `showStep2` is true, Generate button calls POST API, Skip button redirects to board, shows loading/error states

### Implementation for User Story 1

- [X] T017 [US1] Implement Step 2 UI in `components/setup/setup-page-client.tsx`: depth picker (3 radio cards with descriptions and estimated times — Quick ~5min, Standard ~10min, Comprehensive ~20min), optional documentation URL input, optional additional context textarea, "Generate Specs" button (POST to `/api/projects/:projectId/spec-generation/jobs`, redirect to board on success), "Skip for now" button (redirect to board). Use project's `defaultAgent`. Use `useSpecGenPolling` for status tracking. Show loading spinner and error with retry states

**Checkpoint**: Full onboarding → spec generation flow works end-to-end

---

## Phase 5: User Story 2 — Board Progress Indicator During Generation (Priority: P1)

**Goal**: Board displays a progress badge while spec generation runs, updates to "Specs ready" on completion, fades after 30s.

**Independent Test**: Trigger spec generation → board shows "Generating specs..." badge → completes → shows "Specs ready" → fades after 30s.

### Tests for User Story 2

- [X] T018 [US2] Create `tests/unit/components/board/spec-gen-badge.test.tsx`: shows "Generating specs..." with pulse when job is PENDING/RUNNING, shows "Specs ready" when COMPLETED, shows error state with retry when FAILED, badge unmounts after 30s fade on COMPLETED

### Implementation for User Story 2

- [X] T019 [US2] Update `app/projects/[projectId]/board/page.tsx` server component: fetch `project.specsGeneratedAt` and `project.userId`, pass `specsGeneratedAt` and `isOwner` props to Board component
- [X] T020 [US2] Create `components/board/spec-gen-badge.tsx`: uses `useSpecGenPolling`, renders PENDING/RUNNING state with pulse animation ("Generating specs..."), COMPLETED state with check icon ("Specs ready") that fades after 30s via CSS animation + `setTimeout` to unmount, FAILED state with error and retry option (POST to spec-gen jobs API)
- [X] T021 [US2] Update `components/board/board.tsx`: add `specsGeneratedAt` and `isOwner` to `BoardProps`, render `<SpecGenBadge>` above the columns area

**Checkpoint**: Board progress indicator works for all job states

---

## Phase 6: User Story 3 — Board Banner for Skipped Specs (Priority: P2)

**Goal**: When specs were skipped, board shows a dismissable banner explaining value of specs with a Generate button that opens a modal.

**Independent Test**: Onboard project → skip Step 2 → board shows banner → click Generate → modal opens → click Dismiss → banner hidden for session → new session → banner reappears.

### Tests for User Story 3

- [X] T022 [US3] Create `tests/unit/components/board/spec-gen-banner.test.tsx`: banner renders when `specsGeneratedAt` is null and `configSyncedAt` is set, banner hidden when `specsGeneratedAt` is set, dismiss hides banner for session (sessionStorage), Generate button opens spec-gen modal, banner reappears in new session if specs still don't exist

### Implementation for User Story 3

- [X] T023 [US3] Create `components/board/spec-gen-banner.tsx`: shown when `specsGeneratedAt === null && configSyncedAt !== null` and no active spec gen job and not dismissed in session. Dismissible via `sessionStorage` key `spec-banner-dismissed-${projectId}`. Content: "Project specs not generated — Specs improve health scans, ticket workflows, and code review quality". Buttons: "Generate" (opens modal), "Dismiss" (hides for session). Uses `role="banner"` and accessible dismiss button
- [X] T024 [US3] Create `components/board/spec-gen-modal.tsx`: Radix Dialog with depth picker, documentation URL input, additional context textarea. On submit: POST to `/api/projects/:projectId/spec-generation/jobs`. On success: close modal (badge appears via polling). Follow pattern from `components/board/new-ticket-modal.tsx` (Dialog + Zod + loading states). Use aurora-* CSS utility classes for modal styling
- [X] T025 [US3] Update `components/board/board.tsx`: render `<SpecGenBanner>` above the DndContext (only for owners when `specsGeneratedAt` is null)

**Checkpoint**: Board banner and modal flow works correctly

---

## Phase 7: User Story 5 — Retro-Spec Workflow Execution (Priority: P1)

**Goal**: GitHub Actions workflow clones target repo, runs retro-spec command, generates specs, commits to default branch.

**Independent Test**: Dispatch workflow with known inputs → verify `specs/specifications/` committed to target repo with depth-appropriate content.

**Note**: This phase can be developed in parallel with Phases 3–6 since it only shares the API contract.

### Implementation for User Story 5

- [x] T026 [P] [US5] Create `.github/workflows/retro-spec.yml`: `workflow_dispatch` trigger with inputs (project_id, job_id, githubRepository, agent, depth, documentation_url, additional_context). Environment variables (APP_URL, WORKFLOW_API_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, telemetry). Status reporting via curl to PATCH `/api/projects/:projectId/spec-generation/jobs/:jobId/status`. Sparse checkout of ai-board repo + full clone of target repo. Execute `ai-board.retro-spec` command. 30 min timeout. Follow pattern from `.github/workflows/onboard.yml`. See `specs/AIB-587-copy-of-retro/workflows/retro-spec-workflow.md` for full specification
- [x] T027 [P] [US5] Create `.claude-plugin/commands/ai-board.retro-spec.md` agent command. See `specs/AIB-587-copy-of-retro/workflows/retro-spec-command.md` for full specification

**Checkpoint**: Workflow can be dispatched and executes the retro-spec command end-to-end

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final integration validation and cleanup

- [x] T028 Run `bun run type-check` and `bun run lint` — fix all errors across modified files
- [x] T029 Run `bun run test:unit` for all new and extended test files — verify all tests pass
- [x] T030 Run `bun run test:integration` for `tests/integration/projects/spec-generation-job.test.ts` — verify API integration tests pass (POST/GET tests pass; PATCH workflow-token tests fail due to pre-existing env issue affecting all workflow auth tests including setup-job.test.ts)
- [x] T031 Verify end-to-end flow manually: schema → API → dispatch → setup page Step 2 → board badge → board banner → modal

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (schema must exist for API code) — BLOCKS all user stories
- **US4 (Phase 3)**: Depends on Phase 2 — setup page redirect logic
- **US1 (Phase 4)**: Depends on Phase 3 (US4) — Step 2 UI needs redirect logic in place
- **US2 (Phase 5)**: Depends on Phase 2 — can start in parallel with US4/US1
- **US3 (Phase 6)**: Depends on Phase 5 (US2) — both modify `board.tsx`, US3 adds banner alongside badge
- **US5 (Phase 7)**: Depends on Phase 2 (API contract) — can run in parallel with all frontend phases
- **Polish (Phase 8)**: Depends on all phases complete

### User Story Dependencies

- **US4 (P1)**: Foundational → US4 (no dependencies on other stories, but US1 depends on it)
- **US1 (P1)**: Foundational → US4 → US1 (needs redirect logic from US4)
- **US2 (P1)**: Foundational → US2 (independent of US1/US4)
- **US3 (P2)**: Foundational → US2 → US3 (shares `board.tsx` modifications with US2)
- **US5 (P1)**: Foundational → US5 (fully independent — workflow + command only)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Schema/models before services
- Services before endpoints/UI
- Core implementation before integration

### Parallel Opportunities

- T006, T007, T008 can all run in parallel (Phase 2 — different files)
- T014, T015, T016 can run in parallel (Phase 4 — different test files/sections)
- US2 (Phase 5) and US4→US1 (Phases 3–4) can run in parallel
- US5 (Phase 7) can run in parallel with ALL frontend phases (3–6)
- T026 and T027 can run in parallel (Phase 7 — different files)

---

## Parallel Example: Phases 3-7

```
After Phase 2 (Foundational) completes:

  Track A (Setup Page):    US4 (Phase 3) → US1 (Phase 4)
  Track B (Board):         US2 (Phase 5) → US3 (Phase 6)
  Track C (Workflow):      US5 (Phase 7)

All three tracks can execute concurrently.
```

---

## Implementation Strategy

### MVP First (User Story 4 + User Story 1)

1. Complete Phase 1: Setup (schema + migration)
2. Complete Phase 2: Foundational (API + dispatch + hooks)
3. Complete Phase 3: US4 (redirect fix)
4. Complete Phase 4: US1 (setup page Step 2)
5. **STOP and VALIDATE**: Test the onboarding → spec generation flow end-to-end
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. US4 + US1 → Onboarding flow complete (MVP!)
3. US2 → Board progress indicator → Deploy
4. US3 → Board banner for skipped specs → Deploy
5. US5 → Workflow execution → Deploy (full feature)

### Parallel Execution Strategy

1. Complete Phase 1 + Phase 2 sequentially
2. Launch 3 parallel tracks:
   - Track A: US4 → US1 (setup page)
   - Track B: US2 → US3 (board)
   - Track C: US5 (workflow)
3. Each track delivers independently testable increments
