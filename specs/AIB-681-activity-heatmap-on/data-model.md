# Data Model: Activity Heatmap (AIB-681)

No new database models or migrations required. All data is derived from existing tables.

## Source Entities (Read-Only)

### Job (existing — `prisma/schema.prisma`)

| Field | Type | Heatmap Usage |
|-------|------|---------------|
| `id` | Int (PK) | Counting |
| `ticketId` | Int (FK → Ticket) | Join to resolve effective agent |
| `projectId` | Int (FK → Project) | Filter by user's projects |
| `command` | String | Identify `ship` jobs for "tickets shipped" counter |
| `status` | JobStatus enum | Filter: COMPLETED for ship counting; all statuses for activity counting |
| `createdAt` | DateTime | Date key for heatmap cell (UTC-normalized) |
| `completedAt` | DateTime? | Used for ship job completion date |
| `costUsd` | Float? | Aggregated per day for tooltip cost display |

### Ticket (existing)

| Field | Type | Heatmap Usage |
|-------|------|---------------|
| `id` | Int (PK) | Join target from Job |
| `agent` | Agent? (CLAUDE/CODEX/MISTRAL/GEMINI) | Effective agent resolution (ticket-level override) |
| `projectId` | Int (FK → Project) | Implicit via Job.projectId |

### Project (existing)

| Field | Type | Heatmap Usage |
|-------|------|---------------|
| `id` | Int (PK) | Filter user's projects |
| `userId` | String (FK → User) | Ownership check |
| `defaultAgent` | Agent enum | Fallback for tickets with null agent |

### User (existing)

| Field | Type | Heatmap Usage |
|-------|------|---------------|
| `id` | String (PK) | Session identity |
| `createdAt` | DateTime | Year selector: earliest selectable year |

## Derived Types (Application Layer)

### HeatmapCell

Represents a single day in the grid.

```typescript
interface HeatmapCell {
  /** ISO date string YYYY-MM-DD (UTC) */
  date: string;
  /** Total job count for this day across all user projects */
  jobCount: number;
  /** Number of tickets with a completed 'ship' job on this day */
  shippedCount: number;
  /** Sum of costUsd for jobs on this day; null if no cost data exists */
  totalCost: number | null;
}
```

### HeatmapPeriod

The selected time range defining grid boundaries.

```typescript
interface HeatmapPeriod {
  /** "rolling" for last 12 months, or a 4-digit year string */
  value: 'rolling' | string;
  /** Display label: "Last 12 months" or "2025" */
  label: string;
  /** First date in period (UTC, inclusive) */
  startDate: string;
  /** Last date in period (UTC, inclusive) */
  endDate: string;
}
```

### HeatmapFilters

```typescript
interface HeatmapFilters {
  /** Selected year or "rolling" for last 12 months */
  year: 'rolling' | string;
  /** Agent filter: "all" or specific agent name */
  agent: AgentFilter;
}
```

### HeatmapData

API response shape.

```typescript
interface HeatmapData {
  /** Daily aggregated cells for the selected period */
  cells: HeatmapCell[];
  /** Summary metrics */
  summary: {
    totalJobs: number;
    totalShipped: number;
  };
  /** Intensity thresholds (percentile-based from non-zero cells) */
  thresholds: [number, number, number, number];
  /** Available filter options */
  availableAgents: AgentOption[];
  /** Available year options for year selector */
  availableYears: string[];
  /** User account creation year */
  accountCreatedYear: number;
  /** Active filters that produced this data */
  filters: HeatmapFilters;
}
```

## Relationships & Query Pattern

```
User (session)
  └── owns/members → Project[]
       └── has → Ticket[]
            ├── .agent (nullable) ─┐
            └── has → Job[]        │ effective agent = ticket.agent ?? project.defaultAgent
       └── .defaultAgent ──────────┘
```

### Primary Query Flow

1. Get all project IDs where user is owner OR member
2. Query Jobs WHERE `projectId IN (userProjectIds)` AND `createdAt` within period
3. If agent filter active: JOIN Ticket, apply `buildEffectiveAgentWhere(agent)` pattern
4. GROUP BY `DATE(createdAt)` → aggregate: `COUNT(*)` as jobCount, `SUM(costUsd)` as totalCost
5. Separate query for shipped tickets: Jobs WHERE `command = 'ship'` AND `status = 'COMPLETED'`, grouped by `DATE(completedAt)`
6. Merge daily aggregations into `HeatmapCell[]`

### Indexes Leveraged

- `Job.@@index([projectId])` — filter by user's projects
- `Job.@@index([startedAt])` — date range filtering (createdAt also benefits)
- `Job.@@index([status])` — filter COMPLETED for ship jobs
- `Job.@@index([ticketId, status, startedAt])` — compound index for agent-filtered queries

## State Transitions

No state transitions — this feature is read-only.

## Validation Rules

- `year` param: must be "rolling" or a 4-digit year string between `user.createdAt` year and current year
- `agent` param: must be "all" or one of `ALL_AGENTS` values
- All dates normalized to UTC to avoid DST boundary issues
- `costUsd` is nullable — never coerce null to 0; aggregate only non-null values
