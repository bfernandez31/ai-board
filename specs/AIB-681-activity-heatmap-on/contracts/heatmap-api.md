# API Contract: Heatmap Endpoint

## `GET /api/heatmap`

User-scoped endpoint returning aggregated activity data across all projects owned by or accessible to the authenticated user.

### Authentication

- Requires valid NextAuth.js session (cookie-based)
- No project-level access check — user sees only their own projects' data

### Query Parameters

| Parameter | Type | Default | Validation |
|-----------|------|---------|------------|
| `year` | `"rolling"` \| `"2020"..currentYear` | `"rolling"` | Must be "rolling" or a 4-digit year between user's `createdAt` year and current year |
| `agent` | `"all"` \| `"CLAUDE"` \| `"CODEX"` \| `"MISTRAL"` \| `"GEMINI"` | `"all"` | Must be one of the allowed values |

### Success Response — `200 OK`

```jsonc
{
  // Daily aggregated activity cells for the selected period
  "cells": [
    {
      "date": "2025-03-15",     // ISO date (UTC)
      "jobCount": 7,            // Total jobs on this day
      "shippedCount": 1,        // Tickets with completed 'ship' job
      "totalCost": 2.50         // Sum of costUsd; null when no cost data
    }
    // ... one entry per day with activity (zero-activity days omitted)
  ],

  // Period-level totals
  "summary": {
    "totalJobs": 342,
    "totalShipped": 28
  },

  // Percentile-based intensity thresholds for non-zero cells
  // [p25, p50, p75, p100] — client assigns level 1-4 based on these
  "thresholds": [1, 3, 6, 15],

  // Agent options for filter dropdown (only agents with data)
  "availableAgents": [
    { "value": "all", "label": "All agents", "jobCount": 342, "isDefault": true },
    { "value": "CLAUDE", "label": "Claude", "jobCount": 280, "isDefault": false },
    { "value": "CODEX", "label": "Codex", "jobCount": 62, "isDefault": false }
  ],

  // Year options for year selector
  "availableYears": ["2024", "2025", "2026"],

  // User's account creation year (to determine if year selector should be hidden)
  "accountCreatedYear": 2024,

  // Echo of active filters
  "filters": {
    "year": "rolling",
    "agent": "all"
  }
}
```

### Error Responses

| Status | Body | When |
|--------|------|------|
| `400` | `{ "error": "Invalid heatmap filters" }` | Zod validation fails (bad year or agent value) |
| `401` | `{ "error": "Unauthorized" }` | No valid session |
| `500` | `{ "error": "Internal server error" }` | Unexpected failure |

### Data Rules

1. **Job counting**: All jobs (any status) with `createdAt` within the period are counted toward `jobCount`
2. **Ship counting**: Only jobs with `command = 'ship'` AND `status = 'COMPLETED'` count toward `shippedCount`, keyed by `completedAt` date
3. **Cost aggregation**: Sum of `costUsd` for non-null values only. If all jobs on a day have null cost, `totalCost` is `null`
4. **Agent filtering**: Uses effective agent resolution — `ticket.agent ?? project.defaultAgent`
5. **Zero-activity days**: Omitted from `cells` array — client fills the grid and treats missing dates as empty
6. **Date normalization**: All dates are UTC. `createdAt` and `completedAt` are truncated to UTC date for grouping
7. **Threshold calculation**: Non-zero job counts are sorted and split into quartiles. `thresholds[0]` = 25th percentile, `thresholds[3]` = max value

### Cache Headers

```
Cache-Control: no-store
```

No caching — data must be fresh on each request (matches analytics API pattern).
