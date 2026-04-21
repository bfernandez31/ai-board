# Contract: Activity Heatmap API

**Endpoint**: `GET /api/projects/activity-heatmap`
**Auth**: Session (NextAuth) OR Bearer token (PAT). `requireAuth(request)` resolves the current user id.
**Scope**: User-wide — aggregates across every project the viewer owns OR is a member of. NOT per-project (no `projectId` in the path).

> **Route path rationale**: Nested under `/api/projects/` because the data is scoped by the viewer's project memberships, mirroring `/api/projects/` listing semantics. No `[projectId]` segment because the heatmap spans all accessible projects.

---

## Request

### Query parameters

| Name | Type | Default | Validation | Description |
|---|---|---|---|---|
| `period` | string | `'12m'` | `^(12m|\d{4})$`, year MUST be `>= user.createdAt.getFullYear()` and `<= currentYear` | Period to render. `12m` = rolling last 12 months. `YYYY` = that calendar year. |
| `agent` | enum | `'all'` | `'all' \| 'CLAUDE' \| 'CODEX' \| 'MISTRAL' \| 'GEMINI'` (= `AGENT_FILTER_VALUES`) | Effective-agent filter. |

**Invalid `period` handling**: malformed or out-of-range `period` values silently fall back to `'12m'` (do NOT return 400). Rationale: URLs are user-visible and should be forgiving. A bookmarked link with a stale `year=2019` for a user who joined in 2023 should still render (with the default period), not explode.

**Invalid `agent` handling**: return `400 { error: 'Invalid heatmap filters' }`. Rationale: `agent` is a closed enum; a typo is a programming error not a user input.

---

## Response

### 200 OK — `application/json`

```json
{
  "filters": {
    "period": { "kind": "rolling", "months": 12 },
    "agent": "all"
  },
  "period": {
    "startDate": "2025-04-22",
    "endDate": "2026-04-21",
    "label": "the last year"
  },
  "intensityThresholds": {
    "t1": 1,
    "t2": 3,
    "t3": 7,
    "t4": 15
  },
  "days": [
    {
      "date": "2025-04-22",
      "jobCount": 0,
      "sumCostUsd": 0,
      "hasAnyCost": false,
      "shippedTickets": [],
      "intensity": 0
    },
    {
      "date": "2025-04-23",
      "jobCount": 5,
      "sumCostUsd": 1.23,
      "hasAnyCost": true,
      "shippedTickets": [
        { "ticketKey": "AIB-704", "title": "Activity heatmap on projects page" }
      ],
      "intensity": 2
    }
  ],
  "totals": {
    "jobs": 847,
    "ticketsShipped": 43
  },
  "availableAgents": [
    { "value": "CLAUDE", "label": "Claude", "jobCount": 612 },
    { "value": "CODEX",  "label": "Codex",  "jobCount": 235 }
  ],
  "accountCreatedYear": 2024,
  "generatedAt": "2026-04-21T14:02:33.001Z"
}
```

### Field reference

| Path | Type | Notes |
|---|---|---|
| `filters.period` | `HeatmapPeriodKey` | Server echoes the resolved period (not the raw param), so client `filtersMatch` can gate `initialData` reuse. |
| `filters.agent` | `'all' \| Agent` | Echoed unchanged unless invalid (invalid triggers 400, not silent fallback). |
| `period.startDate` | `string` | UTC `YYYY-MM-DD`, inclusive. |
| `period.endDate` | `string` | UTC `YYYY-MM-DD`, inclusive. Clamped to `min(periodEnd, today)`. |
| `period.label` | `string` | Human-readable; `"the last year"` for rolling, `"2025"` for year. Used in header counter (FR-013). |
| `intensityThresholds.t1` | `number` | Lower bound for intensity 1 (always 1 when any non-zero day exists). |
| `intensityThresholds.t2` | `number` | p50 of non-zero distribution, rounded up, monotonic. |
| `intensityThresholds.t3` | `number` | p75. |
| `intensityThresholds.t4` | `number` | p90. |
| `days[]` | `HeatmapDay[]` | Exactly one entry per calendar day in `[startDate, endDate]`. |
| `days[].date` | `string` | UTC `YYYY-MM-DD`. |
| `days[].jobCount` | `number` | Count of jobs with `startedAt` on that day, `status ≠ PENDING`, scoped. |
| `days[].sumCostUsd` | `number` | Sum of non-null `costUsd`, 2-decimal rounded. Use 0 only when `hasAnyCost` is true. |
| `days[].hasAnyCost` | `boolean` | True iff any job on that day has non-null `costUsd`. |
| `days[].shippedTickets[]` | `ShippedTicket[]` | Tickets with `ship` job `COMPLETED` on that day. |
| `days[].intensity` | `0\|1\|2\|3\|4` | Derived from `jobCount` + `intensityThresholds`. |
| `totals.jobs` | `number` | `sum(days[].jobCount)`. |
| `totals.ticketsShipped` | `number` | `sum(days[].shippedTickets.length)`. |
| `availableAgents[]` | `HeatmapAgentOption[]` | Computed from UNFILTERED dataset so options survive when user narrows. |
| `availableAgents[].value` | `Agent` | No `'all'` entry — that's implicit in the UI. |
| `availableAgents[].label` | `string` | From `getAgentLabel`. |
| `availableAgents[].jobCount` | `number` | Effective-agent job count in the period. |
| `accountCreatedYear` | `number` | Lower bound for the period-selector dropdown (FR-015). |
| `generatedAt` | `string` | ISO timestamp; not rendered. |

---

## Error responses

All errors follow `{ error: string, code?: string }` per Constitution §Error Handling.

| Status | Condition | Body |
|---|---|---|
| `400 Bad Request` | Invalid `agent` enum value | `{ "error": "Invalid heatmap filters" }` |
| `401 Unauthorized` | No session and no valid PAT | `{ "error": "Unauthorized" }` |
| `500 Internal Server Error` | Unhandled exception; also logged via `console.error` | `{ "error": "Internal server error" }` |

Note: There is no 403 or 404 case — the endpoint is user-scoped, so auth failure = 401 and missing data = empty `days` array with `totals: { jobs: 0, ticketsShipped: 0 }`.

---

## Caching / headers

- `export const dynamic = 'force-dynamic'` at the route module scope (mirrors analytics route). Forbids Next's static cache.
- `export const revalidate = 0`.
- Cache-Control header explicitly `no-store` on the response (do not leak one user's aggregation to another).

---

## Client contract: `fetchActivityHeatmap(filters)`

Defined in `hooks/use-activity-heatmap.ts`:

```ts
async function fetchActivityHeatmap(filters: HeatmapFilters): Promise<HeatmapData> {
  const params = new URLSearchParams();
  if (filters.period.kind === 'year') params.set('period', String(filters.period.year));
  else if (filters.period.months !== 12) /* future-proof */ params.set('period', '12m');
  // 'all' is the default — omit from URL to keep it clean
  if (filters.agent !== 'all') params.set('agent', filters.agent);

  const qs = params.toString();
  const res = await fetch(`/api/projects/activity-heatmap${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch heatmap');
  return res.json();
}
```

- Omits `period=12m` and `agent=all` from the URL (defaults) so shared/bookmarked URLs stay minimal when the user hasn't customized anything. This is the same behavior the client uses when mirroring to the page URL via `router.push`.
- Response is expected to conform exactly to the 200 schema above; any deviation is a server bug.

---

## Server contract: `getHeatmapInitialData(userId, filters)`

Defined in `lib/heatmap/queries.ts`; consumed by `app/projects/page.tsx` (Server Component) to hydrate the client on first paint.

Same return shape as the GET endpoint. Implementation MUST:
- Accept a `userId` (resolved by `requireAuth` in the server component).
- Accept a validated `HeatmapFilters` object.
- Execute the three Prisma reads in parallel with `Promise.all`.
- Never throw for empty result sets — return the zero-state shape (full grid of empty days, `totals: {jobs: 0, ticketsShipped: 0}`, `availableAgents: []`).
- Throw only for real infrastructure errors (DB unreachable, etc.), which bubble up to the Server Component's error boundary.

---

## Contract tests (integration)

Located at `tests/integration/heatmap/heatmap-route.test.ts`. Each test seeds minimal fixtures via the Prisma test helper and asserts the response shape.

| Test | Assertion |
|---|---|
| Unauthenticated request | 401 `{ error: 'Unauthorized' }` |
| Invalid `agent=foo` | 400 `{ error: 'Invalid heatmap filters' }` |
| Invalid `period=abc` | 200, filters echoed as `{ kind: 'rolling', months: 12 }` |
| Invalid `period=1999` (user joined 2024) | 200, filters echoed as `{ kind: 'rolling', months: 12 }` |
| No activity at all | 200, `days[].every(d => d.jobCount === 0)`, `totals.jobs === 0`, `availableAgents === []` |
| Owner-OR-member scope | Seeds owner project + member project + third-party project; counts ONLY from the first two. |
| Ship detection | Ticket with stage=SHIP but no ship job → `shippedTickets === []`. Ticket with completed ship job → appears exactly once on the completion date. |
| Cost null handling | Day with 3 jobs, 0 have `costUsd` → `hasAnyCost === false`, `sumCostUsd === 0`. Day with 2 of 3 having `costUsd` → `hasAnyCost === true`, `sumCostUsd` = sum of the 2. |
| Effective agent filter | Ticket with `agent=null` on project with `defaultAgent=CODEX` is INCLUDED when `agent=CODEX` filter applied. |
| Future-dated job | Job with `startedAt > today` → NOT counted. `period.endDate <= today`. |
| Intensity thresholds | Given a deterministic distribution, verify computed `t1..t4` match percentile-derived values. |

See `tests/integration/analytics/analytics-route.test.ts` for the exact seeding helper pattern to follow.
