# Data Model: Enrich Comparison Dialog

**Feature**: AIB-344 | **Date**: 2026-03-24

## Existing Entities (No Schema Changes)

This feature is a read-only UI enrichment. **No new database tables or columns are needed.** All required data already exists in the Prisma schema.

### Job (existing — telemetry source)

| Field | Type | Usage in This Feature |
|-------|------|-----------------------|
| `inputTokens` | `Int?` | Summed across all COMPLETED jobs per ticket → "Input Tokens" row |
| `outputTokens` | `Int?` | Summed across all COMPLETED jobs per ticket → "Output Tokens" row |
| `costUsd` | `Float?` | Summed across all COMPLETED jobs per ticket → "Cost" row |
| `durationMs` | `Int?` | Summed across all COMPLETED jobs per ticket → "Duration" row |
| `model` | `String?` | Most-used model across jobs → column header |
| `qualityScore` | `Int?` | From latest VERIFY job → "Quality Score" row |
| `qualityScoreDetails` | `String?` | JSON with 5-dimension breakdown → quality popover |

### ComparisonParticipant (existing — context source)

| Field | Type | Usage in This Feature |
|-------|------|-----------------------|
| `workflowTypeAtComparison` | `String` | → Workflow type badge on ranking card |
| `agentAtComparison` | `String?` | → Agent badge on ranking card |

### TicketMetricSnapshot (existing — implementation metrics)

No changes. The existing `bestValueFlags` pattern informs the operational metrics approach.

## New TypeScript Types (no DB changes)

### Extended ComparisonParticipantDetail

```typescript
// Added fields to existing ComparisonParticipantDetail
interface ComparisonParticipantDetail {
  // ... existing fields ...

  /** Aggregated telemetry across all completed jobs */
  aggregatedTelemetry: AggregatedTelemetry | null;

  /** Parsed quality score breakdown (from latest VERIFY job) */
  qualityDetails: QualityScoreDetails | null;
}

interface AggregatedTelemetry {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  durationMs: number;
  jobCount: number;
  model: string | null;
  hasData: boolean;
}
```

### OperationalMetricDefinition

```typescript
interface OperationalMetricDefinition {
  key: string;
  label: string;
  /** 'lowest' = lower is better (tokens, cost, duration, jobs); 'highest' = higher is better (quality) */
  direction: 'lowest' | 'highest';
  /** Format function for display */
  format: (value: number) => string;
}
```

### OperationalMetricRow

```typescript
interface OperationalMetricRow {
  definition: OperationalMetricDefinition;
  cells: OperationalMetricCell[];
}

interface OperationalMetricCell {
  ticketId: number;
  state: ComparisonEnrichmentState;  // 'available' | 'pending' | 'unavailable'
  value: number | null;
  formattedValue: string | null;
  isBest: boolean;
}
```

## Data Flow

```
┌─────────────────────────┐
│  comparison-detail.ts   │  (server)
│  getComparisonDetail()  │
├─────────────────────────┤
│ 1. Fetch all COMPLETED  │
│    jobs per ticket       │──→ aggregateJobTelemetry()
│ 2. Fetch latest VERIFY  │──→ deriveQualityState() + parseQualityScoreDetails()
│ 3. Build participant    │
│    detail with enriched │
│    telemetry + quality  │
└───────────┬─────────────┘
            │ API Response (ComparisonDetail)
            ▼
┌─────────────────────────┐
│  comparison-viewer.tsx  │  (client)
├─────────────────────────┤
│ Passes participants to: │
│ ├── ComparisonRanking   │──→ Workflow/Agent/Quality badges
│ ├── ComparisonMetrics   │──→ Existing implementation metrics
│ ├── OperationalMetrics  │──→ NEW: 7-row grid with best-value
│ │   └── QualityPopover  │──→ NEW: 5-dimension breakdown
│ ├── DecisionPoints      │──→ Existing
│ └── ComplianceGrid      │──→ Existing
└─────────────────────────┘
```

## Validation Rules

- **Tokens**: Non-negative integers (enforced by SUM of non-null `Int?` fields, defaulting null to 0)
- **Cost**: Non-negative float (same aggregation pattern)
- **Duration**: Non-negative integer in milliseconds
- **Quality Score**: Integer 0-100 (enforced by existing VERIFY job logic)
- **Quality Details JSON**: Parsed via `parseQualityScoreDetails()` which returns null on invalid JSON — popover gracefully unavailable
- **Job Count**: Positive integer (count of COMPLETED jobs; 0 means no data → N/A state)
