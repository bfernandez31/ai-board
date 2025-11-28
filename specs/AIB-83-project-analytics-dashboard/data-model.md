# Data Model: Project Analytics Dashboard

**Date**: 2025-11-28
**Feature**: AIB-83-project-analytics-dashboard

## Overview

This document defines the data entities, relationships, and validation rules for the project analytics dashboard. The feature uses **existing database models** without schema changes—all data is derived from Job and Ticket tables.

---

## Existing Database Entities (No Changes)

### Job Model (Existing)

**Source**: `prisma/schema.prisma` (lines 29-59)

**Fields Used**:
- `id`: Int (primary key)
- `projectId`: Int (foreign key to Project)
- `ticketId`: Int (foreign key to Ticket)
- `command`: String (maps to workflow stage via lookup table)
- `status`: JobStatus enum (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
- `startedAt`: DateTime (for time-series queries)
- `completedAt`: DateTime (for completed job filtering)
- `inputTokens`: Int? (for token usage aggregation)
- `outputTokens`: Int? (for token usage aggregation)
- `cacheReadTokens`: Int? (for cache efficiency calculation)
- `cacheCreationTokens`: Int? (for cache size tracking)
- `costUsd`: Float? (for cost aggregation)
- `durationMs`: Int? (for average duration calculation)
- `toolsUsed`: String[] (for top tools aggregation)

**Indexes Used**:
- `@@index([projectId])` - Filter jobs by project
- `@@index([startedAt])` - Time-series queries
- `@@index([status])` - Filter by job status
- `@@index([ticketId, status, startedAt])` - Composite queries

**Validation Rules**:
- All telemetry fields are nullable (some jobs may lack telemetry data)
- `status` must be one of JobStatus enum values
- `costUsd` must be non-negative if present
- `toolsUsed` defaults to empty array

---

### Ticket Model (Existing)

**Source**: `prisma/schema.prisma` (lines 109-137)

**Fields Used**:
- `id`: Int (primary key)
- `projectId`: Int (foreign key to Project)
- `stage`: Stage enum (INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP)
- `workflowType`: WorkflowType enum (FULL, QUICK, CLEAN)
- `updatedAt`: DateTime (for velocity calculation—when ticket moved to SHIP)

**Indexes Used**:
- `@@index([projectId])` - Filter tickets by project
- `@@index([stage])` - Filter by ticket stage
- `@@index([updatedAt])` - Time-based queries for velocity
- `@@index([projectId, workflowType])` - Workflow distribution queries

**Validation Rules**:
- `stage` must be one of Stage enum values
- `workflowType` defaults to FULL
- `updatedAt` automatically set on updates

---

## Derived Data Entities (Calculated, Not Stored)

These entities represent aggregated analytics data computed from Job and Ticket models. They are **not stored** in the database—calculated on-demand via API queries.

---

### AnalyticsSummary

**Description**: High-level overview metrics displayed in four cards at top of dashboard

**Fields**:
- `totalCostUsd`: Float - Sum of `costUsd` from all completed jobs in date range
- `costTrendPercent`: Float? - Percentage change vs. previous period (null if no previous data)
- `successRatePercent`: Float? - `(COMPLETED / (COMPLETED + FAILED + CANCELLED)) * 100`; null if no terminal jobs
- `avgDurationMs`: Int? - Average `durationMs` of COMPLETED jobs; null if no completed jobs
- `ticketsShippedThisMonth`: Int - Count of tickets in SHIP stage with `updatedAt` in current calendar month

**Derivation**:
```typescript
// Total cost
SELECT SUM(costUsd) FROM Job
WHERE projectId = ? AND completedAt >= ? AND status = 'COMPLETED';

// Success rate
SELECT status, COUNT(*) FROM Job
WHERE projectId = ? AND status IN ('COMPLETED', 'FAILED', 'CANCELLED')
GROUP BY status;

// Avg duration
SELECT AVG(durationMs) FROM Job
WHERE projectId = ? AND status = 'COMPLETED';

// Tickets shipped this month
SELECT COUNT(*) FROM Ticket
WHERE projectId = ? AND stage = 'SHIP' AND updatedAt >= ?;
```

**Validation Rules**:
- `totalCostUsd` must be >= 0
- `successRatePercent` must be 0-100 if present
- `avgDurationMs` must be > 0 if present
- `ticketsShippedThisMonth` must be >= 0

**Business Rules**:
- Cost trend compares current 30-day period to previous 30 days
- Success rate excludes PENDING/RUNNING jobs (terminal states only)
- Average duration excludes FAILED/CANCELLED jobs (COMPLETED only)
- Tickets shipped uses `updatedAt` (when moved to SHIP), not `createdAt`

---

### CostOverTime

**Description**: Time-series data for cost-over-time area chart

**Fields**:
- `date`: Date - Day or week start date depending on granularity
- `costUsd`: Float - Sum of job costs for that period
- `jobCount`: Int - Number of jobs completed in that period

**Derivation**:
```typescript
// Daily aggregation
SELECT DATE(completedAt) as date, SUM(costUsd) as costUsd, COUNT(*) as jobCount
FROM Job
WHERE projectId = ? AND status = 'COMPLETED' AND completedAt >= ?
GROUP BY DATE(completedAt)
ORDER BY date ASC;
```

**Validation Rules**:
- `date` must be within query date range
- `costUsd` must be >= 0
- `jobCount` must be > 0 (no zero-cost days in results)

**Business Rules**:
- Daily granularity: group by calendar day
- Weekly granularity: client-side aggregation of daily data by ISO week
- Missing days show as gaps in chart (no zero-filling)

---

### CostByStage

**Description**: Cost breakdown by workflow stage (horizontal bar chart)

**Fields**:
- `stage`: String - Workflow stage (SPECIFY, PLAN, BUILD, VERIFY)
- `costUsd`: Float - Sum of costs for jobs in that stage
- `jobCount`: Int - Number of jobs in that stage
- `percentage`: Float - Percentage of total cost

**Derivation**:
```typescript
// Fetch jobs with command
SELECT command, SUM(costUsd) as costUsd, COUNT(*) as jobCount
FROM Job
WHERE projectId = ? AND status = 'COMPLETED'
GROUP BY command;

// Map command to stage via lookup table
const COMMAND_TO_STAGE = {
  'specify': 'SPECIFY',
  'plan': 'PLAN',
  'implement': 'BUILD',
  'verify': 'VERIFY',
  'deploy-preview': 'VERIFY',
  'comment-specify': 'SPECIFY',
  'comment-plan': 'PLAN',
  'comment-build': 'BUILD',
  'comment-verify': 'VERIFY',
  'quick-impl': 'BUILD',
  'clean': 'BUILD',
  'rollback-reset': 'PLAN',
};

// Aggregate by stage
const stageData = aggregateByStage(jobData, COMMAND_TO_STAGE);
```

**Validation Rules**:
- `stage` must be one of: SPECIFY, PLAN, BUILD, VERIFY
- `costUsd` must be >= 0
- `jobCount` must be > 0
- `percentage` must sum to ~100% across all stages (allowing floating point rounding)

**Business Rules**:
- Stages sorted descending by cost (highest first)
- Unmapped commands excluded from chart (logged as warning)
- Percentage calculated as `(stageCost / totalCost) * 100`

---

### TokenUsage

**Description**: Token consumption breakdown by type (stacked/grouped bar chart)

**Fields**:
- `inputTokens`: Int - Sum of `inputTokens` across all jobs
- `outputTokens`: Int - Sum of `outputTokens` across all jobs
- `cacheReadTokens`: Int - Sum of `cacheReadTokens` across all jobs
- `cacheCreationTokens`: Int - Sum of `cacheCreationTokens` across all jobs
- `totalTokens`: Int - Sum of all token types

**Derivation**:
```typescript
SELECT
  SUM(inputTokens) as inputTokens,
  SUM(outputTokens) as outputTokens,
  SUM(cacheReadTokens) as cacheReadTokens,
  SUM(cacheCreationTokens) as cacheCreationTokens
FROM Job
WHERE projectId = ? AND status = 'COMPLETED';
```

**Validation Rules**:
- All token counts must be >= 0
- `totalTokens` must equal sum of individual token types
- Null values treated as 0 in aggregation

**Business Rules**:
- Cache tokens = cacheReadTokens + cacheCreationTokens
- Display as stacked bars or grouped bars (UI decision)
- Tooltips show exact counts + percentages

---

### TopTools

**Description**: Most frequently used Claude tools (horizontal bar chart)

**Fields**:
- `toolName`: String - Name of the tool (e.g., "Edit", "Read", "Bash")
- `usageCount`: Int - Number of times tool was used across all jobs
- `percentage`: Float - Percentage of total tool usage

**Derivation**:
```typescript
// Fetch all toolsUsed arrays
SELECT toolsUsed FROM Job
WHERE projectId = ? AND status = 'COMPLETED';

// Flatten and count frequencies
const toolFrequency = jobs
  .flatMap(job => job.toolsUsed)
  .reduce((acc, tool) => {
    acc[tool] = (acc[tool] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

// Sort descending, take top 10
const topTools = Object.entries(toolFrequency)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 10)
  .map(([toolName, usageCount]) => ({
    toolName,
    usageCount,
    percentage: (usageCount / totalToolUsage) * 100
  }));
```

**Validation Rules**:
- `toolName` must be non-empty string
- `usageCount` must be > 0
- `percentage` must be 0-100
- Results limited to top 10 tools

**Business Rules**:
- Sorted descending by usage count (most used first)
- If <10 tools total, show all
- Empty `toolsUsed` arrays contribute no data

---

### CacheEfficiency

**Description**: Cache efficiency percentage (donut chart)

**Fields**:
- `efficiencyPercent`: Float - `(cacheReadTokens / (inputTokens + cacheReadTokens)) * 100`
- `cacheReadTokens`: Int - Total tokens served from cache
- `freshInputTokens`: Int - Total non-cached input tokens
- `totalInputTokens`: Int - Sum of cacheReadTokens + freshInputTokens

**Derivation**:
```typescript
SELECT
  SUM(cacheReadTokens) as cacheReadTokens,
  SUM(inputTokens) as freshInputTokens
FROM Job
WHERE projectId = ? AND status = 'COMPLETED';

const totalInputTokens = cacheReadTokens + freshInputTokens;
const efficiencyPercent = totalInputTokens > 0
  ? (cacheReadTokens / totalInputTokens) * 100
  : 0;
```

**Validation Rules**:
- `efficiencyPercent` must be 0-100
- `cacheReadTokens` must be >= 0
- `freshInputTokens` must be >= 0
- If both are 0, efficiency = 0%

**Business Rules**:
- Higher percentage = better caching = lower costs
- 0% efficiency means no cache usage
- 100% efficiency means all input served from cache (theoretical max)
- Formula matches FR-013 specification

---

### WorkflowDistribution

**Description**: Distribution of workflow types (donut chart)

**Fields**:
- `workflowType`: String - Workflow type (FULL, QUICK, CLEAN)
- `ticketCount`: Int - Number of tickets with this workflow type
- `percentage`: Float - Percentage of total tickets

**Derivation**:
```typescript
SELECT workflowType, COUNT(*) as ticketCount
FROM Ticket
WHERE projectId = ?
GROUP BY workflowType;

const totalTickets = ticketCounts.reduce((sum, c) => sum + c.ticketCount, 0);
const distribution = ticketCounts.map(({ workflowType, ticketCount }) => ({
  workflowType,
  ticketCount,
  percentage: (ticketCount / totalTickets) * 100
}));
```

**Validation Rules**:
- `workflowType` must be one of: FULL, QUICK, CLEAN
- `ticketCount` must be > 0
- `percentage` must sum to ~100% across all types
- Null workflow types excluded (treated as unknown)

**Business Rules**:
- All tickets counted, regardless of stage
- Sorted by percentage descending (most common first)
- If only one workflow type, shows 100% single segment

---

### Velocity

**Description**: Tickets shipped per week (bar chart)

**Fields**:
- `weekStartDate`: Date - ISO week start date (Monday)
- `ticketsShipped`: Int - Number of tickets moved to SHIP in that week
- `weekLabel`: String - Human-readable label (e.g., "Week of Nov 20")

**Derivation**:
```typescript
// Fetch tickets shipped in last 12 weeks
SELECT updatedAt FROM Ticket
WHERE projectId = ? AND stage = 'SHIP' AND updatedAt >= ?
ORDER BY updatedAt ASC;

// Group by ISO week
const velocityByWeek = tickets.reduce((acc, ticket) => {
  const weekStart = getISOWeekStart(ticket.updatedAt);
  acc[weekStart] = (acc[weekStart] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

const velocity = Object.entries(velocityByWeek)
  .map(([weekStartDate, ticketsShipped]) => ({
    weekStartDate: new Date(weekStartDate),
    ticketsShipped,
    weekLabel: formatWeekLabel(weekStartDate)
  }))
  .sort((a, b) => a.weekStartDate - b.weekStartDate);
```

**Validation Rules**:
- `weekStartDate` must be a Monday
- `ticketsShipped` must be > 0
- `weekLabel` must be non-empty string
- Results span last 8-12 weeks

**Business Rules**:
- Weeks with zero shipped tickets excluded from chart (gaps allowed)
- ISO week calculation (Monday-Sunday)
- Current partial week included if tickets shipped
- Uses `updatedAt` field (when ticket transitioned to SHIP)

---

## Command-to-Stage Mapping (Lookup Table)

**Purpose**: Map Job.command values to workflow stages for cost-by-stage aggregation

**Mapping**:
| Command | Stage | Notes |
|---------|-------|-------|
| `specify` | SPECIFY | Main specification workflow |
| `comment-specify` | SPECIFY | AI assistance in SPECIFY stage |
| `plan` | PLAN | Main planning workflow |
| `comment-plan` | PLAN | AI assistance in PLAN stage |
| `rollback-reset` | PLAN | Git reset during VERIFY→PLAN rollback |
| `implement` | BUILD | Main implementation workflow |
| `quick-impl` | BUILD | Quick implementation (bypasses spec/plan) |
| `clean` | BUILD | Automated cleanup workflow |
| `comment-build` | BUILD | AI assistance in BUILD stage |
| `verify` | VERIFY | Test execution and PR creation |
| `deploy-preview` | VERIFY | Vercel preview deployment |
| `comment-verify` | VERIFY | AI assistance in VERIFY stage |

**Validation Rules**:
- Unknown commands logged as warnings (not included in stage aggregation)
- Mapping is immutable (hardcoded in code)
- Case-sensitive exact matching

---

## TypeScript Interfaces

**Location**: `lib/analytics/types.ts`

```typescript
export interface AnalyticsSummary {
  totalCostUsd: number;
  costTrendPercent: number | null;
  successRatePercent: number | null;
  avgDurationMs: number | null;
  ticketsShippedThisMonth: number;
}

export interface CostOverTimeDataPoint {
  date: Date;
  costUsd: number;
  jobCount: number;
}

export interface CostByStageDataPoint {
  stage: string;
  costUsd: number;
  jobCount: number;
  percentage: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
}

export interface TopToolDataPoint {
  toolName: string;
  usageCount: number;
  percentage: number;
}

export interface CacheEfficiency {
  efficiencyPercent: number;
  cacheReadTokens: number;
  freshInputTokens: number;
  totalInputTokens: number;
}

export interface WorkflowDistributionDataPoint {
  workflowType: string;
  ticketCount: number;
  percentage: number;
}

export interface VelocityDataPoint {
  weekStartDate: Date;
  ticketsShipped: number;
  weekLabel: string;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  costOverTime: CostOverTimeDataPoint[];
  costByStage: CostByStageDataPoint[];
  tokenUsage: TokenUsage;
  topTools: TopToolDataPoint[];
  cacheEfficiency: CacheEfficiency;
  workflowDistribution: WorkflowDistributionDataPoint[];
  velocity: VelocityDataPoint[];
}

export const COMMAND_TO_STAGE: Record<string, string> = {
  'specify': 'SPECIFY',
  'plan': 'PLAN',
  'implement': 'BUILD',
  'verify': 'VERIFY',
  'deploy-preview': 'VERIFY',
  'comment-specify': 'SPECIFY',
  'comment-plan': 'PLAN',
  'comment-build': 'BUILD',
  'comment-verify': 'VERIFY',
  'quick-impl': 'BUILD',
  'clean': 'BUILD',
  'rollback-reset': 'PLAN',
};
```

---

## Database Query Performance

**Existing Indexes (No Changes Required)**:

The following existing indexes support analytics queries efficiently:

1. `Job.@@index([projectId])` - Filter all queries by project
2. `Job.@@index([startedAt])` - Time-series cost-over-time queries
3. `Job.@@index([status])` - Filter by COMPLETED/FAILED/CANCELLED
4. `Job.@@index([ticketId, status, startedAt])` - Composite queries
5. `Ticket.@@index([projectId, workflowType])` - Workflow distribution queries
6. `Ticket.@@index([stage])` - Filter by SHIP stage
7. `Ticket.@@index([updatedAt])` - Velocity time-based queries

**Expected Query Performance**:
- Cost aggregation: <50ms for 500 jobs
- Time-series grouping: <100ms for 30 days
- Tool frequency counting: <200ms (client-side array processing)
- Ticket velocity: <50ms for 12 weeks

**No Additional Indexes Needed**: Current schema optimized for analytics queries.

---

## Edge Case Handling

| Scenario | Behavior |
|----------|----------|
| No jobs in project | All metrics show 0 or "No data available" |
| All jobs PENDING/RUNNING | Success rate shows "N/A - No completed jobs" |
| No cost data (costUsd null) | Cost metrics show $0.00 |
| No cache usage | Cache efficiency shows 0% |
| No shipped tickets | Velocity chart shows "No tickets shipped yet" |
| Incomplete telemetry | Calculations use only available data, ignore nulls |
| Division by zero | Return null or 0 with appropriate UI message |
| Unknown job command | Log warning, exclude from stage aggregation |

---

**Data Model Complete**: All entities, relationships, and validation rules documented. Proceed to contracts generation.
