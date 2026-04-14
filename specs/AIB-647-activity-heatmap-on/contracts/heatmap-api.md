# API Contract: Activity Heatmap

## `GET /api/heatmap`

Aggregates daily job activity and shipped tickets across all projects accessible to the authenticated user.

### Authentication

Session-based (NextAuth.js). Returns `401` if unauthenticated.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `year` | `'rolling'` \| `string` (4-digit year) | `'rolling'` | Time period. `'rolling'` = last 12 months from today. Year string = Jan 1 to Dec 31 of that year. |
| `agent` | `'all'` \| `Agent` enum value | `'all'` | Filter by AI agent. |

### Validation (Zod)

```typescript
const heatmapQuerySchema = z.object({
  year: z.union([
    z.literal('rolling'),
    z.string().regex(/^\d{4}$/).transform(Number),
  ]).default('rolling'),
  agent: z.enum(['all', 'CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']).default('all'),
});
```

### Response `200 OK`

```json
{
  "cells": [
    {
      "date": "2026-03-15",
      "jobCount": 5,
      "costUsd": 2.34,
      "ticketsShipped": 1
    },
    {
      "date": "2026-03-16",
      "jobCount": 2,
      "costUsd": null,
      "ticketsShipped": 0
    }
  ],
  "summary": {
    "totalJobs": 150,
    "totalTicketsShipped": 12
  },
  "filters": {
    "year": "rolling",
    "agent": "all"
  },
  "availableYears": [2024, 2025, 2026],
  "availableAgents": [
    { "value": "all", "label": "All agents", "jobCount": 150, "isDefault": true },
    { "value": "CLAUDE", "label": "Claude", "jobCount": 120, "isDefault": false }
  ]
}
```

### Response `401 Unauthorized`

```json
{ "error": "Unauthorized" }
```

### Response `400 Bad Request`

```json
{ "error": "Invalid year parameter" }
```

### Performance Expectations

- Response time: < 2 seconds (SC-002)
- Data volume: ~365 cells max per request (one per day in range)
- Queries: 3 parallel Prisma queries (daily jobs, daily shipped, metadata)
