# Data Model: Project Analytics Dashboard

**Feature**: AIB-87-opus-project-analytics
**Date**: 2025-11-28

## Overview

The analytics dashboard uses **read-only access** to existing entities. No schema changes are required.

## Source Entities

### Job (Existing - No Changes)

Primary source for all analytics data.

| Field | Type | Analytics Usage |
|-------|------|-----------------|
| `id` | Int | N/A (internal) |
| `ticketId` | Int | Link to ticket for workflow type |
| `projectId` | Int | Scope filter |
| `command` | String | Stage derivation (see mapping below) |
| `status` | JobStatus | Filter for COMPLETED jobs |
| `startedAt` | DateTime | Duration calculation |
| `completedAt` | DateTime | Time series grouping, trend calculation |
| `inputTokens` | Int? | Token usage chart |
| `outputTokens` | Int? | Token usage chart |
| `cacheReadTokens` | Int? | Cache efficiency chart |
| `cacheCreationTokens` | Int? | Cache efficiency chart |
| `costUsd` | Float? | Cost metrics, trend indicator |
| `durationMs` | Int? | Average job duration metric |
| `toolsUsed` | String[] | Top tools chart |

**Relevant Indexes** (existing):
- `@@index([projectId])` - Primary scope filter
- `@@index([status])` - Filter completed jobs
- `@@index([startedAt])` - Time range queries

### Ticket (Existing - No Changes)

Source for workflow type distribution and velocity metrics.

| Field | Type | Analytics Usage |
|-------|------|-----------------|
| `id` | Int | Link from Job |
| `projectId` | Int | Scope filter |
| `stage` | Stage | Velocity (SHIP count) |
| `workflowType` | WorkflowType | Workflow distribution chart |
| `updatedAt` | DateTime | Velocity time series |

**Relevant Indexes** (existing):
- `@@index([projectId])` - Primary scope filter
- `@@index([projectId, workflowType])` - Workflow distribution

### Project (Existing - No Changes)

Authorization scope.

| Field | Type | Analytics Usage |
|-------|------|-----------------|
| `id` | Int | Route parameter, access control |
| `userId` | String | Owner authorization |
| `members` | ProjectMember[] | Member authorization |

## Derived Data Structures

### Command to Stage Mapping

Pure function (no database changes):

```typescript
type StageKey = 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY';

const COMMAND_TO_STAGE: Record<string, StageKey> = {
  'specify': 'SPECIFY',
  'comment-specify': 'SPECIFY',
  'plan': 'PLAN',
  'comment-plan': 'PLAN',
  'rollback-reset': 'PLAN',
  'implement': 'BUILD',
  'quick-impl': 'BUILD',
  'comment-build': 'BUILD',
  'clean': 'BUILD',
  'verify': 'VERIFY',
  'deploy-preview': 'VERIFY',
  'comment-verify': 'VERIFY',
};
```

### Analytics Response Types

#### OverviewMetrics

```typescript
interface OverviewMetrics {
  totalCost: number;           // Sum of costUsd for period
  costTrend: number;           // Percentage change vs previous period
  successRate: number;         // COMPLETED / (COMPLETED + FAILED) * 100
  avgDuration: number;         // Average durationMs of completed jobs
  ticketsShipped: number;      // Count of tickets in SHIP stage this month
}
```

#### CostOverTime

```typescript
interface CostDataPoint {
  date: string;                // ISO date or week identifier
  cost: number;                // Sum of costUsd for that period
}

type CostOverTime = CostDataPoint[];
```

#### CostByStage

```typescript
interface StageCost {
  stage: 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY';
  cost: number;
  percentage: number;          // Relative to total
}

type CostByStage = StageCost[];
```

#### TokenUsage

```typescript
interface TokenBreakdown {
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;         // cacheReadTokens + cacheCreationTokens
}
```

#### CacheEfficiency

```typescript
interface CacheMetrics {
  totalTokens: number;         // input + output + cache
  cacheTokens: number;         // cacheReadTokens + cacheCreationTokens
  savingsPercentage: number;   // (cacheTokens / totalTokens) * 100
  estimatedSavingsUsd: number; // Estimated cost savings from cache
}
```

#### TopTools

```typescript
interface ToolUsage {
  tool: string;                // Tool name (Edit, Read, Bash, etc.)
  count: number;               // Usage frequency
}

type TopTools = ToolUsage[];   // Sorted by count descending, max 10
```

#### WorkflowDistribution

```typescript
interface WorkflowBreakdown {
  type: 'FULL' | 'QUICK' | 'CLEAN';
  count: number;
  percentage: number;
}

type WorkflowDistribution = WorkflowBreakdown[];
```

#### VelocityData

```typescript
interface WeeklyVelocity {
  week: string;                // ISO week identifier (2025-W48)
  ticketsShipped: number;
}

type VelocityData = WeeklyVelocity[];
```

### Aggregated Analytics Response

```typescript
interface AnalyticsData {
  overview: OverviewMetrics;
  costOverTime: CostOverTime;
  costByStage: CostByStage;
  tokenUsage: TokenBreakdown;
  cacheEfficiency: CacheMetrics;
  topTools: TopTools;
  workflowDistribution: WorkflowDistribution;
  velocity: VelocityData;

  // Metadata
  timeRange: '7d' | '30d' | '90d' | 'all';
  generatedAt: string;         // ISO timestamp
  jobCount: number;            // Total jobs in range
  hasData: boolean;            // False if no completed jobs
}
```

## Query Strategies

### Overview Metrics Query

```sql
-- Total cost and success rate for period
SELECT
  SUM(cost_usd) as total_cost,
  COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_count,
  COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'FAILED')) as total_count,
  AVG(duration_ms) FILTER (WHERE status = 'COMPLETED') as avg_duration
FROM jobs
WHERE project_id = $1
  AND status IN ('COMPLETED', 'FAILED')
  AND completed_at >= $2;
```

### Trend Calculation

Compare current period sum to previous period of equal length:
- 7d current vs 7d previous
- 30d current vs 30d previous
- Trend = ((current - previous) / previous) * 100

### Tool Usage Aggregation

Since `toolsUsed` is a string array, aggregate in application layer:

```typescript
function aggregateTools(jobs: Job[]): TopTools {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    for (const tool of job.toolsUsed) {
      counts.set(tool, (counts.get(tool) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
```

## Validation Rules

### Time Range Validation

```typescript
const TIME_RANGE_SCHEMA = z.enum(['7d', '30d', '90d', 'all']);
```

### Project Access Validation

Existing `verifyProjectAccess(projectId)` function handles:
- User is project owner (`project.userId === session.user.id`)
- User is project member (`project.members.some(m => m.userId === session.user.id)`)

## Empty State Detection

```typescript
function hasAnalyticsData(jobs: Job[]): boolean {
  return jobs.some(job =>
    job.status === 'COMPLETED' &&
    (job.costUsd != null || job.inputTokens != null)
  );
}
```

## State Transitions

No state transitions apply - analytics is read-only.

## Relationships Diagram

```
Project (1) ──────┬────── (*) Ticket
                  │              │
                  │              │ workflowType
                  │              │
                  │              ▼
                  │       WorkflowDistribution
                  │
                  │
                  └────── (*) Job
                              │
                              ├── costUsd ──────────▶ CostOverTime, CostByStage
                              ├── inputTokens ─────▶ TokenUsage
                              ├── outputTokens ────▶ TokenUsage
                              ├── cacheReadTokens ──▶ CacheEfficiency
                              ├── cacheCreationTokens ▶ CacheEfficiency
                              ├── durationMs ──────▶ OverviewMetrics
                              ├── toolsUsed ───────▶ TopTools
                              ├── command ─────────▶ CostByStage (via mapping)
                              └── status ──────────▶ OverviewMetrics (success rate)
```
