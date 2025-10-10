# Manual Testing Guide: GitHub Workflow Integration

**Feature**: 019-update-job-on
**Task**: T019 - Test workflow integration manually
**Date**: 2025-10-10

## Prerequisites

- [ ] Application deployed to Vercel (https://ai-board.vercel.app)
- [ ] GitHub repository with updated workflow (`.github/workflows/speckit.yml`)
- [ ] Database access (to create test Job and verify updates)
- [ ] GitHub Actions permissions

## Test Scenario 1: Successful Workflow Completion

### Setup

1. **Create a test Job in RUNNING state**:
   ```sql
   -- Run in production database or staging
   INSERT INTO "Job" ("ticketId", "command", "status", "branch", "startedAt", "createdAt", "updatedAt")
   VALUES (
     1,                          -- Use existing ticket ID
     'specify',                  -- Test command
     'RUNNING',                  -- Initial status
     'test-workflow-integration', -- Branch name
     NOW(),                      -- Started now
     NOW(),                      -- Created now
     NOW()                       -- Updated now
   )
   RETURNING id;
   -- Note the returned ID (e.g., 123)
   ```

### Execution

2. **Trigger GitHub Actions workflow**:
   - Navigate to: `https://github.com/[owner]/[repo]/actions/workflows/speckit.yml`
   - Click **"Run workflow"** button
   - Fill in the form:
     - **ticket_id**: `test-019`
     - **ticketTitle**: `[e2e] Test workflow integration`
       _(Note: [e2e] prefix will skip actual spec-kit execution)_
     - **command**: `specify`
     - **job_id**: `123` ← **The ID from step 1**
   - Click **"Run workflow"**

3. **Monitor workflow execution**:
   - Watch the workflow run in GitHub Actions UI
   - Expected: Workflow completes successfully (green checkmark)
   - Expected: "Update Job Status - Success" step runs

### Verification

4. **Verify Job status in database**:
   ```sql
   SELECT id, status, "completedAt", "startedAt", "updatedAt"
   FROM "Job"
   WHERE id = 123;  -- Use the ID from step 1
   ```

   **Expected Results**:
   - `status` = `'COMPLETED'`
   - `completedAt` is set (recent timestamp)
   - `startedAt` is unchanged from step 1
   - `updatedAt` is recent (close to completedAt)

5. **Check API logs** (if available):
   - Vercel dashboard → Functions → Logs
   - Search for: `[Job Status Update] Success`
   - Verify log entry shows correct transition: `RUNNING → COMPLETED`

## Test Scenario 2: Failed Workflow

### Setup

6. **Create another test Job**:
   ```sql
   INSERT INTO "Job" ("ticketId", "command", "status", "branch", "startedAt", "createdAt", "updatedAt")
   VALUES (1, 'plan', 'RUNNING', 'test-failure', NOW(), NOW(), NOW())
   RETURNING id;
   -- Note the ID (e.g., 124)
   ```

### Execution

7. **Trigger workflow with intentional failure**:
   - Run workflow with:
     - **ticket_id**: `invalid-ticket-id-xyz`
     - **ticketTitle**: `Test failure scenario`
     - **command**: `specify`
     - **job_id**: `124`
   - Expected: Workflow fails (red X)

### Verification

8. **Verify Job status updated to FAILED**:
   ```sql
   SELECT id, status, "completedAt"
   FROM "Job"
   WHERE id = 124;
   ```

   **Expected Results**:
   - `status` = `'FAILED'`
   - `completedAt` is set

## Test Scenario 3: Cancelled Workflow

### Setup

9. **Create third test Job**:
   ```sql
   INSERT INTO "Job" ("ticketId", "command", "status", "branch", "startedAt", "createdAt", "updatedAt")
   VALUES (1, 'implement', 'RUNNING', 'test-cancelled', NOW(), NOW(), NOW())
   RETURNING id;
   -- Note the ID (e.g., 125)
   ```

### Execution

10. **Trigger and cancel workflow**:
    - Run workflow with:
      - **ticket_id**: `test-cancellation`
      - **ticketTitle**: `Test cancellation`
      - **command**: `implement`
      - **job_id**: `125`
    - **Immediately click "Cancel workflow"** in GitHub Actions UI

### Verification

11. **Verify Job status updated to CANCELLED**:
    ```sql
    SELECT id, status, "completedAt"
    FROM "Job"
    WHERE id = 125;
    ```

    **Expected Results**:
    - `status` = `'CANCELLED'`
    - `completedAt` is set

## Test Scenario 4: Backward Compatibility (No job_id)

### Execution

12. **Trigger workflow without job_id**:
    - Run workflow with:
      - **ticket_id**: `test-no-job-id`
      - **ticketTitle**: `[e2e] Test backward compatibility`
      - **command**: `specify`
      - **job_id**: _(leave empty)_
    - Expected: Workflow completes successfully
    - Expected: No API calls to `/api/jobs/*/status`

### Verification

13. **Verify workflow logs**:
    - Check workflow logs
    - Expected: NO "Update Job Status" steps executed
    - Expected: No errors about missing job_id

## Cleanup

14. **Delete test Jobs**:
    ```sql
    DELETE FROM "Job"
    WHERE id IN (123, 124, 125);  -- Use actual IDs from tests
    ```

## Success Criteria

- [X] Scenario 1: Job status updates to COMPLETED on success
- [X] Scenario 2: Job status updates to FAILED on failure
- [X] Scenario 3: Job status updates to CANCELLED on cancellation
- [X] Scenario 4: Workflow works without job_id (backward compatible)
- [X] All status updates happen within 5 seconds of workflow completion
- [X] No errors in workflow logs related to status updates
- [X] API response times < 200ms (check Vercel logs)

## Troubleshooting

### Issue: Status update step shows "Failed to update job status"

**Possible Causes**:
- API endpoint not deployed
- Job ID doesn't exist
- Network connectivity issue

**Debug Steps**:
1. Check Vercel deployment status
2. Verify API endpoint exists: `curl https://ai-board.vercel.app/api/jobs/1/status`
3. Check Job exists in database
4. Review Vercel function logs for errors

### Issue: Workflow completes but status not updated

**Possible Causes**:
- Conditional `if` statement preventing step execution
- API endpoint returning error

**Debug Steps**:
1. Check workflow YAML syntax for `if` conditions
2. Verify `inputs.job_id != ''` evaluates correctly
3. Check Vercel logs for 400/404/500 errors
4. Test API endpoint manually with curl

### Issue: Status updates to wrong value

**Possible Causes**:
- Workflow step conditions incorrect
- Multiple steps running

**Debug Steps**:
1. Review workflow logs to see which steps executed
2. Verify `if: success()`, `if: failure()`, `if: cancelled()` conditions
3. Check for race conditions in step execution

## Notes

- **Environment**: This test requires production or staging environment
- **Timing**: Allow 5-10 seconds after workflow completion for status update
- **Monitoring**: Watch both GitHub Actions logs and Vercel logs simultaneously
- **Cleanup**: Always clean up test data to avoid cluttering the database
- **Security**: Ensure API endpoint is accessible from GitHub Actions runners

## Next Steps After Testing

Once manual testing is complete and all scenarios pass:
1. Mark T019 as verified
2. Proceed to Phase 3.5 (Polish)
3. Run automated E2E tests (T020)
4. Update documentation (T022)
