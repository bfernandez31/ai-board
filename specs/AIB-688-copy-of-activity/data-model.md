# Data Model: Activity Heatmap on Projects Page (AIB-688)

**No new database models.** Per FR-022, all data is derived from existing Prisma
models. This file documents (a) the existing entities we read from, (b) the in-
memory payload shape the server assembles and the client consumes, and (c) the
derivation rules that transform (a) into (b).

## Source entities (existing, `prisma/schema.prisma`)

### `User`
- `id: Int` — authenticated subject; drives scope.
- `createdAt: DateTime` — drives the year-selector lower bound (FR-009).

### `Project`
- `id: Int`, `userId: Int` (owner), `defaultAgent: Agent`
- `members: ProjectMember[]` — `{ userId, projectId }`; member access.
- Heatmap scope: `project.userId = currentUserId OR project.members.some(userId = currentUserId)`
  (matches `lib/db/projects.ts:31-37`).

### `Ticket`
- `id: Int`, `ticketKey: String`, `title: String`
- `projectId: Int`, `project.defaultAgent` (join)
- `agent: Agent | null` — explicit override; effective agent = `agent ?? project.defaultAgent`

### `Job`
- `id: Int`, `ticketId: Int`
- `command: String` — heatmap cares about any command for intensity; only `'ship'`
  contributes to shipped tickets (FR-008).
- `status: JobStatus` — enum: `PENDING | RUNNING | COMPLETED | FAILED | CANCELLED`.
  "Shipped" requires `COMPLETED`.
- `completedAt: DateTime | null` — drives day bucket; jobs without `completedAt`
  are excluded from all aggregates (they haven't happened yet from the user's
  perspective).
- `costUsd: Float | null` — summed per day; nulls excluded from the sum; a day
  whose total has zero non-null contributions has `totalCost: null` (FR-010).

### `Agent` (enum)
- `CLAUDE | CODEX | MISTRAL | GEMINI` (see `app/lib/utils/agent-resolution.ts:3`)

---

## Derived payload (server → client)

```ts
// lib/analytics/heatmap-types.ts

export type HeatmapPeriod =
  | { kind: 'last-12-months' }
  | { kind: 'calendar-year'; year: number };

export type HeatmapAgentFilter = 'all' | 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI';

export interface HeatmapFilters {
  period: HeatmapPeriod;
  agent: HeatmapAgentFilter;
  /** IANA tz (e.g. 'America/New_York'). Server validates; falls back to 'UTC'. */
  timezone: string;
}

export interface HeatmapShippedTicket {
  ticketKey: string;   // e.g. 'AIB-123'
  title: string;
}

export interface HeatmapDay {
  /** 'YYYY-MM-DD' in the requested timezone. */
  date: string;
  /** Count of Jobs whose completedAt bucket is this day, in scope. */
  jobCount: number;
  /** Sum of non-null costUsd; null if no job that day had a recorded cost. */
  totalCost: number | null;
  /** Tickets whose ship-job (command='ship', status=COMPLETED) completed this day. */
  shippedTickets: HeatmapShippedTicket[];
  /** Precomputed intensity level 0..4. */
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapTotals {
  jobs: number;              // Σ jobCount across the period
  shippedTickets: number;    // distinct count across the period
}

export interface HeatmapIntensityThresholds {
  /** Quartile cut-offs over non-zero jobCount values; ascending. */
  t1: number; t2: number; t3: number; t4: number;
}

export interface HeatmapMeta {
  /** ISO date (tz-local) of the first day rendered in the grid. */
  rangeStart: string;
  /** ISO date (tz-local) of the last day rendered in the grid. */
  rangeEnd: string;
  /** Label: "Last 12 months" or "2025". */
  label: string;
}

export interface HeatmapPayload {
  filters: HeatmapFilters;
  meta: HeatmapMeta;
  days: HeatmapDay[];                      // Length = (rangeEnd - rangeStart + 1)
  totals: HeatmapTotals;
  thresholds: HeatmapIntensityThresholds;
  /** Distinct effective-agent set over in-scope tickets (for filter visibility). */
  distinctAgents: Agent[];
  /** Calendar years available for the period selector. */
  availableYears: number[];
}
```

---

## Derivation rules

### R1. Accessible project IDs
```
accessibleProjectIds =
  SELECT id FROM Project
  WHERE userId = :currentUserId
     OR EXISTS (SELECT 1 FROM ProjectMember
                WHERE projectId = Project.id AND userId = :currentUserId)
```
Matches `lib/db/projects.ts:31-37`. Required for every aggregate.

### R2. Period → date range (in timezone)
- `last-12-months`: `[ today - 364 days, today ]` in `filters.timezone`.
- `calendar-year: Y`: `[ Y-01-01, Y-12-31 ]` in `filters.timezone`, but clamped
  to `today` if `Y` is the current year (empty cells rendered for future days,
  per the spec's Auto-Resolved Decision on trailing edge).
- Grid always covers full weeks (Sunday-anchored). Days outside the period
  produce "chipped" corners on the client; the server returns only in-period
  days in `days[]`.

### R3. Day bucketing
- `bucketKey(job) = format(job.completedAt, 'yyyy-MM-dd', filters.timezone)`
- Server computes via `Intl.DateTimeFormat(timezone, { timeZone, year, month, day })`
  (no new dependencies).

### R4. Job aggregation
```
FOR each Job j WHERE
      j.ticket.projectId IN :accessibleProjectIds
  AND j.completedAt BETWEEN :rangeStart AND :rangeEnd
  AND (agent filter, §R6)
GROUP BY bucketKey(j):
  jobCount    = COUNT(*)
  totalCost   = SUM(j.costUsd WHERE j.costUsd IS NOT NULL)
                -- null if all contributions are null (distinct from 0.0)
```
Days with no jobs do NOT appear in this groupBy result; the server backfills
zero-count days when building `days[]`.

### R5. Shipped-ticket aggregation
```
FOR each Job j WHERE
      j.ticket.projectId IN :accessibleProjectIds
  AND j.command = 'ship'
  AND j.status  = 'COMPLETED'
  AND j.completedAt BETWEEN :rangeStart AND :rangeEnd
  AND (agent filter on j.ticket, §R6)
GROUP BY bucketKey(j), j.ticketId:
  shippedTickets[bucketKey].push({ ticketKey, title })  -- distinct per day
```
`totals.shippedTickets = distinct ticketId across the whole period`.

### R6. Agent filter (effective)
- `agent = 'all'`: no filter.
- `agent = A`: `j.ticket.agent = A OR (j.ticket.agent IS NULL AND j.ticket.project.defaultAgent = A)`
- Pattern copied verbatim from `lib/analytics/queries.ts:51-69` (research §P1).

### R7. Intensity bucketing (quartile)
```
nonZero = sorted(ascending) jobCount values > 0 across rendered days
if nonZero is empty:      thresholds = {t1:1, t2:2, t3:3, t4:4}  (inert)
else:
  t1 = quantile(nonZero, 0.25) ceil to Int, min 1
  t2 = quantile(nonZero, 0.50) ceil to Int, min t1+1
  t3 = quantile(nonZero, 0.75) ceil to Int, min t2+1
  t4 = max(nonZero)            ceil to Int, min t3+1

level(count) =
  count == 0 -> 0
  count <= t1 -> 1
  count <= t2 -> 2
  count <= t3 -> 3
  else        -> 4
```
Server sets `HeatmapDay.level` so client renders cell colours without recomputing.

### R8. Distinct agent set (filter visibility)
```
distinctAgents =
  DISTINCT effectiveAgent(t) FOR t IN Ticket
  WHERE t.projectId IN :accessibleProjectIds
    AND EXISTS Job j of t with completedAt BETWEEN :rangeStart AND :rangeEnd
```
Computed **without** applying the agent filter itself (the filter depends on
this set). If `|distinctAgents| < 2`, the client hides the filter entirely.

### R9. Available years
```
availableYears =
  [ currentYear, currentYear-1, ..., year(User.createdAt) ]
  -- descending, inclusive both ends
  -- if User.createdAt is in the current calendar year, list contains only currentYear
  -- (the client then hides/disables the year group — FR-009)
```

### R10. Totals
- `totals.jobs = Σ days[i].jobCount`
- `totals.shippedTickets = distinct ticketId count across all days[i].shippedTickets`
- Matched to the header counter: `"{jobs} jobs · {shippedTickets} tickets shipped in {label}"`.

### R11. Empty-state determination (client responsibility)
- The empty-state message ("No activity to show yet…") replaces the grid when
  `totals.jobs === 0`. The legend and filters remain visible (FR-019).

---

## Validation rules

- `HeatmapAgentFilter` MUST be one of `'all' | ALL_AGENTS[*]`. Validated via Zod
  (`z.enum(['all', 'CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI'])`) — matches
  `app/lib/utils/agent-resolution.ts:3`.
- `HeatmapPeriod`: URL-wire form is `period = 'last-12-months'` OR a 4-digit year
  string. Year is validated as an integer between `year(User.createdAt)` and
  `currentYear` inclusive. Values outside that range silently coerce to default.
- `timezone`: validated against `Intl.supportedValuesOf('timeZone')` when
  available; invalid values silently coerce to `'UTC'`.
- No field in the payload is user-supplied write data; no Prisma column
  constraints apply.

## State transitions

None — the heatmap is read-only.

## Concurrency

None — read-only endpoint, no mutations, no locks required.
