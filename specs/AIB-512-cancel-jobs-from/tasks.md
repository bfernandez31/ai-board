# Tasks: Cancel Jobs from UI + Rollback Recovery

**Input**: Design documents from `/specs/AIB-512-cancel-jobs-from/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Included per FR-014 ("System MUST update existing tests to cover the new cancel and rollback behaviors").

**Organization**: Tasks are grouped by user story. US5 (Workflow Run ID Tracking) is placed in Foundational since it is infrastructure enabling US1 (Cancel). US4 (Backup Tags) is merged into US2 (Rollback) since they share the same workflow.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Schema Migration)

**Purpose**: Add workflowRunId field to Job model and generate Prisma client.

- [x] T001 Add `workflowRunId BigInt?` field and `@@index([workflowRunId])` to Job model in `prisma/schema.prisma`
- [x] T002 Run Prisma migration (`bunx prisma migrate dev --name add-workflow-run-id`) and regenerate client (`bunx prisma generate`)

---

## Phase 2: Foundational (Backend Infrastructure)

**Purpose**: Core backend utilities and validation logic that MUST be complete before any user story UI work can begin. Includes US5 (Workflow Run ID Tracking) tasks since they are infrastructure for cancel.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Extend `jobStatusUpdateSchema` in `app/api/jobs/[id]/status/route.ts` to accept optional `workflowRunId` (positive BigInt) on RUNNING status, populate first-write-wins; return 409 if job is already CANCELLED
- [x] T004 [P] Create cancel workflow run utility in `lib/workflows/cancel-workflow-run.ts` — parse owner/repo from githubRepository, call `octokit.actions.cancelWorkflowRun()`, handle 202 (success) and 409 (already finished)
- [x] T005 [P] Extend `isValidTransition()` in `lib/stage-transitions.ts` to add new rollback transitions: SPECIFY→INBOX, PLAN→SPECIFY, BUILD→PLAN, VERIFY→BUILD (all FULL workflow)
- [x] T006 [P] Add rollback validator functions in `app/lib/workflows/rollback-validator.ts`: `canRollbackSpecifyToInbox()`, `canRollbackPlanToSpecify()`, `canRollbackBuildToPlan()`, `canRollbackVerifyToBuild()` — each checks correct stage, FULL workflow type, and last job is FAILED/CANCELLED
- [x] T007 [P] Add `getValidRollbackTargets(stage, workflowType, lastJobStatus)` function in `lib/stage-transitions.ts` returning array of valid rollback target stages based on rollback matrix (empty array if no rollback possible)

**Checkpoint**: Foundation ready — cancel endpoint, rollback transitions, and drag UI work can now begin.

---

## Phase 3: User Story 1 — Cancel a Running Job from the Board (Priority: P1) MVP

**Goal**: Users can cancel a RUNNING or PENDING job by hovering over a ticket card on the board and clicking the cancel button.

**Independent Test**: Create a ticket with a RUNNING job, click the cancel button on the board card, verify the job transitions to CANCELLED and the GitHub Actions run is terminated.

### Tests for User Story 1

- [x] T008 [P] [US1] Add integration tests for cancel endpoint in `tests/integration/jobs/cancel-job.test.ts` — cancel RUNNING job (GitHub API called), cancel PENDING job (no GitHub API), cancel already-COMPLETED job (alreadyTerminal), cancel without auth (401/403), double-cancel idempotent, invalid job ID (404), GitHub API failure (502)
- [x] T009 [P] [US1] Add integration tests for job status workflowRunId extension in `tests/integration/jobs/job-status.test.ts` — RUNNING with workflowRunId populates field, RUNNING without workflowRunId keeps null, RUNNING on CANCELLED job returns 409, second RUNNING callback with different workflowRunId first-write-wins

### Implementation for User Story 1

- [x] T010 [US1] Create cancel job endpoint in `app/api/jobs/[id]/cancel/route.ts` — POST handler with session auth, `verifyProjectAccess()`, handle PENDING (direct CANCELLED), RUNNING (call `cancelWorkflowRun()` then CANCELLED), already-terminal (200 + alreadyTerminal), GitHub API failure (502 without status change)
- [x] T011 [P] [US1] Create cancel confirmation modal component in `components/board/cancel-confirmation-modal.tsx` — AlertDialog (shadcn/ui), props: open, onOpenChange, onConfirm, jobCommand, isCancelling; message: "Annuler le workflow {command} en cours ?"
- [x] T012 [P] [US1] Create cancel job mutation hook in `lib/hooks/mutations/useCancelJob.ts` — `useMutation` calling POST `/api/jobs/{jobId}/cancel`, invalidates `queryKeys.projects.jobsStatus(projectId)` on success
- [x] T013 [US1] Add hover-revealed cancel X button to `components/board/ticket-card.tsx` — visible only when ticket has PENDING/RUNNING job, positioned next to job status indicator, `onClick` with `stopPropagation` opens CancelConfirmationModal, disabled while mutation is in-flight

**Checkpoint**: Users can cancel jobs from the board. Core cancel functionality is complete.

---

## Phase 4: User Story 2 — Rollback a Failed Ticket via Drag-and-Drop (Priority: P1)

**Goal**: Users can drag a ticket with a FAILED/CANCELLED job back to a valid earlier stage, with visual indication of valid drop targets. Includes US4 (Backup Tag Preservation and Cleanup) since backup tags are integral to destructive rollback operations.

**Independent Test**: Set a ticket to BUILD stage with a FAILED job, drag it to PLAN, verify backup tag is created and branch is reset. Also verify SPECIFY→INBOX deletes branch, PLAN→SPECIFY changes stage only, VERIFY→BUILD changes stage only.

### Tests for User Story 2

- [x] T014 [P] [US2] Add integration tests for extended rollback transitions in `tests/integration/tickets/rollback-transitions.test.ts` — SPECIFY→INBOX with FAILED job (branch deleted), PLAN→SPECIFY with FAILED job (no git action), BUILD→PLAN with FAILED job (rollback-reset dispatched), VERIFY→BUILD with FAILED job (stage updated), each with RUNNING job (rejected 400), each with wrong workflow type (rejected 400)
- [x] T015 [P] [US2] Add unit tests for `getValidRollbackTargets()` in `tests/unit/stage-transitions.test.ts` — correct targets for each stage/workflowType/jobStatus combination, empty array for non-terminal statuses, empty array for stages with no rollback
- [x] T016 [P] [US2] Add component test for rollback target highlighting in `tests/unit/components/stage-column.test.tsx` — valid targets highlighted, invalid targets greyed out during drag

### Implementation for User Story 2

- [x] T017 [US2] Extend transition route handler in `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` — add cases for SPECIFY→INBOX (delete branch, reset ticket), PLAN→SPECIFY (stage change only), BUILD→PLAN (create rollback-reset job, dispatch workflow), VERIFY→BUILD (stage change only)
- [x] T018 [US2] Extend board drag handler in `components/board/board.tsx` — on `handleDragStart` compute valid rollback targets via `getValidRollbackTargets()`, store in state, pass to StageColumn, on `handleDragEnd` detect rollback transitions and show confirmation modal
- [x] T019 [US2] Add stage column visual feedback in `components/board/stage-column.tsx` — when dragging ticket with failed/cancelled job: highlight valid rollback targets with stage color border, grey overlay with reduced opacity for invalid targets
- [x] T020 [US2] Add rollback confirmation modals in `components/board/board.tsx` — SPECIFY→INBOX: "Revenir a Inbox ? La branche sera supprimee.", PLAN→SPECIFY: "Revenir a Specify ? Le plan partiel sera ecrase au prochain lancement.", BUILD→PLAN: "Revenir a Plan ? Le code sera reinitialise (backup cree).", VERIFY→BUILD: "Revenir a Build ? Le code actuel sera conserve, verify sera relance."
- [x] T021 [US2] Block drag for active jobs in `components/board/board.tsx` — extend `draggedTicketHasJob` logic to block rollback drag when last job is RUNNING or PENDING (per FR-013)
- [x] T022 [US2] Extend rollback-reset workflow in `.github/workflows/rollback-reset.yml` — accept new `stage` input, create backup tag `backup/{ticketKey}/{stage}-{jobId}` and push to origin before `git reset --hard`
- [x] T023 [US2] Add backup tag cleanup to verify workflow in `.github/workflows/verify.yml` — at start of run, list and delete all `backup/{ticketKey}/*` tags from origin (handle no-tags case gracefully)

**Checkpoint**: Users can drag-and-drop failed/cancelled tickets to valid rollback stages. Backup tags are created/cleaned automatically.

---

## Phase 5: User Story 3 — Cancel a Job from the Ticket Detail Modal (Priority: P2)

**Goal**: Users can cancel a running or pending job directly from the job timeline in the ticket detail modal, with an always-visible cancel button.

**Independent Test**: Open a ticket detail modal with a RUNNING job, click the cancel button on the job timeline row, confirm, verify cancellation.

### Tests for User Story 3

- [x] T024 [P] [US3] Add component test for cancel button on job timeline in `tests/unit/components/jobs-timeline.test.tsx` — cancel button visible for PENDING/RUNNING jobs, hidden for terminal jobs, click triggers confirmation modal, disabled after first click

### Implementation for User Story 3

- [x] T025 [US3] Add always-visible cancel button on PENDING/RUNNING job timeline rows in `components/ticket/jobs-timeline.tsx` — XCircle icon button, triggers CancelConfirmationModal (reuse from US1), disabled after first click to prevent double-cancel

**Checkpoint**: Users have two access points for cancel: hover on board card (US1) and always-visible in detail modal (US3).

---

## Phase 6: User Story 5 — Workflow Script Updates (Priority: P3)

**Goal**: Update all GitHub Actions workflow scripts to report workflowRunId on RUNNING status callback and abort if job is already CANCELLED.

**Independent Test**: Trigger a workflow, verify the RUNNING status callback populates workflowRunId on the job record.

- [ ] T026 [P] [US5] Update `.github/workflows/speckit.yml` to include `workflowRunId: ${{ github.run_id }}` in RUNNING status callback and check for 409 response (abort if CANCELLED)
- [ ] T027 [P] [US5] Update `.github/workflows/quick-impl.yml` to include `workflowRunId: ${{ github.run_id }}` in RUNNING status callback and check for 409 response
- [ ] T028 [P] [US5] Update `.github/workflows/verify.yml` to include `workflowRunId: ${{ github.run_id }}` in RUNNING status callback and check for 409 response
- [ ] T029 [P] [US5] Update `.github/workflows/deploy-preview.yml` to include `workflowRunId: ${{ github.run_id }}` in RUNNING status callback and check for 409 response
- [ ] T030 [P] [US5] Update `.github/workflows/iterate.yml` to include `workflowRunId: ${{ github.run_id }}` in RUNNING status callback and check for 409 response

**Checkpoint**: All workflows report their run ID and respect CANCELLED state.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cross-cutting improvements.

- [ ] T031 [P] Add E2E test for board drag rollback in `tests/e2e/board-rollback.spec.ts` — drag BUILD→PLAN (confirmation → stage change), drag with RUNNING job (blocked), valid/invalid column highlighting
- [ ] T032 Run `bun run type-check` and `bun run lint` to verify no type or lint errors
- [ ] T033 Run full test suite (`bun run test`) to verify all existing tests still pass (SC-008)
- [ ] T034 Run quickstart.md validation — verify cancel flow and rollback flow work end-to-end per quickstart.md steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (schema migration) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (cancel utility, status endpoint extension)
- **US2 (Phase 4)**: Depends on Phase 2 (stage transitions, rollback validators, `getValidRollbackTargets`)
- **US3 (Phase 5)**: Depends on Phase 3 (reuses CancelConfirmationModal and useCancelJob from US1)
- **US5 (Phase 6)**: Depends on Phase 2 (status endpoint must accept workflowRunId) — can run in parallel with US1/US2
- **Polish (Phase 7)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Cancel from Board — can start after Phase 2
- **US2 (P1)**: Rollback DnD — can start after Phase 2 — independent of US1
- **US3 (P2)**: Cancel from Modal — depends on US1 (reuses components)
- **US5 (P3)**: Workflow Scripts — can start after Phase 2 — independent of US1/US2

### Within Each User Story

- Tests can be written first (TDD) and marked [P] for parallel creation
- Backend before frontend
- Components before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T003, T004, T005, T006, T007 (Phase 2) — all modify different files, can run in parallel
- T008, T009 (US1 tests) — different test files, can run in parallel
- T011, T012 (US1 components) — different files, can run in parallel
- T014, T015, T016 (US2 tests) — different test files, can run in parallel
- T026, T027, T028, T029, T030 (US5 workflows) — different workflow files, all parallel
- US1 (Phase 3) and US2 (Phase 4) can run in parallel after Phase 2

---

## Parallel Example: Phase 2 (Foundational)

```
# All foundational tasks can run in parallel (different files):
Task T003: "Extend job status schema in app/api/jobs/[id]/status/route.ts"
Task T004: "Create cancel utility in lib/workflows/cancel-workflow-run.ts"
Task T005: "Extend isValidTransition in lib/stage-transitions.ts"
Task T006: "Add rollback validators in app/lib/workflows/rollback-validator.ts"
Task T007: "Add getValidRollbackTargets in lib/stage-transitions.ts"
# Note: T005 and T007 target the same file — run sequentially or combine
```

## Parallel Example: US1 + US2 After Phase 2

```
# US1 and US2 can execute in parallel since they modify different files:
Parallel track 1 (US1): T008 → T010 → T011+T012 → T013
Parallel track 2 (US2): T014 → T017 → T018+T019 → T020+T021 → T022+T023
```

---

## Implementation Strategy

### MVP First (US1 + US2 = Core Recovery Loop)

1. Complete Phase 1: Setup (schema migration)
2. Complete Phase 2: Foundational (backend infrastructure)
3. Complete Phase 3: US1 — Cancel from Board
4. Complete Phase 4: US2 — Rollback via DnD + Backup Tags
5. **STOP and VALIDATE**: Test cancel + rollback loop independently
6. Deploy/demo if ready — this is the minimum viable recovery experience

### Incremental Delivery

1. Setup + Foundational → Backend infrastructure ready
2. US1 (Cancel from Board) → Test independently → Core cancel works
3. US2 (Rollback DnD + Backup Tags) → Test independently → Complete recovery loop (MVP!)
4. US3 (Cancel from Modal) → Test independently → Alternative cancel access
5. US5 (Workflow Scripts) → Deploy → Full workflowRunId tracking live
6. Polish → Full test suite green, E2E validated

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- US4 (Backup Tags) merged into US2 (Rollback) — same workflow, same phase
- US5 (Workflow Run ID) placed in separate phase since it modifies .yml files only
- T005 and T007 both modify `lib/stage-transitions.ts` — execute sequentially or combine
- BigInt handling: Prisma handles BigInt natively; serialize as string in JSON responses if needed
- All confirmation dialog text is in French per existing codebase convention
