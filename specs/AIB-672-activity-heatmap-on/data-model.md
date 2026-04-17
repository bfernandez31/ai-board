# Data Model: Activity Heatmap on Projects Page (AIB-672)

**No schema migrations.** Per FR-005, every entity below is an existing Prisma
model; this document captures only the fields the feature reads and the
derived shapes used by the API and UI.

## Source Entities (read-only from existing schema)

### `User`
Source of truth: `prisma/schema.prisma`
| Field | Used For |
|-------|----------|
| `id` | Auth subject (`requireAuth()`) |
| `createdAt` | Drives the year-selector range (FR-016) |

### `Project`
| Field | Used For |
|-------|----------|
| `id` | Filter jobs to projects the viewer can access |
| `userId` | Owner membership check (`OR` clause) |
| `defaultAgent` | Effective-agent fallback when `Ticket.agent` is null (FR-025) |
| `members` (relation via `ProjectMember`) | Member membership check |

### `Ticket`
| Field | Used For |
|-------|----------|
| `id` | Join key for shipped-ticket list in tooltips |
| `title` | Tooltip label for shipped tickets (FR-019) |
| `agent` (nullable) | Effective-agent resolution (FR-022/FR-025) |
| `projectId` | Filter by accessible projects |
| `deletedAt` (if applicable) | Collapse deleted shipped tickets to a count (edge case) |

### `Job`
| Field | Used For |
|-------|----------|
| `id` | Primary key for ship-job join |
| `startedAt` | Bucketing day for intensity (FR-002/FR-003) |
| `completedAt` | Day for the shipped counter (FR-004); tooltip cost sum |
| `status` | Success check for `ship` job counting (FR-004) |
| `command` | Identify `ship` jobs for the shipped counter (FR-004) |
| `costUsd` (nullable) | Tooltip cost sum; null-cost handling (FR-020) |
| `projectId`, `ticketId` | Join keys |

## Derived Shapes (API ↔ UI contract)

### `HeatmapPeriod` (input enum)
```ts
type HeatmapPeriod =
  | { kind: 'rolling12m' }        // default, ends today inclusive
  | { kind: 'calendarYear'; year: number }; // e.g. 2025
```
Serialised in the URL as:
- `y` omitted → `rolling12m`
- `y=YYYY` → `calendarYear(YYYY)`

### `HeatmapAgentFilter` (input enum)
```ts
type HeatmapAgentFilter = 'all' | Agent;   // Agent from @prisma/client
```
Serialised as `a=all|CLAUDE|CODEX|MISTRAL|GEMINI`; `all` omitted from URL.

### `HeatmapDayCell` (per-day bucket)
```ts
interface HeatmapDayCell {
  /** ISO date string in the viewer's timezone, e.g. "2025-11-03" */
  date: string;
  /** Number of jobs whose startedAt falls on this day, after agent filter */
  jobCount: number;
  /**
   * Sum of recorded costUsd across jobs on this day.
   * null when every job on the day has null costUsd (FR-020).
   */
  costUsd: number | null;
  /** Count of jobs whose costUsd was null (for optional "excludes N" tooltip hint) */
  nullCostJobCount: number;
  /** Tickets shipped that day (ship job completed successfully, FR-004) */
  shippedTickets: HeatmapShippedTicket[];
  /** Intensity bucket 0..4 (0 = no activity, 4 = peak) — computed server-side */
  intensity: 0 | 1 | 2 | 3 | 4;
}
```

### `HeatmapShippedTicket`
```ts
interface HeatmapShippedTicket {
  /** null when the ticket has been deleted; UI collapses to "N more tickets" */
  ticketId: number | null;
  /** null when deleted — UI shows placeholder (edge case) */
  title: string | null;
}
```

### `HeatmapResponse` (API body)
```ts
interface HeatmapResponse {
  period: {
    kind: 'rolling12m' | 'calendarYear';
    year?: number;           // present only when kind === 'calendarYear'
    startDate: string;       // YYYY-MM-DD inclusive, viewer tz
    endDate: string;         // YYYY-MM-DD inclusive, viewer tz
    timezone: string;        // IANA tz actually used for bucketing
  };
  counters: {
    jobCount: number;             // sum over all cells
    shippedTicketCount: number;   // distinct successful ship jobs in period
  };
  cells: HeatmapDayCell[];        // every day in [startDate..endDate] inclusive
  intensityThresholds: [number, number, number, number];
                                  // upper bound (inclusive) of levels 1..4
  availableAgents: Agent[];       // distinct effective agents for filter UI
  yearSelector: {
    /** Years offered in addition to "rolling12m", ascending to descending order chosen by UI */
    calendarYears: number[];      // [] when account-creation year === current year (FR-017)
    currentYear: number;
  };
}
```

### URL-state mapping (FR-027/FR-028)
| UI state | Query param | Omitted when |
|----------|-------------|--------------|
| Rolling 12 months (default) | `y` absent | always (default) |
| Calendar year `Y` | `y=Y` | never (non-default) |
| Agent = All (default) | `a` absent | always (default) |
| Agent = `X` | `a=X` | never (non-default) |

## Validation Rules

### Request-side (Zod at API boundary)
- `y`: optional, either `'12m'` or a 4-digit integer within
  `[createdYear, currentYear]` of the authenticated user; out-of-range values
  coerce to `12m` silently (defensive — per "Account created on a future date"
  edge case).
- `a`: optional, one of `'all' | Agent enum values`; invalid → 400.
- `tz`: optional string, must be a valid IANA timezone as validated via
  `Intl.DateTimeFormat(tz).resolvedOptions().timeZone === tz`; invalid → falls
  back to `UTC`.

### Response-side invariants
- `cells.length === days in [startDate..endDate]` (inclusive).
- For every cell: `intensity === 0 ⇔ jobCount === 0`.
- `counters.jobCount === Σ cells[i].jobCount`.
- `counters.shippedTicketCount === Σ cells[i].shippedTickets.length` (deleted
  tickets still counted, just represented by `ticketId: null`).
- `intensityThresholds` is monotonically non-decreasing and its last element
  equals `max(cells[*].jobCount)`; when max is 0, thresholds are `[0,0,0,0]`
  and every intensity is 0 (empty-state trigger per FR-012).

## State Transitions

None — the heatmap is a read-only projection over existing job/ticket/project
state. No entities are created, updated, or deleted by this feature.
