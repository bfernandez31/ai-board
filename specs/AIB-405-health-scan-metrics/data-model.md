# Data Model: Health Scan Metrics

**Branch**: `AIB-405-health-scan-metrics`
**Date**: 2026-03-30

---

## Existing Entities (No Schema Changes)

### HealthScan (source: `prisma/schema.prisma`)

No new fields or migrations required. All telemetry fields already exist:

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | Int | No | Primary key |
| `projectId` | Int | No | FK → Project |
| `scanType` | HealthScanType | No | SECURITY, COMPLIANCE, TESTS, SPEC_SYNC |
| `status` | HealthScanStatus | No | PENDING, RUNNING, COMPLETED, FAILED |
| `score` | Int | Yes | 0-100 scan result |
| `issuesFound` | Int | Yes | Issue count |
| `issuesFixed` | Int | Yes | Auto-fixed count (Tests) |
| `tokensUsed` | Int | Yes | **Currently stored but not exposed in history API** |
| `costUsd` | Float | Yes | **Currently stored but not exposed in history API** |
| `durationMs` | Int | Yes | Already in history API response |
| `completedAt` | DateTime | Yes | Used as trend data point date |

**Action**: Expose `tokensUsed` and `costUsd` in the scan history API select clause.

---

## New TypeScript Interfaces

### TrendDataPoint

Lightweight representation for sparklines and area charts. Derived from HealthScan via Prisma query.

```typescript
interface TrendDataPoint {
  score: number;
  date: string; // ISO 8601 from completedAt
}
```

### HealthTrendsResponse

Response shape for the new `GET /api/projects/[projectId]/health/trends` endpoint.

```typescript
interface HealthTrendsResponse {
  security: TrendDataPoint[];
  compliance: TrendDataPoint[];
  tests: TrendDataPoint[];
  specSync: TrendDataPoint[];
}
```

**Constraints**:
- Each array contains at most 20 entries (last 20 COMPLETED scans with non-null scores)
- Ordered chronologically (oldest first) for direct chart consumption
- Only COMPLETED scans with non-null scores are included

### ScanHistoryItem (Extended)

Two new fields added to the existing interface:

```typescript
interface ScanHistoryItem {
  // ... existing fields ...
  tokensUsed: number | null;  // NEW
  costUsd: number | null;     // NEW
}
```

---

## Validation Rules

| Rule | Source | Enforcement |
|------|--------|-------------|
| Only COMPLETED scans in trends | FR-004, Edge Cases | Prisma `where: { status: 'COMPLETED' }` |
| Only non-null scores in trends | Edge Cases | Prisma `where: { score: { not: null } }` |
| Max 20 data points | Auto-resolved decision | Prisma `take: 20` |
| Chronological order (oldest first) | Chart rendering | Prisma `orderBy: { completedAt: 'asc' }` after reversing desc query |

---

## State Transitions

No new state transitions. Existing `HealthScanStatus` flow is unchanged:

```
PENDING → RUNNING → COMPLETED
                  → FAILED
```

Trend data only considers terminal state `COMPLETED`. Sparkline render threshold: ≥ 3 valid data points.
