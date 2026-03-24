# Quickstart: AIB-340 Enrich Comparison Dialog

**Branch**: `AIB-340-enrich-comparison-dialog`

## Implementation Order

### Phase 1: Service Layer (no UI changes yet)

1. **Extend types** (`lib/types/comparison.ts`)
   - Add `totalTokens`, `jobCount`, `primaryModel` to `ComparisonTelemetryEnrichment`
   - Add `qualityBreakdown: ComparisonEnrichmentValue<QualityScoreDetails>` to `ComparisonParticipantDetail`

2. **Update aggregation query** (`lib/comparison/comparison-detail.ts`)
   - Replace `distinct: ['ticketId']` latest-job query with `findMany` of all COMPLETED jobs
   - Add `aggregateJobTelemetry()` helper: groups by ticketId, sums numeric fields, identifies primary model
   - Update `normalizeTelemetryEnrichment()` to accept aggregated data and produce new fields
   - Fetch `qualityScoreDetails` from latest verify job, parse JSON, wrap in enrichment value

3. **Write integration tests** (`tests/integration/comparisons/comparison-detail-aggregation.test.ts`)
   - Test: aggregation sums across multiple completed jobs correctly
   - Test: primary model is from highest-token job
   - Test: ticket with no completed jobs returns unavailable enrichments
   - Test: ticket with in-progress jobs returns pending enrichments
   - Test: quality breakdown available only for FULL workflow with completed verify

### Phase 2: Ranking Card Badges

4. **Modify ranking component** (`components/comparison/comparison-ranking.tsx`)
   - Add workflow type badge (always shown)
   - Add agent badge (conditional on non-null)
   - Add quality badge with threshold label (conditional on available state)

5. **Write component tests** (`tests/unit/components/comparison-ranking.test.tsx`)
   - Test: badges render for FULL/QUICK/CLEAN workflows
   - Test: agent badge hidden when agent is null
   - Test: quality badge shows score + label when available, hidden when unavailable

### Phase 3: Operational Metrics Grid

6. **Create grid component** (`components/comparison/comparison-operational-metrics.tsx`)
   - Table with sticky first column
   - 7 metric rows: Total Tokens, Input Tokens, Output Tokens, Duration, Cost, Job Count, Quality Score
   - Column headers: ticketKey + workflowType + agent
   - Best value badges (computed from participant telemetry)
   - Formatting: tokens with commas, duration as "Xm Ys", cost as "$X.XX"
   - Pending/N/A states

7. **Insert into viewer** (`components/comparison/comparison-viewer.tsx`)
   - Add import and render between `<ComparisonMetricsGrid>` and `<ComparisonDecisionPoints>`

8. **Write component tests** (`tests/unit/components/comparison-operational-metrics.test.tsx`)
   - Test: all 7 metric rows render
   - Test: best value badges on correct cells
   - Test: N/A shown for unavailable, Pending for pending state
   - Test: formatting functions produce expected output

### Phase 4: Quality Breakdown Popover

9. **Create popover component** (`components/comparison/comparison-quality-popover.tsx`)
   - Triggered by clicking quality score cell in operational metrics grid
   - 5 dimension rows: name, score, weight, progress bar
   - Overall score with threshold label
   - Only clickable when `qualityBreakdown.state === 'available'`

10. **Write component tests** (`tests/unit/components/comparison-quality-popover.test.tsx`)
    - Test: popover opens on click, shows all 5 dimensions
    - Test: progress bars proportional to scores
    - Test: not clickable when breakdown unavailable
    - Test: popover closes on outside click

## Key Files to Modify

| File | Change Type |
|------|-------------|
| `lib/types/comparison.ts` | Extend interfaces |
| `lib/comparison/comparison-detail.ts` | New aggregation query + helpers |
| `lib/comparison/comparison-record.ts` | Update `normalizeTelemetryEnrichment` signature |
| `components/comparison/comparison-viewer.tsx` | Add OperationalMetrics section |
| `components/comparison/comparison-ranking.tsx` | Add badges |
| `components/comparison/comparison-operational-metrics.tsx` | NEW file |
| `components/comparison/comparison-quality-popover.tsx` | NEW file |
| `components/comparison/types.ts` | Add OperationalMetricsProps |

## Verification

```bash
bun run type-check    # All types compile
bun run lint          # No lint errors
bun run test:unit     # Component tests pass
bun run test:integration  # Aggregation tests pass
```
