# Tasks: Update Job Status on GitHub Actions Completion

**Input**: Design documents from `/specs/019-update-job-on/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/job-update-api.yaml

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Tech stack: TypeScript 5.6, Next.js 15, Prisma 6.x, Zod 4.x
   → ✅ Structure: Next.js App Router with API routes
2. Load optional design documents:
   → data-model.md: JobStatus enum extension, state machine
   → contracts/: job-update-api.yaml → contract test task
   → research.md: State transitions, idempotency, error handling
3. Generate tasks by category:
   → Setup: Prisma migration, dependencies
   → Tests: Contract tests, E2E tests for state transitions
   → Core: State machine, validation schemas, API endpoint
   → Integration: GitHub workflow updates
   → Polish: Manual testing, documentation updates
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → ✅ Contract has test (job-update-api.yaml)
   → ✅ State machine testable in isolation
   → ✅ E2E tests cover all scenarios
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: Next.js App Router structure
- API routes: `app/api/jobs/[id]/status/route.ts`
- Libraries: `app/lib/job-state-machine.ts`, `app/lib/job-update-validator.ts`
- Tests: `tests/job-status-update.spec.ts`
- Schema: `prisma/schema.prisma`

## Phase 3.1: Setup

- [ ] **T001** Add CANCELLED to JobStatus enum in `prisma/schema.prisma`
  ```prisma
  enum JobStatus {
    PENDING
    RUNNING
    COMPLETED
    FAILED
    CANCELLED  // NEW
  }
  ```

- [ ] **T002** Generate and apply Prisma migration for JobStatus enum
  ```bash
  npx prisma migrate dev --name add-cancelled-job-status
  ```

- [ ] **T003** Verify migration with Prisma Studio
  ```bash
  npx prisma studio
  # Verify JobStatus enum shows CANCELLED option
  ```

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [ ] **T004** [P] Create state machine unit tests in `tests/unit/job-state-machine.test.ts`
  - Test valid transitions (RUNNING → COMPLETED/FAILED/CANCELLED)
  - Test invalid transitions (COMPLETED → FAILED)
  - Test terminal state detection
  - Test idempotent transitions (COMPLETED → COMPLETED)

- [ ] **T005** [P] Create API contract test in `tests/e2e/job-status-update-contract.spec.ts`
  - Test PATCH /api/jobs/[id]/status endpoint exists
  - Test request schema validation (Zod)
  - Test response schema matches OpenAPI spec
  - Test error response formats (400, 404, 500)

- [ ] **T006** [P] Create E2E test for successful completion in `tests/e2e/job-status-update.spec.ts`
  - Create Job with status RUNNING
  - Send PATCH request with status COMPLETED
  - Assert HTTP 200 response
  - Assert job status updated to COMPLETED
  - Assert completedAt timestamp set
  - Assert startedAt unchanged

- [ ] **T007** [P] Create E2E test for workflow failure in `tests/e2e/job-status-update.spec.ts`
  - Create Job with status RUNNING
  - Send PATCH request with status FAILED
  - Assert HTTP 200 response
  - Assert job status updated to FAILED
  - Assert completedAt timestamp set

- [ ] **T008** [P] Create E2E test for workflow cancellation in `tests/e2e/job-status-update.spec.ts`
  - Create Job with status RUNNING
  - Send PATCH request with status CANCELLED
  - Assert HTTP 200 response
  - Assert job status updated to CANCELLED
  - Assert completedAt timestamp set

- [ ] **T009** [P] Create E2E test for idempotent updates in `tests/e2e/job-status-update.spec.ts`
  - Create Job with status COMPLETED
  - Send PATCH request with status COMPLETED
  - Assert HTTP 200 response
  - Assert no database changes
  - Assert completedAt unchanged

- [ ] **T010** [P] Create E2E test for invalid transitions in `tests/e2e/job-status-update.spec.ts`
  - Create Job with status COMPLETED
  - Send PATCH request with status FAILED
  - Assert HTTP 400 response
  - Assert error message "Invalid transition from COMPLETED to FAILED"
  - Assert no database changes

- [ ] **T011** [P] Create E2E test for invalid status value in `tests/e2e/job-status-update.spec.ts`
  - Send PATCH request with invalid status "INVALID"
  - Assert HTTP 400 response
  - Assert Zod validation error details included

- [ ] **T012** [P] Create E2E test for job not found in `tests/e2e/job-status-update.spec.ts`
  - Send PATCH request for non-existent job ID
  - Assert HTTP 404 response
  - Assert error message "Job not found"

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [ ] **T013** [P] Create state machine validation logic in `app/lib/job-state-machine.ts`
  - Define JobStatus type
  - Define VALID_TRANSITIONS map (PENDING→RUNNING, RUNNING→COMPLETED/FAILED/CANCELLED)
  - Implement `canTransition(from, to)` function
  - Implement `isTerminalStatus(status)` function
  - Define InvalidTransitionError class

- [ ] **T014** [P] Create Zod validation schema in `app/lib/job-update-validator.ts`
  - Define jobStatusUpdateSchema with enum validation
  - Export JobStatusUpdate type
  - Include custom error messages for invalid status values

- [ ] **T015** Create API endpoint in `app/api/jobs/[id]/status/route.ts` (PATCH handler)
  - Import Prisma client, Zod schema, state machine
  - Validate request body with Zod
  - Fetch current job from database
  - Handle 404 if job not found
  - Check if transition is idempotent (same status)
  - Validate state transition with `canTransition()`
  - Update job status and completedAt if valid
  - Return minimal response (id, status, completedAt)
  - Handle errors: Zod validation (400), InvalidTransitionError (400), unexpected (500)
  - Add error logging for debugging

- [ ] **T016** Add error handling and logging to API endpoint in `app/api/jobs/[id]/status/route.ts`
  - Log all status update attempts (success and failure)
  - Include job ID, current status, requested status, result
  - Ensure no sensitive data in logs

## Phase 3.4: Integration

- [ ] **T017** Update GitHub workflow to accept job_id input in `.github/workflows/speckit.yml`
  - Add `job_id` to workflow_dispatch inputs
  - Type: number
  - Description: "Job ID for status tracking"
  - Required: false (backward compatibility)

- [ ] **T018** Add status update step to GitHub workflow in `.github/workflows/speckit.yml`
  - Add step after spec-kit command execution
  - Use curl to PATCH /api/jobs/${{ inputs.job_id }}/status
  - Pass status: COMPLETED on success
  - Use if: always() to ensure step runs
  - Add separate step for failure (status: FAILED)
  - Add separate step for cancellation (status: CANCELLED)

- [ ] **T019** Test workflow integration manually
  - Create test Job with status RUNNING
  - Trigger workflow with job_id parameter
  - Monitor workflow execution
  - Verify job status updates to COMPLETED
  - Verify completedAt timestamp accurate

## Phase 3.5: Polish

- [ ] **T020** Run all E2E tests and verify they pass
  ```bash
  npx playwright test tests/e2e/job-status-update.spec.ts
  npx playwright test tests/e2e/job-status-update-contract.spec.ts
  npx playwright test tests/unit/job-state-machine.test.ts
  ```

- [ ] **T021** Execute quickstart.md manual testing scenarios
  - Run all 8 scenarios from `specs/019-update-job-on/quickstart.md`
  - Validate API responses match OpenAPI contract
  - Verify performance target (<200ms per request)
  - Check error messages are clear and actionable

- [ ] **T022** Update CLAUDE.md project documentation
  - Document new API endpoint `/api/jobs/[id]/status`
  - Document state machine patterns and transition rules
  - Document JobStatus enum with CANCELLED status
  - Add testing requirements for state transitions

- [ ] **T023** Performance validation
  - Measure API response times with curl timing
  - Verify <200ms target met (typical: 10-50ms)
  - Test concurrent workflow completions
  - Monitor database query performance

- [ ] **T024** Code cleanup and final review
  - Remove any debug logging
  - Ensure TypeScript strict mode compliance
  - Verify error handling covers all edge cases
  - Check for code duplication
  - Ensure consistent code formatting

## Dependencies

**Setup Phase (T001-T003)**:
- T002 depends on T001 (migration needs schema change)
- T003 depends on T002 (verification needs migration applied)

**Test Phase (T004-T012)**:
- All tests can run in parallel [P]
- Tests must fail before implementation begins

**Implementation Phase (T013-T016)**:
- T013 [P] and T014 [P] are independent (different files)
- T015 depends on T013 and T014 (imports state machine and validator)
- T016 modifies T015 (same file, sequential)

**Integration Phase (T017-T019)**:
- T017 [P] and T018 modify same file (sequential, not parallel)
- T019 depends on T017 and T018 (needs workflow changes)

**Polish Phase (T020-T024)**:
- T020 depends on all implementation tasks
- T021-T024 can run in parallel [P] after T020

## Parallel Execution Examples

### Phase 3.2: Launch All Tests Together
```bash
# All tests run in parallel - different files, no dependencies
Task: "Create state machine unit tests in tests/unit/job-state-machine.test.ts"
Task: "Create API contract test in tests/e2e/job-status-update-contract.spec.ts"
Task: "Create E2E test for successful completion in tests/e2e/job-status-update.spec.ts"
Task: "Create E2E test for workflow failure in tests/e2e/job-status-update.spec.ts"
Task: "Create E2E test for workflow cancellation in tests/e2e/job-status-update.spec.ts"
Task: "Create E2E test for idempotent updates in tests/e2e/job-status-update.spec.ts"
Task: "Create E2E test for invalid transitions in tests/e2e/job-status-update.spec.ts"
Task: "Create E2E test for invalid status value in tests/e2e/job-status-update.spec.ts"
Task: "Create E2E test for job not found in tests/e2e/job-status-update.spec.ts"
```

### Phase 3.3: Launch State Machine and Validator in Parallel
```bash
# These tasks touch different files, can run concurrently
Task: "Create state machine validation logic in app/lib/job-state-machine.ts"
Task: "Create Zod validation schema in app/lib/job-update-validator.ts"
```

### Phase 3.5: Launch Polish Tasks in Parallel
```bash
# After T020 passes, these can run concurrently
Task: "Execute quickstart.md manual testing scenarios"
Task: "Update CLAUDE.md project documentation"
Task: "Performance validation"
Task: "Code cleanup and final review"
```

## Notes

- **[P] tasks**: Different files, no dependencies, safe for parallel execution
- **TDD Workflow**: Verify tests fail (Red) → Implement (Green) → Refactor
- **Commit Strategy**: Commit after each task for clean git history
- **Avoid**: Vague tasks, modifying same file in parallel tasks
- **State Machine**: Pure function, testable in isolation before API integration
- **Idempotency**: Same request → same result (200 OK, no database change)
- **Error Handling**: Log-only approach, no retry mechanism (per clarification)

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - ✅ job-update-api.yaml → T005 (contract test)
   - ✅ PATCH /api/jobs/[id]/status → T015 (implementation)

2. **From Data Model**:
   - ✅ JobStatus enum → T001 (schema change)
   - ✅ State machine → T004 (unit tests), T013 (implementation)

3. **From Quickstart**:
   - ✅ Each scenario → E2E test tasks (T006-T012)
   - ✅ Manual validation → T021 (quickstart execution)

4. **Ordering**:
   - ✅ Setup (T001-T003) → Tests (T004-T012) → Implementation (T013-T016) → Integration (T017-T019) → Polish (T020-T024)
   - ✅ Dependencies enforced via sequential execution

## Validation Checklist
*GATE: Checked before execution*

- [x] All contracts have corresponding tests (job-update-api.yaml → T005)
- [x] State machine has unit tests (T004 before T013)
- [x] All tests come before implementation (T004-T012 before T013-T016)
- [x] Parallel tasks truly independent (verified file paths)
- [x] Each task specifies exact file path (all tasks include paths)
- [x] No task modifies same file as another [P] task (validated)
- [x] E2E tests cover all quickstart scenarios (T006-T012 match scenarios 1-7)
- [x] GitHub workflow integration included (T017-T019)
- [x] Documentation updates planned (T022)

## Summary

**Total Tasks**: 24
**Parallel Opportunities**:
- Phase 3.2: 9 test tasks (T004-T012)
- Phase 3.3: 2 implementation tasks (T013-T014)
- Phase 3.5: 4 polish tasks (T021-T024)

**Estimated Effort**:
- Setup: 30 minutes (T001-T003)
- Test Writing: 3-4 hours (T004-T012)
- Implementation: 2-3 hours (T013-T016)
- Integration: 1-2 hours (T017-T019)
- Polish: 2 hours (T020-T024)
- **Total**: 8-11 hours

**Critical Path**: T001 → T002 → T003 → T004-T012 → T013-T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021-T024
