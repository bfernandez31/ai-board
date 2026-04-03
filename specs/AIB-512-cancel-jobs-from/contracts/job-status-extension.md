# Contract: Job Status Endpoint Extension

## PATCH /api/jobs/:id/status (Extended)

### New Optional Field in Request Body

```json
{
  "status": "RUNNING",
  "workflowRunId": 12345678901
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| workflowRunId | number (BigInt) | No | GitHub Actions run ID. Only accepted with RUNNING status. Set once, ignored on subsequent calls if already populated. |

### Validation Rules

- `workflowRunId` must be a positive integer when provided
- Only accepted when `status` is `RUNNING` (ignored for other statuses)
- Only written if the job's `workflowRunId` is currently null (first-write-wins)
- Workflows MUST check the response status: if the job is already CANCELLED, the endpoint returns 409 and the workflow should abort

### Response Extension

No change to response schema. The `workflowRunId` is not returned in the response.
