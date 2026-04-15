# API Contract: Heatmap Endpoint

## `GET /api/heatmap`

Cross-project activity heatmap data for the authenticated user.

### Authentication
- Requires valid session (NextAuth.js)
- Returns `401` if unauthenticated

### Query Parameters

| Param | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| `year` | `'rolling'` \| `string` | `'rolling'` | `'rolling'` or 4-digit year (user.createdAt.year to current year) | Time period selector |
| `agent` | `'all'` \| `Agent` | `'all'` | `'all'` or one of `CLAUDE`, `CODEX`, `MISTRAL`, `GEMINI` | Agent filter |

### Request

```
GET /api/heatmap?year=rolling&agent=all
```

### Response `200 OK`

```json
{
  "days": [
    {
      "date": "2026-03-15",
      "jobCount": 5,
      "costUsd": 1.23,
      "shippedTickets": [
        { "ticketKey": "AIB-42", "title": "Add dark mode toggle" }
      ]
    },
    {
      "date": "2026-03-16",
      "jobCount": 3,
      "costUsd": null,
      "shippedTickets": []
    }
  ],
  "totalJobs": 150,
  "totalShipped": 12,
  "agents": [
    { "value": "all", "label": "All agents", "jobCount": 150, "isDefault": true },
    { "value": "CLAUDE", "label": "Claude", "jobCount": 120, "isDefault": false },
    { "value": "CODEX", "label": "Codex", "jobCount": 30, "isDefault": false }
  ],
  "periodLabel": "in the last year",
  "userCreatedYear": 2024
}
```

### Field Semantics

| Field | Description |
|-------|-------------|
| `days` | Sparse array — only days with at least one job. Days with zero activity are omitted. |
| `days[].date` | ISO date string `YYYY-MM-DD` in UTC |
| `days[].jobCount` | Count of jobs with `status != PENDING` that started (`startedAt`) on this day |
| `days[].costUsd` | Sum of non-null `costUsd` across jobs. `null` when ALL jobs on that day have null cost. Never `0` for missing data. |
| `days[].shippedTickets` | Tickets with a `command: 'ship'`, `status: 'COMPLETED'` job whose `completedAt` falls on this day. Deduplicated — first completed ship job per ticket only. |
| `totalJobs` | Sum of all `jobCount` values across all days |
| `totalShipped` | Count of unique tickets shipped in the period (NOT sum of daily shipped counts, which could double-count) |
| `agents` | Available agent filter options. `"all"` is always first. Only agents with `jobCount > 0` appear. Hidden (empty array minus "all") when 0 or 1 distinct agents. |
| `periodLabel` | Human-readable label: `"in the last year"` for rolling, `"in 2025"` for calendar year |
| `userCreatedYear` | The year of the user's account creation. Used by client to populate year selector options. |

### Error Responses

| Status | Body | When |
|--------|------|------|
| `401` | `{ "error": "Unauthorized" }` | No valid session |
| `400` | `{ "error": "Invalid year parameter" }` | Year is not 'rolling' or valid 4-digit year in range |
| `400` | `{ "error": "Invalid agent parameter" }` | Agent is not 'all' or a valid Agent enum value |
| `500` | `{ "error": "Failed to fetch heatmap data" }` | Internal server error |

### Notes

- The endpoint aggregates across ALL projects where the user is owner OR member
- Empty period (no jobs): returns `{ days: [], totalJobs: 0, totalShipped: 0, ... }`
- Calendar year queries: `year=2025` returns Jan 1 00:00:00 UTC through Dec 31 23:59:59 UTC
- Rolling queries: `year=rolling` returns the last 365 days from current UTC date
- The `agents` array reuses the existing `AgentOption` type from `lib/analytics/types.ts`
