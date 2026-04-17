# API Contract: GET `/api/activity-heatmap`

**Feature**: AIB-672 Activity Heatmap on Projects Page
**Auth**: Required (session or Bearer PAT, same contract as
`/api/projects/[projectId]/analytics`)
**Side effects**: None (read-only projection).

## Purpose

Return the cross-project activity heatmap for the signed-in user for a given
period, bucketed in the viewer's timezone. Used both server-side (SSR initial
data on `/projects`) and client-side (filter changes, background refetch).

## Request

### Method & path
```
GET /api/activity-heatmap
```

### Query parameters
All parameters are optional; defaults match the URL-omitted state (FR-028).

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `y`  | `'12m'` \| `'YYYY'` | `'12m'` | Period. `12m` = rolling 12 months ending today inclusive. `YYYY` = calendar year (must be within `[user.createdAt.year .. currentYear]`; out-of-range values silently coerce to `12m`). |
| `a`  | `'all' \| 'CLAUDE' \| 'CODEX' \| 'MISTRAL' \| 'GEMINI'` | `'all'` | Effective-agent filter. When set, only jobs whose effective agent (`ticket.agent ?? project.defaultAgent`) matches are counted. |
| `tz` | IANA timezone string (e.g. `Europe/Paris`) | `'UTC'` | Bucketing timezone. Invalid values fall back to `UTC`. |

### Example
```
GET /api/activity-heatmap?y=2025&a=CLAUDE&tz=America%2FNew_York
```

## Response — 200 OK

```ts
{
  period: {
    kind: 'rolling12m' | 'calendarYear',
    year?: number,
    startDate: string,    // "YYYY-MM-DD" inclusive, in `tz`
    endDate:   string,    // "YYYY-MM-DD" inclusive, in `tz`
    timezone:  string,    // IANA tz actually used (may differ from request if fallback)
  },
  counters: {
    jobCount: number,
    shippedTicketCount: number,
  },
  cells: Array<{
    date: string,                  // "YYYY-MM-DD" in `tz`
    jobCount: number,
    costUsd: number | null,        // null iff every job that day has null costUsd (FR-020)
    nullCostJobCount: number,      // 0 when all jobs that day have cost
    shippedTickets: Array<{
      ticketId: number | null,     // null for deleted tickets
      title:    string | null      // null for deleted tickets
    }>,
    intensity: 0 | 1 | 2 | 3 | 4,
  }>,
  intensityThresholds: [number, number, number, number],
  availableAgents: Array<'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI'>,
  yearSelector: {
    calendarYears: number[],       // e.g. [2024, 2025, 2026]; [] when creation year === current
    currentYear: number,
  },
}
```

### Example success payload (truncated)
```json
{
  "period": {
    "kind": "calendarYear",
    "year": 2025,
    "startDate": "2025-01-01",
    "endDate": "2025-12-31",
    "timezone": "America/New_York"
  },
  "counters": { "jobCount": 412, "shippedTicketCount": 27 },
  "cells": [
    {
      "date": "2025-01-01",
      "jobCount": 0,
      "costUsd": null,
      "nullCostJobCount": 0,
      "shippedTickets": [],
      "intensity": 0
    },
    {
      "date": "2025-06-12",
      "jobCount": 8,
      "costUsd": 1.24,
      "nullCostJobCount": 1,
      "shippedTickets": [{ "ticketId": 431, "title": "Add login" }],
      "intensity": 3
    }
  ],
  "intensityThresholds": [3, 6, 9, 12],
  "availableAgents": ["CLAUDE", "CODEX"],
  "yearSelector": {
    "calendarYears": [2023, 2024, 2025, 2026],
    "currentYear": 2026
  }
}
```

## Error Responses

| Status | Body | Trigger |
|--------|------|---------|
| 400 | `{ "error": "Invalid heatmap filters" }` | Zod validation fails on `y` or `a`. `tz` never triggers 400 (silent UTC fallback). |
| 401 | `{ "error": "Unauthorized" }` | No session and no valid Bearer token. |
| 500 | `{ "error": "Internal server error" }` | Unexpected exception. Logged with `console.error('Activity heatmap API error:', …)`. |

## Behaviour Notes

- **Empty aggregate**: When the viewer has zero accessible projects *or* zero
  jobs in the period, the response still returns a fully-shaped payload:
  `cells` covers every day in `[startDate..endDate]` with `jobCount: 0`,
  `intensity: 0`, `costUsd: null`. `counters` are both 0.
  `intensityThresholds` is `[0,0,0,0]`. The UI uses this to render the
  empty-state message (FR-012) without a second request.
- **Agent filter on empty data**: `availableAgents` is always computed from
  the unfiltered job set so the filter doesn't disappear after selection.
- **Shipped counter**: Counts `Job` rows where
  `command = 'ship' AND status = 'COMPLETED' AND completedAt` falls in the
  period, grouped by `ticketId`. A ticket with multiple successful `ship`
  jobs in a day is counted once.
- **Timezone**: `tz` is used for both the day of `startedAt` (intensity) and
  the day of `completedAt` (shipped). The response `timezone` echoes back the
  tz actually used so the UI can warn on fallback if desired.
- **Cost aggregation**: `costUsd` on a cell is `null` when every job that day
  has `costUsd === null`; otherwise it is the sum of the non-null entries,
  with `nullCostJobCount` indicating how many rows were excluded.

## Polling / caching

- **Server component**: call directly (no HTTP round-trip) via a shared
  `getHeatmapData()` helper to avoid the first-paint network hop.
- **Client**: TanStack Query `useQuery({ queryKey: ['activity-heatmap',
  y, a, tz], queryFn: fetch, initialData })`. No aggressive polling — the
  grid refreshes only when filters change or on `invalidateQueries` after a
  related mutation elsewhere (e.g., job status change — future).
