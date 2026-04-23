# API Contract: Job Logs

**Version**: 1.0 | **Date**: 2026-04-23

## POST /api/jobs/{id}/logs

Upload captured agent execution output for a job.

### Authentication

Workflow token (`Authorization: Bearer <WORKFLOW_API_TOKEN>`). Same auth mechanism as `PATCH /api/jobs/{id}/status`.

### Request

```
POST /api/jobs/{id}/logs
Content-Type: application/json
Authorization: Bearer <token>

{
  "agentType": "CLAUDE",
  "rawOutput": "<full agent stdout capture, max 5MB>"
}
```

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `id` | integer | Job ID |

**Body Fields**:
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `agentType` | string | yes | One of: `CLAUDE`, `CODEX`, `MISTRAL`, `GEMINI` |
| `rawOutput` | string | yes | Max 5,242,880 bytes |

### Responses

**201 Created** — Log successfully stored and normalized:
```json
{
  "jobId": 123,
  "entryCount": 47,
  "rawSize": 128450,
  "truncated": false
}
```

**200 OK** — Log already exists for this job (idempotent):
```json
{
  "jobId": 123,
  "entryCount": 47,
  "rawSize": 128450,
  "truncated": false,
  "message": "Log already exists"
}
```

**400 Bad Request** — Validation error:
```json
{
  "error": "Invalid request",
  "details": [{"message": "rawOutput exceeds maximum size", "path": ["rawOutput"]}]
}
```

**401 Unauthorized** — Invalid or missing workflow token:
```json
{ "error": "Unauthorized" }
```

**404 Not Found** — Job does not exist:
```json
{ "error": "Job not found" }
```

**500 Internal Server Error** — Processing failure:
```json
{ "error": "Internal server error" }
```

### Processing Steps

1. Validate workflow auth
2. Validate request body (Zod)
3. Verify job exists
4. Check for existing log (return 200 if exists — idempotent)
5. Detect agent type and parse raw output → `NormalizedLogEntry[]`
6. Generate condensed summary from entries
7. Truncate if raw output exceeds 5MB (preserve first 25% + last 25%)
8. Create `JobLog` record in transaction with `Job.logStatus = AVAILABLE` and `Job.logSummary = <summary>`
9. Return 201 with metadata

### Error Behavior (FR-015)

If any step fails after validation, the endpoint returns 500 but the Job record is NOT modified. The workflow continues to update job status via the separate PATCH endpoint. Log upload failure is logged server-side for operational visibility.

---

## GET /api/jobs/{id}/logs

Retrieve the full normalized log for a job.

### Authentication

Session-based (NextAuth.js) — same as other ticket/job endpoints. User must have access to the parent project (owner OR member).

### Request

```
GET /api/jobs/{id}/logs
Cookie: <session>
```

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `id` | integer | Job ID |

### Responses

**200 OK** — Log content:
```json
{
  "jobId": 123,
  "agentType": "CLAUDE",
  "entries": [
    {
      "timestamp": "2026-04-23T10:15:30.000Z",
      "eventType": "message",
      "content": "Starting implementation of feature..."
    },
    {
      "timestamp": "2026-04-23T10:15:35.000Z",
      "eventType": "tool_invocation",
      "content": "Read file: src/components/button.tsx",
      "metadata": { "tool": "Read", "path": "src/components/button.tsx" }
    },
    {
      "timestamp": "2026-04-23T10:16:00.000Z",
      "eventType": "error",
      "content": "TypeScript error: Property 'foo' does not exist on type 'Bar'"
    }
  ],
  "entryCount": 47,
  "rawSize": 128450,
  "truncated": false,
  "createdAt": "2026-04-23T10:20:00.000Z"
}
```

**404 Not Found** — Job not found or no log exists:
```json
{ "error": "Job not found" }
```
or
```json
{ "error": "Logs not available", "logStatus": "NONE" }
```

**410 Gone** — Log was pruned:
```json
{ "error": "Logs expired", "logStatus": "PRUNED", "message": "Log content was pruned after the 30-day retention period" }
```

**401 Unauthorized**:
```json
{ "error": "Unauthorized: Please sign in" }
```

**403 Forbidden** — User does not have access to the project:
```json
{ "error": "Forbidden: You do not have access to this project" }
```

---

## CRON: POST /api/cron/prune-logs

Scheduled endpoint for log retention pruning. Protected by CRON secret.

### Request

```
POST /api/cron/prune-logs
Authorization: Bearer <CRON_SECRET>
```

### Processing

1. Find all `JobLog` records where associated job's `completedAt` is older than 30 days
2. Delete `JobLog` records in batches (100 per batch to avoid long transactions)
3. Update corresponding `Job` records: set `logStatus = PRUNED`, `logSummary = null`
4. Return summary of pruned records

### Response

**200 OK**:
```json
{
  "pruned": 42,
  "errors": 0,
  "durationMs": 1250
}
```

### Idempotency

Pruning is idempotent. If a run fails partway, the next run picks up remaining expired records. Jobs already at `logStatus = PRUNED` without a `JobLog` record are skipped.

---

## Timeline API Changes

### GET /api/projects/{projectId}/tickets/{id}/timeline

**No contract change** — the existing response already includes all Job fields. Once `logStatus` and `logSummary` are added to the Job model, they appear automatically in the timeline response. The frontend uses these fields to render log previews.

**New fields in job event data**:
```typescript
{
  // ... existing job fields ...
  logStatus: "NONE" | "AVAILABLE" | "PRUNED",
  logSummary: string | null
}
```

---

## Ticket Jobs API Changes

### GET /api/projects/{projectId}/tickets/{id}/jobs

**Select clause extension**: Add `logStatus` to the select list (line 131-148 of existing route). `logSummary` is NOT included in this response (not needed for the jobs telemetry view). Full log content is never included — accessed via the dedicated GET endpoint.
