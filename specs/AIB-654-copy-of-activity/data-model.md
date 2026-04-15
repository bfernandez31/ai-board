# Data Model: Activity Heatmap

No new database tables or models are required (FR-027). The heatmap reads from existing `Job`, `Ticket`, `Project`, and `User` tables.

## Existing Entities Used

### Job (source of truth for heatmap cells)
| Field | Type | Heatmap Usage |
|-------|------|---------------|
| `id` | Int (PK) | Unique job identifier |
| `ticketId` | Int (FK → Ticket) | Join to ticket for agent resolution |
| `command` | String | Filter for `ship` jobs (shipped ticket counting) |
| `status` | JobStatus enum | Only `COMPLETED` jobs count for shipping; all non-PENDING statuses count for cell intensity |
| `startedAt` | DateTime | **Primary date axis** — determines which calendar day a job appears on in the grid |
| `completedAt` | DateTime? | Used to date shipped tickets (FR-010: ship job's completedAt) |
| `costUsd` | Float? | Tooltip cost aggregation (nullable — omit when all null on a day) |
| `projectId` | Int (FK → Project) | Cross-project aggregation via user's projects |

**Relevant indexes**: `@@index([projectId])`, `@@index([startedAt])`, `@@index([status])`, `@@index([ticketId, status, startedAt])`

### Ticket (agent resolution + ship counting)
| Field | Type | Heatmap Usage |
|-------|------|---------------|
| `id` | Int (PK) | Join target from Job |
| `agent` | Agent? (enum, nullable) | Explicit agent — used for effective agent resolution |
| `projectId` | Int (FK → Project) | Join to project for `defaultAgent` fallback |

### Project (agent defaults + user ownership)
| Field | Type | Heatmap Usage |
|-------|------|---------------|
| `id` | Int (PK) | Filter jobs by user's projects |
| `userId` | String (FK → User) | Determine project ownership |
| `defaultAgent` | Agent enum (default: CLAUDE) | Fallback when `ticket.agent` is null |

### User (year selector range)
| Field | Type | Heatmap Usage |
|-------|------|---------------|
| `id` | String (PK) | Current authenticated user |
| `createdAt` | DateTime | Determines available calendar years in year selector (FR-011) |

### ProjectMember (access)
| Field | Type | Heatmap Usage |
|-------|------|---------------|
| `userId` | String (FK → User) | Include projects where user is a member (not just owner) |
| `projectId` | Int (FK → Project) | Membership join |

## Application-Level Types (New)

### HeatmapDay
Represents aggregated data for a single calendar day.

```typescript
interface HeatmapDay {
  date: string;          // ISO date string "YYYY-MM-DD"
  jobCount: number;      // Total jobs started on this day
  costUsd: number | null; // Sum of non-null costUsd values; null if ALL jobs lack cost
  shippedTickets: ShippedTicketInfo[]; // Tickets with completed ship jobs on this day
}
```

### ShippedTicketInfo
```typescript
interface ShippedTicketInfo {
  ticketKey: string;     // e.g., "AIB-123"
  title: string;         // Ticket title for tooltip display
}
```

### HeatmapData
Top-level response from the heatmap API.

```typescript
interface HeatmapData {
  days: HeatmapDay[];            // Sparse array — only days with activity
  totalJobs: number;             // Sum of all jobCount values in period
  totalShipped: number;          // Count of unique tickets shipped in period
  agents: AgentOption[];         // Available agent filter options (from existing type)
  periodLabel: string;           // "in the last year" or "in 2025"
  userCreatedYear: number;       // User.createdAt year — for year selector range
}
```

### HeatmapFilters
Client-side filter state persisted in URL query params.

```typescript
interface HeatmapFilters {
  year: 'rolling' | string;     // 'rolling' = last 12 months, or '2024', '2025', etc.
  agent: 'all' | Agent;         // 'all' or specific agent enum value
}
```

## State Transitions

No state transitions — the heatmap is read-only. All data derives from existing Job status transitions managed elsewhere in the application.

## Validation Rules

| Rule | Source | Enforcement |
|------|--------|-------------|
| `year` param: `'rolling'` or 4-digit year string | FR-011, FR-019 | Zod schema in API route |
| `agent` param: `'all'` or valid Agent enum value | FR-015, FR-019 | Zod schema in API route |
| Year range: user.createdAt.year to current year | FR-011 | Server-side validation |
| Shipped = `command: 'ship'` AND `status: 'COMPLETED'` | FR-009 | Query WHERE clause |
| Cost null handling: exclude null, omit line when all null | FR-014 | Application logic in aggregation |

## Key Query Shape

```sql
-- Pseudocode for main heatmap query
SELECT
  DATE(j."startedAt") as day,
  COUNT(j.id) as job_count,
  SUM(CASE WHEN j."costUsd" IS NOT NULL THEN j."costUsd" ELSE 0 END) as total_cost,
  BOOL_AND(j."costUsd" IS NULL) as all_costs_null
FROM "Job" j
JOIN "Ticket" t ON j."ticketId" = t.id
JOIN "Project" p ON t."projectId" = p.id
LEFT JOIN "ProjectMember" pm ON p.id = pm."projectId"
WHERE (p."userId" = :userId OR pm."userId" = :userId)
  AND j."startedAt" >= :rangeStart
  AND j."startedAt" <= :rangeEnd
  AND j."status" NOT IN ('PENDING')
  -- Optional agent filter:
  AND (t."agent" = :agent OR (t."agent" IS NULL AND p."defaultAgent" = :agent))
GROUP BY DATE(j."startedAt")
```

This will be implemented as a Prisma query with `groupBy` or post-processing aggregation, consistent with existing analytics patterns.
