# API Contract: Activity Heatmap

## `GET /api/activity-heatmap`

Authenticated endpoint returning per-day AI activity aggregates across all
projects accessible to the current user.

### Auth
- Requires a valid NextAuth session. Extract user via `requireAuth()` from
  `lib/db/users.ts`.
- Unauthenticated requests → `401 { error: 'Unauthorized' }`.
- No project-scoped authorization header is required (scope is "all user
  projects"). `verifyProjectAccess` is NOT called.

### Query parameters

| Name     | Required | Allowed values                                           | Default          | Invalid behaviour                                     |
| -------- | -------- | -------------------------------------------------------- | ---------------- | ----------------------------------------------------- |
| `period` | no       | `last-12-months` \| 4-digit year (`YYYY`)                | `last-12-months` | Silently coerce to default (do not 400).              |
| `agent`  | no       | `all` \| `CLAUDE` \| `CODEX` \| `MISTRAL` \| `GEMINI`    | `all`            | Silently coerce to `all`.                             |
| `tz`     | no       | IANA time-zone string (e.g. `America/New_York`)          | `UTC`            | Silently coerce to `UTC`.                             |

`period=YYYY` is rejected (coerced to default) when `YYYY < year(user.createdAt)`
or `YYYY > currentYear`.

### Response `200 OK`

`Content-Type: application/json`

```json
{
  "filters": {
    "period": { "kind": "last-12-months" },
    "agent": "all",
    "timezone": "America/New_York"
  },
  "meta": {
    "rangeStart": "2025-04-20",
    "rangeEnd": "2026-04-19",
    "label": "Last 12 months"
  },
  "days": [
    {
      "date": "2025-04-20",
      "jobCount": 0,
      "totalCost": null,
      "shippedTickets": [],
      "level": 0
    },
    {
      "date": "2025-04-21",
      "jobCount": 4,
      "totalCost": 0.38,
      "shippedTickets": [
        { "ticketKey": "AIB-123", "title": "Fix OAuth redirect" }
      ],
      "level": 2
    }
  ],
  "totals": { "jobs": 412, "shippedTickets": 18 },
  "thresholds": { "t1": 1, "t2": 3, "t3": 6, "t4": 12 },
  "distinctAgents": ["CLAUDE", "CODEX"],
  "availableYears": [2026, 2025, 2024]
}
```

### Field contract (wire ↔ types)

- `filters.period`: `{ kind: 'last-12-months' } | { kind: 'calendar-year', year: number }`
- `filters.agent`: `'all' | 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI'`
- `filters.timezone`: IANA string; always echoed back (even if server coerced it to `UTC`).
- `meta.rangeStart`, `meta.rangeEnd`, `days[].date`: `YYYY-MM-DD` in `filters.timezone`.
- `days`: contiguous, ascending by date, one entry per day in the range.
- `days[].totalCost`: `number | null` — **null** when no job that day recorded cost.
  MUST NOT be `0.0` in that case (client relies on the null to omit the cost line;
  SC-006).
- `days[].level`: integer 0..4, pre-bucketed per §R7 of `data-model.md`.
- `shippedTickets[]`: deduplicated by `ticketKey` per day; order: by successful
  `ship`-job `completedAt` ascending.
- `totals.jobs`: sum of `days[].jobCount`.
- `totals.shippedTickets`: count of DISTINCT `ticketKey` across the period.
- `thresholds.t1 <= t2 <= t3 <= t4`; all ≥ 1.
- `distinctAgents`: subset of `['CLAUDE','CODEX','MISTRAL','GEMINI']`; alphabetical.
- `availableYears`: descending, last entry is `year(user.createdAt)`.

### Error responses

| Status | Body                                                    | When                                                          |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------- |
| 401    | `{ "error": "Unauthorized" }`                           | No session.                                                   |
| 500    | `{ "error": "Failed to load activity heatmap" }`        | Unexpected DB / runtime failure. NEVER fall through to a raw 500 — log with context per constitution. |

**No 400.** Invalid query params silently coerce to defaults (per §FR-015 and
§P5 in research.md — the page must not reject shared URLs). The server logs the
coercion with the offending values.

### Caching / polling
- Cacheability: **per-user, private**. Response MUST include `Cache-Control: private, no-store`.
- Polling: clients use TanStack Query `refetchInterval: 15000`.
- Response body target size: < 60 KB uncompressed for a 12-month payload (a 365-day
  array with short ticket lists — the dominant cost is `shippedTickets`).

### Zod schema (server-side validation)

```ts
// inside app/api/activity-heatmap/route.ts
const querySchema = z.object({
  period: z.string().optional(),
  agent: z.enum(['all', 'CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']).optional(),
  tz: z.string().optional(),
});
```

The `period` field is a plain string because its allow-list is user-specific
(depends on `user.createdAt`); the route validates it imperatively after auth
and coerces invalid values to `'last-12-months'`.

### Contract tests (what `tests/integration/activity-heatmap/heatmap-route.test.ts` MUST assert)

1. **Auth**: unauth → 401.
2. **Default shape**: no query → `filters.period.kind === 'last-12-months'`,
   `filters.agent === 'all'`, `days.length >= 365 && days.length <= 371` (ranges
   can span up to 53 weeks).
3. **Calendar year**: `?period=2025` → `meta.label === '2025'`,
   `days[0].date === '2025-01-01'`, `days.at(-1).date === '2025-12-31'`.
4. **Current-year clamp**: `?period={currentYear}` → `days.at(-1).date === today_in_tz`.
5. **Year out of range**: `?period=1999` → silently coerced to `last-12-months`;
   HTTP status still 200.
6. **Agent scope**: `?agent=CODEX` → `days[].jobCount` only includes jobs whose
   ticket has `agent='CODEX'` OR (`agent=null` AND project's `defaultAgent='CODEX'`).
7. **Shipped counter**: a ticket that was moved to `stage='SHIP'` but has no
   `command='ship' status=COMPLETED` Job MUST NOT appear in `shippedTickets`
   and MUST NOT contribute to `totals.shippedTickets`.
8. **Null cost**: a day with jobs whose `costUsd` is all null → `totalCost === null`
   (NOT `0`).
9. **Owner+member scope**: user sees jobs from a project where they are a
   member-only (not the owner); jobs from a project they neither own nor are a
   member of are excluded.
10. **Distinct agents**: a user with 0 or 1 effective-agent tickets → `distinctAgents.length <= 1`.
11. **Thresholds**: `t1 <= t2 <= t3 <= t4`, all ≥ 1.
12. **Timezone**: `?tz=America/New_York` — a job at UTC `2025-06-15T02:00:00Z`
    must bucket into `2025-06-14` (EDT). Invalid `tz=foo/bar` falls back to UTC.
13. **Content-Type** + `Cache-Control: private, no-store` headers set.

### Rate-limiting / abuse notes

- No per-user rate limit is added. Authenticated user already bounded by
  Next.js session and natural polling rate (15 s).
- No secret data is returned; all fields are derivatives of records the user
  already has access to. No ID disclosure beyond `ticketKey` (which the user
  already sees on `/projects`).
