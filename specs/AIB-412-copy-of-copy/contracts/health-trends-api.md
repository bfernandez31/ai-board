# API Contract: Health Trends Endpoint

## `GET /api/projects/{projectId}/health/trends`

### Description
Returns score trend data for all active scan modules in a single response. Used to render sparklines on module cards and area charts in module drawers.

### Authentication
Session-based (NextAuth.js). Requires project access (owner or member).

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | No | 20 | Max number of completed scans per module (1-100) |

### Response (200 OK)

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
      { "date": "2026-03-28T09:00:00.000Z", "score": 75 },
      { "date": "2026-03-27T11:30:00.000Z", "score": 70 }
    ]
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `trends` | `Record<HealthScanType, TrendDataPoint[]>` | Score history per module, ordered newest first |
| `trends[type][].date` | string (ISO 8601) | Scan completion timestamp (`completedAt`) |
| `trends[type][].score` | integer (0-100) | Scan score |

### Filtering Rules

- Only scans with `status = 'COMPLETED'` are included
- Only scans with `score IS NOT NULL` are included
- Results ordered by `createdAt DESC` (newest first)
- Empty array for modules with no qualifying scans

### Error Responses

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "Invalid project ID" }` | Non-numeric or non-positive projectId |
| 400 | `{ "error": "Invalid limit", "code": "VALIDATION_ERROR" }` | limit out of range |
| 401 | `{ "error": "Unauthorized" }` | No valid session |
| 403 | `{ "error": "Forbidden" }` | User lacks project access |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

---

## `GET /api/projects/{projectId}/health/scans` (Updated)

### Changes

Two fields added to each scan object in the response:

| New Field | Type | Description |
|-----------|------|-------------|
| `tokensUsed` | `integer \| null` | API tokens consumed during scan |
| `costUsd` | `number \| null` | Cost in USD (2 decimal precision) |

These fields are returned for all scans regardless of query parameters. They are `null` for older scans that predate telemetry collection.
