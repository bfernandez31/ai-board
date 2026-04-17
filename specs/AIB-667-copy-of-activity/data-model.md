# Data Model: Activity Heatmap

**Feature**: AIB-667
**Constraint** (FR-028, SC-010): ZERO schema changes. No new tables, columns, indexes, or enums. This document describes the **derived** shapes used at runtime only.

## Existing Prisma Entities Consumed

All reads are against models already defined in `prisma/schema.prisma`:

### `Job` (lines 29-68)
Relevant fields used by the heatmap:
- `id: Int`
- `ticketId: Int` — joins to `Ticket`
- `projectId: Int` — used for scoping + index `@@index([projectId])`
- `command: String` — filter for `'ship'` when counting shipped tickets
- `status: JobStatus` — filter for `COMPLETED` to count successful work
- `completedAt: DateTime?` — day bucket source; null jobs are excluded from cells and counter
- `costUsd: Float?` — null-safe sum for tooltip cost line

Existing `@@index([startedAt])` and `@@index([projectId])` cover the primary query paths. `completedAt` is not indexed alone, but the compound filter `projectId IN (...) AND completedAt >= :from` falls back to the project index followed by an in-memory filter — acceptable at current scale (thousands of jobs per viewer, not millions).

### `Ticket` (lines 125-159)
Relevant fields:
- `id: Int`
- `projectId: Int`
- `agent: Agent?` — explicit ticket agent; null means "inherit project default"
- `stage: Stage` — informational only; ship counting uses the Job model

### `Project` (lines 70-99)
Relevant fields:
- `id: Int`
- `userId: String` — owner scoping
- `defaultAgent: Agent` — inherited when `Ticket.agent IS NULL`
- Relation `members: ProjectMember[]` — member scoping

### `ProjectMember` (lines 101+)
Used to expand scope from owned → accessible projects.

### `User` (lines 161-183)
- `createdAt: DateTime` — bounds the year selector's lowest year.

## Runtime (Non-Persisted) Types

Defined in `lib/activity/heatmap-types.ts`.

### `HeatmapFilters`
```ts
export type HeatmapYearSelection = 'last-12-months' | `${number}`; // "2024", "2025", etc.
export type HeatmapAgentFilter = 'all' | Agent;                    // Agent from @prisma/client

export interface HeatmapFilters {
  year: HeatmapYearSelection;
  agent: HeatmapAgentFilter;
  /** IANA timezone supplied by the client. Falls back to 'UTC' server-side if absent/invalid. */
  timezone: string;
}
```

### `HeatmapDay`
One cell's worth of data.
```ts
export interface HeatmapDay {
  /** YYYY-MM-DD in the viewer's local timezone */
  date: string;
  /** Count of COMPLETED or FAILED jobs (any command) whose completedAt falls in this day */
  jobCount: number;
  /** Count of distinct tickets whose `command=ship` job COMPLETED on this day */
  ticketsShipped: number;
  /** Intensity level 0..4 derived from jobCount via getIntensityLevel() */
  intensity: 0 | 1 | 2 | 3 | 4;
  /** Present only when at least one job on this day had a non-null costUsd */
  totalCostUsd?: number;
}
```
**Validation**:
- `jobCount >= 0`, `ticketsShipped >= 0`, `ticketsShipped <= jobCount + (manual-ship safety — see below)`.
  - Exception: a ticket can be shipped by one project but the ship job itself still contributes to `jobCount`, so the invariant holds in practice.
- `totalCostUsd` MUST be absent (not `0`, not `null`) when no jobs on that day had cost data — the DTO distinguishes "no cost data" from "cost was zero". Enforced by unit test.

### `HeatmapGridRange`
Precomputed range used for grid rendering.
```ts
export interface HeatmapGridRange {
  /** YYYY-MM-DD of first day included in the selected period (viewer tz) */
  startDate: string;
  /** YYYY-MM-DD of last day included in the selected period (viewer tz) */
  endDate: string;
  /** Week boundary: start of the first rendered column (Sunday on/before startDate) */
  gridStart: string;
  /** Week boundary: end of the last rendered column (Saturday on/after endDate) */
  gridEnd: string;
}
```
Chipped-corner cells are cells where `gridStart <= date < startDate` or `endDate < date <= gridEnd`. These cells are NOT rendered (FR-006).

### `HeatmapAgentOption`
```ts
export interface HeatmapAgentOption {
  value: HeatmapAgentFilter;     // 'all' | Agent
  label: string;                 // 'All agents' | 'Claude' | etc. (from agent-resolution.ts)
  historicalJobCount: number;    // Jobs over full account history, not filtered period
}
```
**Visibility rule** (FR-017): Include the agent filter UI only when `options.filter(o => o.value !== 'all' && o.historicalJobCount > 0).length >= 2`.

### `HeatmapYearOption`
```ts
export interface HeatmapYearOption {
  value: HeatmapYearSelection;
  label: string;              // 'Last 12 months' | '2026' | '2025' | …
  isDefault: boolean;
}
```
Derived from `user.createdAt`: one option per calendar year from `createdAt.year` to current year (inclusive), plus `'Last 12 months'` first.

### `HeatmapResponse` (API DTO)
```ts
export interface HeatmapResponse {
  filters: HeatmapFilters;
  range: HeatmapGridRange;
  days: HeatmapDay[];             // sorted ascending by date; contiguous from startDate..endDate
  counters: {
    totalJobs: number;            // sum of days[].jobCount (respects active filters)
    ticketsShipped: number;       // sum of days[].ticketsShipped
    periodLabel: string;          // 'in the last year' | 'in 2025' — for counter copy
  };
  agentOptions: HeatmapAgentOption[];   // derived from FULL history (see FR-017)
  yearOptions: HeatmapYearOption[];     // derived from user.createdAt
  generatedAt: string;            // ISO timestamp
}
```

## Relationships (Query Shape)

The single canonical query, simplified:

```
Projects accessible to viewer
  = Project WHERE userId = :viewerId OR members.some(userId = :viewerId)

Tickets in scope
  = Ticket WHERE projectId IN accessibleProjectIds
          AND (
            :agent = 'all'
            OR agent = :agent
            OR (agent IS NULL AND project.defaultAgent = :agent)
          )

Jobs for cells
  = Job WHERE ticketId IN scopedTicketIds
          AND status IN (COMPLETED, FAILED)
          AND completedAt >= :rangeStart
          AND completedAt <  :rangeEndExclusive

Ship jobs for counter
  = subset WHERE command = 'ship' AND status = COMPLETED
```

The bucketing step (pure TypeScript) converts `completedAt` into the viewer-local `YYYY-MM-DD` key and aggregates per day.

## State Transitions

N/A — this is a read-only view. No entity changes state as a result of rendering the heatmap.

## Validation Rules Summary

| Rule | Source | Location of enforcement |
|---|---|---|
| `timezone` must be a valid IANA string; else fall back to UTC | FR-029 + defensive | Zod schema in API route; server uses `try { Intl.DateTimeFormat([], { timeZone }) } catch { tz = 'UTC' }` |
| `year` ∈ `{last-12-months} ∪ {accountCreationYear..currentYear}` | FR-012, FR-013 | Zod `.refine()` against computed option set |
| `agent` ∈ `{all, CLAUDE, CODEX, MISTRAL, GEMINI}` | Reuse `AGENT_FILTER_VALUES` | Zod `z.enum` |
| Tooltip cost line omitted when no job had cost data | FR-015, SC-008 | Bucketing function — `totalCostUsd` is optional, never zero-filled |
| Cells before startDate / after endDate not rendered | FR-006, SC-009 | `buildGridSkeleton` emits `null` for chipped corner slots |
| No new DB writes anywhere in the flow | FR-028, SC-010 | API route contains zero `prisma.*.create/update/delete` calls — enforced by code review + absence test |
