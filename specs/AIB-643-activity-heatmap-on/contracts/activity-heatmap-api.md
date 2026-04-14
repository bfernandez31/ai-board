# API Contract: Activity Heatmap

**Endpoint**: `GET /api/activity-heatmap`
**Auth**: Session (NextAuth) or Bearer token (PAT)
**Scope**: Cross-project (all user-accessible projects)

## Request

### Query Parameters

| Param | Type | Default | Validation |
|-------|------|---------|------------|
| `year` | `string` | `"rolling"` | `"rolling"` or 4-digit year (2020–current) |
| `agent` | `string` | `"all"` | `"all"`, `"CLAUDE"`, `"CODEX"`, `"MISTRAL"`, `"GEMINI"` |

### Example
```
GET /api/activity-heatmap?year=rolling&agent=all
GET /api/activity-heatmap?year=2025&agent=CLAUDE
```

## Response

### 200 OK
```json
{
  "days": [
    {
      "date": "2026-03-15",
      "jobCount": 5,
      "costUsd": 1.23,
      "ticketsShipped": 1
    },
    {
      "date": "2026-03-16",
      "jobCount": 2,
      "costUsd": null,
      "ticketsShipped": 0
    }
  ],
  "totalJobs": 342,
  "totalTicketsShipped": 47,
  "availableYears": [2024, 2025, 2026],
  "availableAgents": [
    { "value": "all", "label": "All agents", "jobCount": 342 },
    { "value": "CLAUDE", "label": "Claude", "jobCount": 280 },
    { "value": "GEMINI", "label": "Gemini", "jobCount": 62 }
  ],
  "period": {
    "start": "2025-04-14",
    "end": "2026-04-14"
  }
}
```

### 401 Unauthorized
```json
{ "error": "Unauthorized" }
```

### 400 Bad Request
```json
{ "error": "Invalid year parameter" }
```

## Query Logic

1. Get `userId` via `requireAuth(request)`
2. Find all project IDs where user is owner OR member
3. Aggregate jobs with `status IN (COMPLETED, FAILED)` and `completedAt` within date range
4. If `agent !== 'all'`: filter via ticket's effective agent (ticket.agent ?? project.defaultAgent)
5. Group by `DATE(completedAt)` to produce daily job counts and cost sums
6. Count tickets with `stage = 'SHIP'` and `updatedAt` within date range, grouped by date
7. Query distinct years from user's jobs for `availableYears`
8. Query distinct effective agents from user's tickets for `availableAgents`

## Performance Considerations

- Single query with GROUP BY for daily aggregation (not N queries per day)
- Project ID list query is fast (indexed on userId and members.userId)
- Job table indexed on `projectId`, `status`, and `startedAt`
- Response cached by TanStack Query client-side (15s stale, 15s poll)
