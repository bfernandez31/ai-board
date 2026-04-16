# Data Model: Activity Heatmap (AIB-664)

No database schema changes. The feature computes **derived, non-persisted** aggregates from existing Prisma models. This file documents the read model, the in-memory aggregates, and the wire types.

## Underlying Prisma Models (read-only, unchanged)

### `Job` (source of daily counts, cost, and ship detection)
| Field | Type | Heatmap Use |
|---|---|---|
| `id` | Int | identity |
| `ticketId` | Int | join to `Ticket` for agent / project |
| `projectId` | Int | scoping filter (user's accessible projects) |
| `command` | String (VarChar 50) | `'ship'` identifies shipped-ticket contributions |
| `status` | JobStatus enum | must be `COMPLETED` for ship counting; any terminal status for job count? **See Validation Rules**. |
| `completedAt` | DateTime? | bucket date; `NULL` jobs (never-completed) are excluded |
| `costUsd` | Float? | summed per day; `NULL` means "no cost recorded for this job" |

### `Ticket` (effective agent source)
| Field | Type | Heatmap Use |
|---|---|---|
| `id` | Int | identity (used for DISTINCT ship-count) |
| `projectId` | Int | join to `Project.defaultAgent` |
| `agent` | Agent? | explicit agent; if `NULL`, fall back to `project.defaultAgent` |

### `Project` (default-agent and access scope)
| Field | Type | Heatmap Use |
|---|---|---|
| `id` | Int | identity |
| `userId` | String | owner match |
| `members` | ProjectMember[] | member match |
| `defaultAgent` | Agent enum | effective-agent fallback |

### `ProjectMember`
| Field | Type | Heatmap Use |
|---|---|---|
| `projectId` | Int | scope |
| `userId` | String | scope |

### `User`
| Field | Type | Heatmap Use |
|---|---|---|
| `id` | String | auth principal |
| `createdAt` | DateTime | lowest bound of the period selector (FR-007) |

## Derived Read Types (TypeScript)

Declared in `lib/heatmap/types.ts`. These are the contract both the query layer and the client component consume.

```ts
import type { Agent } from '@prisma/client';

/**
 * Period selector value. "last-12-months" is the rolling default;
 * a 4-digit year string (e.g. "2025") selects that calendar year.
 */
export type HeatmapPeriod = 'last-12-months' | `${number}`;

export type HeatmapAgentFilter = 'all' | Agent; // 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI' | 'all'

export interface HeatmapFilters {
  period: HeatmapPeriod;
  agent: HeatmapAgentFilter;
}

/**
 * A single day cell in the heatmap payload. The array in HeatmapData
 * contains one entry per day in the selected period's [firstSunday, lastSaturday]
 * window, including out-of-period leading/trailing days (flagged via inPeriod=false)
 * so the client can render chipped corners without re-deriving dates.
 */
export interface HeatmapDayCell {
  /** ISO date (YYYY-MM-DD), the calendar date for this cell */
  date: string;
  /** false for leading/trailing cells outside the selected period's first/last week */
  inPeriod: boolean;
  /** count of terminal-status jobs completed on this date (COMPLETED + FAILED) */
  jobCount: number;
  /** distinct tickets whose 'ship' job COMPLETED on this date */
  shippedTicketCount: number;
  /** sum of non-null Job.costUsd for the day; null iff no job had a recorded cost */
  totalCost: number | null;
  /** intensity bucket: 0 (empty) … 4 (max) derived from computeIntensityThresholds */
  intensityLevel: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapAgentOption {
  value: Agent;
  label: string;      // from AGENT_LABELS
  jobCount: number;   // over the unfiltered period
}

export interface HeatmapPeriodOption {
  value: HeatmapPeriod;
  label: string;      // "Last 12 months" or "2024"
  isDefault: boolean; // true for 'last-12-months'
}

export interface HeatmapData {
  filters: HeatmapFilters;              // echoed, post-normalization
  periodOptions: HeatmapPeriodOption[]; // ≥1; omits years before user.createdAt
  availableAgents: HeatmapAgentOption[];// only agents with ≥1 job in unfiltered period; [] ⇒ hide filter
  days: HeatmapDayCell[];               // contiguous Sunday…Saturday window covering period
  /** Header totals, already respecting the active agent filter */
  totals: {
    jobCount: number;
    shippedTicketCount: number;
  };
  /** Intensity bucket upper bounds: thresholds[i] is max jobCount for level i+1 (non-zero levels) */
  intensityThresholds: [number, number, number, number];
  /** Server clock at generation (for debugging / testing determinism) */
  generatedAt: string; // ISO
}
```

## Validation Rules

1. **Access scope (FR-019)**: `Job.projectId IN getAccessibleProjectIdsForUser(userId)`. No other filter may widen this; 100% of returned `jobCount` MUST be attributable to jobs on projects the user owns or is a member of.

2. **Job counting (FR-002, FR-006)**: A job contributes to a day's `jobCount` iff
   - `status IN (COMPLETED, FAILED)` AND
   - `completedAt IS NOT NULL` AND
   - `completedAt` falls within the selected period (inclusive both sides) AND
   - after agent-filter application (see rule 4).

3. **Shipped-ticket counting (FR-020, SC-003)**: A ticket `T` contributes `1` to `shippedTicketCount` on date `D` iff there exists a `Job J` with
   - `J.ticketId = T.id` AND
   - `J.command = 'ship'` AND
   - `J.status = COMPLETED` AND
   - `date(J.completedAt) = D` AND
   - `T.projectId` is in the user's accessible project ids AND
   - after agent-filter application.
   - DISTINCT on `ticketId`: if the same ticket is re-shipped on the same day, count once.

4. **Agent filter (FR-009, FR-010)**: When `agent !== 'all'`, a job is retained iff `resolveEffectiveAgent(ticket.agent, ticket.project.defaultAgent) === filters.agent`. Grid boundaries (the `days[]` array) MUST remain identical to the unfiltered call — only `jobCount`, `shippedTicketCount`, `totalCost`, `intensityLevel`, and `totals` change.

5. **Cost null-safety (FR-012, SC-006)**: For a day, `totalCost = null` iff every qualifying job has `costUsd IS NULL`. Otherwise `totalCost = SUM(costUsd WHERE costUsd IS NOT NULL)`. Clients MUST NOT render `$NaN` or `$0` fallbacks.

6. **Period bounds (FR-003)**:
   - `period = 'last-12-months'`: range is `[today - 365 days, today]`, inclusive. Grid window extends back to the Sunday of the start-week and forward to the Saturday of the end-week.
   - `period = '<YYYY>'`: range is `[YYYY-01-01 00:00, YYYY-12-31 23:59:59]`. Same Sunday…Saturday window padding.
   - Leap years (e.g. 2024): 366 days in `inPeriod=true` cells.

7. **Period options (FR-007)**:
   - Always include `{ value: 'last-12-months', isDefault: true }`.
   - For each year `Y` where `user.createdAt.getFullYear() ≤ Y ≤ currentYear`, include `{ value: String(Y), isDefault: false }`, ordered **descending**.
   - If `user.createdAt.getFullYear() === currentYear`, the output contains **only** the default option.

8. **Available agents (FR-008, US3 scenarios 1–2)**:
   - Computed from the **unfiltered** dataset (ignoring `filters.agent`).
   - Include only agents with `jobCount ≥ 1` in the period.
   - Sort by descending `jobCount` (tie-break alphabetical by `value`).
   - Return `[]` when 0 or 1 distinct agents exist — the client hides the filter entirely in that case.

9. **Intensity thresholds**:
   - Given `nonZeroCounts = sort(days.filter(d => d.inPeriod && d.jobCount > 0).map(d => d.jobCount))`:
     - If `nonZeroCounts.length === 0`: `thresholds = [0, 0, 0, 0]`, all cells at level 0 (empty state).
     - Otherwise, compute 4 quartile upper-bound thresholds: `Q1, Q2, Q3, max`.
     - A day's `intensityLevel` is:
       - `0` if `jobCount === 0`
       - `1` if `0 < jobCount ≤ Q1`
       - `2` if `Q1 < jobCount ≤ Q2`
       - `3` if `Q2 < jobCount ≤ Q3`
       - `4` if `Q3 < jobCount`

10. **Input validation (FR-011)**:
    - `period`: must match `/^last-12-months$|^\d{4}$/` and, if a year, must satisfy `user.createdAt.getFullYear() ≤ year ≤ currentYear`. Invalid ⇒ silently coerced to `'last-12-months'`.
    - `agent`: must be `'all'` or a member of `ALL_AGENTS`. Invalid ⇒ silently coerced to `'all'`.

## State Transitions
N/A — this is a read-only aggregation. No mutations are performed.

## Indexes
Existing Prisma indexes that support the heatmap query:
- `Job @@index([projectId])` — used for the initial `projectId IN (…)` filter.
- `Job @@index([startedAt])` — NOT ideal; the query filters on `completedAt`. If performance becomes an issue, **defer** adding `@@index([completedAt])`; the query planner can still use `projectId` index and then scan. Add the index only if measured p95 > 200ms at realistic data volume, and track in a follow-up ticket.

## Fixture Requirements (for tests)
The integration tests require seeded data that exercises every rule:
- A user with `createdAt` in a prior year and in the current year (two test users).
- Jobs across two distinct projects where user is owner vs member.
- Tickets with `agent = null` (to test `defaultAgent` fallback) AND tickets with explicit `agent`.
- Jobs with `costUsd = null` and `costUsd > 0` on the same day (cost-line omission test).
- A `ship` job with `status = FAILED` on a stage-SHIP ticket (MUST NOT count toward shipped).
- A leap-year January 1 that is not a Sunday (e.g. 2024-01-01 is a Monday ⇒ chipped top-left).
- An all-zero-activity user (empty-state).
