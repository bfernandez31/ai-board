# Research: Automatic Quality Score via Code Review

## Decision 1: Score Storage Location

- **Decision**: Add `qualityScore Int?` field directly on the Job model
- **Rationale**: Follows the existing telemetry pattern (nullable fields on Job: `inputTokens`, `outputTokens`, `costUsd`, `durationMs`, etc.). Single field on existing model avoids join overhead and maintains query simplicity. Score is 1:1 with a verify job, making Job the natural owner.
- **Alternatives considered**:
  1. Separate `QualityScore` model with FK to Job — rejected: over-normalized for a single integer, adds unnecessary joins
  2. JSON field with dimension breakdown — rejected: loses type safety, harder to query for analytics aggregations

## Decision 2: Dimension Score Storage

- **Decision**: Store dimension scores as a JSON string in a `qualityScoreDetails` field on Job, alongside the integer `qualityScore` summary
- **Rationale**: Dimension scores (5 sub-scores + weights) are always read together, never queried individually in WHERE clauses. JSON storage avoids 5 extra columns while keeping the data colocated. The integer `qualityScore` field enables efficient SQL aggregation for analytics.
- **Alternatives considered**:
  1. Five separate Int? columns — rejected: adds 5 columns for data only needed in detail views
  2. Separate DimensionScore model — rejected: 5 rows per verify job is excessive for read-together data

## Decision 3: Score Computation Location

- **Decision**: Compute scores inside the code review command (`.claude-plugin/commands/ai-board.code-review.md`), output structured JSON to a file, and have the verify workflow parse and send it via the existing job status endpoint
- **Rationale**: The 5 review agents already execute in the code review command. Adding scoring to each agent's output is minimal change. The verify workflow already calls the job status endpoint on completion. This avoids a new API endpoint or workflow step.
- **Alternatives considered**:
  1. Separate scoring workflow step — rejected: adds complexity, scores should be computed alongside the review
  2. Server-side computation from PR comments — rejected: fragile parsing, not all review data is in comments

## Decision 4: Score Transmission to API

- **Decision**: Extend the existing `PATCH /api/jobs/:id/status` endpoint to accept an optional `qualityScore` integer and optional `qualityScoreDetails` JSON string
- **Rationale**: The verify workflow already calls this endpoint to set COMPLETED status. Adding the score payload is a minimal, backwards-compatible extension. No new endpoint needed.
- **Alternatives considered**:
  1. New dedicated `PATCH /api/jobs/:id/quality-score` endpoint — rejected: unnecessary when existing endpoint handles the same lifecycle event
  2. File-based scoring via telemetry endpoint — rejected: telemetry endpoint handles OTEL logs, not structured business data

## Decision 5: Analytics Aggregation Strategy

- **Decision**: Aggregate quality scores using Prisma queries on the Job table, filtering by `command = 'verify'`, `status = 'COMPLETED'`, and `qualityScore IS NOT NULL`, grouped by date
- **Rationale**: Follows existing analytics patterns in `lib/analytics/queries.ts`. The `qualityScore` integer field on Job enables efficient AVG/MIN/MAX aggregations without JSON parsing. Dimension comparison uses `qualityScoreDetails` JSON parsed at the application layer after filtering.
- **Alternatives considered**:
  1. Materialized view — rejected: over-engineering for current scale
  2. Pre-computed analytics table — rejected: adds write complexity without clear performance need

## Decision 6: Badge Color Thresholds

- **Decision**: Use fixed thresholds: Excellent (90-100, green), Good (70-89, blue), Fair (50-69, amber), Poor (0-49, red)
- **Rationale**: Directly from spec FR-008. Fixed thresholds are simple, predictable, and require no historical data. Color choices align with conventional quality indicators.
- **Alternatives considered**:
  1. Percentile-based thresholds — rejected: requires historical data, inconsistent across projects
  2. Configurable per-project — rejected: over-engineering for v1

## Decision 7: Code Review Command Modification Approach

- **Decision**: Add a scoring instruction to each of the 5 existing review agents, asking them to return a dimension score (0-100) alongside their issue list. Add a final consolidation step that writes a `quality-score.json` file to the workspace.
- **Rationale**: Minimal changes to existing agent prompts. Each agent already analyzes a specific dimension. Adding "also rate this dimension 0-100" is a natural extension. The JSON file output follows the existing pattern of structured workflow artifacts.
- **Alternatives considered**:
  1. Separate scoring agents — rejected: duplicates work already done by review agents
  2. Score inferred from issue count/severity — rejected: unreliable proxy, doesn't reflect agent assessment
