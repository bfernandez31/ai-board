# Quickstart: Update Job Status on GitHub Actions Completion

**Feature**: 019-update-job-on
**Date**: 2025-10-10

## Purpose

This quickstart guide provides manual testing steps to verify the Job status update feature works correctly after implementation. Follow these steps to validate workflow completion scenarios and state transitions.

## Prerequisites

- [ ] Local development environment running (`npm run dev`)
- [ ] PostgreSQL database running with latest migrations applied
- [ ] Test data: At least one Project and Ticket in database
- [ ] API testing tool installed (curl, Postman, or similar)
- [ ] GitHub repository with spec-kit workflow configured

## Test Scenarios

### Scenario 1: Successful Workflow Completion (RUNNING → COMPLETED)

**Objective**: Verify job status updates to COMPLETED when workflow finishes successfully.

**Steps**:

1. Create a test Job record in RUNNING state:
   ```sql
   INSERT INTO "Job" ("ticketId", "command", "status", "startedAt", "createdAt", "updatedAt")
   VALUES (1, 'specify', 'RUNNING', NOW(), NOW(), NOW())
   RETURNING id;
   -- Note the returned ID (e.g., 42)
   ```

2. Send status update request:
   ```bash
   curl -X PATCH http://localhost:3000/api/jobs/42/status \
     -H "Content-Type: application/json" \
     -d '{"status": "COMPLETED"}'
   ```

3. **Expected Response** (HTTP 200):
   ```json
   {
     "id": 42,
     "status": "COMPLETED",
     "completedAt": "2025-10-10T14:32:15.123Z"
   }
   ```

4. Verify database state:
   ```sql
   SELECT id, status, "completedAt", "startedAt"
   FROM "Job"
   WHERE id = 42;
   ```

   **Expected**:
   - `status` = 'COMPLETED'
   - `completedAt` is set to current timestamp
   - `startedAt` is unchanged from step 1

**✅ Pass Criteria**: HTTP 200 response, status updated in database, timestamps correct

---

### Scenario 2: Failed Workflow (RUNNING → FAILED)

**Objective**: Verify job status updates to FAILED when workflow errors.

**Steps**:

1. Create test Job in RUNNING state (see Scenario 1, step 1)

2. Send status update request:
   ```bash
   curl -X PATCH http://localhost:3000/api/jobs/43/status \
     -H "Content-Type: application/json" \
     -d '{"status": "FAILED"}'
   ```

3. **Expected Response** (HTTP 200):
   ```json
   {
     "id": 43,
     "status": "FAILED",
     "completedAt": "2025-10-10T14:35:42.789Z"
   }
   ```

4. Verify database state (see Scenario 1, step 4)

**✅ Pass Criteria**: HTTP 200 response, status = FAILED, completedAt set

---

### Scenario 3: Cancelled Workflow (RUNNING → CANCELLED)

**Objective**: Verify job status updates to CANCELLED when user stops workflow.

**Steps**:

1. Create test Job in RUNNING state

2. Send status update request:
   ```bash
   curl -X PATCH http://localhost:3000/api/jobs/44/status \
     -H "Content-Type: application/json" \
     -d '{"status": "CANCELLED"}'
   ```

3. **Expected Response** (HTTP 200):
   ```json
   {
     "id": 44,
     "status": "CANCELLED",
     "completedAt": "2025-10-10T14:38:12.456Z"
   }
   ```

4. Verify database state

**✅ Pass Criteria**: HTTP 200 response, status = CANCELLED, completedAt set

---

### Scenario 4: Idempotent Update (COMPLETED → COMPLETED)

**Objective**: Verify same status request returns success without error (idempotency).

**Steps**:

1. Create test Job already in COMPLETED state:
   ```sql
   INSERT INTO "Job" ("ticketId", "command", "status", "completedAt", "startedAt", "createdAt", "updatedAt")
   VALUES (1, 'plan', 'COMPLETED', NOW(), NOW() - INTERVAL '5 minutes', NOW(), NOW())
   RETURNING id;
   ```

2. Request same status again:
   ```bash
   curl -X PATCH http://localhost:3000/api/jobs/45/status \
     -H "Content-Type: application/json" \
     -d '{"status": "COMPLETED"}'
   ```

3. **Expected Response** (HTTP 200):
   ```json
   {
     "id": 45,
     "status": "COMPLETED",
     "completedAt": "2025-10-10T14:30:00.000Z"
   }
   ```

4. Verify completedAt timestamp is UNCHANGED from step 1

**✅ Pass Criteria**: HTTP 200 response, no database changes, same completedAt value

---

### Scenario 5: Invalid State Transition (COMPLETED → FAILED)

**Objective**: Verify invalid transitions return 400 error.

**Steps**:

1. Use existing COMPLETED job from Scenario 4 (or create new one)

2. Attempt invalid transition:
   ```bash
   curl -X PATCH http://localhost:3000/api/jobs/45/status \
     -H "Content-Type: application/json" \
     -d '{"status": "FAILED"}'
   ```

3. **Expected Response** (HTTP 400):
   ```json
   {
     "error": "Invalid transition from COMPLETED to FAILED"
   }
   ```

4. Verify database state unchanged (still COMPLETED)

**✅ Pass Criteria**: HTTP 400 response, descriptive error message, no database change

---

### Scenario 6: Invalid Status Value

**Objective**: Verify request validation rejects invalid status values.

**Steps**:

1. Send request with invalid status:
   ```bash
   curl -X PATCH http://localhost:3000/api/jobs/42/status \
     -H "Content-Type: application/json" \
     -d '{"status": "INVALID"}'
   ```

2. **Expected Response** (HTTP 400):
   ```json
   {
     "error": "Invalid request",
     "details": [
       {
         "message": "Status must be COMPLETED, FAILED, or CANCELLED",
         "path": ["status"]
       }
     ]
   }
   ```

**✅ Pass Criteria**: HTTP 400 response, Zod validation error details included

---

### Scenario 7: Job Not Found

**Objective**: Verify 404 error for non-existent job ID.

**Steps**:

1. Send request for non-existent job:
   ```bash
   curl -X PATCH http://localhost:3000/api/jobs/99999/status \
     -H "Content-Type: application/json" \
     -d '{"status": "COMPLETED"}'
   ```

2. **Expected Response** (HTTP 404):
   ```json
   {
     "error": "Job not found"
   }
   ```

**✅ Pass Criteria**: HTTP 404 response, clear error message

---

### Scenario 8: End-to-End Workflow Integration

**Objective**: Verify complete workflow from GitHub Actions to job update.

**Prerequisites**:
- GitHub repository with spec-kit workflow
- Workflow modified to accept `job_id` parameter
- Workflow has status update step

**Steps**:

1. Create Job via application (or directly in database):
   ```sql
   INSERT INTO "Job" ("ticketId", "command", "status", "startedAt", "createdAt", "updatedAt")
   VALUES (1, 'specify', 'RUNNING', NOW(), NOW(), NOW())
   RETURNING id;
   -- Note ID (e.g., 50)
   ```

2. Trigger GitHub Actions workflow manually:
   - Go to Actions tab in GitHub repository
   - Select "Spec-Kit Workflow Execution"
   - Click "Run workflow"
   - Fill in inputs:
     - `ticket_id`: 1
     - `command`: specify
     - `job_id`: 50 ← NEW PARAMETER
   - Click "Run workflow"

3. Monitor workflow execution:
   - Wait for workflow to complete
   - Check workflow logs for status update step

4. Verify Job status in database:
   ```sql
   SELECT id, status, "completedAt"
   FROM "Job"
   WHERE id = 50;
   ```

   **Expected**:
   - `status` = 'COMPLETED' (if workflow succeeded)
   - `completedAt` is set to timestamp when workflow finished

**✅ Pass Criteria**: Workflow completes, job status updated automatically, timestamps accurate

---

## Validation Checklist

After running all scenarios, verify:

- [x] All 8 scenarios pass
- [ ] API responses match OpenAPI contract (specs/019-update-job-on/contracts/job-update-api.yaml)
- [ ] State transitions follow state machine rules (see data-model.md)
- [ ] Idempotency works correctly (same request → same result)
- [ ] Error messages are clear and actionable
- [ ] Database timestamps are accurate (UTC)
- [ ] No errors logged for valid requests
- [ ] Errors logged for invalid requests (with context)
- [ ] GitHub workflow integration works end-to-end

## Performance Validation

Measure API response times:

```bash
# Use curl with timing
curl -X PATCH http://localhost:3000/api/jobs/42/status \
  -H "Content-Type: application/json" \
  -d '{"status": "COMPLETED"}' \
  -w "\nTime: %{time_total}s\n"
```

**Target**: <200ms per request (typical: 10-50ms for single DB update)

## Cleanup

After testing, clean up test data:

```sql
-- Delete test jobs (be careful in production!)
DELETE FROM "Job" WHERE id IN (42, 43, 44, 45, 50);
```

## Troubleshooting

**Issue**: HTTP 500 errors
- Check application logs for stack traces
- Verify database connection
- Ensure Prisma client is generated (`npx prisma generate`)

**Issue**: HTTP 404 for valid job ID
- Verify job exists in database
- Check API route path matches `/api/jobs/[id]/status`
- Ensure Next.js dev server restarted after code changes

**Issue**: State transition rejected unexpectedly
- Check current job status in database
- Verify state machine rules (see data-model.md)
- Review `VALID_TRANSITIONS` in `lib/job-state-machine.ts`

**Issue**: Workflow integration fails
- Verify `job_id` parameter added to workflow inputs
- Check workflow has status update step with correct API endpoint
- Ensure API is accessible from GitHub Actions runner
- Review workflow logs for HTTP response details

## Next Steps

After quickstart validation passes:
- Run E2E tests (`npx playwright test`)
- Deploy to staging environment
- Test with real GitHub Actions workflows
- Monitor production logs for errors
- Gather metrics on status update performance
