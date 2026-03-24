# Quickstart: Enrich comparison dialog with operational metrics and quality data

## Implementation Order

1. Expand `lib/types/comparison.ts` with the operational metric, quality summary, and quality breakdown contracts required by the dialog.
2. Refactor `lib/comparison/comparison-detail.ts` to aggregate all participant jobs, derive primary model, compute best-value flags, and enforce comparison-specific quality-detail eligibility.
3. Update `lib/comparison/comparison-record.ts` normalization helpers so the GET detail route returns the richer participant shape cleanly.
4. Update `components/comparison/comparison-ranking.tsx` to show workflow type, optional agent, and quality score plus threshold label.
5. Add `components/comparison/comparison-operational-metrics-grid.tsx` and insert it in `components/comparison/comparison-viewer.tsx` after implementation metrics.
6. Extend unit, component, and integration tests around comparison detail enrichment and rendering.

## Expected API Shape Change

The existing detail route stays the same:

- `GET /api/projects/{projectId}/tickets/{ticketId}/comparisons/{comparisonId}`

But each participant now needs:

- persisted comparison metadata:
  - `ticketKey`
  - `workflowType`
  - `agent`
  - `rank`
  - `score`
  - `metrics`
- operational summary:
  - `primaryModel`
  - `operational.totalTokens`
  - `operational.inputTokens`
  - `operational.outputTokens`
  - `operational.durationMs`
  - `operational.costUsd`
  - `operational.jobCount`
- quality summary:
  - `quality.score`
  - `quality.thresholdLabel`
  - `quality.detailAvailable`
  - `quality.breakdown`

## Manual Verification Flow

1. Seed or create a comparison with 2-6 participant tickets.
2. Ensure at least one participant has multiple jobs with telemetry and mixed models.
3. Ensure at least one participant has a completed FULL verify job with complete `qualityScoreDetails`.
4. Ensure at least one participant has incomplete or missing telemetry to exercise `Pending` and `N/A`.
5. Open the comparison dialog and verify:
   - section order is Ranking -> Implementation Metrics -> Operational Metrics -> Decision Points -> Compliance Grid
   - ranking cards show workflow type and optional agent
   - operational table shows seven rows
   - lowest/highest best-value badges appear correctly
   - sticky metric label column remains visible while horizontal scrolling
   - eligible quality cells open inline details with five dimensions
   - ineligible quality cells do not offer the interaction

## Test Targets

- Unit:
  - `tests/unit/comparison/`
- Component:
  - `tests/unit/components/comparison-dashboard-sections.test.tsx`
  - `tests/unit/components/comparison-ranking.test.tsx`
  - `tests/unit/components/quality-score-section.test.tsx` as interaction reference
- Integration:
  - `tests/integration/comparisons/comparison-detail-route.test.ts`
  - `tests/integration/comparisons/comparison-dashboard-api.test.ts`

## Non-Goals

- No new Prisma migration
- No workflow changes
- No ranking algorithm change
- No changes to saved implementation metrics, decision points, or compliance persistence
