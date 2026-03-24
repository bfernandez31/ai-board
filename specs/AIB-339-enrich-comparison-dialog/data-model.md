# Data Model: Enrich comparison dialog with operational metrics and quality data

## Overview

This feature does not introduce new Prisma models. It expands the comparison detail read model by combining existing persisted comparison entities with live `Job` aggregates.

## Existing Persistent Entities

### ComparisonRecord

- Purpose: Saved comparison report metadata and top-level recommendation.
- Relevant fields:
  - `id`
  - `projectId`
  - `sourceTicketId`
  - `winnerTicketId`
  - `markdownPath`
  - `summary`
  - `overallRecommendation`
  - `keyDifferentiators`
  - `generatedAt`
- Relationships:
  - has many `ComparisonParticipant`
  - has many `DecisionPointEvaluation`

### ComparisonParticipant

- Purpose: Saved participant rank and metadata at comparison time.
- Relevant fields:
  - `ticketId`
  - `rank`
  - `score`
  - `workflowTypeAtComparison`
  - `agentAtComparison`
  - `rankRationale`
- Relationships:
  - belongs to `ComparisonRecord`
  - has one `TicketMetricSnapshot`
  - has many `ComplianceAssessment`

### TicketMetricSnapshot

- Purpose: Saved implementation metrics shown in the existing Implementation Metrics section.
- Relevant fields:
  - `linesAdded`
  - `linesRemoved`
  - `linesChanged`
  - `filesChanged`
  - `testFilesChanged`
  - `changedFiles`
  - `bestValueFlags`

### ComplianceAssessment

- Purpose: Saved constitution compliance rows used by the comparison compliance grid.
- Relevant fields:
  - `principleKey`
  - `principleName`
  - `status`
  - `notes`
  - `displayOrder`

### Job

- Purpose: Source of live operational and quality data.
- Relevant fields:
  - `ticketId`
  - `command`
  - `status`
  - `startedAt`
  - `completedAt`
  - `inputTokens`
  - `outputTokens`
  - `cacheReadTokens`
  - `cacheCreationTokens`
  - `costUsd`
  - `durationMs`
  - `model`
  - `qualityScore`
  - `qualityScoreDetails`
- Relationship:
  - belongs to `Ticket`

## New Read-Model Entities

### ComparisonParticipantOperationalMetrics

- Purpose: Aggregate all operational metrics needed for one participant column.
- Fields:
  - `totalTokens`: `ComparisonEnrichmentValue<number>`
  - `inputTokens`: `ComparisonEnrichmentValue<number>`
  - `outputTokens`: `ComparisonEnrichmentValue<number>`
  - `durationMs`: `ComparisonEnrichmentValue<number>`
  - `costUsd`: `ComparisonEnrichmentValue<number>`
  - `jobCount`: `ComparisonEnrichmentValue<number>`
  - `primaryModel`: `string | null`
- Validation rules:
  - `totalTokens = inputTokens + outputTokens` only when both values are available.
  - `jobCount` counts all included jobs for the ticket.
  - `primaryModel` is null when no model-bearing telemetry exists.

### ComparisonQualitySummary

- Purpose: Summary quality presentation for ranking cards and the operational metrics row.
- Fields:
  - `score`: `ComparisonEnrichmentValue<number>`
  - `thresholdLabel`: `string | null`
  - `isBestValue`: `boolean`
  - `detailAvailable`: `boolean`
- Validation rules:
  - `thresholdLabel` derives from `qualityScoreDetails.threshold` when trusted or `getScoreThreshold(score)` otherwise.
  - `detailAvailable` is true only when the full breakdown entity is available.

### ComparisonQualityBreakdown

- Purpose: In-context detail payload for eligible participants.
- Fields:
  - `overallScore`: `number`
  - `thresholdLabel`: `string`
  - `dimensions`: array of five dimension records
- Dimension fields:
  - `agentId`
  - `name`
  - `score`
  - `weight`
- Validation rules:
  - Must contain exactly the five configured dimensions in the canonical display order from `DIMENSION_CONFIG`.
  - Each dimension must have a numeric score and numeric weight.

### ComparisonOperationalMetricRow

- Purpose: Normalized row contract for the operational metrics table.
- Fields:
  - `key`: `totalTokens | inputTokens | outputTokens | durationMs | costUsd | jobCount | quality`
  - `label`: display label
  - `comparison`: `lowest-wins | highest-wins`
  - `bestParticipantTicketIds`: number[]
- Validation rules:
  - `bestParticipantTicketIds` excludes `pending` and `unavailable` cells.
  - Ties are represented by multiple ticket IDs.

## Derived State Rules

### Operational Metric State

- `available`: ticket has finalized numeric data for the metric.
- `pending`: ticket has related work, but at least one required job or telemetry field is not finalized.
- `unavailable`: ticket has no applicable job data for the metric.

### Quality Detail Eligibility

Eligible when all conditions are true:
- `workflowTypeAtComparison === FULL`
- latest verify job is `COMPLETED`
- `qualityScore != null`
- `qualityScoreDetails` parses successfully
- parsed payload contains all five configured dimensions

### Best-Value Rules

- Lowest wins:
  - total tokens
  - input tokens
  - output tokens
  - duration
  - cost
  - job count
- Highest wins:
  - quality

## State Transitions

### Operational Metric Cell

- `unavailable` -> `pending`
  - occurs when a new related job exists but telemetry is not finalized
- `pending` -> `available`
  - occurs when all required telemetry becomes available
- `pending` -> `unavailable`
  - occurs when work finishes without applicable telemetry for that metric

### Quality Detail Availability

- `false` -> `true`
  - when a FULL-workflow completed verify job with complete five-dimension details becomes available
- `true` -> `false`
  - not expected for a persisted comparison unless underlying job data is removed or corrupted
