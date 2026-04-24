# Implementation Plan: Track Per-Turn Context Size on Jobs

**Branch**: `AIB-736-copy-of-track`
**Spec**: `specs/AIB-736-copy-of-track/spec.md`

## Technical Context

| Aspect | Details |
|--------|---------|
| Primary language | TypeScript 5.9 (strict) |
| Framework | Next.js 16 (App Router), React 18 |
| Database | PostgreSQL 14+ via Prisma 6.x |
| Telemetry pipeline | OTLP-based ingestion via `POST /api/telemetry/v1/logs` |
| Charts | Recharts 3.x |
| Test framework | Vitest (unit + integration), Playwright (E2E) |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new types explicitly typed; no `any` |
| II. Component-Driven | PASS | Extends existing `JobRow` component; new chart follows shadcn/ui Card pattern |
| III. Test-Driven | PASS | Extends existing test files first; new unit test only for pure helpers |
| IV. Security-First | PASS | No new user inputs; context metrics computed from trusted telemetry pipeline |
| V. Database Integrity | PASS | Nullable migration, no data loss; telemetry update is atomic |
| V. Spec Clarification | PASS | Four auto-resolved decisions documented with CONSERVATIVE fallback |

## Implementation Phases

### Phase 1: Data Layer (Schema + Telemetry Processing)

**Goal**: Add the three context metric fields to the Job model and compute them during telemetry ingestion.

#### 1.1 Prisma Schema Migration

**File**: `prisma/schema.prisma` (after line 54)

Add three nullable integer fields:
```prisma
peakContextTokens   Int?
avgContextTokens    Int?
turnCount           Int?
```

Run `bunx prisma migrate dev --name add_context_metrics` to generate migration.

#### 1.2 Telemetry Processor Extension

**File**: `lib/telemetry/otlp-processor.ts`

**Changes to `TelemetryMetrics` interface** (line 33):
- Add `peakContextTokens: number` (default 0)
- Add `contextTokensSum: number` (default 0, internal running sum — not persisted directly)
- Add `turnCount: number` (default 0)

**Changes to `createEmptyMetrics()`** (line 49):
- Initialize new fields to 0

**Changes to Claude event processing** (line 658):
- On each `claude_code.api_request` event:
  ```typescript
  const turnInputTokens = parseIntAttribute(findAttribute(attrs, 'input_tokens'));
  if (turnInputTokens > 0) {
    deltaMetrics.peakContextTokens = Math.max(deltaMetrics.peakContextTokens, turnInputTokens);
    deltaMetrics.contextTokensSum += turnInputTokens;
    deltaMetrics.turnCount += 1;
  }
  ```

**Changes to Codex event processing** (line 670):
- On each `codex.sse_event` with `response.completed`:
  ```typescript
  if (totalInputTokens > 0) {
    deltaMetrics.peakContextTokens = Math.max(deltaMetrics.peakContextTokens, totalInputTokens);
    deltaMetrics.contextTokensSum += totalInputTokens;
    deltaMetrics.turnCount += 1;
  }
  ```
  Note: Use `totalInputTokens` (before subtracting cached) as the context window size for per-turn tracking.

**Changes to `updateJobMetrics()`** (line 178):
- Read existing `peakContextTokens`, `avgContextTokens`, `turnCount` from job select
- Merge context metrics:
  ```typescript
  if (metrics.turnCount > 0) {
    const newPeak = Math.max(job.peakContextTokens ?? 0, metrics.peakContextTokens);
    const existingTurnCount = job.turnCount ?? 0;
    const existingSum = (job.avgContextTokens ?? 0) * existingTurnCount;
    const totalTurnCount = existingTurnCount + metrics.turnCount;
    const totalSum = existingSum + metrics.contextTokensSum;
    
    updateData.peakContextTokens = newPeak;
    updateData.avgContextTokens = Math.round(totalSum / totalTurnCount);
    updateData.turnCount = totalTurnCount;
  }
  ```

**No changes for Gemini/Mistral**: These agents don't fire delta per-turn events with `input_tokens`, so their `turnCount` remains 0 in the metrics, and no context fields are written (remain null).

#### 1.3 Type Updates

**File**: `lib/types/job-types.ts`

Add to `TicketJobWithTelemetry` interface:
```typescript
peakContextTokens: number | null;
avgContextTokens: number | null;
turnCount: number | null;
```

#### 1.4 API Select Updates

**File**: `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`

Add `peakContextTokens: true`, `avgContextTokens: true`, `turnCount: true` to the Prisma select clause.

---

### Phase 2: Timeline UI (Context Health Pill + Detail View)

**Goal**: Show context-health indicator on collapsed job rows and context metrics in expanded detail view.

#### 2.1 Context Health Helper

**File**: `lib/analytics/aggregations.ts` (or a small inline helper in the component)

```typescript
type ContextHealthTier = 'healthy' | 'warning' | 'danger';

function getContextHealthTier(peakContextTokens: number): ContextHealthTier {
  if (peakContextTokens >= 100_000) return 'danger';
  if (peakContextTokens >= 50_000) return 'warning';
  return 'healthy';
}

const CONTEXT_HEALTH_CONFIG: Record<ContextHealthTier, { color: string; label: string }> = {
  healthy: { color: 'text-ctp-green', label: 'Healthy' },
  warning: { color: 'text-ctp-yellow', label: 'Warning' },
  danger: { color: 'text-ctp-red', label: 'Danger' },
};
```

#### 2.2 JobRow Header Pill

**File**: `components/ticket/jobs-timeline.tsx` (inside `JobRow`, line ~133)

After the model badge, add a context-health pill when `job.peakContextTokens != null`:
```tsx
{job.peakContextTokens != null && (() => {
  const tier = getContextHealthTier(job.peakContextTokens);
  const config = CONTEXT_HEALTH_CONFIG[tier];
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${config.color} bg-secondary hidden sm:inline`}>
      {formatAbbreviatedNumber(job.peakContextTokens)} ctx · {job.turnCount} turns
    </span>
  );
})()}
```

No pill rendered when `peakContextTokens` is null (FR-006).

#### 2.3 Expanded Detail View Extension

**File**: `components/ticket/jobs-timeline.tsx` (inside `CollapsibleContent`, after token breakdown grid)

Add a context metrics section when context data is available:
```tsx
{job.peakContextTokens != null && (
  <div className="grid grid-cols-2 gap-4 text-sm border-t border-border pt-3">
    <div>
      <span className="text-ctp-overlay0">Peak Context:</span>
      <span className="ml-2 text-foreground font-medium">
        {formatAbbreviatedNumber(job.peakContextTokens)}
      </span>
    </div>
    <div>
      <span className="text-ctp-overlay0">Avg Context:</span>
      <span className="ml-2 text-foreground font-medium">
        {job.avgContextTokens != null ? formatAbbreviatedNumber(job.avgContextTokens) : '-'}
      </span>
    </div>
    <div>
      <span className="text-ctp-overlay0">Turn Count:</span>
      <span className="ml-2 text-foreground font-medium">
        {job.turnCount ?? '-'}
      </span>
    </div>
  </div>
)}
```

---

### Phase 3: Analytics Dashboard (Context Health Distribution Chart)

**Goal**: Add a context-health distribution chart to the project analytics dashboard with command/workflow/quality filtering.

#### 3.1 Analytics Types

**File**: `lib/analytics/types.ts`

```typescript
export interface ContextBucket {
  bucket: string;
  count: number;
}

export interface ContextHealthAnalytics {
  distribution: ContextBucket[];
  averagePeak: number | null;
  totalJobsWithData: number;
}
```

Add `contextHealth?: ContextHealthAnalytics | null` to `AnalyticsData` interface.

#### 3.2 Analytics Query

**File**: `lib/analytics/queries.ts`

Add `getContextHealthAnalytics()` function following the `getQualityScoreAnalytics` pattern:

1. Query completed jobs with `peakContextTokens: { not: null }` and existing filters
2. Optionally filter by `command`, `workflowType` (from ticket), and quality score bucket
3. Bucket peak values into distribution ranges (0-25K, 25-50K, 50-75K, 75-100K, 100-150K, 150K+)
4. Compute average peak across all qualifying jobs
5. Return `ContextHealthAnalytics`

Add to `getAnalyticsData()` Promise.all array.

#### 3.3 Chart Component

**File**: `components/analytics/context-health-chart.tsx` (new)

Follow the `CostByStageChart` pattern:
- Props: `data: ContextBucket[]`, `emptyMessage?: string`
- Empty state: Card with centered message
- Chart: Vertical `BarChart` with bucket labels on X-axis, count on Y-axis
- Color: Bars colored by health tier (green for 0-50K buckets, yellow for 50-100K, red for 100K+)
- Tooltip: Shows bucket range and job count

#### 3.4 Dashboard Integration

**File**: `components/analytics/analytics-dashboard.tsx`

Add context-health chart to the grid, gated behind `advancedAnalytics` subscription:
```tsx
{subscription?.limits.advancedAnalytics && analytics.contextHealth && (
  <div className="md:col-span-2">
    <ContextHealthChart
      data={analytics.contextHealth.distribution}
      emptyMessage={emptyMessage}
    />
  </div>
)}
```

#### 3.5 Analytics Query Parameters (Optional Filtering)

The context-health chart supports client-side filtering within the dashboard's existing filter infrastructure. The analytics API query function accepts optional `command`, `workflowType`, and `qualityBucket` parameters. Initially, these are passed server-side from the existing filter state. Dedicated filter dropdowns specific to the context chart can be added as a follow-up.

---

## Testing Strategy

### Unit Tests

**Extend**: `tests/unit/context-health.test.ts` (new file — no existing file covers context tier logic)
- `getContextHealthTier()`: verify threshold boundaries (49999→healthy, 50000→warning, 99999→warning, 100000→danger)
- Quality score bucket helper: verify bucket boundaries
- Context size bucket helper: verify distribution bucketing

### Integration Tests

**Extend**: `tests/integration/jobs/ticket-jobs.test.ts`
- Verify the three new fields are returned in the GET response when populated
- Verify null fields when job has no context metrics

**Extend**: `tests/integration/jobs/status.test.ts`
- This file tests job lifecycle and telemetry persistence
- Add scenario: simulate OTLP telemetry with per-turn input_tokens → verify peakContextTokens, avgContextTokens, turnCount computed correctly on job

**Extend**: `tests/integration/analytics/analytics-route.test.ts`
- Seed jobs with known context metrics → verify distribution buckets
- Verify null-context jobs excluded from analytics
- Verify empty state when no jobs have context data

### Component Tests

**Extend**: `tests/unit/components/analytics-dashboard.test.tsx`
- Verify context-health chart renders when data present
- Verify chart hidden when `advancedAnalytics` disabled or no data

### No E2E Tests

Context metrics are read-only computed data. The critical paths (telemetry ingestion, API responses, chart rendering) are fully covered by integration and component tests. No browser-specific behavior (OAuth, drag-drop) requires Playwright.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Multi-batch OTLP merge produces incorrect average | Medium | Low | Average recomputed from (existingAvg × existingCount + newSum) / totalCount; unit test covers merge scenarios |
| Gemini/Mistral jobs accidentally get non-null context fields | Low | Medium | Guard: only set fields when `turnCount > 0` in metrics; Gemini events don't populate turnCount |
| Migration causes downtime | Very Low | Low | Nullable columns only — no table locks, no backfill |
| Context metrics pollute existing telemetry | Low | High | FR-004 compliance: context fields are written alongside (not instead of) existing fields; existing updateData assignments unchanged |

## Dependencies

- No new npm packages
- No runner/agent changes (uses existing OTLP attributes)
- No new environment variables
- No workflow file changes

## Generated Artifacts

| Artifact | Path |
|----------|------|
| Research | `specs/AIB-736-copy-of-track/research.md` |
| Data Model | `specs/AIB-736-copy-of-track/data-model.md` |
| API Contract | `specs/AIB-736-copy-of-track/contracts/api-contract.md` |
| Implementation Plan | `specs/AIB-736-copy-of-track/plan.md` (this file) |
