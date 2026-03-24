# API Changes: Enrich Comparison Dialog

**Feature**: AIB-344 | **Date**: 2026-03-24

## No New Endpoints

This feature does not introduce any new API endpoints. All changes are modifications to the existing comparison detail response.

## Modified Endpoint

### GET `/api/projects/{projectId}/tickets/{ticketId}/comparisons/{comparisonId}`

**Change**: Extend `ComparisonParticipantDetail` in the response with aggregated telemetry and quality breakdown data.

#### Current Response Shape (participant)

```typescript
{
  ticketId: number;
  ticketKey: string;
  title: string;
  stage: Stage;
  workflowType: WorkflowType;
  agent: string | null;
  rank: number;
  score: number;
  rankRationale: string;
  quality: { state: 'available' | 'pending' | 'unavailable'; value: number | null };
  telemetry: {
    inputTokens: { state: string; value: number | null };
    outputTokens: { state: string; value: number | null };
    durationMs: { state: string; value: number | null };
    costUsd: { state: string; value: number | null };
  };
  metrics: ComparisonMetricSnapshot;
}
```

#### Updated Response Shape (participant)

```typescript
{
  // ... all existing fields unchanged ...

  /** NEW: Aggregated telemetry across ALL completed jobs (not just latest) */
  aggregatedTelemetry: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
    durationMs: number;
    jobCount: number;
    model: string | null;
    hasData: boolean;
  } | null;

  /** NEW: Parsed quality score breakdown from latest VERIFY job */
  qualityDetails: {
    dimensions: Array<{
      name: string;
      agentId: string;
      score: number;
      weight: number;
      weightedScore: number;
    }>;
    threshold: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    computedAt: string;
  } | null;
}
```

#### Backend Query Changes

**File**: `lib/comparison/comparison-detail.ts` — `getComparisonDetailForTicket()`

1. **Replace** single-latest-job telemetry query with:
   ```typescript
   // Fetch ALL completed jobs per ticket for aggregation
   prisma.job.findMany({
     where: {
       ticketId: { in: participantIds },
       status: 'COMPLETED',
     },
     select: {
       ticketId: true,
       inputTokens: true,
       outputTokens: true,
       cacheReadTokens: true,
       cacheCreationTokens: true,
       costUsd: true,
       durationMs: true,
       model: true,
       toolsUsed: true,
     },
   })
   ```

2. **Extend** VERIFY job query to include `qualityScoreDetails`:
   ```typescript
   prisma.job.findMany({
     where: {
       ticketId: { in: participantIds },
       command: 'verify',
     },
     orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
     distinct: ['ticketId'],
     select: {
       ticketId: true,
       qualityScore: true,
       qualityScoreDetails: true,  // NEW
     },
   })
   ```

3. **Group** completed jobs by ticketId and call `aggregateJobTelemetry()` per ticket

4. **Parse** `qualityScoreDetails` via `parseQualityScoreDetails()` and include in response

#### Backward Compatibility

The new fields (`aggregatedTelemetry`, `qualityDetails`) are **additive** — they are nullable and do not change existing fields. Existing consumers of the API response will not break. The existing `telemetry` and `quality` enrichment fields remain unchanged for backward compatibility.
