# Research: Enrich Comparison Dialog

**Feature**: AIB-340 | **Date**: 2026-03-24

## R1: Aggregation Strategy — Latest Job vs All Completed Jobs

**Decision**: Aggregate across ALL completed jobs per ticket (sum tokens, cost, duration; count jobs).

**Rationale**: The spec explicitly requires FR-006 to sum across all completed jobs. This provides the honest "total investment" picture. The current implementation in `comparison-detail.ts:171-187` fetches only the latest job via `distinct: ['ticketId']`, which must be replaced with a full aggregation query.

**Alternatives considered**:
1. Latest job only (current behavior) — rejected because it underreports cost/effort for tickets with multiple build cycles
2. Prisma `$queryRaw` with SQL `GROUP BY` — rejected because Prisma's `findMany` + in-memory grouping is type-safe and bounded (max 6 tickets × ~50 jobs)
3. Prisma `groupBy` for sums — considered but `groupBy` doesn't support selecting non-aggregated fields like `model`, so a `findMany` + in-memory reduce is simpler

## R2: Primary Model Determination

**Decision**: The primary AI model is the `model` field from the job with the highest total token consumption (inputTokens + outputTokens).

**Rationale**: Spec decision (lines 54-62) explicitly states this approach. The highest-token job is most likely the main implementation work. If all jobs have null model, show "N/A".

**Alternatives considered**:
1. Most recent job's model — rejected because latest job might be a small verify run, not the main build
2. Most frequent model across jobs — rejected because it adds complexity with no clear benefit over highest-token heuristic

## R3: Quality Score Breakdown Data Source

**Decision**: Use the existing `qualityScoreDetails` JSON field on the Job model. Parse it as `QualityScoreDetails` from `lib/quality-score.ts`.

**Rationale**: The 5 dimensions (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync) with weights and scores are already stored. No new data collection needed.

**Alternatives considered**:
1. Compute breakdown on the fly — rejected because data already exists in JSON
2. Store breakdown in a separate table — rejected because it would require a migration for existing data

## R4: Best Value Logic

**Decision**: For each metric row, compare across all participants and mark the best value(s). Best = lowest for tokens, duration, cost, job count; best = highest for quality score. Ties share the badge.

**Rationale**: Spec explicitly defines polarity per metric (FR-007) and tie behavior (lines 65-72). Implementation mirrors existing `buildBestValueFlags` pattern in `comparison-record.ts:109-141`.

**Alternatives considered**: None — spec is explicit.

## R5: Sticky Column for Horizontal Scroll

**Decision**: CSS `position: sticky; left: 0;` on the first column cells with `bg-card` background to prevent content bleed-through.

**Rationale**: Standard CSS sticky positioning works with `overflow-x-auto` on the container. No JavaScript scroll handlers needed. Native mobile horizontal scroll is preserved.

**Alternatives considered**:
1. JavaScript-based virtual scroll — rejected because max 6 columns is far below virtualization thresholds
2. Separate fixed column + scrollable area — rejected because CSS sticky is simpler and has excellent browser support

## R6: Popover vs Dialog for Quality Breakdown

**Decision**: Use shadcn/ui `Popover` component (Radix UI-based) for the quality breakdown.

**Rationale**: The spec says "popover" (FR-012). Popover is appropriate for contextual detail that doesn't interrupt flow. Radix Popover handles positioning, focus management, and click-outside dismissal.

**Alternatives considered**:
1. Tooltip — rejected because content is too rich (5 rows with progress bars)
2. Dialog — rejected because it's too heavy for supplementary detail; spec says popover

## R7: Enrichment Type Extension Strategy

**Decision**: Extend `ComparisonTelemetryEnrichment` with new fields (`totalTokens`, `jobCount`, `primaryModel`) rather than creating a separate type.

**Rationale**: The existing `ComparisonEnrichmentValue<T>` tri-state wrapper (available/pending/unavailable) already handles all needed states. Adding fields to the existing type preserves backward compatibility — existing fields (inputTokens, outputTokens, durationMs, costUsd) continue to work. The new fields use the same pattern.

**Alternatives considered**:
1. New `ComparisonOperationalMetrics` type separate from telemetry — rejected because it would require parallel enrichment flows and duplicate pending/unavailable logic
2. Replace telemetry type entirely — rejected because existing code depends on current shape

## R8: Quality Breakdown in API Response

**Decision**: Add `qualityBreakdown: ComparisonEnrichmentValue<QualityScoreDetails>` to `ComparisonParticipantDetail`. The service layer fetches the latest verify job's `qualityScoreDetails` JSON and parses it.

**Rationale**: The popover needs dimension-level data that isn't currently in the API response. Adding it to the participant detail keeps all enrichment data in one place. Using the enrichment wrapper handles the unavailable case (QUICK workflow, no verify job).

**Alternatives considered**:
1. Separate API endpoint for quality breakdown — rejected because it adds a network round-trip for data that's small and already queryable in the same service call
2. Client-side fetch on popover open — rejected because it adds latency to the popover interaction
