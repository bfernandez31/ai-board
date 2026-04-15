# Data Model: Activity Heatmap

## No New Database Models (FR-023)

This feature uses existing Job, Ticket, Project, and User tables exclusively. No schema changes or migrations required.

## Derived Data Structures (TypeScript interfaces)

### HeatmapDay
Represents a single day's aggregated data for one cell in the heatmap grid.

| Field | Type | Description |
|-------|------|-------------|
| date | string | ISO date string (YYYY-MM-DD) |
| jobCount | number | Count of COMPLETED jobs on this day |
| costUsd | number \| null | Sum of costUsd for jobs with recorded cost; null if none have cost |
| shippedTickets | string[] | ticketKeys of tickets whose `ship` job completed this day |

### HeatmapData (API response)
Top-level response from the heatmap API endpoint.

| Field | Type | Description |
|-------|------|-------------|
| days | HeatmapDay[] | Array of days with activity (sparse — days with 0 jobs omitted) |
| totalJobs | number | Total COMPLETED jobs in period |
| totalShipped | number | Distinct tickets shipped in period |
| availableAgents | AgentOption[] | Agents with data (reuses analytics type) |
| availableYears | number[] | Calendar years with data (for year selector) |
| userCreatedAt | string | ISO timestamp of user account creation |
| generatedAt | string | ISO timestamp of response generation |

### HeatmapFilters
Client-side filter state.

| Field | Type | Default | URL param |
|-------|------|---------|-----------|
| year | string | "last-12-months" | `year` |
| agent | AgentFilter | "all" | `agent` |

### HeatmapCell (client-side computed)
Computed from HeatmapDay for rendering.

| Field | Type | Description |
|-------|------|-------------|
| date | Date | Local date object |
| jobCount | number | Jobs on this day |
| level | 0-4 | Intensity level from quartile bucketing |
| costUsd | number \| null | Cost sum |
| shippedTickets | string[] | Shipped ticket keys |

## Query Patterns

### Primary Query: Daily Job Counts
```
Job WHERE:
  - status = COMPLETED
  - completedAt BETWEEN period_start AND period_end
  - ticket.project.userId = authenticated_user_id
  - (optional) ticket matches effective agent filter
GROUP BY: DATE(completedAt)
SELECT: count, sum(costUsd)
```

### Shipped Tickets Query
```
Job WHERE:
  - status = COMPLETED
  - command = 'ship'
  - completedAt BETWEEN period_start AND period_end
  - ticket.project.userId = authenticated_user_id
  - (optional) ticket matches effective agent filter
SELECT: DISTINCT ticket.ticketKey, DATE(completedAt)
```

### Available Years Query
```
Job WHERE:
  - status = COMPLETED
  - ticket.project.userId = authenticated_user_id
SELECT: DISTINCT YEAR(completedAt)
```

## Relationships Used

- Job → Ticket (via ticketId): for agent resolution and shipped ticket lookup
- Ticket → Project (via projectId): for defaultAgent fallback and user ownership
- Project → User (via userId): for cross-project data scoping
