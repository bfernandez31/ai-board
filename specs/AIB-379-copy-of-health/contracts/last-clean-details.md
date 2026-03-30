# API Contract: Last Clean Details

## GET `/api/projects/:projectId/health/last-clean`

Returns Last Clean module data including cleanup history for the Health Dashboard drawer.

### Authorization

Requires project access (owner or member) via `verifyProjectAccess(projectId)`.

### Response: `200 OK`

```json
{
  "lastCleanDate": "2026-03-20T10:00:00.000Z",
  "stalenessStatus": "ok",
  "daysSinceClean": 9,
  "filesCleaned": 12,
  "remainingIssues": 3,
  "summary": "Cleaned 12 files, 3 remaining issues",
  "history": [
    {
      "jobId": 456,
      "completedAt": "2026-03-20T10:00:00.000Z",
      "filesCleaned": 12,
      "remainingIssues": 3,
      "summary": "Cleaned 12 files, 3 remaining issues"
    },
    {
      "jobId": 400,
      "completedAt": "2026-02-15T08:30:00.000Z",
      "filesCleaned": null,
      "remainingIssues": null,
      "summary": null
    }
  ]
}
```

### Response: No cleanups

```json
{
  "lastCleanDate": null,
  "stalenessStatus": null,
  "daysSinceClean": null,
  "filesCleaned": null,
  "remainingIssues": null,
  "summary": null,
  "history": []
}
```

### Query Logic

1. Fetch all COMPLETED cleanup jobs: `command = 'clean'`, `status = 'COMPLETED'`, `ticket.projectId = X`, ordered by `completedAt DESC`, limit 20
2. For each job, attempt to parse `output` field for structured cleanup data (`filesCleaned`, `remainingIssues`, `summary`)
3. Compute `stalenessStatus` from most recent `completedAt`:
   - `< 30 days` → `'ok'`
   - `30-60 days` → `'warning'`
   - `> 60 days` → `'alert'`
   - No cleanups → `null`
4. `daysSinceClean` = floor((now - lastCleanDate) / (1000 * 60 * 60 * 24))

### Error Responses

- `400`: Invalid project ID
- `401`: Unauthorized
- `404`: Project not found
