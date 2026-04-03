# Tasks: Cancel Jobs + Rollback Recovery

**Input**: Design documents from `/specs/AIB-513-copy-of-cancel/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per FR-015 — spec explicitly requires test coverage for cancel and rollback functionality.

**Organization**: Tasks grouped by user story. US4 (workflowRunId storage) is placed in Foundational phase since it is a prerequisite for cancel functionality.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Database schema change for workflowRunId field

- [x] T001 Add `workflowRunId BigInt?` field to Job model in `prisma/schema.prisma` and run migration
- [x] T002 Run `bunx prisma generate` to regenerate Prisma client after migration

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend infrastructure that ALL user stories depend on — state machine, validators, helpers, and workflowRunId persistence (US4)

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Extend PENDING valid transitions to include CANCELLED in `app/lib/job-state-machine.ts`
- [x] T004 Add optional `workflowRunId` to Zod schema in `app/lib/job-update-validator.ts`
- [x] T005 Persist `workflowRunId` on RUNNING transition (only if currently null) in `app/api/jobs/[id]/status/route.ts`
- [x] T006 [P] Create cancel workflow helper `lib/workflows/cancel-workflow.ts` using `octokit.actions.cancelWorkflowRun()`
- [x] T007 [P] Create branch deletion helper `lib/workflows/delete-branch.ts` using `octokit.git.deleteRef()`
- [x] T008 Add `canRollbackToSpecify()`, `canRollbackBuildToPlan()`, `canRollbackToBuild()` functions in `app/lib/workflows/rollback-validator.ts`
- [x] T009 Add new valid rollback transitions (SPECIFY→INBOX, PLAN→SPECIFY, BUILD→PLAN, VERIFY→BUILD) in `lib/stage-transitions.ts`
- [x] T010 [P] Unit test: PENDING→CANCELLED transition validity in `tests/unit/job-state-machine.test.ts` (extend existing)
- [x] T011 [P] Unit test: new rollback validator functions in `tests/unit/rollback-validator.test.ts` (extend existing)
- [x] T012 [P] Unit test: `isValidTransition()` for new rollback paths in `tests/unit/stage-transitions.test.ts` (extend or create)
- [x] T013 [P] Integration test: workflowRunId persistence on RUNNING callback in `tests/integration/jobs/status.test.ts` (extend existing)

**Checkpoint**: Foundation ready — cancel and rollback user stories can now begin

---

## Phase 3: User Story 1 — Cancel a Running Job from the Board (Priority: P1) MVP

**Goal**: Users can cancel PENDING or RUNNING jobs by clicking a cancel button on the board ticket card

**Independent Test**: Create a ticket with a RUNNING job, hover to see cancel button, confirm cancellation, verify job transitions to CANCELLED

### Implementation for User Story 1

- [x] T014 [US1] Create cancel job endpoint `app/api/jobs/[id]/cancel/route.ts` — session auth, validate PENDING/RUNNING, call GitHub API if RUNNING, mark CANCELLED
- [x] T015 [US1] Create cancel mutation hook `app/lib/hooks/useCancelJob.ts` — TanStack Query mutation with optimistic update, invalidate ticket queries on settlement
- [x] T016 [US1] Create cancel confirmation dialog `components/board/cancel-job-dialog.tsx` — shadcn/ui AlertDialog with French text "Annuler le workflow {command} en cours ?", double-click prevention
- [x] T017 [US1] Add cancel button (X icon) to ticket card on hover for PENDING/RUNNING jobs in `components/board/ticket-card.tsx`
- [x] T018 [P] [US1] Integration test: cancel endpoint scenarios (PENDING, RUNNING with runId, already CANCELLED, COMPLETED rejected, auth) in `tests/integration/jobs/cancel.test.ts` (new)
- [x] T019 [P] [US1] Component test: cancel button visibility and dialog behavior in `tests/unit/components/cancel-job-dialog.test.tsx` (new)

**Checkpoint**: Users can cancel jobs from the board view

---

## Phase 4: User Story 2 — Cancel a Job from the Ticket Detail Modal (Priority: P1)

**Goal**: Users can cancel PENDING or RUNNING jobs from the job timeline in the ticket detail modal

**Independent Test**: Open ticket detail modal with a RUNNING job, verify cancel action on timeline row, confirm cancellation

### Implementation for User Story 2

- [x] T020 [US2] Add cancel button/action on PENDING/RUNNING job rows in `components/ticket/jobs-timeline.tsx` — reuse `useCancelJob` hook and `CancelJobDialog` from US1

**Checkpoint**: Users can cancel jobs from both board view and ticket detail modal

---

## Phase 5: User Story 3 — Rollback a Failed Ticket via Drag-and-Drop (Priority: P1)

**Goal**: Users can drag tickets with FAILED/CANCELLED jobs to valid previous stages, with visual feedback showing valid rollback targets

**Independent Test**: Create ticket in BUILD with FAILED job, drag to PLAN, confirm dialog, verify ticket moves to PLAN stage

### Implementation for User Story 3

- [x] T021 [US3] Add handlers for PLAN→SPECIFY, BUILD→PLAN, VERIFY→BUILD rollback paths in `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
- [x] T022 [US3] Extend `handleDragStart` to compute valid rollback targets from rollback matrix in `components/board/board.tsx`
- [x] T023 [US3] Pass `validRollbackTargets` and `isDraggingRollback` to column components, apply `opacity-30` to invalid targets in `components/board/board-column.tsx`
- [x] T024 [US3] Create rollback confirmation dialog with stage-specific French messages in `components/board/rollback-confirm-dialog.tsx` (new or extend existing)
- [x] T025 [US3] Extend `handleDragEnd` to handle new rollback transitions, show confirmation dialog, call transition endpoint on confirm in `components/board/board.tsx`
- [x] T026 [P] [US3] Integration test: new rollback transitions (PLAN→SPECIFY, BUILD→PLAN, VERIFY→BUILD, rejection scenarios) in `tests/integration/tickets/transitions.test.ts` (extend existing)
- [x] T027 [P] [US3] E2E test: rollback drag-and-drop (drag BUILD→PLAN, column greying, drag rejection for RUNNING jobs) in `tests/e2e/rollback-new-paths.spec.ts` (new)

**Checkpoint**: Users can recover failed/cancelled tickets via drag-and-drop rollback

---

## Phase 6: User Story 5 — Git Tag Backup Before Destructive Rollback (Priority: P2)

**Goal**: Destructive rollbacks (BUILD→PLAN, VERIFY→PLAN) create a backup git tag before performing the reset, preserving partial work

**Independent Test**: Trigger BUILD→PLAN rollback, verify `backup/{ticketKey}/build-{jobId}` tag exists on repository

### Implementation for User Story 5

- [x] T028 [US5] Add backup tag creation step (`backup/{ticketKey}/{stage}-{jobId}`) before hard reset in `.github/workflows/rollback-reset.yml`
- [x] T029 [US5] Add step to delete `backup/{ticketKey}/*` tags on successful verify start in `.github/workflows/verify.yml`

**Checkpoint**: All destructive rollbacks are safely backed up via git tags

---

## Phase 7: User Story 6 — SPECIFY→INBOX Rollback with Branch Cleanup (Priority: P3)

**Goal**: Tickets in SPECIFY with failed jobs can be rolled back to INBOX, with automatic branch deletion

**Independent Test**: Create ticket in SPECIFY with FAILED job and branch, drag to INBOX, verify branch deleted and ticket in INBOX

### Implementation for User Story 6

- [x] T030 [US6] Add SPECIFY→INBOX handler in `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` — validate, delete branch via GitHub API if set, update ticket (stage=INBOX, branch=null), delete job
- [x] T031 [US6] Add SPECIFY→INBOX rollback confirmation and drag target in `components/board/board.tsx` and `components/board/rollback-confirm-dialog.tsx`
- [x] T032 [P] [US6] Integration test: SPECIFY→INBOX with branch, SPECIFY→INBOX without branch in `tests/integration/tickets/transitions.test.ts` (extend)

**Checkpoint**: Full rollback matrix is complete

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and edge case handling

- [ ] T033 Run `bun run type-check` and fix any TypeScript errors across all changed files
- [ ] T034 Run `bun run lint` and fix any linting issues across all changed files
- [ ] T035 Run full test suite `bun run test` to verify no regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (migration) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — cancel endpoint + board UI
- **US2 (Phase 4)**: Depends on Phase 3 — reuses cancel hook and dialog from US1
- **US3 (Phase 5)**: Depends on Phase 2 — can run in parallel with US1/US2
- **US5 (Phase 6)**: Depends on Phase 2 — workflow YAML changes, can run in parallel with US1-US3
- **US6 (Phase 7)**: Depends on Phase 2 — can run in parallel with US1-US3, US5
- **Polish (Phase 8)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: After Foundational — no other story dependencies
- **US2 (P1)**: After US1 — reuses cancel hook/dialog from US1
- **US3 (P1)**: After Foundational — independent of US1/US2
- **US5 (P2)**: After Foundational — independent, workflow YAML only
- **US6 (P3)**: After Foundational — independent, extends transition endpoint

### Parallel Opportunities

- T006 + T007 (helpers) can run in parallel
- T010 + T011 + T012 + T013 (foundational tests) can run in parallel
- T018 + T019 (US1 tests) can run in parallel
- T026 + T027 (US3 tests) can run in parallel
- US3, US5, US6 can all run in parallel with each other (after Foundational)
- US1 + US3 can run in parallel (different files, independent features)

---

## Parallel Example: After Foundational Phase

```
# These user stories can run in parallel:
Stream A: US1 (T014-T019) → US2 (T020)
Stream B: US3 (T021-T027)
Stream C: US5 (T028-T029) + US6 (T030-T032)
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup (migration)
2. Complete Phase 2: Foundational (state machine, validators, helpers)
3. Complete Phase 3: US1 — Cancel from board
4. Complete Phase 4: US2 — Cancel from modal
5. **STOP and VALIDATE**: Test cancel functionality independently
6. Deploy/demo if ready — users can now cancel unwanted jobs

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. US1 + US2 → Cancel capability (MVP!)
3. US3 → Rollback drag-and-drop → Full recovery workflow
4. US5 → Git backup tags → Safety net for destructive rollbacks
5. US6 → SPECIFY→INBOX → Complete rollback matrix
6. Polish → Type-check, lint, full test suite

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- US4 (workflowRunId) is in Foundational phase since it's infrastructure for cancel
- French confirmation text matches existing app language conventions
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
