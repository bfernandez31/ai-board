# Research: Job Completion Validation for Stage Transitions

**Feature**: 030-should-not-be
**Date**: 2025-10-15
**Purpose**: Resolve NEEDS CLARIFICATION items from plan.md Phase 0

## Task 1: Job Query Performance Patterns

### Decision
Use Prisma `findFirst()` with `orderBy: { startedAt: 'desc' }` to fetch the most recent job for validation.

### Rationale
1. **Existing Index Support**: The `Job` model already has a composite index `@@index([ticketId, status, startedAt])` which perfectly supports this query pattern
2. **Simplicity**: `findFirst()` with `orderBy` is more readable than raw SQL and leverages Prisma's type safety
3. **Performance**: With the existing index, query performance will be <10ms for single-row lookup
4. **Consistency**: Pattern matches existing codebase style (see `/app/api/projects/[projectId]/jobs/status/route.ts` which uses similar patterns)

### Query Pattern
```typescript
const mostRecentJob = await prisma.job.findFirst({
  where: {
    ticketId: ticket.id,
    // Optional: Filter by stage-specific command if needed
    // command: STAGE_COMMAND_MAP[ticket.stage]
  },
  orderBy: { startedAt: 'desc' },
  select: {
    id: true,
    status: true,
    command: true,
    startedAt: true,
  },
});
```

### Alternatives Considered
- **`findMany()` with `take: 1`**: Equivalent but `findFirst()` is more semantically correct
- **Raw SQL with `LIMIT 1`**: Would bypass Prisma's type safety without performance benefits
- **Aggregate by max(startedAt)**:More complex, no performance gain with existing index

### Performance Validation
- Index: `@@index([ticketId, status, startedAt])` ✅ Exists
- Query plan: Expects index scan on ticketId + sort on startedAt (already indexed)
- Estimated time: <10ms for lookup, well under <50ms requirement

---

## Task 2: Error Response Structure for Job Validation

### Decision
Use error code `JOB_NOT_COMPLETED` with descriptive messages that include job status.

### Rationale
1. **Consistency**: Existing error codes follow `RESOURCE_STATE` pattern (e.g., `PROJECT_NOT_FOUND`, `INVALID_TRANSITION`)
2. **Semantic Clarity**: `JOB_NOT_COMPLETED` clearly indicates the validation failure reason
3. **Client-Friendly**: Descriptive messages help developers understand why transition was blocked
4. **Existing Pattern**: API routes already use structured error responses with `{ error, code, message }` format

### Error Response Schema
```typescript
// For PENDING/RUNNING jobs
{
  error: 'Cannot transition',
  code: 'JOB_NOT_COMPLETED',
  message: 'Cannot transition: workflow is still running',
  details: {
    currentStage: 'SPECIFY',
    targetStage: 'PLAN',
    jobStatus: 'RUNNING',
    jobCommand: 'specify'
  }
}

// For FAILED/CANCELLED jobs
{
  error: 'Cannot transition',
  code: 'JOB_NOT_COMPLETED',
  message: 'Cannot transition: previous workflow failed. Please retry the workflow.',
  details: {
    currentStage: 'SPECIFY',
    targetStage: 'PLAN',
    jobStatus: 'FAILED',
    jobCommand: 'specify'
  }
}
```

### HTTP Status Code
- **400 Bad Request**: Job validation failure is a client error (attempting invalid state transition)
- Matches existing pattern for `INVALID_TRANSITION` errors (also 400)

### Error Response Implementation Location
- **File**: `lib/workflows/transition.ts`
- **Function**: `handleTicketTransition()` - Add new error return before workflow dispatch
- **Type**: Extend `TransitionResult` interface with new `errorCode: 'JOB_NOT_COMPLETED'`

### Alternatives Considered
- **Error Code `WORKFLOW_IN_PROGRESS`**: Too specific, doesn't cover FAILED/CANCELLED states
- **Error Code `TRANSITION_BLOCKED`**: Too generic, doesn't indicate reason
- **HTTP 409 Conflict**: Less appropriate than 400 for validation failure
- **HTTP 423 Locked**: Implies resource lock, misleading for job status validation

### Evidence from Codebase
Grep search results show consistent pattern:
- `code: 'VALIDATION_ERROR'` for input validation failures
- `code: 'INVALID_TRANSITION'` for stage transition violations (returns 400)
- `code: 'PROJECT_NOT_FOUND'` for missing resources (returns 404)
- `code: 'FORBIDDEN'` for authorization failures (returns 403)

**Pattern**: `{error: string, code: string}` object returned with appropriate HTTP status

---

## Task 3: Test Update Strategy

### Decision
**Update existing test file** `/tests/api/ticket-transition.spec.ts` by adding new test scenarios for job completion validation.

### Rationale
1. **Constitution Compliance**: Principle III (Test-Driven Development) mandates searching for existing tests before creating new files
2. **Test Discovery**: Grep confirmed single test file covering transition API (483 lines, 10 test scenarios)
3. **Cohesion**: All transition API tests belong in same test file for maintainability
4. **Existing Helpers**: Test file already has `transitionThrough()` helper and `setupTestData()` which can be reused

### Test Scenarios to Add

#### New Test Scenarios (Job Completion Validation)
1. **Test: Block transition when job PENDING**
   - Arrange: Create ticket in SPECIFY stage with PENDING job
   - Act: Attempt transition to PLAN
   - Assert: 400 error with `code: 'JOB_NOT_COMPLETED'`

2. **Test: Block transition when job RUNNING**
   - Arrange: Create ticket in SPECIFY stage with RUNNING job
   - Act: Attempt transition to PLAN
   - Assert: 400 error with message "workflow is still running"

3. **Test: Block transition when job FAILED**
   - Arrange: Create ticket in SPECIFY stage with FAILED job
   - Act: Attempt transition to PLAN
   - Assert: 400 error with message "workflow failed. Please retry"

4. **Test: Block transition when job CANCELLED**
   - Arrange: Create ticket in SPECIFY stage with CANCELLED job
   - Act: Attempt transition to PLAN
   - Assert: 400 error with message "workflow was cancelled. Please retry"

5. **Test: Allow transition when job COMPLETED**
   - Arrange: Create ticket in SPECIFY stage with COMPLETED job
   - Act: Attempt transition to PLAN
   - Assert: 200 success, new job created

6. **Test: Validate against most recent job (multiple jobs scenario)**
   - Arrange: Create ticket with 2 jobs (old FAILED, new COMPLETED)
   - Act: Attempt transition to PLAN
   - Assert: 200 success (validates against most recent COMPLETED job)

7. **Test: Block when most recent job is not COMPLETED (multiple jobs)**
   - Arrange: Create ticket with 2 jobs (old COMPLETED, new FAILED)
   - Act: Attempt transition to PLAN
   - Assert: 400 error (validates against most recent FAILED job)

#### Existing Tests Requiring Updates

**Test 2: "should transition ticket from SPECIFY to PLAN"** (Line 64)
- **Current Behavior**: Transitions immediately after creating SPECIFY job (job is PENDING)
- **Update Required**: Complete the job by simulating workflow completion before PLAN transition
- **Fix**: After line 88 (branch update), add job completion simulation:
  ```typescript
  // Simulate job completion before transitioning to PLAN
  const workflowToken = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';
  await request.patch(`/api/jobs/${specifyJob.id}/status`, {
    data: { status: 'RUNNING' },
    headers: { 'Authorization': `Bearer ${workflowToken}` },
  });
  await request.patch(`/api/jobs/${specifyJob.id}/status`, {
    data: { status: 'COMPLETED' },
    headers: { 'Authorization': `Bearer ${workflowToken}` },
  });
  ```

**Test 3: "should transition ticket from PLAN to BUILD"** (Line 122)
- **Current Behavior**: Uses `transitionThrough()` helper which needs updating
- **Update Required**: Ensure `transitionThrough()` helper completes jobs before transitions
- **Fix Location**: `/tests/helpers/transition-helpers.ts` - Update helper to complete jobs

**Test 9: "should handle optimistic concurrency conflicts"** (Line 369)
- **Current Behavior**: Expects concurrent transitions to have one 200 and one 400/409/500
- **Impact**: May now fail with `JOB_NOT_COMPLETED` instead of state machine error
- **Update Required**: Update expected error codes to include `JOB_NOT_COMPLETED` as valid failure
- **Fix**: Line 392 - Add `JOB_NOT_COMPLETED` to expected failure codes

### Helper Function Updates

**File**: `/tests/helpers/transition-helpers.ts`
**Function**: `transitionThrough()`
**Update**: After each transition, simulate job completion before next transition:
```typescript
export async function transitionThrough(
  request: APIRequestContext,
  ticketId: number,
  stages: string[]
): Promise<void> {
  for (const stage of stages) {
    const response = await request.post(`/api/projects/1/tickets/${ticketId}/transition`, {
      data: { targetStage: stage },
    });

    // [NEW] Simulate job completion for automated stages
    if (['SPECIFY', 'PLAN', 'BUILD'].includes(stage)) {
      const body = await response.json();
      const jobId = body.jobId;

      const workflowToken = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

      // Transition job to RUNNING then COMPLETED
      await request.patch(`/api/jobs/${jobId}/status`, {
        data: { status: 'RUNNING' },
        headers: { 'Authorization': `Bearer ${workflowToken}` },
      });

      await request.patch(`/api/jobs/${jobId}/status`, {
        data: { status: 'COMPLETED' },
        headers: { 'Authorization': `Bearer ${workflowToken}` },
      });
    }
  }
}
```

### New Test Helper (Optional)
Create helper for creating tickets with specific job statuses:
```typescript
// File: /tests/helpers/db-setup.ts
export async function createTicketWithJob(
  stage: string,
  jobStatus: JobStatus,
  jobCommand: string
): Promise<{ ticket: Ticket; job: Job }> {
  const { ticket } = await setupTestData({ stage });
  const job = await prisma.job.create({
    data: {
      ticketId: ticket.id,
      projectId: 1,
      command: jobCommand,
      status: jobStatus,
      startedAt: new Date(),
      updatedAt: new Date(),
    },
  });
  return { ticket, job };
}
```

### Test File Structure (Post-Update)
```typescript
test.describe('POST /api/projects/:projectId/tickets/:id/transition', () => {
  // Existing tests (10 scenarios) - some require updates
  test('should transition ticket from INBOX to SPECIFY', ...);           // [NO CHANGE]
  test('should transition ticket from SPECIFY to PLAN', ...);            // [UPDATE] Add job completion
  test('should transition ticket from PLAN to BUILD', ...);              // [NO CHANGE] Helper handles it
  test('should transition ticket to VERIFY without creating job', ...);  // [NO CHANGE]
  test('should reject invalid transition (skipping stages)', ...);       // [NO CHANGE]
  test('should reject cross-project access', ...);                       // [NO CHANGE]
  test('should return 404 for non-existent project', ...);               // [NO CHANGE]
  test('should return 404 for non-existent ticket', ...);                // [NO CHANGE]
  test('should handle optimistic concurrency conflicts', ...);           // [UPDATE] Expected error codes
  test('should support complete workflow with branch creation', ...);    // [NO CHANGE]

  // NEW: Job completion validation tests (7 scenarios)
  test.describe('Job Completion Validation', () => {
    test('should block transition when job is PENDING', ...);
    test('should block transition when job is RUNNING', ...);
    test('should block transition when job is FAILED', ...);
    test('should block transition when job is CANCELLED', ...);
    test('should allow transition when job is COMPLETED', ...);
    test('should validate against most recent job (COMPLETED)', ...);
    test('should validate against most recent job (FAILED)', ...);
  });
});
```

### Alternatives Considered
- **Create new test file**: Violates constitution (Principle III - must search for existing tests first)
- **Update only failing tests**: Incomplete, doesn't add new validation scenarios
- **Skip test updates**: Causes test failures, violates TDD principle

### Test Execution Strategy
1. **Phase 1**: Update `transitionThrough()` helper in `/tests/helpers/transition-helpers.ts`
2. **Phase 2**: Add new test scenarios in nested `describe('Job Completion Validation')` block
3. **Phase 3**: Update existing tests (Test 2, Test 9) with job completion simulation
4. **Phase 4**: Run all tests to verify no regressions

---

## Summary

All NEEDS CLARIFICATION items resolved:

1. **Job Query Pattern**: ✅ `findFirst()` with `orderBy: { startedAt: 'desc' }` leveraging existing composite index
2. **Error Response**: ✅ `JOB_NOT_COMPLETED` error code with descriptive messages, 400 HTTP status
3. **Test Strategy**: ✅ Update existing `/tests/api/ticket-transition.spec.ts` with 7 new scenarios and 3 test updates

**Ready for Phase 1**: Design artifacts (data-model.md, contracts/, quickstart.md)
