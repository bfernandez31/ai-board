# API Contracts: Health Dashboard Scan Detail Drawer

**Feature Branch**: `AIB-376-copy-of-health`
**Date**: 2026-03-29

---

## New Endpoints

### GET `/api/projects/:projectId/health/scans/:scanId`

Fetch a single scan's full details including the report content.

**Auth**: Session-based (verifyProjectAccess)

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| projectId | number | Project ID |
| scanId | number | Scan ID |

**Response 200**:
```json
{
  "scan": {
    "id": 42,
    "scanType": "SECURITY",
    "status": "COMPLETED",
    "score": 78,
    "report": "## Security Scan Report\n\n### High Severity\n...",
    "issuesFound": 5,
    "issuesFixed": 2,
    "baseCommit": "abc1234",
    "headCommit": "def5678",
    "durationMs": 45000,
    "errorMessage": null,
    "startedAt": "2026-03-29T10:00:00Z",
    "completedAt": "2026-03-29T10:00:45Z",
    "createdAt": "2026-03-29T10:00:00Z"
  }
}
```

**Response 404**: `{ "error": "Scan not found" }`
**Response 401**: `{ "error": "Unauthorized" }`
**Response 403**: `{ "error": "Forbidden" }`

---

### GET `/api/projects/:projectId/health/scans/:scanId/tickets`

Fetch tickets generated from a specific scan (heuristic: CLEAN tickets created between this scan's completion and the next scan of the same type).

**Auth**: Session-based (verifyProjectAccess)

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| projectId | number | Project ID |
| scanId | number | Scan ID |

**Response 200**:
```json
{
  "tickets": [
    {
      "id": 101,
      "ticketKey": "AIB-456",
      "title": "Fix SQL injection in auth handler",
      "currentStage": "BUILD"
    }
  ]
}
```

**Response 200 (no tickets)**:
```json
{
  "tickets": []
}
```

---

### GET `/api/projects/:projectId/health/scans/latest`

Fetch the latest scan for a given module type (convenience endpoint for the drawer).

**Auth**: Session-based (verifyProjectAccess)

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| type | HealthScanType | Yes | Module type filter |

**Response 200**:
```json
{
  "scan": {
    "id": 42,
    "scanType": "SECURITY",
    "status": "COMPLETED",
    "score": 78,
    "report": "## Security Scan Report\n...",
    "issuesFound": 5,
    "issuesFixed": 2,
    "baseCommit": "abc1234",
    "headCommit": "def5678",
    "durationMs": 45000,
    "errorMessage": null,
    "startedAt": "2026-03-29T10:00:00Z",
    "completedAt": "2026-03-29T10:00:45Z",
    "createdAt": "2026-03-29T10:00:00Z"
  }
}
```

**Response 200 (no scans)**:
```json
{
  "scan": null
}
```

---

## Existing Endpoints Used (No Changes)

### GET `/api/projects/:projectId/health/scans`

Already supports `type` filter and cursor-based pagination. Used for scan history in the drawer.

**Query**: `?type=SECURITY&limit=10`

### GET `/api/projects/:projectId/health`

Already provides module status, active scans, scores. Used by `useHealthPolling` — no changes needed.
