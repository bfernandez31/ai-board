# API Contract: `GET /api/heatmap`

Returns the authenticated user's activity heatmap for the selected period, optionally filtered by agent. Scoped to projects the user owns or is a member of.

## Endpoint
`GET /api/heatmap`

## Authentication
- Session cookie (NextAuth) OR Bearer PAT in `Authorization: Bearer …` header, via `requireAuth(request)` from `lib/db/users.ts`.
- Header `x-test-user-id` accepted in test environments only (project convention; see CLAUDE.md "Test Environment").

## Query Parameters

| Name | Type | Default | Valid values | Behaviour on invalid |
|---|---|---|---|---|
| `period` | string | `'last-12-months'` | `'last-12-months'` OR a 4-digit year ≥ `user.createdAt.getFullYear()` and ≤ current year | Silently coerced to `'last-12-months'` (no 400) |
| `agent` | string | `'all'` | `'all'`, `'CLAUDE'`, `'CODEX'`, `'MISTRAL'`, `'GEMINI'` | Silently coerced to `'all'` |

Validation via Zod with `.catch(defaultValue)` per field so the route **never 400s on filter values**. 400 is reserved for fundamentally malformed requests (currently unreachable given the permissive schema).

## Response — 200 OK

```jsonc
{
  "filters": {
    "period": "last-12-months",
    "agent": "all"
  },
  "periodOptions": [
    { "value": "last-12-months", "label": "Last 12 months", "isDefault": true },
    { "value": "2025",           "label": "2025",           "isDefault": false },
    { "value": "2024",           "label": "2024",           "isDefault": false }
  ],
  "availableAgents": [
    { "value": "CLAUDE", "label": "Claude", "jobCount": 142 },
    { "value": "CODEX",  "label": "Codex",  "jobCount": 17  }
  ],
  "days": [
    {
      "date": "2025-04-13",
      "inPeriod": true,
      "jobCount": 0,
      "shippedTicketCount": 0,
      "totalCost": null,
      "intensityLevel": 0
    },
    {
      "date": "2025-04-14",
      "inPeriod": true,
      "jobCount": 3,
      "shippedTicketCount": 1,
      "totalCost": 0.42,
      "intensityLevel": 2
    }
    // … one entry per day in the Sunday-aligned, Saturday-terminated grid window
  ],
  "totals": {
    "jobCount": 387,
    "shippedTicketCount": 21
  },
  "intensityThresholds": [1, 3, 6, 14],
  "generatedAt": "2026-04-16T10:00:00.000Z"
}
```

### Response type (TypeScript)
See `lib/heatmap/types.ts:HeatmapData`. The wire format is exactly this interface JSON-serialized.

### Semantic guarantees
- `days[]` is **contiguous** calendar dates, every element's `date` = previous element's `date + 1 day`.
- `days[0].date` is a **Sunday** and `days[days.length - 1].date` is a **Saturday**.
- `totals.jobCount === sum(days.filter(d => d.inPeriod).map(d => d.jobCount))` (respecting the active agent filter).
- `totals.shippedTicketCount === sum(days.filter(d => d.inPeriod).map(d => d.shippedTicketCount))`.
- `availableAgents` is computed from the **unfiltered** dataset and is the same for all `agent` filter values in a given period. `[]` iff ≤ 1 distinct agent.
- `totalCost === null` iff every qualifying job for that day had `costUsd = null`.
- For a day with `jobCount === 0`: `intensityLevel === 0` and `totalCost === null` and `shippedTicketCount === 0`.

## Error Responses

| Status | Shape | When |
|---|---|---|
| 401 | `{ "error": "Unauthorized" }` | `requireAuth()` threw (no session, invalid PAT) |
| 500 | `{ "error": "Internal server error" }` | Unexpected error; logged server-side with `console.error` |

No 400, 403, or 404 branches:
- **400**: all filter values are silently coerced; there is no malformed-request case.
- **403**: the heatmap has no project-level gate — scope is always "your accessible projects".
- **404**: an empty result is a valid 200 response (empty-state), not "not found".

## Caching
- No HTTP cache headers (dynamic per-user).
- Client uses TanStack Query `refetchInterval: 15000`, `staleTime: 10000` (matches CLAUDE.md "15s analytics polling").

## Idempotency
Pure read; safe to call repeatedly. No side effects.

## Rate limiting
Inherits the app's default Next.js route handler behaviour (no per-route limiter currently). The 15s polling interval is well within any practical limit.

## Test matrix (for `tests/integration/heatmap/heatmap-route.test.ts`)

| # | Scenario | Setup | Expectation |
|---|---|---|---|
| 1 | default call | seed user with jobs across last 90 days | 200; `filters.period === 'last-12-months'`; `days.length >= 365` |
| 2 | specific year | `?period=2024` with seeded 2024 jobs | 200; `days[0].date` is the Sunday on/before 2024-01-01 |
| 3 | invalid period | `?period=foo` | 200; `filters.period === 'last-12-months'` (silent fallback) |
| 4 | year before account | `?period=2019` for user createdAt 2024 | 200; silently falls back to `'last-12-months'` |
| 5 | agent filter | `?agent=CLAUDE` with mixed-agent jobs | 200; totals only reflect Claude-attributed jobs; `days` boundaries unchanged vs unfiltered |
| 6 | invalid agent | `?agent=unknown` | 200; `filters.agent === 'all'` |
| 7 | access scoping | seed jobs on a project the user is NOT a member of | those jobs do not appear in any counts |
| 8 | ship counting | ship job with `status = FAILED` on SHIP-stage ticket | `shippedTicketCount` does NOT include it |
| 9 | cost nullability | all jobs on day `D` have `costUsd = null` | `days[indexOf(D)].totalCost === null` |
| 10 | mixed cost | one job costUsd=0.10, another costUsd=null on day `D` | `days[indexOf(D)].totalCost === 0.10` |
| 11 | leap year | `?period=2024` | entries between 2024-01-01 and 2024-12-31 count to 366 |
| 12 | empty data | user with no jobs | `totals.jobCount === 0`, all cells `intensityLevel === 0`, `availableAgents === []` |
| 13 | 1-agent user | user's jobs all map to Claude | `availableAgents === []` (client hides filter) |
| 14 | unauthenticated | no session | 401 |
