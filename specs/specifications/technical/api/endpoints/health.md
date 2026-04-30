# Health Endpoints

## Health Endpoints

### GET /api/projects/[projectId]/health

Returns the aggregate health score and per-module status for a project.

**Authentication**: Session cookie OR Bearer PAT
**Authorization**: `verifyProjectAccess(projectId)` — owner or member

**Path params**: `projectId` (integer, required)

**Response** (200 OK):
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
      "summary": "3 issues found",
      "skipReason": null
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
      "score": 82,
      "label": "Good",
      "lastScanDate": "2026-03-27T16:00:00Z",
      "passive": true,
      "summary": "5 tickets — Good",
      "ticketCount": 5,
      "trend": "up",
      "trendDelta": 4,
      "distribution": {
        "excellent": 1,
        "good": 3,
        "fair": 1,
        "poor": 0
      }
    },
    "reviewQuality": {
      "score": 74,
      "label": "Good",
      "lastScanDate": "2026-04-02T08:00:00Z",
      "scanStatus": "COMPLETED",
      "issuesFound": 3,
      "summary": "3 missed findings"
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

**Score labels**: 90–100 → "Excellent", 70–89 → "Good", 50–69 → "Fair", 0–49 → "Poor", no data → "No data yet" with `globalScore: null`.

**SKIPPED module behavior**: When a module's most recent scan is SKIPPED, `scanStatus` is `"SKIPPED"`, `summary` is `"Skipped: {reason}"`, and `skipReason` is populated. The `score` field reflects the last COMPLETED score (preserved in the `HealthScore` aggregate) — SKIPPED scans do not overwrite it. SKIPPED modules are excluded from the global score calculation if they have no prior COMPLETED score.

**Errors**:
- `400`: Invalid project ID
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Project not found

---

### POST /api/projects/[projectId]/health/scans

Triggers a new health scan for the specified active module type.

**Authentication**: Session cookie OR Bearer PAT
**Authorization**: `verifyProjectAccess(projectId)` — owner or member

**Request body**:
```json
{ "scanType": "SECURITY" }
```

**Validation** (Zod): `scanType` required, enum `["SECURITY", "COMPLIANCE", "TESTS", "SPEC_SYNC", "REVIEW_QUALITY"]`

**Behavior**:
1. Validate `scanType`
2. Check for existing PENDING/RUNNING scan of same type → 409 if found
3. Look up latest COMPLETED scan of this type for incremental `baseCommit`
4. Create `HealthScan` record in PENDING status
5. Dispatch scan workflow via GitHub Actions
6. Return the created scan record

**Response** (201 Created):
```json
{
  "scan": {
    "id": 42,
    "projectId": 1,
    "scanType": "SECURITY",
    "status": "PENDING",
    "baseCommit": "abc1234567890abcdef1234567890abcdef123456",
    "headCommit": null,
    "createdAt": "2026-03-28T10:00:00Z"
  }
}
```

**Errors**:
- `400`: Invalid project ID or invalid scan type (`VALIDATION_ERROR`)
- `401`: Unauthorized
- `403`: Forbidden
- `409`: Concurrent scan already running (`SCAN_IN_PROGRESS`)

---

### GET /api/projects/[projectId]/health/scans

Returns paginated scan history for a project.

**Authentication**: Session cookie OR Bearer PAT
**Authorization**: `verifyProjectAccess(projectId)` — owner or member

**Query params**:
- `type` (optional): `"SECURITY" | "COMPLIANCE" | "TESTS" | "SPEC_SYNC" | "REVIEW_QUALITY"` — filter by scan type
- `limit` (optional): integer 1–100, default 20
- `cursor` (optional): scan ID for cursor-based pagination
- `includeReport` (optional): `"true"` — include the `report` JSON string in each scan object (omitted by default for performance)

**Response** (200 OK):
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
      "tokensUsed": 12000,
      "costUsd": 0.15,
      "errorMessage": null,
      "startedAt": "2026-03-27T14:30:00Z",
      "completedAt": "2026-03-27T14:30:45Z",
      "createdAt": "2026-03-27T14:29:55Z",
      "report": "{ ... }"
    }
  ],
  "nextCursor": 35,
  "hasMore": true
}
```

When `includeReport=true` is omitted, the `report` field is not present on scan objects.

`tokensUsed` and `costUsd` are always returned; both are `null` for scans that predate telemetry collection.

Results ordered by `createdAt DESC`. `nextCursor` is the ID of the last scan returned; pass as `cursor` for the next page.

**Errors**:
- `400`: Invalid project ID or invalid query params (`VALIDATION_ERROR`)
- `401`: Unauthorized
- `403`: Forbidden

---

### GET /api/projects/[projectId]/health/scans/[scanId]

Returns a single `HealthScan` by id with its `report` JSON. Powers historic-row selection in the scan-detail drawer.

**Authentication**: Session cookie OR Bearer PAT
**Authorization**: `verifyProjectAccess(projectId)` — owner or member. After the access check, the handler verifies that the looked-up scan's `projectId` matches the URL `projectId`; on mismatch, the response is `404` (not `403`) so the existence of a scan in another project is not leaked.

**Path params**: `projectId` (positive integer), `scanId` (positive integer)

**Response** (200 OK):
```json
{
  "scan": {
    "id": 1234,
    "scanType": "COMPLIANCE",
    "status": "COMPLETED",
    "score": 87,
    "issuesFound": 2,
    "issuesFixed": 1,
    "baseCommit": "abc1234",
    "headCommit": "def5678",
    "durationMs": 5421,
    "tokensUsed": 12345,
    "costUsd": 0.0234,
    "errorMessage": null,
    "startedAt": "2026-04-29T10:00:00.000Z",
    "completedAt": "2026-04-29T10:00:05.421Z",
    "createdAt": "2026-04-29T10:00:00.000Z",
    "report": "{\"type\":\"COMPLIANCE\",\"issues\":[…],\"generatedTickets\":[…]}"
  }
}
```

The `scan` object shape matches a single item from `GET …/scans?type=…&includeReport=true`. The `report` field is the raw JSON-stringified column; the client decodes it via `parseScanReport(moduleType, raw)`. `report` is `null` for legacy or SKIPPED scans that have no structured report — the drawer surfaces the "No detailed report available for this scan" empty state when this happens.

**Caching**: Server does not set explicit `Cache-Control`; clients call with `cache: 'no-store'` and rely on TanStack Query (`staleTime: 30_000`, `gcTime: 5 min`) keyed by `health.scan(projectId, scanId)`.

**Errors**:
- `400`: Invalid `projectId` or `scanId`
- `401`: Unauthorized
- `403`: Forbidden (caller is neither owner nor member)
- `404`: Scan not found, or scan exists but belongs to a different project (cross-project guard)
- `500`: Unexpected error (logged server-side as `[Health Scan By Id] Error:`)

---

### PATCH /api/projects/[projectId]/health/scans/[scanId]/status

Workflow callback endpoint to update scan status and results. Uses the same Bearer token authentication pattern as `PATCH /api/jobs/:id/status`.

**Authentication**: `Authorization: Bearer <WORKFLOW_API_TOKEN>`

**Path params**: `projectId` (integer), `scanId` (integer)

**Request body**:
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
  "errorMessage": null,
  "skipReason": null
}
```

**Validation** (Zod):
- `status`: Required, enum `["RUNNING", "COMPLETED", "FAILED", "SKIPPED"]`
- `score`: Optional integer 0–100 (required when `status = COMPLETED`; must be absent/null when `status = SKIPPED`)
- `skipReason`: Optional string, max 500 chars (meaningful only when `status = SKIPPED`)
- `headCommit`: Optional string, 40 chars
- `issuesFound` / `issuesFixed`: Optional integers ≥ 0
- `durationMs` / `tokensUsed`: Optional integers ≥ 0
- `costUsd`: Optional float ≥ 0
- `errorMessage`: Optional string, max 2000 chars

**Valid status transitions**: PENDING→RUNNING, RUNNING→COMPLETED, RUNNING→FAILED, RUNNING→SKIPPED

**Response** (200 OK):
```json
{ "scan": { "id": 42, "status": "COMPLETED", "score": 85 } }
```

**Side effects on COMPLETED** (executed atomically in a single database transaction):
1. Update corresponding sub-score in `HealthScore` aggregate
2. Recalculate `globalScore` from all non-null sub-scores
3. Update the module's last scan timestamp

**Side effects on SKIPPED**: None — the `HealthScore` aggregate is NOT updated. The previous COMPLETED sub-score (if any) is preserved. `completedAt` is set (terminal state).

**Defensive guard**: If `status = SKIPPED` is sent for a `COMPLIANCE` or `TESTS` scan, the endpoint treats it as `COMPLETED` with the provided score (or rejects with 400 if score is absent). Agents for these types should never emit `skipped: true`, but the API enforces it defensively.

**Errors**:
- `400`: Invalid scan ID, score missing for COMPLETED, or score present for SKIPPED
- `401`: Invalid workflow token
- `404`: Scan not found or wrong project
- `409`: Invalid status transition (e.g., COMPLETED → RUNNING)

---

### GET /api/projects/[projectId]/health/trends

Returns score trend data for all active scan modules in a single response. Used to render sparklines on module cards and area charts in module drawers.

**Authentication**: Session cookie OR Bearer PAT
**Authorization**: `verifyProjectAccess(projectId)` — owner or member

**Query params**:
- `limit` (optional): integer 1–100, default 20 — max number of COMPLETED scans per module

**Response** (200 OK):
```json
{
  "trends": {
    "SECURITY": [
      { "date": "2026-03-30T14:22:00.000Z", "score": 85 },
      { "date": "2026-03-29T10:15:00.000Z", "score": 82 }
    ],
    "COMPLIANCE": [
      { "date": "2026-03-30T14:22:00.000Z", "score": 92 }
    ],
    "TESTS": [],
    "SPEC_SYNC": [
      { "date": "2026-03-30T14:22:00.000Z", "score": 78 },
      { "date": "2026-03-28T09:00:00.000Z", "score": 75 }
    ],
    "REVIEW_QUALITY": [
      { "date": "2026-04-02T08:00:00.000Z", "score": 74 }
    ]
  }
}
```

Each array is ordered newest first. Only scans with `status = COMPLETED` and a non-null score are included. Empty array when no qualifying scans exist for a module.

**Errors**:
- `400`: Invalid project ID or `limit` out of range (`VALIDATION_ERROR`)
- `401`: Unauthorized
- `403`: Forbidden

---

### GET /api/projects/[projectId]/health/quality-gate

Returns aggregated Quality Gate data for the Health Dashboard drawer.

**Authentication**: Session cookie OR Bearer PAT
**Authorization**: `verifyProjectAccess(projectId)` — owner or member

**Path params**: `projectId` (integer, required)

**Response** (200 OK):
```json
{
  "averageScore": 82,
  "ticketCount": 5,
  "trend": "up",
  "trendDelta": 4,
  "distribution": {
    "excellent": 1,
    "good": 3,
    "fair": 1,
    "poor": 0
  },
  "dimensions": [
    { "name": "Compliance", "averageScore": 88, "weight": 0.30 },
    { "name": "Bug Detection", "averageScore": 79, "weight": 0.30 },
    { "name": "Product Contract Sync", "averageScore": 65, "weight": 0.20 },
    { "name": "Edge Cases & Failure Modes", "averageScore": 75, "weight": 0.15 },
    { "name": "Historical Context", "averageScore": 70, "weight": 0.05 }
  ],
  "recentTickets": [
    {
      "ticketKey": "AIB-120",
      "title": "Add user preferences",
      "score": 85,
      "completedAt": "2026-03-25T14:30:00.000Z"
    }
  ],
  "trendData": [
    { "ticketKey": "AIB-120", "score": 85, "date": "2026-03-25T14:30:00.000Z" }
  ]
}
```

**Empty state** (no qualifying data): `averageScore: null`, `ticketCount: 0`, `trend: null`, `trendDelta: null`, all arrays empty.

**Query logic**:
- Current period: COMPLETED verify jobs, `workflowType=FULL`, `stage=SHIP`, `completedAt >= now - 30 days`
- Previous period: same filters with `completedAt` between 60 and 30 days ago (for trend calculation)
- Dimensions derived from `qualityScoreDetails` JSON on each qualifying Job record

**Errors**:
- `400`: Invalid project ID
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Project not found

