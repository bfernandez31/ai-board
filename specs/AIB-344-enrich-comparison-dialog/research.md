# Research: Enrich Comparison Dialog

**Feature**: AIB-344 | **Date**: 2026-03-24

## Research Tasks & Findings

### R1: Telemetry Aggregation — Latest Job vs All Jobs

**Question**: The current `comparison-detail.ts` fetches only the latest job per ticket for telemetry enrichment. FR-007 requires aggregation across all completed jobs. How should this change?

**Decision**: Replace the single-latest-job query with `buildTelemetryQuery()` + `aggregateJobTelemetry()` from `telemetry-extractor.ts`, which already sums across all COMPLETED jobs.

**Rationale**: The `aggregateJobTelemetry()` function already implements correct aggregation logic (lines 16-76 of `telemetry-extractor.ts`). It sums `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheCreationTokens`, `costUsd`, `durationMs` across all jobs and derives the primary model from the most-used model. Reusing this avoids duplication.

**Alternatives considered**:
- Keep latest-job-only and add a separate aggregation query — rejected (duplicates existing logic, two sources of truth)
- Create a database view for aggregated telemetry — rejected (over-engineering for a read-only UI feature)

---

### R2: ComparisonTelemetryEnrichment — Extending for Aggregated Data

**Question**: The current `ComparisonTelemetryEnrichment` type only has `inputTokens`, `outputTokens`, `durationMs`, `costUsd`. FR-005 requires `totalTokens`, `jobCount`, and `qualityScore` rows.

**Decision**: Keep `ComparisonTelemetryEnrichment` unchanged (it represents per-field enrichment state). Instead, extend `ComparisonParticipantDetail` with new fields for the aggregated data needed by the operational metrics grid.

**Rationale**: The enrichment state machine (`available | pending | unavailable`) applies per-field. Adding `totalTokens` (derived from input + output), `jobCount`, and `qualityScore` as separate enrichment values keeps the pattern consistent. The operational metrics component can derive `totalTokens` from `inputTokens.value + outputTokens.value`.

**Alternatives considered**:
- Flatten all 7 metrics into `ComparisonTelemetryEnrichment` — rejected (mixes telemetry with quality, violates single responsibility)
- Create a new `OperationalMetrics` type replacing telemetry — rejected (breaks existing `ComparisonParticipantDetail` consumers)

---

### R3: Best-Value Highlighting Logic

**Question**: How should best-value be determined across metrics? FR-008 specifies lowest-is-best for tokens/duration/cost/job count, highest-is-best for quality.

**Decision**: Create a pure function `determineBestValues(participants, metricKey, direction)` that returns a `Set<ticketId>` of winners. Direction is `'lowest'` or `'highest'`. Ties result in all tied participants being included (FR-009).

**Rationale**: The existing `bestValueFlags` pattern on `ComparisonMetricSnapshot` uses `Record<string, boolean>` per participant. The operational metrics grid needs the same pattern but computed at render time from aggregated data (not stored in DB).

**Alternatives considered**:
- Compute best values server-side and store in response — rejected (adds API complexity for a simple client-side calculation)
- Use the existing `bestValueFlags` from `ComparisonMetricSnapshot` — rejected (those are for implementation metrics, not operational metrics)

---

### R4: Quality Score Breakdown Popover Data

**Question**: Where does the 5-dimension quality breakdown data come from? FR-012-013 require it for FULL workflow tickets that passed VERIFY.

**Decision**: Fetch `qualityScoreDetails` (JSON string) from the latest VERIFY job alongside `qualityScore`. Parse using existing `parseQualityScoreDetails()` from `lib/quality-score.ts`. Pass parsed details through the API response as part of the participant detail.

**Rationale**: `qualityScoreDetails` is already stored on the Job model as a JSON string. `parseQualityScoreDetails()` already handles null/invalid JSON gracefully. The `QualityScoreDetails` type already has `dimensions: DimensionScore[]` with name, score, weight, weightedScore — exactly what the popover needs.

**Alternatives considered**:
- Create a separate API endpoint for quality breakdown — rejected (over-engineering; data is small and can be included in the comparison detail response)
- Lazy-load quality details on popover open — rejected (adds latency and complexity for minimal data savings)

---

### R5: Horizontal Scroll with Fixed Label Column

**Question**: FR-014-015 require horizontal scrolling with a fixed metric labels column for 2-6 participants.

**Decision**: Use CSS `overflow-x-auto` on the grid container with `position: sticky; left: 0` on the label column. No JavaScript scroll handling needed.

**Rationale**: CSS sticky positioning is widely supported (99%+ browser coverage). The existing `ComparisonMetricsGrid` uses a simple table — the new grid can follow the same pattern with sticky first column. Native touch scrolling works automatically with `overflow-x-auto`.

**Alternatives considered**:
- Use a virtualized table library (e.g., TanStack Table) — rejected (max 6 columns × 7 rows = 42 cells, no need for virtualization)
- JavaScript-based scroll synchronization — rejected (CSS sticky is simpler and more performant)

---

### R6: Formatting Conventions

**Question**: What formatting should be used for each metric type?

**Decision**: Reuse existing formatters where possible:
- **Tokens**: `toLocaleString()` for thousands separators (e.g., "12,450") — matches `formatTelemetryDisplay()`
- **Cost**: `$X.XXXX` format (4 decimal places) — matches existing `formatTelemetryDisplay()` which uses `toFixed(4)`
- **Duration**: `formatDurationMs()` from `lib/comparison/format-duration.ts` (e.g., "2m 34s")
- **Job count**: Plain integer
- **Quality score**: Integer + threshold label (e.g., "87 Good") — matches `QualityScoreBadge` pattern

**Rationale**: Consistency with existing formatting in the codebase. The spec's example of `$0.85` (2 decimal places) differs from the existing `toFixed(4)` — we'll use `toFixed(4)` for precision consistency with the existing `formatTelemetryDisplay()`.

**Alternatives considered**:
- Use `Intl.NumberFormat` for locale-aware formatting — deferred per spec decision (locale-specific formatting is deferred)

---

### R7: Pending vs N/A State Determination

**Question**: How to distinguish "Pending" (job in progress) from "N/A" (no jobs)?

**Decision**: Use the existing `ComparisonEnrichmentState` machine:
- `'available'`: Job completed, data present → show formatted value
- `'pending'`: Job exists but not completed → show "Pending" with subtle animation
- `'unavailable'`: No jobs at all → show "N/A"

For the operational metrics grid, derive states from:
- If ticket has no completed jobs AND no in-progress jobs → all metrics `'unavailable'`
- If ticket has in-progress jobs but no completed jobs → all metrics `'pending'`
- If ticket has completed jobs → each metric independently `'available'` or `'unavailable'` based on null checks

**Rationale**: The state machine is already defined and used by the existing enrichment system. Extending it to the new grid keeps behavior consistent.

## Resolved NEEDS CLARIFICATION Items

All technical context items from the plan were resolved without ambiguity. No NEEDS CLARIFICATION items remained after initial analysis — the existing codebase has all required infrastructure.
