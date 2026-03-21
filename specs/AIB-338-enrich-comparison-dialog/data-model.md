# Data Model: AIB-338 Enrich Comparison Dialog

## Overview

This feature does not require Prisma schema changes. It extends the comparison detail read model returned by `GET /api/projects/{projectId}/tickets/{ticketId}/comparisons/{comparisonId}` by deriving additional participant-level operational and quality data from existing `Job`, `ComparisonRecord`, and `ComparisonParticipant` records.

## Existing Persistent Entities Reused

### Job

Source of truth for operational telemetry and quality data.

| Field | Type | Usage in this feature |
|------|------|------------------------|
| `ticketId` | `Int` | Groups jobs per compared ticket |
| `status` | `JobStatus` | Distinguishes completed jobs from in-progress jobs |
| `command` | `String` | Identifies verify jobs for quality summary/details |
| `inputTokens` | `Int?` | Aggregated into input and total tokens |
| `outputTokens` | `Int?` | Aggregated into output and total tokens |
| `costUsd` | `Float?` | Aggregated cost metric |
| `durationMs` | `Int?` | Aggregated duration metric |
| `model` | `String?` | Used for dominant-model / multi-model labeling |
| `qualityScore` | `Int?` | Summary quality value |
| `qualityScoreDetails` | `String?` | Parsed into detailed dimension breakdown |
| `startedAt` / `completedAt` | `DateTime` | Determines recency and pending/final state |

### ComparisonRecord / ComparisonParticipant

Existing comparison persistence remains the source of ranking and implementation metrics.

| Field | Type | Usage in this feature |
|------|------|------------------------|
| `ComparisonParticipant.workflowTypeAtComparison` | `WorkflowType` | Ranking card badge and quality-detail eligibility |
| `ComparisonParticipant.agentAtComparison` | `Agent?` | Ranking card context and operational column header context |
| `ComparisonParticipant.metricSnapshot` | relation | Existing Implementation Metrics section remains unchanged |
| `ComparisonParticipant.rank` / `score` / `rankRationale` | scalar | Existing ranking section remains unchanged except for added badges/context |

## New Read Models

### ComparisonOperationalMetricValue

Normalized state wrapper for a single operational metric.

| Field | Type | Description |
|------|------|-------------|
| `state` | `'available' \| 'pending' \| 'unavailable'` | Final visibility state for the metric |
| `value` | `number \| null` | Numeric value when available |
| `isBest` | `boolean` | Whether this participant ties for the best visible value |
| `displayLabel` | `string` | Optional server-provided human-readable label for formatting consistency |

Validation rules:
- `pending` and `unavailable` must always carry `value: null`
- `isBest` must be `false` when `state !== 'available'`

### ComparisonModelSummary

Per-ticket model attribution for the Operational Metrics section.

| Field | Type | Description |
|------|------|-------------|
| `state` | `'available' \| 'pending' \| 'unavailable'` | Whether model attribution is known yet |
| `label` | `string \| null` | Dominant model name or `"Multiple models"` |
| `dominantModel` | `string \| null` | Raw model identifier when a single model is dominant |
| `completedJobCount` | `number` | Number of completed jobs considered for attribution |
| `mixedModels` | `boolean` | True when no single model dominates |

Validation rules:
- `mixedModels` implies `label === "Multiple models"`
- `dominantModel` must be null when `mixedModels` is true

### ComparisonQualitySummary

Quality row summary used in both ranking cards and the Operational Metrics grid.

| Field | Type | Description |
|------|------|-------------|
| `state` | `'available' \| 'pending' \| 'unavailable'` | Summary value availability |
| `score` | `number \| null` | Overall quality score |
| `threshold` | `'Excellent' \| 'Good' \| 'Fair' \| 'Poor' \| null` | Threshold label derived from score |
| `detailsState` | `'available' \| 'summary_only' \| 'unavailable'` | Interactivity state for detail tray |

Validation rules:
- `threshold` must be present when `score` is present
- `detailsState === 'available'` requires parsed detail dimensions

### ComparisonQualityDetail

Detailed quality breakdown for eligible tickets.

| Field | Type | Description |
|------|------|-------------|
| `ticketId` | `number` | Ticket owning the detail |
| `ticketKey` | `string` | Ticket key for tray heading |
| `score` | `number` | Overall quality score |
| `threshold` | `'Excellent' \| 'Good' \| 'Fair' \| 'Poor'` | Threshold label |
| `dimensions` | `QualityDimension[]` | Five dimension rows with score and weight |

### QualityDimension

| Field | Type | Description |
|------|------|-------------|
| `agentId` | `string` | Stable dimension identifier |
| `name` | `string` | Human-readable dimension name |
| `score` | `number` | Dimension score |
| `weight` | `number` | Decimal weight, preserved from stored details |

Validation rules:
- Preserve stored order when available; otherwise sort by known `DIMENSION_CONFIG`
- Expected target set is five evaluated dimensions

### ComparisonOperationalAggregate

Full per-participant operational section payload.

| Field | Type | Description |
|------|------|-------------|
| `totalTokens` | `ComparisonOperationalMetricValue` | Sum of input and output tokens |
| `inputTokens` | `ComparisonOperationalMetricValue` | Sum across all relevant jobs |
| `outputTokens` | `ComparisonOperationalMetricValue` | Sum across all relevant jobs |
| `durationMs` | `ComparisonOperationalMetricValue` | Sum across all relevant jobs |
| `costUsd` | `ComparisonOperationalMetricValue` | Sum across all relevant jobs |
| `jobCount` | `ComparisonOperationalMetricValue` | Count of associated jobs |
| `model` | `ComparisonModelSummary` | Dominant-model / multi-model summary |
| `quality` | `ComparisonQualitySummary` | Quality score summary and detail availability |

## Relationships

| Source | Relationship | Target | Purpose |
|--------|--------------|--------|---------|
| `ComparisonRecord` | has many | `ComparisonParticipant` | Defines compared tickets and ranking |
| `ComparisonParticipant.ticketId` | maps to many | `Job` | Provides aggregation input for operational metrics |
| `Job(command=verify)` | provides zero or one latest eligible detail | `ComparisonQualityDetail` | Drives the in-place quality tray |

## State Transitions

### Operational Metric Availability

1. `unavailable`
   No associated job data exists for the metric.
2. `pending`
   At least one associated job exists, but final aggregated data is incomplete because relevant execution is still running or has not yet produced terminal telemetry.
3. `available`
   Aggregate value is final enough to display numerically.

### Quality Detail Availability

1. `unavailable`
   No summary score exists, or the ticket is not a FULL workflow ticket, or no verify result exists.
2. `summary_only`
   Summary score exists but no valid dimension breakdown is available.
3. `available`
   FULL workflow ticket has completed verify output with parseable `qualityScoreDetails`.

## No Schema Changes

- No Prisma migration required
- No new tables or columns required
- No backfill required
- Existing jobs and comparison records are sufficient to compute the new read model
