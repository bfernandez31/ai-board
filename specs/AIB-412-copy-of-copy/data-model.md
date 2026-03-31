# Data Model: Health Scan Metrics - Trend Lines, Sparklines and History Enrichment

**Feature Branch**: `AIB-412-copy-of-copy`
**Created**: 2026-03-31

## Existing Entities (No Schema Changes Required)

### HealthScan (existing — no migration needed)

The `HealthScan` model already contains all fields required for this feature:

| Field | Type | Status | Notes |
|-------|------|--------|-------|
| `id` | Int (PK) | Existing | Auto-increment |
| `projectId` | Int (FK) | Existing | → Project |
| `scanType` | HealthScanType | Existing | SECURITY, COMPLIANCE, TESTS, SPEC_SYNC |
| `status` | HealthScanStatus | Existing | PENDING, RUNNING, COMPLETED, FAILED |
| `score` | Int? | Existing | 0-100, null until completed |
| `issuesFound` | Int? | Existing | Count of issues detected |
| `issuesFixed` | Int? | Existing | Count of auto-fixed issues |
| `tokensUsed` | Int? | Existing | API tokens consumed |
| `costUsd` | Float? | Existing | Cost in USD |
| `durationMs` | Int? | Existing | Execution time in milliseconds |
| `baseCommit` | String? | Existing | For incremental scanning |
| `headCommit` | String? | Existing | For incremental scanning |
| `report` | String? | Existing | JSON report data |
| `errorMessage` | String? | Existing | Max 2000 chars |
| `startedAt` | DateTime? | Existing | |
| `completedAt` | DateTime? | Existing | |
| `createdAt` | DateTime | Existing | |
| `updatedAt` | DateTime | Existing | |

**Key insight**: `tokensUsed` and `costUsd` are already stored by the PATCH status endpoint but not returned by the GET scan history endpoint. This is an API-layer gap, not a schema gap.

**Relevant indexes**: `@@index([projectId, scanType, createdAt])` — optimal for the trend query (filter by projectId + scanType, order by createdAt desc).

## New Projections (TypeScript types only)

### TrendDataPoint

Lightweight projection of HealthScan for chart rendering:

```typescript
interface TrendDataPoint {
  date: string;    // ISO string from completedAt
  score: number;   // 0-100
}
```

### ModuleTrends

Response shape for the trends endpoint:

```typescript
interface ModuleTrends {
  trends: {
    SECURITY: TrendDataPoint[];
    COMPLIANCE: TrendDataPoint[];
    TESTS: TrendDataPoint[];
    SPEC_SYNC: TrendDataPoint[];
  };
}
```

### ScanHistoryItem (extended)

Two fields added to existing `ScanHistoryItem` type:

```typescript
// Added to existing ScanHistoryItem in lib/health/types.ts
interface ScanHistoryItem {
  // ... existing fields ...
  tokensUsed: number | null;   // NEW
  costUsd: number | null;      // NEW
}
```

## Validation Rules

- Trend query: Only `status === 'COMPLETED'` AND `score IS NOT NULL` scans contribute to trend data (FR-010)
- Sparkline threshold: Minimum 3 data points required to render (FR-006)
- Trend limit: Default 20 scans per module, configurable via query parameter
- Cost formatting: 2 decimal places, USD prefix
- Token formatting: Abbreviated with k/M suffixes for ≥1000
- Duration formatting: Human-readable (ms → s → m s)

## State Transitions

No new state transitions. The feature is read-only — it visualizes existing HealthScan data that is already populated by the scan workflow system.
