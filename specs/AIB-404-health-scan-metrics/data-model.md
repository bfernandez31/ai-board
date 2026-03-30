# Data Model: Health Scan Metrics

**Date**: 2026-03-30
**Feature Branch**: `AIB-404-health-scan-metrics`

## Existing Entities (No Schema Changes)

### HealthScan (Prisma model — read-only for this feature)

The `HealthScan` model already contains all fields needed. No migration required.

| Field | Type | Used By | Notes |
|-------|------|---------|-------|
| `id` | Int (PK) | All | Auto-increment |
| `projectId` | Int (FK) | Trend endpoint | Indexed with scanType |
| `scanType` | HealthScanType enum | Trend endpoint, sparklines | SECURITY, COMPLIANCE, TESTS, SPEC_SYNC |
| `status` | HealthScanStatus enum | Trend filter | Only COMPLETED scans feed trends |
| `score` | Int? | Trend data, sparklines, area charts | 0-100 range, null if not scored |
| `issuesFound` | Int? | History enrichment | Metric icon #1 |
| `durationMs` | Int? | History enrichment | Metric icon #4, formatted as human time |
| `tokensUsed` | Int? | History enrichment | Metric icon #3, **not yet in API select** |
| `costUsd` | Decimal? | History enrichment | Metric icon #2, **not yet in API select** |
| `completedAt` | DateTime? | Trend timestamps, area chart x-axis | Used for chronological ordering |

**Key indexes**: `(projectId, scanType, status)` — supports the trend query pattern.

## New TypeScript Types

### TrendDataPoint

```typescript
/** Single score data point for trend visualization */
interface TrendDataPoint {
  score: number;
  date: string; // ISO 8601 from completedAt
}
```

**Validation**: `score` is always non-null (filtered at query level). `date` is always non-null (only COMPLETED scans have `completedAt`).

### ModuleTrend

```typescript
/** Trend data for a single active module */
interface ModuleTrend {
  module: HealthScanType; // 'SECURITY' | 'COMPLIANCE' | 'TESTS' | 'SPEC_SYNC'
  data: TrendDataPoint[];
}
```

### TrendResponse

```typescript
/** API response shape for GET /api/projects/:projectId/health/trend */
interface TrendResponse {
  trends: {
    security: TrendDataPoint[];
    compliance: TrendDataPoint[];
    tests: TrendDataPoint[];
    specSync: TrendDataPoint[];
  };
}
```

**Business rules**:
- Each array contains at most 20 entries, ordered chronologically (oldest first for chart rendering)
- Empty array means no completed scans for that module
- Only COMPLETED scans with non-null scores are included

### ScanHistoryItem (Extended)

```typescript
/** Extended scan history item — adds tokensUsed and costUsd */
interface ScanHistoryItem {
  // ... existing fields ...
  tokensUsed: number | null;  // NEW: exposed in API select
  costUsd: number | null;     // NEW: exposed in API select (Decimal serialized as number)
}
```

## State Transitions

No new state transitions. The feature is read-only — it queries existing `HealthScan` records.

## Data Flow

```
HealthScan table (existing data)
       │
       ├── GET /health/trend ──→ TrendResponse ──→ useHealthTrend hook
       │                                              │
       │                              ┌───────────────┼───────────────┐
       │                              ▼               ▼               ▼
       │                         Sparkline      ModuleAreaChart   (future use)
       │                      (module cards)   (module drawers)
       │
       └── GET /health/scans ──→ ScanHistoryItem[] ──→ DrawerHistory
                (+ tokensUsed,       │
                 + costUsd)          ▼
                              Enriched HistoryEntry
                           (4 metric icons with tooltips)
```
