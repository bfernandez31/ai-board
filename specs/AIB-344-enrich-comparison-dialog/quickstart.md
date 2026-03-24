# Quickstart: Enrich Comparison Dialog

**Feature**: AIB-344 | **Date**: 2026-03-24

## Implementation Order

### Step 1: Extend Backend Query (lib/comparison/comparison-detail.ts)

Modify `getComparisonDetailForTicket()` to:
- Fetch all COMPLETED jobs per ticket (not just latest) using `buildTelemetryQuery()`
- Group by ticketId and aggregate with `aggregateJobTelemetry()`
- Extend VERIFY job query to include `qualityScoreDetails`
- Parse quality details with `parseQualityScoreDetails()`
- Add `aggregatedTelemetry` and `qualityDetails` to participant response

### Step 2: Extend Types (lib/types/comparison.ts)

Add to `ComparisonParticipantDetail`:
- `aggregatedTelemetry: AggregatedTelemetry | null`
- `qualityDetails: QualityScoreDetails | null`

Define `AggregatedTelemetry` interface.

### Step 3: Create Operational Metrics Utility (lib/comparison/operational-metrics.ts)

- Define 7 metric definitions with keys, labels, directions, formatters
- `buildOperationalMetricRows(participants)` — returns rows with best-value flags
- `determineBestValues(values, direction)` — returns Set of winner indices

### Step 4: Add Ranking Card Badges (components/comparison/comparison-ranking.tsx)

Add three badges per participant card:
1. Workflow type badge (always visible)
2. Agent badge (when `agent` is non-null)
3. Quality score badge (when `quality.state === 'available'`)

### Step 5: Create Operational Metrics Grid (components/comparison/comparison-operational-metrics.tsx)

New component rendering:
- Card with "Operational Metrics" header
- Table with fixed label column and scrollable data columns
- 7 metric rows with formatted values, "Pending", or "N/A"
- "Best" badges on winning cells

### Step 6: Create Quality Popover (components/comparison/comparison-quality-popover.tsx)

New component using shadcn Popover:
- Triggered by clicking quality score cell
- Shows 5 dimensions with scores, progress bars, weights
- Overall score with threshold label in footer
- Only enabled when `qualityDetails` is non-null

### Step 7: Wire Into Dialog (components/comparison/comparison-viewer.tsx)

Insert `ComparisonOperationalMetricsGrid` between `ComparisonMetricsGrid` and `ComparisonDecisionPoints`.

### Step 8: Write Tests

- Unit tests for `operational-metrics.ts` (best-value logic, formatting)
- Component tests for operational metrics grid (7 rows, N/A, Pending, best-value)
- Component tests for ranking badges (workflow, agent, quality)
- Component tests for quality popover (5 dimensions, disabled for non-FULL)
- Integration test for aggregated telemetry query

## Key Dependencies

| Dependency | Already Exists | Location |
|-----------|---------------|----------|
| `aggregateJobTelemetry()` | Yes | `lib/comparison/telemetry-extractor.ts` |
| `formatDurationMs()` | Yes | `lib/comparison/format-duration.ts` |
| `parseQualityScoreDetails()` | Yes | `lib/quality-score.ts` |
| `getScoreThreshold()` | Yes | `lib/quality-score.ts` |
| `getScoreColor()` | Yes | `lib/quality-score.ts` |
| `ComparisonEnrichmentValue<T>` | Yes | `lib/types/comparison.ts` |
| shadcn Popover | Yes | `components/ui/popover.tsx` |
| shadcn Progress | Verify | `components/ui/progress.tsx` |
| shadcn Badge | Yes | `components/ui/badge.tsx` |

## Verification

```bash
bun run type-check    # TypeScript compilation
bun run lint          # ESLint
bun run test:unit     # Unit + component tests
bun run test          # All tests including integration
```
