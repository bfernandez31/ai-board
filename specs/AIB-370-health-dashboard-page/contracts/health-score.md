# Contract: Health Score Endpoint

## GET `/api/projects/[projectId]/health`

Returns the aggregate health score and module statuses for a project.

### Authentication
- Session cookie OR Bearer token (PAT)
- Requires project access (owner or member) via `verifyProjectAccess(projectId)`

### Request
- **Path params**: `projectId` (integer, required)
- **Query params**: None

### Response 200

```json
{
  "globalScore": 78,
  "label": "Good",
  "color": {
    "text": "text-ctp-blue",
    "bg": "bg-ctp-blue/10",
    "fill": "bg-ctp-blue"
  },
  "modules": {
    "security": {
      "score": 85,
      "label": "Good",
      "lastScanDate": "2026-03-27T14:30:00Z",
      "scanStatus": "COMPLETED",
      "issuesFound": 3,
      "summary": "3 issues found"
    },
    "compliance": {
      "score": 92,
      "label": "Excellent",
      "lastScanDate": "2026-03-26T10:00:00Z",
      "scanStatus": "COMPLETED",
      "issuesFound": 0,
      "summary": "All clear"
    },
    "tests": {
      "score": null,
      "label": null,
      "lastScanDate": null,
      "scanStatus": null,
      "issuesFound": null,
      "summary": "No scan yet"
    },
    "specSync": {
      "score": 60,
      "label": "Fair",
      "lastScanDate": "2026-03-25T08:00:00Z",
      "scanStatus": "COMPLETED",
      "issuesFound": 5,
      "summary": "5 issues found"
    },
    "qualityGate": {
      "score": 75,
      "label": "Good",
      "lastScanDate": "2026-03-27T16:00:00Z",
      "passive": true,
      "summary": "From latest verify job"
    },
    "lastClean": {
      "score": null,
      "label": "OK",
      "lastCleanDate": "2026-03-20T12:00:00Z",
      "passive": true,
      "jobId": 456,
      "summary": "8 days ago"
    }
  },
  "lastFullScanDate": "2026-03-27T14:30:00Z",
  "activeScans": [
    {
      "id": 42,
      "scanType": "SECURITY",
      "status": "RUNNING",
      "startedAt": "2026-03-28T09:00:00Z"
    }
  ]
}
```

### Response when no health data exists

```json
{
  "globalScore": null,
  "label": "No data yet",
  "color": {
    "text": "text-muted-foreground",
    "bg": "bg-muted",
    "fill": "bg-muted"
  },
  "modules": {
    "security": { "score": null, "label": null, "lastScanDate": null, "scanStatus": null, "issuesFound": null, "summary": "No scan yet" },
    "compliance": { "score": null, "label": null, "lastScanDate": null, "scanStatus": null, "issuesFound": null, "summary": "No scan yet" },
    "tests": { "score": null, "label": null, "lastScanDate": null, "scanStatus": null, "issuesFound": null, "summary": "No scan yet" },
    "specSync": { "score": null, "label": null, "lastScanDate": null, "scanStatus": null, "issuesFound": null, "summary": "No scan yet" },
    "qualityGate": { "score": null, "label": null, "lastScanDate": null, "passive": true, "summary": "No verify jobs yet" },
    "lastClean": { "score": null, "label": null, "lastCleanDate": null, "passive": true, "jobId": null, "summary": "No cleanup yet" }
  },
  "lastFullScanDate": null,
  "activeScans": []
}
```

### Error Responses

| Status | Body | When |
|--------|------|------|
| 400 | `{ "error": "Invalid project ID" }` | Non-numeric or <= 0 projectId |
| 401 | `{ "error": "Unauthorized" }` | No session/token |
| 403 | `{ "error": "Forbidden" }` | Not project owner or member |
| 404 | `{ "error": "Project not found" }` | Project doesn't exist |
