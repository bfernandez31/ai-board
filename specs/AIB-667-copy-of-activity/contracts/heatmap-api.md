# API Contract: `GET /api/activity/heatmap`

**Feature**: AIB-667
**Consumers**: `app/projects/page.tsx` (SSR initial fetch) and `hooks/use-activity-heatmap.ts` (client polling, 15s).
**Stability**: Internal API; not versioned. Reshape via PR as needed.

## Authentication
- `requireAuth()` — session cookie OR Bearer PAT (same as other account-scoped endpoints).
- Returns `401` if no valid session/token.

## Query Parameters

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `year` | `"last-12-months"` \| `"2020".."2100"` | no | `"last-12-months"` | Period selector. Years outside the viewer's valid range (account creation year → current year) are rejected with `400`. |
| `agent` | `"all" \| "CLAUDE" \| "CODEX" \| "MISTRAL" \| "GEMINI"` | no | `"all"` | Effective-agent filter. Invalid values rejected with `400`. |
| `tz` | IANA timezone string | no | `"UTC"` | Viewer's local timezone for day bucketing. Invalid values fall back to `"UTC"` (request succeeds). |

## Request Validation (Zod)

```ts
const querySchema = z.object({
  year: z.string().optional(),  // refined against computed valid set
  agent: z.enum(['all', 'CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']).default('all'),
  tz: z.string().max(64).optional(),
});
```

`year` cannot be fully validated with `z.enum` because the valid set depends on the viewer's account creation year. The handler computes the set and returns `400 { error: "Invalid year" }` if `year` is outside it.

## Success Response — 200 OK

Body matches `HeatmapResponse` from `lib/activity/heatmap-types.ts`:

```json
{
  "filters": {
    "year": "last-12-months",
    "agent": "all",
    "timezone": "America/Los_Angeles"
  },
  "range": {
    "startDate": "2025-04-17",
    "endDate":   "2026-04-17",
    "gridStart": "2025-04-13",
    "gridEnd":   "2026-04-18"
  },
  "days": [
    {
      "date": "2025-04-17",
      "jobCount": 3,
      "ticketsShipped": 1,
      "intensity": 2,
      "totalCostUsd": 1.42
    },
    {
      "date": "2025-04-18",
      "jobCount": 2,
      "ticketsShipped": 0,
      "intensity": 2
    }
  ],
  "counters": {
    "totalJobs": 5,
    "ticketsShipped": 1,
    "periodLabel": "in the last year"
  },
  "agentOptions": [
    { "value": "all",    "label": "All agents", "historicalJobCount": 127 },
    { "value": "CLAUDE", "label": "Claude",     "historicalJobCount": 98 },
    { "value": "CODEX",  "label": "Codex",      "historicalJobCount": 29 }
  ],
  "yearOptions": [
    { "value": "last-12-months", "label": "Last 12 months", "isDefault": true },
    { "value": "2026",           "label": "2026",           "isDefault": false },
    { "value": "2025",           "label": "2025",           "isDefault": false },
    { "value": "2024",           "label": "2024",           "isDefault": false }
  ],
  "generatedAt": "2026-04-17T14:22:08.123Z"
}
```

### Guarantees
- `days` is **contiguous** from `range.startDate` through `range.endDate` inclusive, one entry per calendar day in the viewer's tz. Zero-activity days are present with `jobCount: 0`, `intensity: 0`, no `totalCostUsd`.
- `days[].totalCostUsd` is **absent** (not `null`, not `0`) when no jobs on that day had a recorded cost.
- `counters.totalJobs === sum(days[].jobCount)`.
- `counters.ticketsShipped === sum(days[].ticketsShipped)`.
- `agentOptions` is computed over the **viewer's entire job history**, not the filtered period (FR-017).
- If the viewer's historical job data has 0 or 1 distinct effective agents, the non-`all` option count is `< 2` and the client hides the filter.

## Error Responses

| Status | Body | Trigger |
|---|---|---|
| `400` | `{ "error": "Invalid heatmap filters" }` | Zod validation failure (malformed `agent`, overlong `tz`, etc.) |
| `400` | `{ "error": "Invalid year" }` | `year` outside valid set for this viewer |
| `401` | `{ "error": "Unauthorized" }` | No valid session/token |
| `500` | `{ "error": "Internal server error" }` | Unexpected exception; logged via `console.error` |

Follows the structured error shape documented in the constitution (`{ error: string, code?: string }`) and matches the patterns in `app/api/projects/[projectId]/analytics/route.ts`.

## Caching / Headers

- `Cache-Control: private, no-store` — heatmap is per-viewer and changes on every poll.
- No `ETag`. The 15s polling cycle is the freshness contract.

## Rate / Scale Envelope

- Expected load: one SSR request per `/projects` page view + one request per 15s for each open tab (paused when hidden).
- Typical viewer: ≤ 50 projects, ≤ 5000 jobs in a 12-month window, aggregated to ≤ 372 day cells.
- p95 server budget: **< 150ms**. Enforced via an integration test that seeds a realistic dataset and asserts response time.
