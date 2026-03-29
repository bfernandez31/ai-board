# Contract: Scan History Endpoint

## GET `/api/projects/[projectId]/health/scans`

Returns paginated scan history for a project, optionally filtered by scan type.

### Authentication
- Session cookie OR Bearer token (PAT)
- Requires project access (owner or member) via `verifyProjectAccess(projectId)`

### Request

- **Path params**: `projectId` (integer, required)
- **Query params**:
  - `type` (optional): `"SECURITY" | "COMPLIANCE" | "TESTS" | "SPEC_SYNC"` — filter by scan type
  - `limit` (optional): integer, 1-100, default 20 — page size
  - `cursor` (optional): integer — scan ID for cursor-based pagination

**Validation** (Zod):
- `type`: Optional enum
- `limit`: Optional integer, min 1, max 100, default 20
- `cursor`: Optional positive integer

### Response 200

```json
{
  "scans": [
    {
      "id": 42,
      "scanType": "SECURITY",
      "status": "COMPLETED",
      "score": 85,
      "issuesFound": 3,
      "issuesFixed": 1,
      "baseCommit": "abc1234567890abcdef1234567890abcdef123456",
      "headCommit": "def4567890abcdef1234567890abcdef456789ab",
      "durationMs": 45000,
      "errorMessage": null,
      "startedAt": "2026-03-27T14:30:00Z",
      "completedAt": "2026-03-27T14:30:45Z",
      "createdAt": "2026-03-27T14:29:55Z"
    },
    {
      "id": 38,
      "scanType": "SECURITY",
      "status": "COMPLETED",
      "score": 72,
      "issuesFound": 7,
      "issuesFixed": 2,
      "baseCommit": null,
      "headCommit": "abc1234567890abcdef1234567890abcdef123456",
      "durationMs": 120000,
      "errorMessage": null,
      "startedAt": "2026-03-25T10:00:00Z",
      "completedAt": "2026-03-25T10:02:00Z",
      "createdAt": "2026-03-25T09:59:50Z"
    }
  ],
  "nextCursor": 35,
  "hasMore": true
}
```

### Pagination

Cursor-based pagination using scan ID:
- Results ordered by `createdAt DESC` (most recent first)
- `nextCursor`: ID of the last scan in the response (use as `cursor` for next page)
- `hasMore`: `true` if more results exist beyond this page

### Error Responses

| Status | Body | When |
|--------|------|------|
| 400 | `{ "error": "Invalid project ID" }` | Non-numeric or <= 0 projectId |
| 400 | `{ "error": "Invalid filters", "code": "VALIDATION_ERROR" }` | Invalid query params |
| 401 | `{ "error": "Unauthorized" }` | No session/token |
| 403 | `{ "error": "Forbidden" }` | Not project owner or member |

## PATCH `/api/projects/[projectId]/health/scans/[scanId]/status`

Workflow callback endpoint to update scan status and results.

### Authentication
- Workflow token auth (same pattern as `PATCH /api/jobs/:id/status`)

### Request

- **Path params**: `projectId` (integer), `scanId` (integer)
- **Body** (JSON):

```json
{
  "status": "COMPLETED",
  "score": 85,
  "report": "{ ... }",
  "issuesFound": 3,
  "issuesFixed": 1,
  "headCommit": "def4567890abcdef1234567890abcdef456789ab",
  "durationMs": 45000,
  "tokensUsed": 12000,
  "costUsd": 0.15,
  "errorMessage": null
}
```

**Validation** (Zod):
- `status`: Required, enum `["RUNNING", "COMPLETED", "FAILED"]`
- `score`: Optional integer 0-100 (required when status = COMPLETED)
- `report`: Optional string (JSON)
- `issuesFound`: Optional integer >= 0
- `issuesFixed`: Optional integer >= 0
- `headCommit`: Optional string, 40 chars
- `durationMs`: Optional integer >= 0
- `tokensUsed`: Optional integer >= 0
- `costUsd`: Optional float >= 0
- `errorMessage`: Optional string, max 2000 chars

### Response 200

```json
{
  "scan": {
    "id": 42,
    "status": "COMPLETED",
    "score": 85
  }
}
```

### Side Effects (on COMPLETED)
1. Update `HealthScore` aggregate for the project
2. Recalculate `globalScore` from all non-null sub-scores
3. Update the corresponding module's last scan timestamp

### Error Responses

| Status | Body | When |
|--------|------|------|
| 400 | `{ "error": "Invalid scan ID" }` | Non-numeric or <= 0 scanId |
| 400 | `{ "error": "Score required for completed scans" }` | status=COMPLETED without score |
| 401 | `{ "error": "Unauthorized" }` | Invalid workflow token |
| 404 | `{ "error": "Scan not found" }` | Scan doesn't exist or wrong project |
| 409 | `{ "error": "Invalid status transition" }` | e.g., COMPLETED → RUNNING |
