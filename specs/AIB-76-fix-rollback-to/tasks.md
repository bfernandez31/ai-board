# Tasks: Fix Rollback to Plan from Verify

**Input**: Design documents from `/specs/AIB-76-fix-rollback-to/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: No tests explicitly requested in specification. E2E test extension mentioned in quickstart.md for validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new files and basic structure for the rollback-reset feature

- [ ] T001 [P] Create dispatch function file `app/lib/workflows/dispatch-rollback-reset.ts` with interface definitions
- [ ] T002 [P] Create GitHub workflow file `.github/workflows/rollback-reset.yml` with initial structure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before user story implementation

**Note**: No database migrations required - Job command field is VARCHAR(50) and already supports new command types

- [ ] T003 Implement `dispatchRollbackResetWorkflow` function in `app/lib/workflows/dispatch-rollback-reset.ts`
  - Define `RollbackResetInputs` interface with: ticketId, ticketKey, projectId, branch, githubOwner, githubRepo
  - Create job record with command `rollback-reset` and status `PENDING`
  - Dispatch `rollback-reset.yml` workflow via Octokit
  - Return jobId for tracking
- [ ] T004 Implement job status callback API support for `rollback-reset` command in job status endpoint

**Checkpoint**: Foundation ready - dispatch function exists and can be called from transition API

---

## Phase 3: User Story 1 - Complete Rollback with Git Reset (Priority: P1) 🎯 MVP

**Goal**: When user drags ticket from VERIFY to PLAN, the system resets the git branch to remove implementation commits while preserving spec files

**Independent Test**: Trigger VERIFY→PLAN rollback and verify:
1. Job with command `rollback-reset` is created
2. Workflow is dispatched
3. Git branch no longer contains implementation commits
4. Spec folder files remain intact

### Implementation for User Story 1

- [ ] T005 [US1] Modify transition route to dispatch rollback-reset workflow in `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
  - Import `dispatchRollbackResetWorkflow` from dispatch function
  - After existing rollback transaction succeeds, call dispatch function
  - Include `resetJobId` in response JSON
- [ ] T006 [US1] Implement workflow step: Update job status to RUNNING in `.github/workflows/rollback-reset.yml`
  - Use curl to PATCH `/api/jobs/${job_id}/status` with status RUNNING
  - Include WORKFLOW_API_TOKEN authorization header
- [ ] T007 [US1] Implement workflow step: Checkout target repository in `.github/workflows/rollback-reset.yml`
  - Use actions/checkout@v4 with repository input
  - Checkout feature branch with full history (fetch-depth: 0)
  - Configure git user for ai-board[bot]
- [ ] T008 [US1] Implement workflow step: Identify reset target commit in `.github/workflows/rollback-reset.yml`
  - Fetch implement job's startedAt time from API
  - Find last commit before that timestamp using `git log --before`
  - Store commit SHA in RESET_COMMIT env var
  - Add fallback to find commit with "plan" or "tasks" in message
- [ ] T009 [US1] Implement workflow step: Backup spec folder in `.github/workflows/rollback-reset.yml`
  - Define SPEC_DIR as `specs/${BRANCH_NAME}`
  - If spec dir exists, run `git stash push --include-untracked -- "$SPEC_DIR"`
  - Set SPEC_STASHED env var for later restoration
- [ ] T010 [US1] Implement workflow step: Execute git reset in `.github/workflows/rollback-reset.yml`
  - Run `git reset --hard $RESET_COMMIT`
- [ ] T011 [US1] Implement workflow step: Restore spec folder in `.github/workflows/rollback-reset.yml`
  - If SPEC_STASHED is true, run `git stash pop`
  - Stage spec files with `git add specs/`
  - Commit with message "chore: preserve spec files during rollback"
- [ ] T012 [US1] Implement workflow step: Force push reset branch in `.github/workflows/rollback-reset.yml`
  - Run `git push origin ${BRANCH_NAME} --force`
- [ ] T013 [US1] Implement workflow step: Update job status to COMPLETED in `.github/workflows/rollback-reset.yml`
  - On success, PATCH job status to COMPLETED
  - Use `if: success()` condition

**Checkpoint**: User Story 1 complete - rollback triggers git reset, spec files preserved

---

## Phase 4: User Story 2 - Rollback with Failed Git Reset Recovery (Priority: P2)

**Goal**: If git reset fails, system marks job as FAILED and provides clear feedback

**Independent Test**: Simulate git reset failure and verify:
1. Job status is marked FAILED with error message
2. Ticket remains at PLAN stage (from initial transition)
3. Branch is in original state (no partial reset)

### Implementation for User Story 2

- [ ] T014 [US2] Implement workflow step: Update job status to FAILED on error in `.github/workflows/rollback-reset.yml`
  - Use `if: failure()` condition to catch any step failures
  - PATCH job status to FAILED
- [ ] T015 [US2] Add error handling for branch not found in `.github/workflows/rollback-reset.yml`
  - Check branch exists before checkout
  - Fail with descriptive error if branch missing
- [ ] T016 [US2] Add error handling for stash operation failure in `.github/workflows/rollback-reset.yml`
  - Wrap stash in error handling block
  - If stash fails, abort reset and preserve original state
- [ ] T017 [US2] Add error handling for push failure with retry in `.github/workflows/rollback-reset.yml`
  - Implement retry logic (attempt push twice)
  - Fail with descriptive error after retry exhausted

**Checkpoint**: User Story 2 complete - failures handled gracefully with clear feedback

---

## Phase 5: User Story 3 - Rollback Preserves Spec Modifications (Priority: P2)

**Goal**: Spec modifications made during VERIFY stage are preserved during rollback

**Independent Test**: Modify spec files in VERIFY stage, rollback, verify modifications retained

### Implementation for User Story 3

- [ ] T018 [US3] Ensure stash includes untracked files in `.github/workflows/rollback-reset.yml`
  - Verify `--include-untracked` flag handles new files added to spec folder
  - Test that modifications to existing spec files are preserved
- [ ] T019 [US3] Handle nested directories in spec folder in `.github/workflows/rollback-reset.yml`
  - Ensure contracts/, checklists/ subdirectories are preserved
  - Verify git stash handles nested structure correctly

**Checkpoint**: User Story 3 complete - all spec modifications preserved during rollback

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation and cleanup across all user stories

- [ ] T020 [P] Validate workflow runs correctly via manual test
  - Complete full VERIFY→PLAN rollback flow
  - Verify commit history shows implementation commits removed
  - Verify spec files unchanged
- [ ] T021 [P] Extend E2E tests to verify rollback-reset job creation in `tests/e2e/verify-rollback.spec.ts`
  - Add test: rollback creates job with command 'rollback-reset'
  - Add test: response includes resetJobId
- [ ] T022 Run quickstart.md validation checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion (dispatch function ready)
- **User Story 2 (Phase 4)**: Can be implemented alongside US1 (different workflow steps)
- **User Story 3 (Phase 5)**: Can be implemented alongside US1/US2 (enhancement to existing steps)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Core implementation - foundational to US2 and US3
- **User Story 2 (P2)**: Error handling - independent of US3, enhances US1
- **User Story 3 (P2)**: Spec preservation - independent of US2, enhances US1

### Within Each User Story

- Workflow steps should be implemented in order (they execute sequentially)
- API changes (T005) must be completed before workflow can be triggered
- Error handling (US2) can be added incrementally to existing workflow

### Parallel Opportunities

**Phase 1 (Setup)**:
- T001 and T002 can run in parallel (different files)

**Phase 3-5 (User Stories)**:
- US2 and US3 can be worked on in parallel after US1 core steps are done
- T014-T017 (US2) are independent of T018-T019 (US3)

**Phase 6 (Polish)**:
- T020 and T021 can run in parallel (manual vs automated testing)

---

## Parallel Example: Setup Phase

```bash
# Launch both setup tasks together:
Task: "Create dispatch function file app/lib/workflows/dispatch-rollback-reset.ts"
Task: "Create GitHub workflow file .github/workflows/rollback-reset.yml"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T004)
3. Complete Phase 3: User Story 1 (T005-T013)
4. **STOP and VALIDATE**: Test rollback triggers workflow and resets branch
5. Deploy if MVP satisfies requirements

### Incremental Delivery

1. Setup + Foundational → Dispatch function ready
2. Add User Story 1 → Core rollback-reset works → Validate manually
3. Add User Story 2 → Error handling robust → Test failure scenarios
4. Add User Story 3 → Spec preservation verified → Full validation
5. Polish → E2E tests pass → Ready for production

### Sequential Implementation (Recommended)

Given the workflow nature (steps depend on each other):

1. T001-T004: Build foundation (dispatch function + workflow shell)
2. T005: Connect transition API to dispatch
3. T006-T013: Build workflow steps in execution order
4. T014-T017: Add error handling to each step
5. T018-T019: Ensure spec preservation is complete
6. T020-T022: Validate and test

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No database migrations needed - Job.command is VARCHAR(50)
- Workflow must be merged to main before it can be dispatched
- Existing rollback functionality continues to work during implementation (graceful degradation)
- Force push requires GH_PAT with appropriate permissions
- Spec folder location: `specs/[BRANCH_NAME]/` (not `.specify/`)
