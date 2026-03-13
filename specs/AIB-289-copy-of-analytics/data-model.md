# Data Model: Analytics Filters and Dynamic Shipping Metrics

**Feature**: AIB-289 - Analytics Filters and Dynamic Shipping Metrics
**Date**: 2026-03-13

## Entity Overview

This feature does not add database tables or columns. It extends the in-memory analytics domain model built from existing `Project`, `Ticket`, and `Job` records.

---

## Existing Persistent Entities Used

### Project

Relevant fields:

```typescript
interface ProjectAnalyticsSource {
  id: number;
  defaultAgent: 'CLAUDE' | 'CODEX';
}
```

Role in feature:
- Supplies the fallback agent when `ticket.agent` is null
- Scopes analytics to one project

### Ticket

Relevant fields:

```typescript
interface TicketAnalyticsSource {
  id: number;
  projectId: number;
  stage: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP' | 'CLOSED';
  workflowType: 'FULL' | 'QUICK' | 'CLEAN';
  agent: 'CLAUDE' | 'CODEX' | null;
  updatedAt: Date;
  closedAt: Date | null;
}
```

Role in feature:
- Determines outcome membership (`SHIP`, `CLOSED`)
- Determines effective agent when joined with project default
- Supplies shipped and closed completion counts
- Supplies workflow distribution counts

Validation and invariants:
- `closedAt` must be present when `stage = CLOSED`
- `updatedAt` is the fallback lifecycle timestamp for shipped tickets
- Only `SHIP` and `CLOSED` participate in the outcome filter

### Job

Relevant fields:

```typescript
interface JobAnalyticsSource {
  id: number;
  ticketId: number;
  projectId: number;
  command: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  completedAt: Date | null;
  costUsd: number | null;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  toolsUsed: string[];
}
```

Role in feature:
- Supplies job-backed overview metrics and charts
- Remains filtered by `completedAt` for the active time range
- Is further filtered by parent ticket outcome and effective agent

---

## Derived Domain Entities

### AnalyticsFilters

Canonical request state shared across page loader, API route, and query helpers.

```typescript
type TimeRange = '7d' | '30d' | '90d' | 'all';
type TicketOutcomeFilter = 'shipped' | 'closed' | 'all-completed';
type AgentFilter = 'all' | 'CLAUDE' | 'CODEX';

interface AnalyticsFilters {
  range: TimeRange;
  outcome: TicketOutcomeFilter;
  agent: AgentFilter;
}
```

Validation rules:
- `range` must be one of the existing dashboard ranges
- `outcome` must be one of the three spec-defined options
- `agent` must be `all` or a supported effective agent enum value

Default state:

```typescript
const DEFAULT_ANALYTICS_FILTERS: AnalyticsFilters = {
  range: '30d',
  outcome: 'shipped',
  agent: 'all',
};
```

### AgentOption

Project-scoped filter metadata for the dashboard selector.

```typescript
interface AgentOption {
  value: AgentFilter;
  label: string;
  jobCount: number;
  isDefault: boolean;
}
```

Rules:
- Must always include `all`
- Named agents appear only if the project has at least one matching job-backed ticket for that effective agent

### CompletionMetric

Period-aware overview card data for terminal ticket outcomes.

```typescript
interface CompletionMetric {
  count: number;
  label: string;
}
```

Rules:
- `label` mirrors the active time range (`Last 7 days`, `Last 30 days`, `Last 90 days`, `All time`)
- `count` can be `0` without implying an API failure

### OverviewMetrics

Extended overview payload.

```typescript
interface OverviewMetrics {
  totalCost: number;
  costTrend: number;
  successRate: number;
  avgDuration: number;
  ticketsShipped: CompletionMetric;
  ticketsClosed: CompletionMetric;
}
```

### AnalyticsData

Extended response contract for the dashboard.

```typescript
interface AnalyticsData {
  overview: OverviewMetrics;
  costOverTime: CostDataPoint[];
  costByStage: StageCost[];
  tokenUsage: TokenBreakdown;
  cacheEfficiency: CacheMetrics;
  topTools: ToolUsage[];
  workflowDistribution: WorkflowBreakdown[];
  velocity: WeeklyVelocity[];
  filters: AnalyticsFilters;
  availableAgents: AgentOption[];
  generatedAt: string;
  jobCount: number;
  hasData: boolean;
}
```

Relationships:
- `filters` describes the applied request state
- `availableAgents` configures the agent selector for the same project
- `hasData` describes whether any job-backed analytics exist after filters are applied; it does not suppress completion metrics

---

## Derived Filtering Rules

### Effective Agent Resolution

```typescript
effectiveAgent = ticket.agent ?? ticket.project.defaultAgent;
```

### Outcome Membership

```typescript
matchesOutcome('shipped') = ticket.stage === 'SHIP'
matchesOutcome('closed') = ticket.stage === 'CLOSED'
matchesOutcome('all-completed') = ticket.stage === 'SHIP' || ticket.stage === 'CLOSED'
```

### Time Window Rules

- Job-backed metrics: `job.completedAt >= rangeStart` when a finite range is selected
- Shipped count + velocity: `ticket.stage = SHIP` and `ticket.updatedAt >= rangeStart`
- Closed count: `ticket.stage = CLOSED` and `ticket.closedAt >= rangeStart`

---

## State Transitions

No new workflow states are introduced. The feature reads existing terminal ticket states only:

```text
VERIFY -> SHIP
VERIFY -> CLOSED
```

Analytics treat these outcomes independently for overview counts and jointly or separately according to the selected outcome filter.

---

## Schema Impact

No Prisma migration is required.
