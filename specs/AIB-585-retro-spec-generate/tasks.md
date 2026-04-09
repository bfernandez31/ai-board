# Tasks: AIB-585 Retro-Spec Generate

**Input**: Design documents from `/specs/AIB-585-retro-spec-generate/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-endpoints.md, workflows/

**Tests**: Included by default (constitution).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema migration and shared query key setup

- [x] T001 Run Prisma migration: add `SetupJobCommand` enum (`ONBOARD`, `RETRO_SPEC`), add `command`, `depth`, `docUrl`, `context` fields to `ProjectSetupJob`, add composite index `[projectId, command, status]` in `prisma/schema.prisma`
- [x] T002 Run `bunx prisma generate` to regenerate Prisma client after migration
- [x] T003 Add `retroSpecJob(projectId)` query key to `app/lib/query-keys.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API route extensions that all frontend stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Extend POST handler in `app/api/projects/[projectId]/setup/jobs/route.ts` — add Zod validation for optional `command` (default `ONBOARD`), conditional `depth` (required for RETRO_SPEC), optional `docUrl` (URL, max 2000), optional `context`; invert `configSyncedAt` check for RETRO_SPEC (MUST be set); scope active-job check by `command` type
- [x] T005 Extend POST handler in `app/api/projects/[projectId]/setup/jobs/route.ts` — on RETRO_SPEC command, dispatch `retro-spec.yml` workflow instead of `onboard.yml`; return `command`, `depth`, `docUrl` in response
- [x] T006 [P] Create `lib/workflows/dispatch-retro-spec.ts` following pattern from `lib/workflows/dispatch-onboard.ts` — inputs: `project_id`, `job_id`, `githubRepository`, `agent`, `depth`, `docUrl`, `context`; test mode support; credential pre-check; Octokit dispatch
- [x] T007 Extend GET handler in `app/api/projects/[projectId]/setup/jobs/route.ts` — add optional `command` query parameter for filtering; return `command`, `depth`, `docUrl` in response
- [x] T008 Extend PATCH handler in `app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts` — on COMPLETED, check `job.command`: only trigger `syncProjectConfig()` for ONBOARD jobs; RETRO_SPEC completion is a no-op

**Checkpoint**: API foundation ready — frontend and workflow implementation can begin

---

## Phase 3: User Story 1 — Generate Specs After Onboarding (Priority: P1) MVP

**Goal**: Project owner can trigger spec generation from the board via banner and modal, with a background workflow dispatched.

**Independent Test**: Onboard a project, click "Generate" on the banner, select depth, verify job is created and workflow dispatched.

### Tests for User Story 1

- [x] T009 [P] [US1] Create retro-spec API integration tests in `tests/integration/projects/retro-spec-job.test.ts` — test POST with RETRO_SPEC command: valid creation with depth, missing depth rejection (400), configSyncedAt required (409 NOT_CONFIGURED), concurrent job prevention (409 JOB_ACTIVE), invalid docUrl rejection
- [x] T010 [P] [US1] Extend existing setup job tests in `tests/integration/projects/setup-job.test.ts` — add backward compatibility tests: ONBOARD jobs still work with new `command` field; command defaults to ONBOARD when omitted; existing response shape preserved
- [x] T011 [P] [US1] Create retro-spec GET/PATCH integration tests in `tests/integration/projects/retro-spec-job.test.ts` — test GET with `command=RETRO_SPEC` filter; test PATCH status transitions (no config sync on RETRO_SPEC completion)
- [x] T012 [P] [US1] Create retro-spec modal unit tests in `tests/unit/components/board/retro-spec-modal.test.tsx` — depth selection defaults to Standard; URL validation on docUrl field; submit dispatches POST with correct payload (`command: "RETRO_SPEC"`, `depth`, `docUrl`, `context`); error states displayed

### Implementation for User Story 1

- [x] T013 [P] [US1] Create retro-spec polling hook in `app/lib/hooks/useRetroSpecPolling.ts` following pattern from `app/lib/hooks/useSetupJobPolling.ts` — GET `/api/projects/:projectId/setup/jobs?command=RETRO_SPEC` at 2s interval; stop on COMPLETED/FAILED; return `{ job, isGenerating, isCompleted, isFailed, error }`
- [x] T014 [P] [US1] Create retro-spec modal component in `components/board/retro-spec-modal.tsx` — shadcn/ui Dialog with aurora styling; depth picker radio group (Quick/Standard default/Comprehensive) with descriptions and time estimates; optional docUrl input with URL validation; optional context textarea; "Generate Specs" button POSTs to `/api/projects/:projectId/setup/jobs` with `command: "RETRO_SPEC"`; on success close modal and start polling; on error show inline error
- [x] T015 [US1] Create retro-spec banner component in `components/board/retro-spec-banner.tsx` — dismissible banner: "Project specs not generated — Specs improve health scans, ticket workflows, and code review quality — [Generate] [x]"; dismissal persists to `localStorage` key `retro-spec-banner-dismissed-${projectId}`; "Generate" opens modal; conditional render: only when project has `configSyncedAt` set, no completed RETRO_SPEC job, and not dismissed; accessibility: `role="alert"`, `aria-live="polite"`
- [x] T016 [US1] Integrate banner into board: extend `components/board/board.tsx` — import and render `RetroSpecBanner` above stage columns; pass `projectId` prop; banner renders at same level as OfflineIndicator
- [x] T017 [US1] Extend board page server component in `app/projects/[projectId]/board/page.tsx` — query for latest completed RETRO_SPEC job to determine if specs exist; pass `hasSpecs: boolean` prop to Board component

**Checkpoint**: US1 complete — owner can trigger spec generation from board, job is created and dispatched

---

## Phase 4: User Story 3 — Post-Init Redirect to Board (Priority: P1)

**Goal**: Setup page redirects to board when configSyncedAt is set; no re-init option for configured projects.

**Independent Test**: Complete an onboard init, verify setup page redirects to board without manual intervention.

### Tests for User Story 3

- [ ] T018 [P] [US3] Verify existing redirect tests still pass in `tests/integration/projects/setup-redirect.test.ts` and `tests/unit/components/setup/setup-page.test.tsx` — run tests, confirm no regressions from schema changes

### Implementation for User Story 3

- [ ] T019 [US3] Verify server-side redirect in `app/projects/[projectId]/setup/page.tsx` — confirm redirect when `configSyncedAt` is set; confirm non-owner blocking; fix if any regressions found
- [ ] T020 [US3] Verify client-side redirect in `components/setup/setup-page-client.tsx` — confirm redirect when polling detects `configSyncedAt`; confirm no "re-initialize" button for configured projects; fix if any regressions found

**Checkpoint**: US3 complete — setup page correctly redirects to board after onboarding

---

## Phase 5: User Story 5 — Board Badge During Generation (Priority: P2)

**Goal**: Real-time status badge in board header during spec generation (pulse while running, success/fade on completion, error with retry on failure).

**Independent Test**: Trigger spec generation, observe badge transitions: "Generating specs..." (pulse) -> "Specs ready" (fade) or error state with retry.

### Tests for User Story 5

- [ ] T021 [P] [US5] Create retro-spec badge unit tests in `tests/unit/components/board/retro-spec-badge.test.tsx` — renders "Generating specs..." with pulse when job PENDING/RUNNING; renders "Specs ready" on COMPLETED (fades after 30s); renders error with retry on FAILED; hidden when no active job

### Implementation for User Story 5

- [ ] T022 [US5] Create retro-spec badge component in `components/board/retro-spec-badge.tsx` — states: Generating (pulse animation), Completed ("Specs ready" fades after 30s), Failed (error with retry button); uses `useRetroSpecPolling` hook; positioned in board area above stage columns
- [ ] T023 [US5] Integrate badge into board: extend `components/board/board.tsx` — import and render `RetroSpecBadge`; badge and banner are mutually exclusive (badge shown when job is active)

**Checkpoint**: US5 complete — owner sees real-time badge during spec generation

---

## Phase 6: User Story 2 — Skip Spec Generation (Priority: P2)

**Goal**: Owner can dismiss the banner, and later access spec generation from a board menu option.

**Independent Test**: Dismiss banner, verify it does not reappear on reload; verify "Generate Specs" option accessible elsewhere.

### Tests for User Story 2

- [ ] T024 [P] [US2] Create retro-spec banner unit tests in `tests/unit/components/board/retro-spec-banner.test.tsx` — renders when specs not generated and not dismissed; hidden when dismissed (localStorage); hidden when specs already generated; dismiss button persists to localStorage; generate button opens modal

### Implementation for User Story 2

- [ ] T025 [US2] Add "Generate Specs" option to board menu in `components/board/board.tsx` — ensure modal can be triggered from alternate location for users who dismissed the banner (FR-013); e.g., board header dropdown or project actions menu

**Checkpoint**: US2 complete — banner is dismissible and spec generation remains accessible

---

## Phase 7: User Story 4 — Spec Generation with External Documentation (Priority: P3)

**Goal**: Owner can provide a documentation URL and context during spec generation; workflow fetches and incorporates external docs.

**Independent Test**: Provide a documentation URL during spec generation, verify it is included in the job dispatch payload and passed to the workflow.

### Tests for User Story 4

- [ ] T026 [P] [US4] Extend retro-spec API tests in `tests/integration/projects/retro-spec-job.test.ts` — test POST with docUrl and context fields; verify docUrl and context are stored on the job record; verify invalid URL rejected

### Implementation for User Story 4

- [ ] T027 [US4] Verify modal docUrl and context fields work end-to-end in `components/board/retro-spec-modal.tsx` — confirm docUrl validation (valid URL format), context textarea, and both fields included in POST payload (already implemented in T014; this task verifies integration)

**Checkpoint**: US4 complete — external documentation URL and context flow through the entire pipeline

---

## Phase 8: GitHub Workflow & Agent Command

**Purpose**: The workflow and agent command that execute spec generation in CI

- [ ] T028 [P] Create retro-spec GitHub Actions workflow in `.github/workflows/retro-spec.yml` following `onboard.yml` structure — inputs: project_id, job_id, githubRepository, agent, depth, docUrl, context; steps: report RUNNING, fetch credentials, fetch GitHub token, clone repo, fetch docs (if URL, non-fatal), execute agent command, commit specs to default branch, report COMPLETED/FAILED; timeout 30 minutes
- [ ] T029 [P] Create retro-spec agent command in `.claude-plugin/commands/ai-board.retro-spec.md` — prompt template for LLM-powered codebase analysis and spec generation; depth-scaled output (Quick: overview; Standard: architecture + API + data model + workflows; Comprehensive: full functional + technical specs); writes to `specs/specifications/` directory

**Checkpoint**: Workflow and agent command ready — full end-to-end spec generation functional

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final integration verification and cross-story consistency

- [ ] T030 Run `bun run type-check` and `bun run lint` to verify no type or lint errors across all changed files
- [ ] T031 Run `bun run test:unit` and `bun run test:integration` to verify all new and existing tests pass
- [ ] T032 Verify backward compatibility: existing onboard job tests in `tests/integration/projects/setup-job.test.ts` pass without modification beyond T010

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (schema + Prisma client) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (API routes)
- **US3 (Phase 4)**: Depends on Phase 1 only (verify existing behavior)
- **US5 (Phase 5)**: Depends on US1 (polling hook and board integration)
- **US2 (Phase 6)**: Depends on US1 (banner component)
- **US4 (Phase 7)**: Depends on US1 (modal and API)
- **Workflow (Phase 8)**: Depends on Phase 2 (dispatch function) — can run in parallel with frontend phases
- **Polish (Phase 9)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US3 (P1)**: Can start after Phase 1 — independent of other stories (verify/fix only)
- **US5 (P2)**: Depends on US1 (uses polling hook from T013)
- **US2 (P2)**: Depends on US1 (banner component from T015)
- **US4 (P3)**: Depends on US1 (modal and API from T014/T004)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration

### Parallel Opportunities

- T003 (query keys) can run in parallel with T001/T002 (migration)
- T006 (dispatch function) can run in parallel with T004/T005 (route extensions)
- T009, T010, T011, T012 (US1 tests) can all run in parallel
- T013, T014 (polling hook + modal) can run in parallel
- T028, T029 (workflow + agent command) can run in parallel with all frontend phases
- US3 (Phase 4) can run in parallel with US1 (Phase 3) since they touch different files

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests in parallel:
Task T009: "Create retro-spec API integration tests in tests/integration/projects/retro-spec-job.test.ts"
Task T010: "Extend existing setup job tests in tests/integration/projects/setup-job.test.ts"
Task T011: "Create retro-spec GET/PATCH tests in tests/integration/projects/retro-spec-job.test.ts"
Task T012: "Create retro-spec modal unit tests in tests/unit/components/board/retro-spec-modal.test.tsx"

# Launch US1 independent implementations in parallel:
Task T013: "Create retro-spec polling hook in app/lib/hooks/useRetroSpecPolling.ts"
Task T014: "Create retro-spec modal component in components/board/retro-spec-modal.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 + US3 Only)

1. Complete Phase 1: Setup (migration + query keys)
2. Complete Phase 2: Foundational (API routes + dispatch)
3. Complete Phase 3: User Story 1 (banner + modal + polling)
4. Complete Phase 4: User Story 3 (verify redirect)
5. **STOP and VALIDATE**: Test US1 and US3 independently
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational -> API ready
2. Add US1 -> Core spec generation flow (MVP!)
3. Add US3 -> Redirect fix
4. Add US5 -> Real-time badge feedback
5. Add US2 -> Banner dismissal + alternate trigger
6. Add US4 -> External documentation support
7. Add Workflow (Phase 8) -> End-to-end CI execution
8. Each story adds value without breaking previous stories

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done:
   - Parallel track A: US1 (Phase 3) -> US5 (Phase 5) -> US2 (Phase 6) -> US4 (Phase 7)
   - Parallel track B: US3 (Phase 4)
   - Parallel track C: Workflow + Agent Command (Phase 8)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- `tests/unit/components/board/` directory does not exist yet — will be created when first test file is written
- All existing files referenced have been validated against the filesystem
