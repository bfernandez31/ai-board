# Data Model: Analytics Filters (Agent/Status) & Dynamic Shipped Card

**Ticket**: AIB-287
**Date**: 2026-03-13

---

## Schema Changes

**None required.** All necessary fields already exist in the Prisma schema.

---

## Relevant Entities

### Job (existing — read-only)

| Field | Type | Usage in This Feature |
|-------|------|----------------------|
| `id` | Int | Primary key |
| `projectId` | Int | Filter scope |
| `ticketId` | Int | FK to Ticket — used for stage-based relational filtering |
| `model` | String (VarChar 50) | Agent filter — distinct values populate dropdown |
| `status` | JobStatus enum | Only COMPLETED/FAILED included in metrics |
| `command` | String (VarChar 50) | Maps to stage via COMMAND_TO_STAGE |
| `completedAt` | DateTime? | Time range filtering |
| `costUsd` | Float? | Cost metrics |
| `inputTokens` | Int? | Token metrics |
| `outputTokens` | Int? | Token metrics |
| `cacheReadTokens` | Int? | Cache metrics |
| `cacheCreationTokens` | Int? | Cache metrics |
| `durationMs` | Int? | Duration metrics |
| `toolsUsed` | String[] | Top tools chart |

**Relationship**: `ticket Ticket @relation(fields: [ticketId], references: [id])`

### Ticket (existing — read-only)

| Field | Type | Usage in This Feature |
|-------|------|----------------------|
| `id` | Int | Primary key |
| `projectId` | Int | Filter scope |
| `stage` | Stage enum | Status filter: SHIP and CLOSED are filterable |
| `workflowType` | WorkflowType enum | Workflow distribution chart |
| `updatedAt` | DateTime | Time-based counting for shipped/closed cards |

**Stage enum values**: INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP, CLOSED

### Relevant Indices (existing)

| Model | Index | Usage |
|-------|-------|-------|
| Job | `[projectId, startedAt]` | Time-scoped job queries |
| Job | `[projectId, status]` | Status-filtered job queries |
| Job | `[ticketId, status, startedAt]` | Ticket-specific job lookups |
| Ticket | `[projectId, stage]` | Stage-filtered ticket counts |
| Ticket | `[updatedAt]` | Time-range ticket queries |
| Ticket | `[projectId, workflowType]` | Workflow distribution |

---

## New TypeScript Types

### StatusFilter

```typescript
export type StatusFilter = 'shipped' | 'closed' | 'all';
```

Maps to Prisma stage values:
- `'shipped'` → `{ stage: { in: ['SHIP'] } }`
- `'closed'` → `{ stage: { in: ['CLOSED'] } }`
- `'all'` → `{ stage: { in: ['SHIP', 'CLOSED'] } }`

### AnalyticsFilters

```typescript
export interface AnalyticsFilters {
  range: TimeRange;
  status: StatusFilter;
  agent: string | null; // null = all agents
}
```

### Updated OverviewMetrics

```typescript
export interface OverviewMetrics {
  totalCost: number;
  costTrend: number;
  successRate: number;
  avgDuration: number;
  ticketsShipped: number; // Now respects time range (was hardcoded to current month)
  ticketsClosed: number;  // NEW: CLOSED tickets in selected time range
}
```

### Updated AnalyticsData

```typescript
export interface AnalyticsData {
  // ... existing fields ...
  availableAgents: string[]; // NEW: distinct model values for agent filter dropdown
}
```

---

## Query Filter Application Matrix

Shows which filters apply to each analytics query function:

| Query Function | Time Range | Status (Ticket Stage) | Agent (Job Model) |
|---------------|------------|----------------------|-------------------|
| `getOverviewMetrics` | `completedAt >= rangeStart` | Job → Ticket stage relation | `model = agent` |
| `getCostOverTime` | `completedAt >= rangeStart` | Job → Ticket stage relation | `model = agent` |
| `getCostByStage` | `completedAt >= rangeStart` | Job → Ticket stage relation | `model = agent` |
| `getTokenUsage` | `completedAt >= rangeStart` | Job → Ticket stage relation | `model = agent` |
| `getCacheEfficiency` | (via getTokenUsage) | (via getTokenUsage) | (via getTokenUsage) |
| `getTopTools` | `completedAt >= rangeStart` | Job → Ticket stage relation | `model = agent` |
| `getWorkflowDistribution` | `updatedAt >= rangeStart` | Direct `stage: { in: stages }` | N/A (ticket-level query) |
| `getVelocityData` | `updatedAt >= rangeStart` | Direct `stage: { in: stages }` | N/A (ticket-level query) |
| `getAvailableAgents` (NEW) | None (all-time) | None | N/A (returns distinct models) |
| Ticket counts (shipped/closed) | `updatedAt >= rangeStart` | Direct stage filter | N/A (ticket-level) |

### Prisma Filter Pattern for Job Queries

```typescript
// Base job filter (applied to all job queries)
const jobFilter = {
  projectId,
  status: 'COMPLETED', // or { in: ['COMPLETED', 'FAILED'] } for overview
  ...(rangeStart && { completedAt: { gte: rangeStart } }),
  // Status filter: filter jobs by their parent ticket's stage
  ...(stages && { ticket: { stage: { in: stages } } }),
  // Agent filter: filter by job model
  ...(agent && { model: agent }),
};
```

### Prisma Filter Pattern for Ticket Queries

```typescript
// Base ticket filter (applied to velocity, workflow distribution)
const ticketFilter = {
  projectId,
  stage: { in: stages }, // ['SHIP'], ['CLOSED'], or ['SHIP', 'CLOSED']
  ...(rangeStart && { updatedAt: { gte: rangeStart } }),
};
```

---

## Validation Rules

| Parameter | Validation | Error |
|-----------|-----------|-------|
| `status` | Must be one of: `shipped`, `closed`, `all` | 400: Invalid status filter |
| `agent` | Must be a non-empty string if provided | 400: Invalid agent filter |
| `range` | Must be one of: `7d`, `30d`, `90d`, `all` | 400: Invalid time range (existing) |
