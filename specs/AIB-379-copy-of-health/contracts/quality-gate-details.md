# API Contract: Quality Gate Details

## GET `/api/projects/:projectId/health/quality-gate`

Returns aggregated Quality Gate data for the project's Health Dashboard.

### Authorization

Requires project access (owner or member) via `verifyProjectAccess(projectId)`.

### Response: `200 OK`

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
    { "name": "Compliance", "averageScore": 88, "weight": 0.40 },
    { "name": "Bug Detection", "averageScore": 79, "weight": 0.30 },
    { "name": "Code Comments", "averageScore": 75, "weight": 0.20 },
    { "name": "Historical Context", "averageScore": 70, "weight": 0.10 },
    { "name": "Spec Sync", "averageScore": 65, "weight": 0.00 }
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
    {
      "ticketKey": "AIB-120",
      "score": 85,
      "date": "2026-03-25T14:30:00.000Z"
    }
  ]
}
```

### Response: Empty state

```json
{
  "averageScore": null,
  "ticketCount": 0,
  "trend": null,
  "trendDelta": null,
  "distribution": {
    "excellent": 0,
    "good": 0,
    "fair": 0,
    "poor": 0
  },
  "dimensions": [],
  "recentTickets": [],
  "trendData": []
}
```

### Query Logic

1. **Current period** (last 30 days): All Jobs where `command = 'verify'`, `status = 'COMPLETED'`, `qualityScore IS NOT NULL`, `ticket.workflowType = 'FULL'`, `ticket.stage = 'SHIP'`, `completedAt >= NOW - 30 days`
2. **Previous period** (30-60 days ago): Same filters with `completedAt` between 60 and 30 days ago
3. **Trend**: `current avg - previous avg` → direction + delta
4. **Dimensions**: Parse `qualityScoreDetails` JSON for each qualifying job, compute per-dimension average using `DIMENSION_CONFIG`
5. **Distribution**: Count tickets in each threshold bucket (Excellent >=90, Good >=70, Fair >=50, Poor <50)

### Error Responses

- `400`: Invalid project ID
- `401`: Unauthorized
- `404`: Project not found
