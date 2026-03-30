# API Contract: Health Trends

## GET /api/projects/:projectId/health/trends

Returns the last N completed scan scores per active module for sparkline and area chart rendering.

### Authorization

- Requires authenticated session (NextAuth)
- `verifyProjectAccess(projectId)` — owner OR member

### Request

**Path Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | integer | Yes | Project ID |

**Query Parameters**: None

### Response

**200 OK**:
```json
{
  "security": [
    { "score": 72, "date": "2026-03-20T14:30:00.000Z" },
    { "score": 78, "date": "2026-03-25T09:15:00.000Z" },
    { "score": 85, "date": "2026-03-28T11:00:00.000Z" }
  ],
  "compliance": [
    { "score": 90, "date": "2026-03-22T16:00:00.000Z" }
  ],
  "tests": [],
  "specSync": [
    { "score": 65, "date": "2026-03-19T08:00:00.000Z" },
    { "score": 70, "date": "2026-03-26T10:30:00.000Z" }
  ]
}
```

**Response Schema**:
```typescript
{
  security: TrendDataPoint[];   // max 20 items
  compliance: TrendDataPoint[]; // max 20 items
  tests: TrendDataPoint[];      // max 20 items
  specSync: TrendDataPoint[];   // max 20 items
}

interface TrendDataPoint {
  score: number;  // 0-100
  date: string;   // ISO 8601 (from completedAt)
}
```

**Constraints**:
- Only `COMPLETED` scans with non-null `score` are included
- Ordered chronologically (oldest → newest)
- Maximum 20 data points per module
- Empty array if no qualifying scans exist

**Error Responses**:
| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "Invalid project ID" }` | Non-numeric or non-positive projectId |
| 401 | `{ "error": "Unauthorized" }` | No valid session |
| 403 | `{ "error": "Forbidden" }` | User lacks project access |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

---

## GET /api/projects/:projectId/health/scans (Modified)

### Changes

Two new fields added to each item in the `scans` array:

| Field | Type | Description |
|-------|------|-------------|
| `tokensUsed` | `number \| null` | Tokens consumed by the scan |
| `costUsd` | `number \| null` | Cost in USD |

**Updated response example**:
```json
{
  "scans": [
    {
      "id": 42,
      "scanType": "SECURITY",
      "status": "COMPLETED",
      "score": 85,
      "issuesFound": 3,
      "issuesFixed": null,
      "baseCommit": "abc1234",
      "headCommit": "def5678",
      "durationMs": 45000,
      "tokensUsed": 12500,
      "costUsd": 0.15,
      "errorMessage": null,
      "startedAt": "2026-03-28T10:00:00.000Z",
      "completedAt": "2026-03-28T10:00:45.000Z",
      "createdAt": "2026-03-28T09:59:58.000Z"
    }
  ],
  "nextCursor": null,
  "hasMore": false
}
```
