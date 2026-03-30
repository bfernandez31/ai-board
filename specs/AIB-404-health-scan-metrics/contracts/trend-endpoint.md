# API Contract: Health Trend Endpoint

**Endpoint**: `GET /api/projects/:projectId/health/trend`
**Authentication**: Session-based (NextAuth.js)
**Authorization**: `verifyProjectAccess(projectId)` — Owner or member

## Request

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | integer | Yes | Project ID (> 0) |

**Query Parameters**: None

## Response

### 200 OK

```json
{
  "trends": {
    "security": [
      { "score": 85, "date": "2026-03-15T10:30:00.000Z" },
      { "score": 90, "date": "2026-03-20T14:15:00.000Z" }
    ],
    "compliance": [],
    "tests": [
      { "score": 72, "date": "2026-03-18T09:00:00.000Z" }
    ],
    "specSync": [
      { "score": 95, "date": "2026-03-22T16:45:00.000Z" }
    ]
  }
}
```

**Response Schema**:

| Field | Type | Description |
|-------|------|-------------|
| `trends` | object | Keyed by camelCase module name |
| `trends.[module]` | `TrendDataPoint[]` | Up to 20 entries, oldest first |
| `trends.[module][].score` | integer | 0-100 score value |
| `trends.[module][].date` | string (ISO 8601) | `completedAt` timestamp |

**Business Rules**:
- Only COMPLETED scans with non-null `score` are included
- Maximum 20 data points per module (most recent)
- Results ordered chronologically (oldest → newest) for chart rendering
- Empty array if module has no qualifying scans

### 400 Bad Request

```json
{ "error": "Invalid project ID" }
```

### 401 Unauthorized

```json
{ "error": "Unauthorized" }
```

### 403 Forbidden

```json
{ "error": "Forbidden" }
```

### 500 Internal Server Error

```json
{ "error": "Internal server error" }
```

---

## Modified Contract: Scan History Endpoint

**Endpoint**: `GET /api/projects/:projectId/health/scans` (existing)

### Changes

Two fields added to each scan record in the response:

| Field | Type | Description | Previously |
|-------|------|-------------|------------|
| `tokensUsed` | `integer \| null` | Tokens consumed during scan | Not in select |
| `costUsd` | `number \| null` | Cost in USD (Decimal → number) | Not in select |

**Impact**: Existing consumers receive additional nullable fields — backwards compatible.
