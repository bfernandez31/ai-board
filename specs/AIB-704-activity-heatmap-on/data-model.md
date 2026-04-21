# Data Model: Activity Heatmap on Projects Page (AIB-704)

**Branch**: `AIB-704-activity-heatmap-on`
**Date**: 2026-04-21

Per FR-029, this feature introduces NO new persisted entities. All data is derived server-side from existing `User`, `Project`, `ProjectMember`, `Ticket`, and `Job` records. This document captures the derived response types, their invariants, and the read shape used to build them.

---

## 1. Source entities (Prisma, read-only)

### User (relevant fields)
- `id: string` — current viewer.
- `createdAt: DateTime` — supplies the lower bound of the period selector (FR-014, FR-015).

### Project (relevant fields)
- `id: int`
- `userId: string` — owner.
- `defaultAgent: Agent` — participates in effective-agent resolution.
- `members: ProjectMember[]` — widens visibility.

### ProjectMember
- `(projectId, userId)` unique — membership lookup.

### Ticket (relevant fields)
- `id: int`
- `projectId: int`
- `ticketKey: string` (e.g., `"AIB-704"`) — shown in shipped-ticket tooltip.
- `title: string` — shown in shipped-ticket tooltip.
- `agent: Agent?` — nullable; effective = `agent ?? project.defaultAgent`.

### Job (relevant fields)
- `id: int`
- `ticketId: int`
- `command: string` — e.g. `"ship"`, `"specify"`, `"plan"`, ...
- `status: JobStatus` — `PENDING | RUNNING | COMPLETED | FAILED | CANCELLED`.
- `startedAt: DateTime` — day-of-record fallback.
- `completedAt: DateTime?` — day-of-record for `ship` job counting (FR-003).
- `costUsd: Float?` — nullable; null = "no cost data" (FR-004).

### Enums
- `Agent`: `CLAUDE | CODEX | MISTRAL | GEMINI`
- `JobStatus`: `PENDING | RUNNING | COMPLETED | FAILED | CANCELLED`

---

## 2. Derived types

All types live in `lib/heatmap/types.ts`. All strict-TypeScript; no `any`.

```ts
import type { Agent } from '@prisma/client';
import type { AgentFilter, NamedAgent } from '@/lib/analytics/types';

/** Period selector value. */
export type HeatmapPeriodKey =
  | { kind: 'rolling'; months: 12 }       // "Last 12 months" — default
  | { kind: 'year'; year: number };       // specific calendar year

/** Serialized period for URL + API (compact). */
export type HeatmapPeriodParam = '12m' | `${number}`; // '12m' | '2024' | '2025' | ...

/** User-selected filters; reflected in URL. */
export interface HeatmapFilters {
  period: HeatmapPeriodKey;
  agent: AgentFilter;   // 'all' | Agent enum (reused from analytics)
}

/** One cell in the grid. Days with zero jobs still appear with count=0 (unless outside the period). */
export interface HeatmapDay {
  /** YYYY-MM-DD, UTC. Matches `formatDateForGrouping(date, 'daily')`. */
  date: string;
  /** Total jobs with startedAt ≠ null on that day (all commands, all non-PENDING statuses). */
  jobCount: number;
  /** Sum of non-null costUsd across that day's jobs. Use 0 only when hasAnyCost is true. */
  sumCostUsd: number;
  /** True if at least one job on this day has a non-null costUsd. Drives tooltip template. */
  hasAnyCost: boolean;
  /** Tickets whose ship job COMPLETED on that day. Empty array when none. */
  shippedTickets: ShippedTicket[];
  /** 0 (no activity) | 1..4 (adaptive non-zero bucket). Computed server-side once per period. */
  intensity: 0 | 1 | 2 | 3 | 4;
}

export interface ShippedTicket {
  ticketKey: string; // e.g. "AIB-704"
  title: string;
}

/** Agent option as surfaced to the client. */
export interface HeatmapAgentOption {
  value: NamedAgent;   // no 'all' here — 'all' is implicit in the UI as default
  label: string;       // via getAgentLabel()
  jobCount: number;    // effective-agent job count across the selected period
}

/** Complete server response + the server's echoed filters for hydration gating. */
export interface HeatmapData {
  filters: HeatmapFilters;

  /** Resolved period boundaries (inclusive), for client-side grid generation. */
  period: {
    startDate: string;  // YYYY-MM-DD (UTC)
    endDate: string;    // YYYY-MM-DD (UTC); clamped to min(periodEnd, today)
    label: string;      // "the last year" | "2025" | ...
  };

  /** Intensity thresholds derived from the non-zero distribution (p50, p75, p90 rounded). */
  intensityThresholds: {
    t1: number;  // ≥ this → level 1 (always 1)
    t2: number;  // ≥ this → level 2 (p50)
    t3: number;  // ≥ this → level 3 (p75)
    t4: number;  // ≥ this → level 4 (p90)
  };

  /** All cells that fall within [startDate, endDate] AND are not in the future. */
  days: HeatmapDay[];

  /** Totals for the header counter (FR-013). */
  totals: {
    jobs: number;
    ticketsShipped: number;
  };

  /** Populated from effective-agent resolution; empty or single-element => filter hidden client-side (FR-018). */
  availableAgents: HeatmapAgentOption[];

  /** Lower bound of the period selector (FR-014, FR-015). */
  accountCreatedYear: number;

  /** ISO timestamp; not displayed, used for cache keying & debugging. */
  generatedAt: string;
}
```

---

## 3. Invariants

These MUST hold for every `HeatmapData` returned by the server:

1. **Day coverage (FR-007)**: `days[]` contains exactly one entry per calendar day in the inclusive range `[period.startDate, period.endDate]`. Days with zero activity appear as `{ jobCount: 0, sumCostUsd: 0, hasAnyCost: false, shippedTickets: [], intensity: 0 }`. Days outside the range are NEVER included — chipped corners are produced by the client rendering only the days present.

2. **Future clamp (Edge Case)**: `period.endDate <= today` in UTC. Jobs with `completedAt > today` are excluded from bucketing.

3. **Totals consistency**:
   - `totals.jobs === sum(days[].jobCount)`.
   - `totals.ticketsShipped === sum(days[].shippedTickets.length)`.

4. **Cost null-safety (FR-004, SC-006)**:
   - If a day has zero jobs, then `hasAnyCost === false` and `sumCostUsd === 0`.
   - If a day has jobs but all have `costUsd IS NULL`, then `hasAnyCost === false` and `sumCostUsd === 0` (but client MUST NOT render "$0").
   - If a day has at least one job with non-null `costUsd`, `hasAnyCost === true` and `sumCostUsd` is the sum of ONLY the non-null values.
   - `sumCostUsd` is rounded to 2 decimals server-side via `Math.round(x * 100) / 100`.

5. **Ship detection (FR-003, SC-007)**: `shippedTickets[]` is populated ONLY from `Job` rows with `command='ship' AND status='COMPLETED' AND completedAt` on that day. No `Ticket.stage` consultation.

6. **Scope (FR-001)**: Every ticket and job counted belongs to a `Project` where the viewer is owner OR member. Enforced by a single Prisma `where` clause: `ticket: { project: { OR: [{ userId }, { members: { some: { userId } } }] } }`.

7. **Intensity monotonicity**: `0 < t1 <= t2 <= t3 <= t4`. The bucket function MUST yield a stable level regardless of the exact equality of thresholds (use `>=` for boundaries).

8. **Agent filter consistency (FR-020)**: When `filters.agent !== 'all'`, grid boundaries, intensityThresholds, and `accountCreatedYear` are computed EXCLUSIVELY from the filtered dataset — no leakage from unfiltered jobs. `availableAgents` is computed from the UNFILTERED dataset (so the filter options don't vanish when the user picks a single agent).

9. **Empty state trigger (FR-010, Decision 11)**: Client displays the empty state iff `filters.agent === 'all' AND totals.jobs === 0 AND totals.ticketsShipped === 0`. Server never gates this — it always returns the full grid shape.

10. **Period serialization round-trip**: `parsePeriodParam(serialize(filters.period)) === filters.period` for every valid period. Invalid param values fall back to the default `{ kind: 'rolling', months: 12 }` (no throw on bad input — we treat it as "reset to default").

---

## 4. Query shape (Prisma)

All reads happen in `lib/heatmap/queries.ts`. The three reads run in parallel:

### Read A — job activity (all commands)

```ts
prisma.job.findMany({
  where: {
    startedAt: { gte: periodStart, lte: clampedEnd, not: null },
    status: { not: JobStatus.PENDING },
    ticket: {
      project: { OR: [{ userId }, { members: { some: { userId } } }] },
      ...(agentFilter !== 'all' ? buildEffectiveAgentWhere(agentFilter) : {}),
    },
  },
  select: {
    completedAt: true,
    startedAt: true,
    costUsd: true,
  },
});
```

### Read B — ship completions (for the shipped-tickets tooltip + counter)

```ts
prisma.job.findMany({
  where: {
    command: 'ship',
    status: 'COMPLETED',
    completedAt: { gte: periodStart, lte: clampedEnd, not: null },
    ticket: {
      project: { OR: [{ userId }, { members: { some: { userId } } }] },
      ...(agentFilter !== 'all' ? buildEffectiveAgentWhere(agentFilter) : {}),
    },
  },
  select: {
    completedAt: true,
    ticket: { select: { ticketKey: true, title: true } },
  },
});
```

### Read C — available agents (always UNFILTERED by agent)

```ts
prisma.ticket.findMany({
  where: {
    project: { OR: [{ userId }, { members: { some: { userId } } }] },
    jobs: { some: { startedAt: { gte: periodStart, lte: clampedEnd } } },
  },
  select: {
    agent: true,
    project: { select: { defaultAgent: true } },
    _count: { select: { jobs: { where: { startedAt: { gte: periodStart, lte: clampedEnd } } } } },
  },
});
// JS-side: map to effective agent, sum _count.jobs into Map<Agent, number>, emit HeatmapAgentOption[].
```

No raw SQL (Constitution IV). No new indexes required — existing `Job(ticketId, status, startedAt)` composite index + `Job(startedAt)` index cover the predicates.

---

## 5. Transitions

N/A — this feature is read-only. No entity state transitions, no mutations, no writes. Constitution V (Database Integrity) checks reduce to: no migrations needed; no transactional logic; no soft deletes.

---

## 6. Validation boundaries

Input from the network MUST be validated by Zod at the route layer:

```ts
const querySchema = z.object({
  period: z.string().optional(),  // '12m' | YYYY
  agent: z.enum(AGENT_FILTER_VALUES).optional(),
});
```

A bad `period` string is NOT a 400 — it falls back to the default (`'12m'`), to avoid surfacing opaque validation errors for a URL the user may have typed or bookmarked loosely. A bad `agent` string IS a 400 — the `agent` enum is a closed set and a typo there is a programming error, not a user choice.
