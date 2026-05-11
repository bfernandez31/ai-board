# API Contract: Admin Insights

**Base path**: `/api/admin/insights`

All endpoints require the caller to be authenticated AND present on the `ADMIN_EMAILS` allowlist. Unauthorized or non-admin users receive `404 Not Found` (not 403) to avoid revealing the admin area's existence.

---

## POST /api/admin/insights/runs

Trigger a new insights analysis run.

### Request

No body required. The server determines the analysis window automatically.

### Response

**201 Created** — Run created and analysis started
```json
{
  "run": {
    "id": 1,
    "status": "PENDING",
    "triggeredBy": "user-id-123",
    "periodStart": null,
    "periodEnd": null,
    "sessionCount": null,
    "ticketCount": null,
    "reportKey": null,
    "errorMessage": null,
    "timeoutAt": "2026-05-11T13:30:00.000Z",
    "startedAt": null,
    "completedAt": null,
    "createdAt": "2026-05-11T13:00:00.000Z"
  }
}
```

**404 Not Found** — Not authenticated, not admin, or admin area hidden
```json
{ "error": "Not found" }
```

**409 Conflict** — Analysis already in progress
```json
{ "error": "An analysis is already in progress", "code": "RUN_IN_PROGRESS" }
```

**409 Conflict** — No new shipped tickets since last run
```json
{
  "error": "No new shipped tickets since last run",
  "code": "NO_NEW_TICKETS",
  "lastRunDate": "2026-05-10T12:00:00.000Z"
}
```

**503 Service Unavailable** — Blob storage not configured
```json
{ "error": "Blob storage is not configured", "code": "BLOB_NOT_CONFIGURED" }
```

### Behavior

1. Verify admin access (auth + allowlist)
2. Check `BLOB_READ_WRITE_TOKEN` is configured → 503 if not
3. Check for existing PENDING/RUNNING run with `timeoutAt > now()` → 409 if found
4. Find last COMPLETED run's `periodEnd` (or epoch for first run)
5. Count shipped CLAUDE tickets since that date → 409 if none
6. Create InsightsRun record with `status: PENDING`, `timeoutAt: now() + 30 minutes`
7. Start background analysis (non-blocking)
8. Return 201 with run record

---

## GET /api/admin/insights/runs

List all insights runs (paginated, newest first).

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | int (1-100) | 20 | Number of runs to return |
| `cursor` | int | — | Run ID for cursor-based pagination (fetch runs with `id < cursor`) |
| `status` | string | — | Filter by status: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED` |

### Response

**200 OK**
```json
{
  "runs": [
    {
      "id": 5,
      "status": "COMPLETED",
      "triggeredBy": "user-id-123",
      "periodStart": "2026-04-01T00:00:00.000Z",
      "periodEnd": "2026-05-11T13:00:00.000Z",
      "sessionCount": 42,
      "ticketCount": 15,
      "reportKey": "insights-reports/5.html",
      "reportSize": 125000,
      "errorMessage": null,
      "timeoutAt": "2026-05-11T13:30:00.000Z",
      "startedAt": "2026-05-11T13:00:05.000Z",
      "completedAt": "2026-05-11T13:02:30.000Z",
      "createdAt": "2026-05-11T13:00:00.000Z"
    }
  ],
  "nextCursor": 4,
  "hasMore": true
}
```

**404 Not Found** — Not admin

---

## GET /api/admin/insights/runs/[runId]

Get a single insights run by ID.

### Response

**200 OK** — Run object (same shape as list item above)

**404 Not Found** — Not admin or run not found

---

## PATCH /api/admin/insights/runs/[runId]/status

Update the status of an insights run. Used internally by the background analysis process.

### Request

```json
{
  "status": "COMPLETED",
  "periodStart": "2026-04-01T00:00:00.000Z",
  "periodEnd": "2026-05-11T13:00:00.000Z",
  "sessionCount": 42,
  "ticketCount": 15,
  "reportKey": "insights-reports/5.html",
  "reportSize": 125000
}
```

Or for failure:
```json
{
  "status": "FAILED",
  "errorMessage": "Claude Code /insights command exited with code 1"
}
```

### Auth

Internal only — validated via `WORKFLOW_API_TOKEN` Bearer header OR admin session.

### Response

**200 OK** — Updated run object

**400 Bad Request** — Invalid state transition or missing required fields

**404 Not Found** — Run not found

### State Transition Validation

| Current | Allowed Next | Required Fields |
|---------|-------------|-----------------|
| PENDING | RUNNING | — |
| PENDING | FAILED | `errorMessage` |
| RUNNING | COMPLETED | `periodStart`, `periodEnd`, `sessionCount`, `ticketCount`, `reportKey`, `reportSize` |
| RUNNING | FAILED | `errorMessage` |

---

## GET /api/admin/insights/runs/[runId]/report

Stream the HTML report artifact from Blob storage.

### Response

**200 OK**
```
Content-Type: text/html; charset=utf-8
Content-Length: 125000
Cache-Control: private, max-age=3600
```
Body: HTML content streamed from Blob storage

**404 Not Found** — Not admin, run not found, or no report (run not completed)

### Behavior

1. Verify admin access
2. Load InsightsRun by ID → 404 if not found
3. Check `reportKey` is set → 404 if null (run not completed)
4. Stream report from Blob via `streamInsightsReport(reportKey)` → 404 if blob missing
5. Return HTML with long cache (reports are immutable)

---

## GET /api/admin/insights/latest

Convenience endpoint to get the latest completed run with its report URL.

### Response

**200 OK**
```json
{
  "run": {
    "id": 5,
    "status": "COMPLETED",
    "periodStart": "2026-04-01T00:00:00.000Z",
    "periodEnd": "2026-05-11T13:00:00.000Z",
    "sessionCount": 42,
    "ticketCount": 15,
    "reportUrl": "/api/admin/insights/runs/5/report",
    "completedAt": "2026-05-11T13:02:30.000Z",
    "createdAt": "2026-05-11T13:00:00.000Z"
  },
  "activeRun": null
}
```

If an analysis is currently running:
```json
{
  "run": { ... },
  "activeRun": {
    "id": 6,
    "status": "RUNNING",
    "startedAt": "2026-05-11T14:00:05.000Z",
    "createdAt": "2026-05-11T14:00:00.000Z"
  }
}
```

If no reports exist yet:
```json
{
  "run": null,
  "activeRun": null
}
```

**404 Not Found** — Not admin
