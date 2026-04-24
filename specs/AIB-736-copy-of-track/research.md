# Research: Track Per-Turn Context Size on Jobs

## Resolved Unknowns

### 1. Where do per-turn input tokens exist in telemetry?

- **Decision**: Each `claude_code.api_request` OTLP log record already carries `input_tokens` for that individual API call. The processor at `lib/telemetry/otlp-processor.ts:658-668` sums these into `deltaMetrics.inputTokens` per batch. To compute per-turn context metrics, we intercept these values **before** they're summed — tracking the maximum, running sum, and count as the batch is processed.
- **Rationale**: No new telemetry instrumentation needed. Claude Code already emits one `claude_code.api_request` event per API turn with `input_tokens` as an attribute. We compute peak/avg/count from these events.
- **Alternatives considered**: (a) Store every per-turn value in a separate table — rejected (high write volume, overkill for three summary statistics). (b) Compute from raw logs after the fact — rejected (logs may be pruned, adds latency).

### 2. How should Codex per-turn tracking work?

- **Decision**: Codex `codex.sse_event` with `event.kind = "response.completed"` also fires per-turn. The `input_token_count` attribute (which includes cached tokens) represents the total context visible to the model for that turn. Use this value directly as the per-turn context size (it reflects what the model actually "sees").
- **Rationale**: For context-rot analysis, the relevant metric is the total context window usage per turn, not just non-cached input. The full `input_token_count` is the right signal.
- **Alternatives considered**: Use `nonCachedInputTokens` (inputTokenCount minus cachedTokens) — rejected because cached tokens still occupy context window space and contribute to context rot.

### 3. Gemini cumulative mode handling

- **Decision**: Gemini uses CUMULATIVE merge mode where each event reports running totals. Per-turn deltas cannot be reliably extracted from cumulative snapshots. Leave the three context fields null for Gemini jobs (same treatment as Mistral).
- **Rationale**: Without delta-mode per-turn events, computing peak/avg is unreliable. The spec already requires graceful null handling (FR-003, FR-006).
- **Alternatives considered**: Attempt to diff consecutive cumulative values — rejected (events may arrive out of order, gaps produce negative deltas).

### 4. Where to persist the computed metrics

- **Decision**: Add three nullable `Int` columns to the `Job` model: `peakContextTokens`, `avgContextTokens`, `turnCount`. Update them in `updateJobMetrics()` alongside existing telemetry fields.
- **Rationale**: Keeps all job telemetry co-located. No new tables needed. Nullable columns handle agents without per-turn data and historical jobs.
- **Alternatives considered**: Separate `JobContextMetrics` table — rejected (adds a join for every timeline query, over-normalized for three fields).

### 5. Analytics chart type

- **Decision**: Use a histogram (vertical bar chart) showing peak context token distribution across configurable bucket ranges, following the existing `BarChart` pattern from `cost-by-stage-chart.tsx`.
- **Rationale**: Distribution chart is what the spec requests (FR-008). Bar chart is the simplest Recharts component for bucketed data and follows existing patterns.
- **Alternatives considered**: Box plot — rejected (Recharts doesn't natively support it). Scatter plot — rejected (harder to read for distribution analysis).

## Existing Files

### Source Files to Modify

| File | What it covers | Action |
|------|---------------|--------|
| `prisma/schema.prisma` (lines 29-70) | Job model definition | **Extend**: add 3 new fields |
| `lib/telemetry/otlp-processor.ts` (lines 49-61, 176-289, 658-694) | Telemetry metrics accumulation and persistence | **Extend**: track per-turn context stats in metrics, persist to DB |
| `lib/types/job-types.ts` (lines 55-73) | `TicketJobWithTelemetry` interface | **Extend**: add 3 new fields |
| `components/ticket/jobs-timeline.tsx` (lines 81-289) | `JobRow` component rendering job items | **Extend**: add context-health pill in header, context metrics in detail |
| `lib/analytics/types.ts` (lines 1-152) | Analytics data type definitions | **Extend**: add `ContextHealthAnalytics` type |
| `lib/analytics/queries.ts` (lines 629-687) | `getAnalyticsData` orchestrator | **Extend**: add context health aggregation query |
| `lib/analytics/aggregations.ts` | Utility functions for analytics | **Extend**: add quality-score bucket helper, context bucket helper |
| `components/analytics/analytics-dashboard.tsx` (lines 170-252) | Dashboard layout grid | **Extend**: add context-health chart to grid |
| `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` | Ticket jobs GET endpoint | **Extend**: include new fields in select |
| `app/api/projects/[projectId]/analytics/route.ts` | Analytics GET endpoint | No change needed (passes through to `getAnalyticsData`) |

### Source Files to Create

| File | Purpose |
|------|---------|
| `components/analytics/context-health-chart.tsx` | Distribution chart for peak context sizes |
| `prisma/migrations/YYYYMMDD_add_context_metrics/migration.sql` | Schema migration (auto-generated by `prisma migrate dev`) |

### Test Files to Extend

| File | What it covers | Action |
|------|---------------|--------|
| `tests/integration/jobs/ticket-jobs.test.ts` | Ticket jobs endpoint responses | **Extend**: verify new fields returned |
| `tests/integration/jobs/status.test.ts` | Job status transitions & telemetry | **Extend**: verify context metrics persistence |
| `tests/integration/analytics/analytics-route.test.ts` | Analytics endpoint with filters | **Extend**: verify context-health data |
| `tests/unit/components/analytics-dashboard.test.tsx` | Dashboard component rendering | **Extend**: verify context-health chart renders |

### Test Files to Create

| File | Purpose |
|------|---------|
| `tests/unit/context-health.test.ts` | Unit tests for context tier classification, quality bucket helpers |

## Patterns to Follow

### 1. Telemetry Accumulation Pattern (otlp-processor.ts:658-668)

Claude events are processed as DELTA mode — each batch adds to running totals via `mergeTelemetryValue()`. For per-turn tracking, we add three tracking fields to `TelemetryMetrics`:
- `peakContextTokens: number` — updated via `Math.max(current, newTurnValue)` on each `claude_code.api_request`
- `contextTokensSum: number` — running sum of per-turn input tokens (for computing average)
- `turnCount: number` — incremented per `claude_code.api_request` event

These are DELTA-accumulated alongside existing fields (not cumulative).

**Reference**: `lib/telemetry/otlp-processor.ts:658-668` (Claude event processing), `lib/telemetry/otlp-processor.ts:207-227` (metric merging in `updateJobMetrics`).

### 2. Job Update Merge Pattern (otlp-processor.ts:207-263)

When persisting metrics, the processor reads the current job state, merges with new metrics, then writes back atomically:
```
const mergedValue = mergeTelemetryValue(job.existingField, metrics.newField, mergeMode);
```

For context metrics, the merge must handle multiple OTLP batches:
- `peakContextTokens`: `Math.max(job.peakContextTokens ?? 0, metrics.peakContextTokens)`
- `avgContextTokens`: recomputed from merged sum and count
- `turnCount`: `(job.turnCount ?? 0) + metrics.turnCount`

**Reference**: `lib/telemetry/otlp-processor.ts:176-289`

### 3. Analytics Aggregation Pattern (queries.ts:527-605)

Quality score analytics shows the exact pattern for a new analytics section:
1. Query jobs with filter using `buildJobWhere()` + additional field constraints
2. Return empty result when no data (lines 546-553)
3. Compute aggregations in a loop over results
4. Return typed result matching the analytics data structure

**Reference**: `lib/analytics/queries.ts:527-605` (`getQualityScoreAnalytics`)

### 4. Chart Component Pattern (cost-by-stage-chart.tsx:1-97)

Every chart follows the same structure:
1. Props interface with `data` and optional `emptyMessage`
2. Early return with empty state card when data is empty
3. Card with CardHeader/CardTitle + CardContent wrapping ResponsiveContainer
4. Recharts component with theme-aware colors (`hsl(var(--chart-N))`)
5. Custom Tooltip component with `bg-background` card styling

**Reference**: `components/analytics/cost-by-stage-chart.tsx:1-97`

### 5. Type Extension Pattern (job-types.ts:55-73)

`TicketJobWithTelemetry` mirrors Prisma `Job` fields but uses `number | null` instead of `Int?`. The API select clause in `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` must include new fields.

**Reference**: `lib/types/job-types.ts:55-73`, `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`

### 6. Dashboard Grid Placement (analytics-dashboard.tsx:182-233)

Charts are placed in a responsive grid: `grid gap-4 md:grid-cols-2 lg:grid-cols-3`. New charts are added as grid items. Subscription-gated charts (like quality score) are wrapped in a conditional. Context health should follow the same gating pattern if behind `advancedAnalytics`.

**Reference**: `components/analytics/analytics-dashboard.tsx:182-233`
