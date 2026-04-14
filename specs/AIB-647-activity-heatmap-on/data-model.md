# Data Model: Activity Heatmap

## No Schema Changes Required (SC-008)

This feature operates entirely on existing `Job` and `Ticket` tables. No migrations needed.

## Query Entities (TypeScript interfaces only)

### HeatmapFilters

```typescript
interface HeatmapFilters {
  year: 'rolling' | number;  // 'rolling' = last 12 months, or specific year (e.g. 2025)
  agent: AgentFilter;        // Reuse from lib/analytics/types.ts ('all' | NamedAgent)
}
```

### HeatmapDayCell

Represents one calendar day's aggregated activity across all user projects.

```typescript
interface HeatmapDayCell {
  date: string;             // ISO date string 'YYYY-MM-DD'
  jobCount: number;         // Total jobs started on this day
  costUsd: number | null;   // Total cost (null if all jobs have null cost)
  ticketsShipped: number;   // Tickets with completed 'ship' job on this day
}
```

**Source**: Aggregated from `Job.startedAt` (for job counts/cost) and `Job.completedAt` where `command='ship'` (for shipped tickets).

### HeatmapData

Top-level API response shape.

```typescript
interface HeatmapData {
  cells: HeatmapDayCell[];           // One entry per day with activity
  summary: {
    totalJobs: number;               // Sum of all jobCount values
    totalTicketsShipped: number;     // Sum of all ticketsShipped values
  };
  filters: HeatmapFilters;          // Echo applied filters
  availableYears: number[];          // Years with data (e.g. [2024, 2025, 2026])
  availableAgents: AgentOption[];    // Agents with data (reuse type from analytics)
}
```

### Intensity Level Mapping

```typescript
type IntensityLevel = 0 | 1 | 2 | 3 | 4;  // empty, low, medium, high, max

function getIntensityLevel(jobCount: number, maxCount: number): IntensityLevel {
  if (jobCount === 0) return 0;
  const ratio = jobCount / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.50) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}
```

## Database Access Patterns

### Primary Query: Daily Job Aggregation

```sql
-- Conceptual (implemented via Prisma)
SELECT
  DATE(j."startedAt") AS date,
  COUNT(*) AS job_count,
  SUM(j."costUsd") AS cost_usd
FROM "Job" j
JOIN "Ticket" t ON j."ticketId" = t.id
JOIN "Project" p ON t."projectId" = p.id
LEFT JOIN "ProjectMember" pm ON p.id = pm."projectId"
WHERE (p."userId" = :userId OR pm."userId" = :userId)
  AND j."startedAt" >= :rangeStart
  AND j."startedAt" < :rangeEnd
  AND j."status" IN ('COMPLETED', 'FAILED')
  -- Optional agent filter via ticket.agent / project.defaultAgent
GROUP BY DATE(j."startedAt")
```

**Indexes leveraged**: `Job.@@index([startedAt])`, `Job.@@index([projectId])`, `Ticket.@@index([projectId])`

### Secondary Query: Daily Shipped Tickets

```sql
SELECT
  DATE(j."completedAt") AS date,
  COUNT(DISTINCT t.id) AS tickets_shipped
FROM "Job" j
JOIN "Ticket" t ON j."ticketId" = t.id
JOIN "Project" p ON t."projectId" = p.id
LEFT JOIN "ProjectMember" pm ON p.id = pm."projectId"
WHERE (p."userId" = :userId OR pm."userId" = :userId)
  AND j.command = 'ship'
  AND j.status = 'COMPLETED'
  AND j."completedAt" >= :rangeStart
  AND j."completedAt" < :rangeEnd
GROUP BY DATE(j."completedAt")
```

### Metadata Query: Available Years

```sql
SELECT DISTINCT EXTRACT(YEAR FROM j."startedAt") AS year
FROM "Job" j
JOIN "Ticket" t ON j."ticketId" = t.id
JOIN "Project" p ON t."projectId" = p.id
LEFT JOIN "ProjectMember" pm ON p.id = pm."projectId"
WHERE (p."userId" = :userId OR pm."userId" = :userId)
ORDER BY year
```

## State Transitions

None — this is a read-only feature. No mutations to existing data.

## Validation Rules

| Field | Constraint |
|-------|-----------|
| `year` | Must be `'rolling'` or a 4-digit year present in `availableYears` |
| `agent` | Must be `'all'` or a value present in `availableAgents` |
