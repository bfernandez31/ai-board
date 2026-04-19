# Data Model: Activity Heatmap (AIB-690)

**Feature Branch**: `AIB-690-activity-heatmap-on`
**Date**: 2026-04-19

## Overview

All heatmap entities are **derived views** over existing Prisma tables (`Job`, `Ticket`, `Project`, `ProjectMember`, `User`). No new tables, no migrations — FR-026 and SC-008. This document defines the TypeScript shapes that flow between server and client.

## Source Tables (read-only)

Referenced from `prisma/schema.prisma` — **no changes**:

- `Project.userId` (owner), `Project.members[]` (members), `Project.defaultAgent` (effective-agent fallback).
- `Ticket.projectId`, `Ticket.agent` (nullable; resolved via `project.defaultAgent`).
- `Job.projectId`, `Job.ticketId`, `Job.command`, `Job.status`, `Job.completedAt`, `Job.costUsd`.
- `JobStatus` enum: `PENDING | RUNNING | COMPLETED | FAILED | CANCELLED`. Heatmap counts jobs whose `completedAt` is non-null within the period (any status that reached a terminal state, including `FAILED` / `CANCELLED`, because the spec counts "activity", not "successful activity"). **Ship counting** is the exception: a job contributes to the "tickets shipped" figure only if `command='ship'` AND `status='COMPLETED'`.
- `Agent` enum: `CLAUDE | CODEX | MISTRAL | GEMINI`.

## Derived Entities

### HeatmapPeriod

The selected time window. Exactly one of:

```ts
type HeatmapPeriod =
  | { kind: 'rolling12m'; endDate: string }           // ISO YYYY-MM-DD (today in UTC)
  | { kind: 'year'; year: number };                    // e.g. 2025
```

**Validation**:
- `rolling12m` is the default. Its implied start is `endDate - 364 days` (inclusive, so exactly 365 days visible).
- `year` must be in `[accountCreationYear, currentYear]`. Values outside this range are coerced to the default `rolling12m` (FR-011, FR-012, spec edge case "Invalid query params").
- Derived period boundaries (`startDate`, `endDate`) are always inclusive ISO calendar dates in UTC.

### HeatmapFilters

```ts
interface HeatmapFilters {
  period: HeatmapPeriod;
  agent: AgentFilter;  // 'all' | 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI' — reuse from lib/analytics/types.ts
}
```

**Defaults**: `{ period: { kind: 'rolling12m', endDate: today }, agent: 'all' }`.

**URL encoding**: Serialized as `heatmapPeriod=last12months|YYYY` and `heatmapAgent=all|<Agent>`. Keys are **omitted** from the URL when the value equals the default (FR-016).

### DailyCell

One cell of the grid. One per calendar date within the period boundaries, inclusive.

```ts
interface DailyCell {
  date: string;              // 'YYYY-MM-DD' (UTC calendar date)
  jobCount: number;          // jobs with completedAt on this date, post-filter
  shipJobCount: number;      // jobs where command='ship' AND status='COMPLETED'
  shippedTicketCount: number;// distinct ticketIds contributing shipJobCount on this date
  totalCostUsd: number | null;// sum of costUsd for contributing jobs; null if ANY contributing job has costUsd=null
  bucket: 0 | 1 | 2 | 3 | 4; // intensity level (0 = no activity, 4 = deepest)
}
```

**Validation**:
- `jobCount >= 0`, `shipJobCount >= 0`, `shippedTicketCount >= 0`.
- `shipJobCount <= jobCount` (ship jobs are a subset of all jobs).
- `shippedTicketCount <= shipJobCount` (distinct tickets cannot exceed their ship-job total).
- `totalCostUsd` is `null` (not `0`) when any contributing job lacks cost (FR-018). When all contributing jobs have cost, the value is rounded to 2 decimals.
- `bucket === 0` iff `jobCount === 0`. When `jobCount > 0`, `bucket >= 1`.

**State transitions**: None — entities are ephemeral per request.

### HeatmapSummary

Header figures for the period, after filter application.

```ts
interface HeatmapSummary {
  totalJobs: number;           // FR-009: X in "X jobs · Y tickets shipped"
  distinctShippedTickets: number; // FR-009: Y; distinct ticketIds with any completed ship job in the period
  periodLabel: string;         // 'in the last year' | 'in 2025' (human-readable)
}
```

**Validation**: `totalJobs >= 0`, `distinctShippedTickets >= 0`. `periodLabel` is always populated, never empty.

### BucketThresholds

Quantile-derived thresholds used to color cells. Emitted for transparency and for client-side legend rendering.

```ts
interface BucketThresholds {
  // Job-count thresholds at 25/50/75 percentiles of non-zero days.
  // A cell with jobCount = n goes to bucket:
  //   0 if n === 0
  //   1 if n <= p25
  //   2 if n <= p50
  //   3 if n <= p75
  //   4 otherwise
  p25: number;
  p50: number;
  p75: number;
  maxJobCount: number;     // max over all days in the period
}
```

**Edge cases**:
- When there are zero non-zero days → thresholds default to `{ p25: 0, p50: 0, p75: 0, maxJobCount: 0 }` and every cell is bucket 0.
- When all non-zero days share the same count → `p25 = p50 = p75 = that count`; by bucketing rule, every non-zero day falls in bucket 1 (guaranteeing "bucket 1 is never empty when any jobs exist that day" — spec reviewer note).

### AgentOption

Reuse the existing `AgentOption` type from `lib/analytics/types.ts`:

```ts
interface AgentOption {
  value: AgentFilter;
  label: string;
  jobCount: number;
  isDefault: boolean;
}
```

For heatmap: only emit agent options with `jobCount > 0` after the user-accessible project scope is applied, plus the always-included `"All agents"` option (FR-013, FR-014). Filter is hidden client-side when the list has fewer than 2 non-"All" entries.

### HeatmapData (API response envelope)

```ts
interface HeatmapData {
  period: { kind: 'rolling12m' | 'year'; startDate: string; endDate: string; year?: number };
  filters: HeatmapFilters;
  cells: DailyCell[];              // one per calendar day, sorted by date ascending
  summary: HeatmapSummary;
  thresholds: BucketThresholds;
  availableAgents: AgentOption[];  // includes 'all' sentinel
  availableYears: number[];        // from accountCreationYear to currentYear, inclusive, descending
  generatedAt: string;             // ISO timestamp
}
```

**Validation**:
- `cells.length === daysBetween(period.startDate, period.endDate) + 1`.
- `cells` are strictly ordered by date, no duplicates, no gaps.
- `availableYears` is `[]` when the user's account is younger than 1 full calendar year AND was created in the current year (spec edge case line 100); client hides the year selector in that case.
- `period.year` is present iff `period.kind === 'year'`.

## Relationships

```
User (signed-in)
  └─ owns or is member of ─ Project (many)
        └─ has ─ Ticket (many)
              └─ has ─ Job (many)
                    └─ contributes to ─ DailyCell (one per completedAt calendar day)
```

- Access filter: `Project.userId = currentUserId OR ProjectMember.userId = currentUserId`.
- Agent filter (effective): `Ticket.agent = filterAgent OR (Ticket.agent IS NULL AND Project.defaultAgent = filterAgent)`.
- Cell aggregation key: `DATE(Job.completedAt AT TIME ZONE 'UTC')`.
- Ship-ticket counting (summary): `COUNT(DISTINCT Ticket.id WHERE EXISTS (Job.ticketId = Ticket.id AND Job.command = 'ship' AND Job.status = 'COMPLETED' AND Job.completedAt BETWEEN start AND end))`.
- Ship-job counting (per-day cell): `COUNT(Job.id WHERE Job.command = 'ship' AND Job.status = 'COMPLETED' AND DATE(Job.completedAt) = cell.date)`.

## Derivation Algorithm (server)

Inputs: `userId`, `period`, `agent`.

1. Resolve `accessibleProjectIds`: `prisma.project.findMany({ where: { OR: [{userId}, {members: {some: {userId}}}] }, select: { id: true } })`.
2. Resolve `accountCreationYear`: `prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } })`.
3. Compute `startDate`, `endDate` from `period` (UTC calendar dates). Guard: coerce invalid year to `rolling12m`.
4. Build WHERE clauses:
   - Job: `{ projectId: { in: accessibleProjectIds }, completedAt: { gte: startDate, lte: endDate }, ticket: { is: effectiveAgentWhere(agent) ?? {} } }`.
   - Ticket (for ship-summary): same effective-agent WHERE, plus `jobs: { some: { command: 'ship', status: COMPLETED, completedAt: { gte, lte } } }`.
5. Query jobs: `prisma.job.findMany({ where: jobWhere, select: { completedAt: true, command: true, status: true, costUsd: true, ticketId: true } })`.
6. Query distinct shipped ticket count: `prisma.ticket.count({ where: ticketWhereWithShipJobExists })`.
7. Group jobs by `formatUTCDate(completedAt)` → map of date → `{jobs[], shipJobs[], tickets:Set}`.
8. For each day in `[startDate, endDate]`, build `DailyCell`: `jobCount`, `shipJobCount`, `shippedTicketCount = distinct size of ticket ids among shipJobs`, `totalCostUsd = null if any job.costUsd === null else sum rounded to 2dp`.
9. Compute `BucketThresholds` via quantiles over `cells.filter(c => c.jobCount > 0).map(c => c.jobCount)`.
10. Assign `bucket` to each cell using thresholds.
11. Compute `summary`: `totalJobs = cells.reduce(sum)`, `distinctShippedTickets = step 6 result`, `periodLabel` from period.
12. Compute `availableAgents` (adapted `getAvailableAgents` scoped to `accessibleProjectIds`).
13. Compute `availableYears`: `[accountCreationYear..currentYear]` in descending order.
14. Return envelope.

## State Transitions

No entity has state. Heatmap views are request-scoped. Client state (current filters, tooltip open/close) is UI ephemera, not persisted.

## Non-goals (explicit)

- No persistence layer. No Prisma model addition.
- No cache layer (Redis / in-memory). Rely on TanStack Query cache client-side and fresh DB reads server-side. Typical payload: ~370 cells × ~80 bytes ≈ 30 KB ungzipped.
- No cross-day aggregation beyond per-day counts (no weekly/monthly rollups).
- No per-project breakdown in the cell payload (the feature is deliberately a single aggregated view).
