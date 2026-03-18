# Data Model: Automatic Quality Score

## Schema Changes

### Job Model Extension

Add two fields to the existing `Job` model in `prisma/schema.prisma`:

```prisma
model Job {
  // ... existing fields ...

  // Quality score (0-100) computed from code review agent dimension scores
  // Only populated for COMPLETED verify jobs of FULL workflow tickets
  qualityScore        Int?
  // JSON string containing dimension sub-scores, weights, and threshold label
  // Format: {"dimensions": [...], "threshold": "Good", "computedAt": "ISO8601"}
  qualityScoreDetails String?
}
```

### Field Specifications

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `qualityScore` | `Int?` | Yes | Weighted final score (0-100), rounded integer |
| `qualityScoreDetails` | `String?` | Yes | JSON with dimension breakdown |

### qualityScoreDetails JSON Schema

```typescript
interface QualityScoreDetails {
  dimensions: DimensionScore[];
  threshold: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  computedAt: string; // ISO 8601 timestamp
}

interface DimensionScore {
  name: string;        // e.g., "Bug Detection"
  agentId: string;     // e.g., "bug-detection"
  score: number;       // 0-100
  weight: number;      // 0.0-1.0 (sum of all weights = 1.0)
  weightedScore: number; // score * weight
}
```

### Dimension Definitions (Fixed)

| Dimension | Agent | Weight | Agent # |
|-----------|-------|--------|---------|
| Bug Detection | Agent #2 | 0.30 | Shallow bug scan |
| Compliance | Agent #1 | 0.30 | CLAUDE.md & constitution audit |
| Code Comments | Agent #5 | 0.20 | Code comment compliance |
| Historical Context | Agent #3 | 0.10 | Git blame/history analysis |
| PR Comments | Agent #4 | 0.10 | Previous PR comment patterns |

### Score Thresholds

| Threshold | Range | Color | Tailwind Classes |
|-----------|-------|-------|-----------------|
| Excellent | 90-100 | Green | `text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950` |
| Good | 70-89 | Blue | `text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-950` |
| Fair | 50-69 | Amber | `text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-950` |
| Poor | 0-49 | Red | `text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950` |

## Validation Rules

- `qualityScore`: integer, 0-100 inclusive, nullable
- `qualityScoreDetails`: valid JSON string matching schema above, nullable
- Both fields are null for: QUICK workflow, CLEAN workflow, failed/cancelled jobs, non-verify commands
- Both fields are immutable after initial write (no update endpoint)
- If `qualityScore` is set, `qualityScoreDetails` MUST also be set (and vice versa)

## Analytics Types Extension

Add to `lib/analytics/types.ts`:

```typescript
export interface QualityScoreDataPoint {
  date: string;           // ISO date
  averageScore: number;   // Average quality score for the period
  count: number;          // Number of scored jobs in the period
}

export interface DimensionComparison {
  dimension: string;      // e.g., "Bug Detection"
  averageScore: number;   // Average dimension score across all scored jobs
  weight: number;         // The dimension weight
}

export interface QualityScoreAnalytics {
  scoreTrend: QualityScoreDataPoint[];
  dimensionComparison: DimensionComparison[];
  overallAverage: number | null;  // null if no scored jobs
  totalScoredJobs: number;
}
```

Extend `AnalyticsData` interface:

```typescript
export interface AnalyticsData {
  // ... existing fields ...
  qualityScore: QualityScoreAnalytics;
}
```

## Migration

Single Prisma migration adding two nullable columns to the `Job` table. No data backfill required — existing jobs will have `null` for both fields.
