# Contract: Cancel Job Endpoint

## POST /api/jobs/:id/cancel

Cancels a running or pending job, optionally terminating the associated GitHub Actions workflow run.

### Authentication

Session cookie (user must have project access via ticket ownership/membership).

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | number | Job ID |

### Request Body

None.

### Response: 200 OK (Cancelled Successfully)

```json
{
  "id": 123,
  "status": "CANCELLED",
  "completedAt": "2026-04-03T14:32:15.123Z"
}
```

### Response: 200 OK (Already Terminal — No-Op)

```json
{
  "id": 123,
  "status": "COMPLETED",
  "completedAt": "2026-04-03T14:30:00.000Z",
  "alreadyTerminal": true
}
```

### Response: 404 Not Found

```json
{
  "error": "Job not found"
}
```

### Response: 403 Forbidden

```json
{
  "error": "Not authorized to cancel this job"
}
```

### Response: 409 Conflict

```json
{
  "error": "Job is not in a cancellable state",
  "currentStatus": "COMPLETED"
}
```

### Behavior

1. Validate session authentication
2. Fetch job with ticket and project
3. Verify user has project access (owner or member)
4. If job status is already terminal (COMPLETED/FAILED/CANCELLED): return 200 with `alreadyTerminal: true` and current status
5. If job status is PENDING (no workflowRunId):
   - Update job status to CANCELLED, set completedAt
   - Return 200
6. If job status is RUNNING (has workflowRunId):
   - Call `octokit.actions.cancelWorkflowRun()` with the stored run ID
   - Handle 409 from GitHub (run already finished) — refresh job status
   - Update job status to CANCELLED, set completedAt
   - Return 200
7. If GitHub API call fails: return 502 with error, do NOT update job status

### Idempotency

Calling cancel on an already-CANCELLED job returns 200 with `alreadyTerminal: true`. No side effects.
