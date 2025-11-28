# Research: Project Analytics Dashboard

**Date**: 2025-11-28
**Feature**: AIB-83-project-analytics-dashboard

## Overview

This document consolidates research findings for implementing the project analytics dashboard. All technical decisions are documented with rationale and alternatives considered.

---

## 1. Chart Library Selection

**Decision**: Use Recharts (already available via shadcn/ui chart components)

**Rationale**:
- Recharts integrates seamlessly with shadcn/ui design system
- React-based declarative API matches Next.js patterns
- Supports all required chart types (area, bar, donut, stacked bars)
- TypeScript support with proper type definitions
- Responsive by default, works well with Tailwind
- Lightweight compared to alternatives (Chart.js, Victory, Nivo)

**Alternatives Considered**:
- **Chart.js**: More popular but imperative API conflicts with React patterns; requires wrapper library
- **Victory**: Strong animation support but larger bundle size; overkill for static analytics
- **Nivo**: Beautiful defaults but heavier dependencies; more suitable for data visualization apps
- **D3.js**: Maximum flexibility but steep learning curve; excessive for standard business charts

**Implementation Notes**:
- Check if shadcn/ui chart components already installed; if not, add via `npx shadcn@latest add chart`
- Use `<ResponsiveContainer>` for responsive width/height
- Apply Tailwind theme colors for consistency
- Enable tooltips with custom formatters for currency/percentage/duration

---

## 2. Data Aggregation Strategy

**Decision**: Real-time aggregation via Prisma queries (no pre-computed aggregates or caching initially)

**Rationale**:
- Spec specifies AUTO → PRAGMATIC policy: "No caching infrastructure needed for initial version"
- Job telemetry data already indexed on critical fields (projectId, startedAt, status)
- Performance target is <2 seconds for 500 jobs; Prisma aggregation queries can meet this
- Simplifies initial implementation; caching can be added later if performance degrades
- Postgres aggregate functions (SUM, AVG, COUNT) are highly optimized

**Alternatives Considered**:
- **Pre-computed aggregates**: Add hourly/daily summary tables via cron jobs; rejected because adds schema complexity and sync issues
- **Redis caching**: Cache query results with TTL; rejected per PRAGMATIC policy to avoid infrastructure dependency
- **Materialized views**: Postgres materialized views refreshed on schedule; rejected because requires schema migrations and refresh logic

**Implementation Notes**:
- Use Prisma `aggregate()` for sum/avg/count operations
- Use `groupBy()` for time-series and stage-level breakdowns
- Leverage existing indexes: `@@index([projectId, startedAt])` for time-based queries
- Monitor query performance; if >2s, add query result caching in Phase 2

**Query Optimization**:
```typescript
// Efficient cost aggregation
const totalCost = await prisma.job.aggregate({
  where: { projectId, completedAt: { gte: startDate } },
  _sum: { costUsd: true }
});

// Stage-level grouping
const costByStage = await prisma.job.groupBy({
  by: ['command'],
  where: { projectId, status: 'COMPLETED' },
  _sum: { costUsd: true }
});
```

---

## 3. Command-to-Stage Mapping

**Decision**: Map job `command` field to workflow stages using predefined lookup table

**Mapping**:
- `specify` → SPECIFY
- `plan` → PLAN
- `implement` → BUILD
- `verify`, `deploy-preview` → VERIFY
- `comment-specify` → SPECIFY
- `comment-plan` → PLAN
- `comment-build` → BUILD
- `comment-verify` → VERIFY
- `quick-impl` → BUILD
- `clean` → BUILD
- `rollback-reset` → PLAN

**Rationale**:
- Feature requirement FR-009 specifies explicit mapping
- Job model stores `command` (workflow action) not `stage` (ticket stage)
- Some commands map to same stage (verify + deploy-preview → VERIFY)
- Lookup table approach is simple, testable, and easily extensible

**Alternatives Considered**:
- **Infer from ticket stage**: Rejected because job.command is authoritative source; ticket.stage can change after job completes
- **Add stage field to Job model**: Rejected because requires schema migration and duplicates derivable data
- **Use regex patterns**: Rejected because brittle and harder to maintain than explicit mapping

**Implementation Notes**:
```typescript
const COMMAND_TO_STAGE: Record<string, string> = {
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

## 4. Date Range Handling

**Decision**: Default to last 30 days with no date range picker in initial version

**Rationale**:
- Spec auto-resolved decision: "Default to 30 days of data" (PRAGMATIC policy)
- 30-day window covers typical sprint/monthly reporting needs
- Simplifies UI by removing date range controls
- Query performance remains good with 30-day filter vs. all-time data
- Future enhancement can add date picker if users request it

**Alternatives Considered**:
- **All-time data**: Rejected because unbounded queries degrade with large datasets
- **Configurable date range**: Rejected per PRAGMATIC policy to minimize initial complexity
- **Multiple presets** (7d, 30d, 90d): Rejected to avoid UI clutter; can add later based on feedback

**Implementation Notes**:
```typescript
const startDate = new Date();
startDate.setDate(startDate.getDate() - 30);

const jobs = await prisma.job.findMany({
  where: {
    projectId,
    completedAt: { gte: startDate }
  }
});
```

---

## 5. Time-Series Granularity

**Decision**: Daily aggregation by default, weekly aggregation via toggle switch

**Rationale**:
- Spec auto-resolved decision: "Daily aggregation sufficient for most analytics needs"
- Feature description explicitly mentions "daily/weekly" granularity for cost over time
- Daily provides sufficient detail without overwhelming chart with data points
- Weekly aggregation helps identify longer-term trends for projects with sparse activity

**Alternatives Considered**:
- **Hourly granularity**: Rejected because not useful for workflow analytics (jobs span hours/days, not minutes)
- **Monthly aggregation**: Rejected because 30-day default window makes monthly less useful
- **Auto-adjust by range**: Rejected to avoid complexity; toggle provides explicit user control

**Implementation Notes**:
```typescript
// Daily grouping
const dailyCost = await prisma.job.groupBy({
  by: ['completedAt'],
  where: { projectId, status: 'COMPLETED' },
  _sum: { costUsd: true }
});

// Weekly grouping (client-side aggregation from daily data)
const weeklyCost = aggregateByWeek(dailyCost);
```

---

## 6. Tool Usage Aggregation

**Decision**: Aggregate `toolsUsed` arrays from Job.toolsUsed field, display top 10 tools by frequency

**Rationale**:
- Job model already stores `toolsUsed: String[] @default([])` field
- Feature requirement FR-012 specifies top 10 tools
- Frequency count is straightforward: flatten arrays, count occurrences, sort descending
- Top 10 limit prevents chart clutter while showing most relevant tools

**Alternatives Considered**:
- **Show all tools**: Rejected because long tail of rare tools clutters chart
- **Group by category**: Rejected because no tool category taxonomy exists in current data
- **Show tool usage over time**: Rejected to limit initial scope; can add as future enhancement

**Implementation Notes**:
```typescript
// Fetch all jobs with toolsUsed data
const jobs = await prisma.job.findMany({
  where: { projectId, status: 'COMPLETED' },
  select: { toolsUsed: true }
});

// Aggregate tool frequencies
const toolFrequency = jobs
  .flatMap(job => job.toolsUsed)
  .reduce((acc, tool) => {
    acc[tool] = (acc[tool] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

// Sort and take top 10
const topTools = Object.entries(toolFrequency)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 10);
```

---

## 7. Cache Efficiency Calculation

**Decision**: Calculate as `(cacheReadTokens / (inputTokens + cacheReadTokens)) * 100`

**Rationale**:
- Feature requirement FR-013 specifies this exact formula
- Represents percentage of input tokens served from cache vs. fresh tokens
- Higher percentage = better caching = lower costs (cached tokens cost less)
- Formula handles edge cases: if no cache reads, efficiency = 0%

**Alternatives Considered**:
- **Total tokens denominator**: `cacheReadTokens / totalTokens`; rejected because includes output tokens which aren't cacheable
- **Cost-based efficiency**: `cachedCostSavings / totalCost`; rejected because requires cache pricing data not currently stored
- **Cache hit rate**: Count of cache hits vs. misses; rejected because current data doesn't track individual API calls

**Implementation Notes**:
```typescript
const cacheEfficiency = (job: Job): number => {
  const inputTokens = job.inputTokens || 0;
  const cacheReadTokens = job.cacheReadTokens || 0;
  const denominator = inputTokens + cacheReadTokens;

  if (denominator === 0) return 0;
  return (cacheReadTokens / denominator) * 100;
};
```

---

## 8. Success Rate Calculation

**Decision**: `(COMPLETED jobs / (COMPLETED + FAILED + CANCELLED)) * 100`, exclude PENDING/RUNNING

**Rationale**:
- Feature requirement FR-004 specifies this exact formula
- Only jobs in terminal states (COMPLETED/FAILED/CANCELLED) count toward success rate
- PENDING/RUNNING jobs are in-flight and shouldn't affect historical success metrics
- Handles edge case: if no terminal jobs, display "N/A" instead of division by zero

**Alternatives Considered**:
- **Include CANCELLED as neutral**: Rejected because cancellations often indicate problems (user interrupted failing job)
- **Separate success vs. failure rates**: Rejected to keep metric simple; one percentage is easier to interpret
- **Weighted by cost**: Rejected because success rate is workflow reliability metric, not cost metric

**Implementation Notes**:
```typescript
const terminalJobs = await prisma.job.groupBy({
  by: ['status'],
  where: {
    projectId,
    status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] }
  },
  _count: true
});

const completed = terminalJobs.find(g => g.status === 'COMPLETED')?._count || 0;
const total = terminalJobs.reduce((sum, g) => sum + g._count, 0);
const successRate = total > 0 ? (completed / total) * 100 : null;
```

---

## 9. Average Duration Calculation

**Decision**: Average `durationMs` from COMPLETED jobs only, convert to human-readable format

**Rationale**:
- Feature requirement FR-005 specifies average duration for completed jobs
- Only COMPLETED jobs have meaningful duration (FAILED jobs may timeout, CANCELLED jobs are interrupted)
- Human-readable format (e.g., "2m 34s") is more user-friendly than raw milliseconds
- Average provides single number summary; percentiles (p50, p95) can be added later

**Alternatives Considered**:
- **Include all terminal jobs**: Rejected because FAILED/CANCELLED durations are misleading
- **Median instead of mean**: Rejected to keep calculation simple; median requires sorting and percentile logic
- **Show duration distribution**: Rejected to limit initial scope; can add histogram later

**Implementation Notes**:
```typescript
const avgDuration = await prisma.job.aggregate({
  where: { projectId, status: 'COMPLETED' },
  _avg: { durationMs: true }
});

const formatDuration = (ms: number): string => {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};
```

---

## 10. Velocity Calculation

**Decision**: Count tickets in SHIP stage with `updatedAt` within each week of last 8-12 weeks

**Rationale**:
- Feature requirement FR-015 specifies tickets shipped per week
- `updatedAt` timestamp indicates when ticket transitioned to SHIP stage
- 8-12 week window provides sufficient trend data without overwhelming chart
- Weekly granularity matches typical sprint/iteration cadence

**Alternatives Considered**:
- **Use createdAt**: Rejected because shows when ticket was created, not shipped
- **Monthly aggregation**: Rejected because 30-day window makes monthly buckets less useful
- **Cumulative velocity**: Rejected in favor of per-week bars for easier trend identification

**Implementation Notes**:
```typescript
const twelveWeeksAgo = new Date();
twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

const shippedTickets = await prisma.ticket.findMany({
  where: {
    projectId,
    stage: 'SHIP',
    updatedAt: { gte: twelveWeeksAgo }
  },
  select: { updatedAt: true }
});

// Group by week
const velocityByWeek = groupByWeek(shippedTickets);
```

---

## 11. Authorization Pattern

**Decision**: Use existing `verifyProjectAccess(projectId)` helper from `lib/auth-helpers.ts`

**Rationale**:
- Feature requirement FR-016 mandates authorization via verifyProjectAccess
- Existing helper checks both ownership and membership
- Consistent with all other project-scoped API routes
- Returns 403 Forbidden if user lacks access

**Alternatives Considered**:
- **Public analytics**: Rejected because telemetry data is sensitive (cost, usage patterns)
- **Role-based access**: Rejected because current system has binary access (owner/member can view, others cannot)

**Implementation Notes**:
```typescript
import { verifyProjectAccess } from '@/lib/auth-helpers';

export async function GET(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const params = await context.params;
  const projectId = parseInt(params.projectId);

  await verifyProjectAccess(projectId); // Throws 403 if unauthorized

  // ... fetch analytics data
}
```

---

## 12. Navigation Integration

**Decision**: Add "Analytics" menu item to existing project dropdown menu (three-dot menu on project cards)

**Rationale**:
- Feature requirement FR-001 specifies project dropdown menu entry
- Existing dropdown menu pattern used for project settings, members, etc.
- Consistent with current UI/UX patterns
- 2-click navigation: dropdown → Analytics

**Alternatives Considered**:
- **Top-level tab**: Rejected because project pages don't currently use tab navigation
- **Sidebar navigation**: Rejected because no persistent sidebar exists in current design
- **Dashboard widget**: Rejected because requirement specifies dedicated page, not embedded widget

**Implementation Notes**:
- Locate existing project dropdown component (likely in `/components/project/` or `/components/board/`)
- Add menu item with icon (lucide-react `BarChart3` or `TrendingUp`)
- Link to `/project/[projectKey]/analytics` route

---

## Summary of Technical Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| Chart Library | Recharts (via shadcn/ui) | React-native, TypeScript support, integrates with design system |
| Data Aggregation | Real-time Prisma queries | No caching needed per PRAGMATIC policy, existing indexes sufficient |
| Command-to-Stage | Lookup table mapping | Explicit, testable, matches FR-009 specification |
| Date Range | 30-day default, no picker | PRAGMATIC policy, covers typical reporting needs |
| Time Granularity | Daily default, weekly toggle | Matches spec requirement, balances detail vs. clutter |
| Tool Usage | Top 10 by frequency | Prevents chart clutter, shows most relevant data |
| Cache Efficiency | `cacheReadTokens / (inputTokens + cacheReadTokens)` | Matches FR-013, represents input token savings |
| Success Rate | `COMPLETED / (COMPLETED + FAILED + CANCELLED)` | Matches FR-004, excludes in-flight jobs |
| Avg Duration | COMPLETED jobs only, human-readable | Meaningful metric, user-friendly format |
| Velocity | Tickets in SHIP per week, 8-12 weeks | Weekly cadence matches sprints, sufficient trend data |
| Authorization | `verifyProjectAccess()` helper | Consistent with existing patterns, enforces ownership/membership |
| Navigation | Project dropdown menu entry | Matches FR-001, consistent with existing UI |

---

**Research Complete**: All technical unknowns resolved. Proceed to Phase 1 (data-model.md, contracts, quickstart.md).
