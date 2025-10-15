# Tasks: Job Completion Validation for Stage Transitions

**Input**: Design documents from `/specs/030-should-not-be/`
**Prerequisites**: plan.md, spec.md (4 user stories), research.md, data-model.md, contracts/job-validation-error.yaml

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- **Next.js 15 App Router**: `app/`, `lib/`, `tests/` at repository root
- API routes in `app/api/`
- Business logic in `lib/`
- E2E tests in `tests/api/` using Playwright

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare test helpers and validation infrastructure for all user stories

- [ ] T001 [P] Update `tests/helpers/transition-helpers.ts` to add job completion simulation in `transitionThrough()` helper
- [ ] T002 [P] Add `createTicketWithJob()` helper to `tests/helpers/db-setup.ts` for creating tickets with specific job statuses

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core validation logic that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Add `shouldValidateJobCompletion()` function to `lib/workflows/transition.ts` to determine which stages require validation
- [ ] T004 Add `getJobValidationErrorMessage()` function to `lib/workflows/transition.ts` to map job statuses to user-friendly error messages
- [ ] T005 Add `validateJobCompletion()` function to `lib/workflows/transition.ts` to query most recent job and validate status
- [ ] T006 Update `TransitionResult` interface in `lib/workflows/transition.ts` to add `JOB_NOT_COMPLETED` and `MISSING_JOB` error codes with optional `details` field
- [ ] T007 Integrate `validateJobCompletion()` call into `handleTicketTransition()` in `lib/workflows/transition.ts` after sequential validation but before workflow dispatch
- [ ] T008 Update error handling in `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` to support new error codes and include details in response

**Checkpoint**: Foundation ready - validation logic implemented, all user stories can now be tested

---

## Phase 3: User Story 1 - Block Transition When Job Not Completed (Priority: P1) 🎯 MVP

**Goal**: Prevent ticket transitions from SPECIFY, PLAN, and BUILD stages when jobs are in non-terminal states (PENDING, RUNNING, FAILED, CANCELLED)

**Independent Test**: Create ticket in SPECIFY stage with PENDING job, attempt transition to PLAN, verify 400 error with `JOB_NOT_COMPLETED` code

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before foundational implementation**

- [ ] T009 [P] [US1] Add test "should block transition when job is PENDING" in nested `describe('Job Completion Validation')` block in `tests/api/ticket-transition.spec.ts`
- [ ] T010 [P] [US1] Add test "should block transition when job is RUNNING" in nested `describe('Job Completion Validation')` block in `tests/api/ticket-transition.spec.ts`
- [ ] T011 [P] [US1] Add test "should block transition when job is FAILED" with retry message in nested `describe('Job Completion Validation')` block in `tests/api/ticket-transition.spec.ts`
- [ ] T012 [P] [US1] Add test "should block transition when job is CANCELLED" with retry message in nested `describe('Job Completion Validation')` block in `tests/api/ticket-transition.spec.ts`
- [ ] T013 [P] [US1] Add test "should block PLAN→BUILD transition when plan job is PENDING" in nested `describe('Job Completion Validation')` block in `tests/api/ticket-transition.spec.ts`
- [ ] T014 [P] [US1] Add test "should block BUILD→VERIFY transition when build job is RUNNING" in nested `describe('Job Completion Validation')` block in `tests/api/ticket-transition.spec.ts`

### Validation for User Story 1

- [ ] T015 [US1] Run tests to verify all 6 blocking scenarios return 400 error with correct error messages and job details
- [ ] T016 [US1] Verify error response includes `details` object with `currentStage`, `targetStage`, `jobStatus`, and `jobCommand` fields

**Checkpoint**: At this point, User Story 1 should be fully functional - transitions are blocked when jobs incomplete

---

## Phase 4: User Story 2 - Allow Transition When Job Completed (Priority: P1) 🎯 MVP

**Goal**: Allow ticket transitions when the most recent job has status COMPLETED

**Independent Test**: Create ticket in SPECIFY stage with COMPLETED job, attempt transition to PLAN, verify 200 success and new job created

### Tests for User Story 2

- [ ] T017 [P] [US2] Add test "should allow transition when job is COMPLETED" in nested `describe('Job Completion Validation')` block in `tests/api/ticket-transition.spec.ts`
- [ ] T018 [P] [US2] Add test "should allow PLAN→BUILD transition when plan job is COMPLETED" in nested `describe('Job Completion Validation')` block in `tests/api/ticket-transition.spec.ts`
- [ ] T019 [P] [US2] Add test "should allow BUILD→VERIFY transition when build job is COMPLETED" in nested `describe('Job Completion Validation')` block in `tests/api/ticket-transition.spec.ts`

### Validation for User Story 2

- [ ] T020 [US2] Run tests to verify all 3 scenarios return 200 success with new job created and ticket stage updated
- [ ] T021 [US2] Verify response includes `jobId` for automated stages (SPECIFY→PLAN, PLAN→BUILD)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - transitions blocked when incomplete, allowed when completed

---

## Phase 5: User Story 3 - Allow Transitions for Manual Stages (Priority: P2)

**Goal**: Ensure manual stages (INBOX→SPECIFY, BUILD→VERIFY, VERIFY→SHIP) bypass job validation

**Independent Test**: Create ticket in VERIFY stage (no jobs required), attempt transition to SHIP, verify 200 success without job validation

### Tests for User Story 3

- [ ] T022 [P] [US3] Update existing test "should transition ticket from SPECIFY to PLAN" (line 64) in `tests/api/ticket-transition.spec.ts` to add job completion simulation after SPECIFY job creation before PLAN transition
- [ ] T023 [P] [US3] Verify existing test "should transition ticket from PLAN to BUILD" still passes with updated `transitionThrough()` helper that completes jobs
- [ ] T024 [P] [US3] Add test "should allow INBOX→SPECIFY transition without job validation" in nested `describe('Job Completion Validation')` block in `tests/api/ticket-transition.spec.ts`

### Validation for User Story 3

- [ ] T025 [US3] Run tests to verify manual stage transitions (INBOX→SPECIFY, VERIFY→SHIP) work without job validation
- [ ] T026 [US3] Verify updated helper function `transitionThrough()` properly completes jobs for automated stages before next transition

**Checkpoint**: All P1 and P2 user stories should now be independently functional

---

## Phase 6: User Story 4 - Handle Multiple Jobs for Same Ticket (Priority: P3)

**Goal**: Validate against the most recent job (by `startedAt DESC`) when multiple jobs exist for the same ticket

**Independent Test**: Create ticket with two jobs (old FAILED, new COMPLETED), attempt transition, verify system checks only most recent job

### Tests for User Story 4

- [ ] T027 [P] [US4] Add test "should validate against most recent job (COMPLETED after FAILED)" in nested `describe('Job Completion Validation')` block in `tests/api/ticket-transition.spec.ts`
- [ ] T028 [P] [US4] Add test "should validate against most recent job (FAILED after COMPLETED)" in nested `describe('Job Completion Validation')` block in `tests/api/ticket-transition.spec.ts`
- [ ] T029 [P] [US4] Add test "should validate against most recent job with three jobs (FAILED, COMPLETED, RUNNING)" in nested `describe('Job Completion Validation')` block in `tests/api/ticket-transition.spec.ts`

### Validation for User Story 4

- [ ] T030 [US4] Run tests to verify system always checks most recent job by `startedAt DESC` regardless of job status history
- [ ] T031 [US4] Verify query performance using existing composite index `[ticketId, status, startedAt]` achieves <10ms execution time

**Checkpoint**: All user stories should now be independently functional with retry workflow support

---

## Phase 7: Integration & Compatibility

**Purpose**: Ensure new validation doesn't break existing tests

- [ ] T032 Update existing test "should handle optimistic concurrency conflicts" (line 369) in `tests/api/ticket-transition.spec.ts` to add `JOB_NOT_COMPLETED` to expected error codes for concurrent transition failures
- [ ] T033 Run all existing tests in `tests/api/ticket-transition.spec.ts` to verify no regressions (should see 10 existing + 10 new tests pass)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Quality assurance and documentation

- [ ] T034 [P] Run TypeScript type check: `npm run type-check` to verify all types are correct
- [ ] T035 [P] Run linter: `npm run lint` to ensure code quality standards
- [ ] T036 Run full test suite: `npx playwright test tests/api/ticket-transition.spec.ts` to verify all 20 test scenarios pass
- [ ] T037 Manual testing: Follow quickstart.md Test Scenario 1 (Block PENDING Job) to verify error response
- [ ] T038 Manual testing: Follow quickstart.md Test Scenario 2 (Allow After Completion) to verify success response
- [ ] T039 Performance validation: Verify job validation query executes in <50ms using database query logs
- [ ] T040 Run quickstart.md validation checklist to ensure all implementation steps completed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately (test helper updates)
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories (core validation logic)
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Story 1 (P1) - Block transitions: Can start after Phase 2
  - User Story 2 (P1) - Allow transitions: Can start after Phase 2 (parallel with US1)
  - User Story 3 (P2) - Manual stages: Can start after Phase 2 (parallel with US1/US2)
  - User Story 4 (P3) - Multiple jobs: Can start after Phase 2 (parallel with US1/US2/US3)
- **Integration (Phase 7)**: Depends on all user stories being complete
- **Polish (Phase 8)**: Depends on Integration completion

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories (tests complementary scenarios)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Updates existing tests, should work independently
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Tests edge case with query logic, independently testable

### Within Each User Story

- Tests (Phases 3-6) should be written and FAIL before foundational implementation (Phase 2)
- Core validation logic (Phase 2) before any user story tests pass
- Each user story's tests can run in parallel within that phase (all marked [P])
- Validation tasks run sequentially after tests to verify correctness

### Parallel Opportunities

- **Setup (Phase 1)**: Both tasks T001 and T002 can run in parallel (different files)
- **User Story Tests**: Once Phase 2 complete, all 6 tests for US1 can run in parallel (T009-T014)
- **User Story Tests**: All 3 tests for US2 can run in parallel (T017-T019)
- **User Story Tests**: All 3 tests for US3 can run in parallel (T022-T024)
- **User Story Tests**: All 3 tests for US4 can run in parallel (T027-T029)
- **Cross-Story Parallelization**: After Phase 2, developers can work on US1, US2, US3, and US4 in parallel
- **Polish (Phase 8)**: T034 and T035 can run in parallel (independent checks)

---

## Parallel Example: User Story 1

```bash
# After Phase 2 (foundational) complete, launch all 6 blocking tests together:
Task T009: "Add test 'should block transition when job is PENDING'"
Task T010: "Add test 'should block transition when job is RUNNING'"
Task T011: "Add test 'should block transition when job is FAILED'"
Task T012: "Add test 'should block transition when job is CANCELLED'"
Task T013: "Add test 'should block PLAN→BUILD transition when plan job is PENDING'"
Task T014: "Add test 'should block BUILD→VERIFY transition when build job is RUNNING'"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only - Both P1)

1. Complete Phase 1: Setup (test helpers) → Foundation for all tests ready
2. Complete Phase 2: Foundational (core validation logic) → CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (blocking transitions) → Core safety feature
4. Complete Phase 4: User Story 2 (allowing transitions) → Complementary happy path
5. **STOP and VALIDATE**: Test both stories independently
6. Deploy/demo MVP - essential job validation working

### Incremental Delivery

1. Complete Setup + Foundational → Validation infrastructure ready
2. Add User Story 1 (P1) → Test independently → Core blocking logic working
3. Add User Story 2 (P1) → Test independently → Happy path working → Deploy/Demo MVP!
4. Add User Story 3 (P2) → Test independently → Manual stages preserved → Deploy/Demo
5. Add User Story 4 (P3) → Test independently → Retry workflows supported → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers after Phase 2 completion:

1. **Team completes Setup + Foundational together** (T001-T008)
2. **Once Foundational done, split work:**
   - Developer A: User Story 1 (T009-T016) - Blocking transitions
   - Developer B: User Story 2 (T017-T021) - Allowing transitions
   - Developer C: User Story 3 (T022-T026) - Manual stages
   - Developer D: User Story 4 (T027-T031) - Multiple jobs
3. Stories complete and integrate independently
4. **Reconvene for Integration (Phase 7)** - verify no conflicts
5. **Final Polish (Phase 8)** - quality checks together

---

## Notes

- [P] tasks = different files or independent test scenarios, no dependencies
- [Story] label (US1, US2, US3, US4) maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **CRITICAL**: Write tests (Phases 3-6) BEFORE implementing foundational logic (Phase 2) to follow TDD principle
- Tests should FAIL initially, then PASS after Phase 2 implementation
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- User's explicit requirement: "try to use existing one, and fix the one would be impacted by this change"
  - T022 updates existing test (line 64)
  - T023 verifies existing test still passes
  - T032 updates existing test (line 369) for compatibility
  - All other tests added to existing `/tests/api/ticket-transition.spec.ts` file in nested `describe('Job Completion Validation')` block
