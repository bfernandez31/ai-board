# Data Model: Enrich Comparison Dialog

**Feature**: AIB-340 | **Date**: 2026-03-24

## Overview

This feature introduces **no new database tables or columns**. All data is derived from existing models at query time. The data model changes are limited to TypeScript interfaces that represent aggregated/enriched views of existing data.

## Existing Entities (Read-Only)

### Job (source: `prisma/schema.prisma`)

Telemetry fields used for aggregation:
| Field | Type | Usage |
|-------|------|-------|
| `ticketId` | Int | Group-by key for aggregation |
| `status` | JobStatus | Filter: only COMPLETED jobs included |
| `inputTokens` | Int? | Summed across completed jobs |
| `outputTokens` | Int? | Summed across completed jobs |
| `durationMs` | Int? | Summed across completed jobs |
| `costUsd` | Float? | Summed across completed jobs |
| `model` | String? | Primary model = job with highest (inputTokens + outputTokens) |
| `qualityScore` | Int? | 0-100, only on completed verify jobs |
| `qualityScoreDetails` | String? | JSON: `QualityScoreDetails` structure |

### ComparisonParticipant (source: `prisma/schema.prisma`)

Existing fields used for badge display:
| Field | Type | Usage |
|-------|------|-------|
| `workflowTypeAtComparison` | WorkflowType | Badge on ranking card |
| `agentAtComparison` | Agent? | Badge on ranking card (if non-null) |

### QualityScoreDetails (source: `lib/quality-score.ts`)

Existing JSON structure stored in `Job.qualityScoreDetails`:
```typescript
interface QualityScoreDetails {
  dimensions: DimensionScore[];  // 5 items
  threshold: ScoreThreshold;     // 'Excellent' | 'Good' | 'Fair' | 'Poor'
  computedAt: string;            // ISO timestamp
}

interface DimensionScore {
  name: string;        // e.g., "Compliance"
  agentId: string;     // e.g., "compliance"
  score: number;       // 0-100
  weight: number;      // 0.0-1.0
  weightedScore: number;
}
```

## New Derived Entities (TypeScript only)

### AggregatedJobTelemetry

Derived at query time by grouping all COMPLETED jobs per ticket.

| Field | Type | Derivation |
|-------|------|------------|
| `ticketId` | number | Group-by key |
| `inputTokens` | number | SUM of all completed jobs' inputTokens (null treated as 0) |
| `outputTokens` | number | SUM of all completed jobs' outputTokens (null treated as 0) |
| `totalTokens` | number | inputTokens + outputTokens |
| `durationMs` | number | SUM of all completed jobs' durationMs (null treated as 0) |
| `costUsd` | number | SUM of all completed jobs' costUsd (null treated as 0) |
| `jobCount` | number | COUNT of completed jobs |
| `primaryModel` | string \| null | model from the job with highest (inputTokens + outputTokens) |

**Validation rules**:
- Only jobs with `status === 'COMPLETED'` are included
- Null numeric fields contribute 0 to sums
- If all jobs have null for a metric, the enrichment state is `pending` (data expected but not yet available)
- If no completed jobs exist, all enrichment states are `unavailable`

### Extended ComparisonTelemetryEnrichment

Adds new fields to the existing interface:

| Field | Type | New? |
|-------|------|------|
| `inputTokens` | ComparisonEnrichmentValue\<number\> | Existing (now aggregated) |
| `outputTokens` | ComparisonEnrichmentValue\<number\> | Existing (now aggregated) |
| `durationMs` | ComparisonEnrichmentValue\<number\> | Existing (now aggregated) |
| `costUsd` | ComparisonEnrichmentValue\<number\> | Existing (now aggregated) |
| `totalTokens` | ComparisonEnrichmentValue\<number\> | NEW |
| `jobCount` | ComparisonEnrichmentValue\<number\> | NEW |
| `primaryModel` | ComparisonEnrichmentValue\<string\> | NEW |

### Extended ComparisonParticipantDetail

Adds quality breakdown to existing interface:

| Field | Type | New? |
|-------|------|------|
| `qualityBreakdown` | ComparisonEnrichmentValue\<QualityScoreDetails\> | NEW |

## State Transitions

### ComparisonEnrichmentValue States

```
                    ┌──────────────┐
                    │ unavailable  │  No completed jobs / QUICK workflow (no verify)
                    └──────────────┘
                           │
                    (job starts)
                           │
                    ┌──────────────┐
                    │   pending    │  Job in progress, telemetry not yet recorded
                    └──────────────┘
                           │
                    (job completes with data)
                           │
                    ┌──────────────┐
                    │  available   │  Data aggregated and returned with value
                    └──────────────┘
```

### Best Value Determination

For each metric row across all participants:
- **Lowest is best**: totalTokens, inputTokens, outputTokens, durationMs, costUsd, jobCount
- **Highest is best**: qualityScore
- **Ties**: All participants sharing the best value receive the flag
- **N/A/Pending excluded**: Participants without available values are not considered for best value

## Relationships

```
ComparisonRecord 1──* ComparisonParticipant
                           │
                    (enriched at query time with)
                           │
                    AggregatedJobTelemetry ←── Job (many, grouped by ticketId)
                    QualityScoreDetails    ←── Job (latest verify, qualityScoreDetails JSON)
```
