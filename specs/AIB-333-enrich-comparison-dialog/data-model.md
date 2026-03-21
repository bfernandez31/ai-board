# Data Model: AIB-333 Enrich Comparison Dialog

## Overview

This feature is **UI-focused with backend enrichment extensions**. No new database tables or schema migrations are required. Changes are limited to:
1. Extended API response types (TypeScript interfaces)
2. Enhanced database queries (aggregation instead of single-job fetch)
3. New UI components consuming existing data

## Type Extensions

### ComparisonParticipantDetail (Extended)

**File**: `lib/types/comparison.ts`

| Field | Type | Change | Description |
|-------|------|--------|-------------|
| `ticketId` | `number` | Existing | — |
| `ticketKey` | `string` | Existing | — |
| `title` | `string` | Existing | — |
| `stage` | `Stage` | Existing | — |
| `workflowType` | `WorkflowType` | Existing | Used for ranking badge + column header |
| `agent` | `string \| null` | Existing | Used for ranking badge + column header |
| `rank` | `number` | Existing | — |
| `score` | `number` | Existing | — |
| `rankRationale` | `string` | Existing | — |
| `quality` | `ComparisonEnrichmentValue<number>` | Existing | Used for ranking badge + grid row |
| `qualityScoreDetails` | `QualityScoreDetails \| null` | **NEW** | Dimension breakdown for popover |
| `telemetry` | `ComparisonTelemetryEnrichment` | Existing | Extended with new fields |
| `metrics` | `ComparisonMetricSnapshot` | Existing | — |
| `model` | `string \| null` | **NEW** | Primary AI model used |

### ComparisonTelemetryEnrichment (Extended)

**File**: `lib/types/comparison.ts`

| Field | Type | Change | Description |
|-------|------|--------|-------------|
| `inputTokens` | `ComparisonEnrichmentValue<number>` | Existing | Sum across all jobs |
| `outputTokens` | `ComparisonEnrichmentValue<number>` | Existing | Sum across all jobs |
| `totalTokens` | `ComparisonEnrichmentValue<number>` | **NEW** | Computed: inputTokens + outputTokens |
| `durationMs` | `ComparisonEnrichmentValue<number>` | Existing | Sum across all jobs |
| `costUsd` | `ComparisonEnrichmentValue<number>` | Existing | Sum across all jobs |
| `jobCount` | `ComparisonEnrichmentValue<number>` | **NEW** | Count of completed jobs |
| `hasPartialData` | `boolean` | **NEW** | True when some jobs still in progress |

### ComparisonEnrichmentValue<T> (Unchanged)

```typescript
interface ComparisonEnrichmentValue<T> {
  state: 'available' | 'pending' | 'unavailable';
  value: T | null;
}
```

## Query Changes

### Current: Single latest job per ticket
```
prisma.job.findMany({ distinct: ['ticketId'], ... })
```

### New: Aggregated across all completed jobs per ticket
```
prisma.job.groupBy({
  by: ['ticketId'],
  where: { ticketId: { in: participantIds }, status: 'COMPLETED' },
  _sum: { inputTokens, outputTokens, durationMs, costUsd },
  _count: { id: true }
})
```

Plus a separate query for primary model:
```
prisma.job.groupBy({
  by: ['ticketId', 'model'],
  where: { ticketId: { in: participantIds }, model: { not: null } },
  _count: { id: true },
  orderBy: { _count: { id: 'desc' } }
})
```

### Quality Score Details Query Extension
```
// Current: select: { ticketId, qualityScore }
// New: select: { ticketId, qualityScore, qualityScoreDetails }
```

## State Transitions

### Telemetry Enrichment States

```
No jobs exist          → state: 'unavailable', value: null
All jobs in progress   → state: 'pending', value: null
Some jobs completed    → state: 'available', value: aggregated sum, hasPartialData: true
All jobs completed     → state: 'available', value: aggregated sum, hasPartialData: false
```

### Quality Score Enrichment States

```
No verify job          → state: 'unavailable', value: null, details: null
Verify job, no score   → state: 'pending', value: null, details: null
Verify job with score  → state: 'available', value: score, details: parsed JSON
```

## Entities Not Changed

- **ComparisonRecord**: No changes (comparison metadata unchanged)
- **ComparisonParticipant**: No changes (DB model stays the same, enrichment is at API layer)
- **TicketMetricSnapshot**: No changes (implementation metrics unchanged)
- **DecisionPointEvaluation**: No changes
- **ComplianceAssessment**: No changes
- **Job**: No changes (existing telemetry fields are sufficient)
- **Ticket**: No changes (existing workflowType/agent fields used as-is)
