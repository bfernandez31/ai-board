# Data Model: Health Dashboard - Passive Modules (Quality Gate & Last Clean)

**Date**: 2026-03-29

## Overview

No new database tables or migrations are required. Both modules derive data from existing models via read-only aggregation queries.

## Existing Entities Used

### Job (read-only)

| Field | Type | Usage |
|-------|------|-------|
| `id` | Int (PK) | Reference for Last Clean `jobId` |
| `ticketId` | Int (FK → Ticket) | Join to filter by project |
| `command` | String | Filter: `'verify'` for QG, `'clean'` for Last Clean |
| `status` | JobStatus enum | Filter: `'COMPLETED'` only |
| `qualityScore` | Int? | QG: individual ticket score (0-100) |
| `qualityScoreDetails` | String? (JSON) | QG: dimension breakdown (`DimensionScore[]`) |
| `completedAt` | DateTime? | QG: 30-day window filter; Last Clean: recency |

### Ticket (read-only, via Job join)

| Field | Type | Usage |
|-------|------|-------|
| `id` | Int (PK) | Join target for Job.ticketId |
| `projectId` | Int (FK → Project) | Filter by project |
| `stage` | Stage enum | Filter: `'SHIP'` for QG qualifying tickets |
| `ticketKey` | String | Display in QG drawer ticket list |
| `title` | String | Display in QG drawer ticket list |

### HealthScore (read-write, existing)

| Field | Type | Usage |
|-------|------|-------|
| `qualityGate` | Int? | Stores latest QG aggregate score for hero sub-badge |
| `lastCleanDate` | DateTime? | Stores last cleanup date |
| `lastCleanJobId` | Int? | Reference to last cleanup job |

## Derived Data Structures (not persisted)

### QualityGateAggregate

Computed on every Health Dashboard page load from Job + Ticket data.

```typescript
interface QualityGateAggregate {
  // Card data
  averageScore: number | null;        // Average of qualityScore across qualifying tickets
  ticketCount: number;                 // Number of qualifying SHIP tickets in 30-day window
  trend: QualityGateTrend;            // Comparison with previous 30-day period
  distribution: ThresholdDistribution; // Count per threshold bucket

  // Drawer data
  dimensions: DimensionAverage[];      // Per-dimension average across qualifying tickets
  recentTickets: QualityGateTicketItem[]; // Individual ticket scores
  trendData: TrendDataPoint[];         // Weekly data points for trend chart
}
```

### QualityGateTrend

```typescript
interface QualityGateTrend {
  type: 'improvement' | 'regression' | 'stable' | 'new' | 'no_data';
  currentAverage: number | null;
  previousAverage: number | null;
  delta: number | null;  // currentAverage - previousAverage (null when previous has no data)
}
```

### ThresholdDistribution

```typescript
interface ThresholdDistribution {
  excellent: number;  // Score 90-100
  good: number;       // Score 70-89
  fair: number;       // Score 50-69
  poor: number;       // Score 0-49
}
```

### DimensionAverage

```typescript
interface DimensionAverage {
  name: string;         // 'Compliance' | 'Bug Detection' | 'Code Comments' | 'Historical Context' | 'Spec Sync'
  averageScore: number | null;  // Average of dimension.score across qualifying tickets (null if no data)
  weight: number;       // Original weight (0.40, 0.30, 0.20, 0.10, 0.00)
}
```

### QualityGateTicketItem

```typescript
interface QualityGateTicketItem {
  ticketKey: string;
  title: string;
  score: number;
  label: string;        // 'Excellent' | 'Good' | 'Fair' | 'Poor'
  completedAt: string;  // ISO date string
}
```

### TrendDataPoint

```typescript
interface TrendDataPoint {
  week: string;          // ISO week label (e.g., "Mar 3-9")
  averageScore: number;
  ticketCount: number;
}
```

### LastCleanAggregate

Computed on every Health Dashboard page load from Job data.

```typescript
interface LastCleanAggregate {
  // Card data
  lastCleanDate: string | null;      // ISO date of most recent completed clean job
  filesCleaned: number;               // From job output (default 0)
  remainingIssues: number;            // From job output (default 0)
  daysAgo: number | null;            // Computed: days since lastCleanDate
  isOverdue: boolean;                 // daysAgo > 30
  status: 'ok' | 'overdue' | 'never'; // Visual status indicator

  // Drawer data
  summary: string;                    // Text summary of most recent cleanup
  history: LastCleanHistoryItem[];    // Up to 10 most recent cleanup jobs
}
```

### LastCleanHistoryItem

```typescript
interface LastCleanHistoryItem {
  jobId: number;
  completedAt: string;     // ISO date
  filesCleaned: number;
  remainingIssues: number;
  summary: string;
  ticketKey: string | null; // Associated ticket if available
}
```

## Query Patterns

### Quality Gate: 30-Day Aggregation

```sql
-- Qualifying tickets: SHIP stage + COMPLETED verify job + non-null qualityScore + last 30 days
SELECT j.qualityScore, j.qualityScoreDetails, j.completedAt, t.ticketKey, t.title
FROM Job j
JOIN Ticket t ON j.ticketId = t.id
WHERE t.projectId = ?
  AND t.stage = 'SHIP'
  AND j.command = 'verify'
  AND j.status = 'COMPLETED'
  AND j.qualityScore IS NOT NULL
  AND j.completedAt >= NOW() - INTERVAL '30 days'
ORDER BY j.completedAt DESC
```

### Quality Gate: Previous Period (for trend)

Same query but with `completedAt BETWEEN (NOW() - 60 days) AND (NOW() - 30 days)`.

### Last Clean: Most Recent + History

```sql
-- Most recent clean job with details
SELECT j.id, j.completedAt, j.qualityScoreDetails, t.ticketKey
FROM Job j
JOIN Ticket t ON j.ticketId = t.id
WHERE t.projectId = ?
  AND j.command = 'clean'
  AND j.status = 'COMPLETED'
ORDER BY j.completedAt DESC
LIMIT 10
```

## State Transitions

### Quality Gate States

```
No SHIP tickets in 30 days → Card: "---", summary: "No qualifying tickets", trend: "no_data"
SHIP tickets in current only → Card: score, trend: "new" (N/A)
SHIP tickets in both periods → Card: score, trend: "improvement"/"regression"/"stable"
```

### Last Clean States

```
No cleanup jobs ever → Card: "No cleanup yet", status: "never"
Last cleanup ≤ 30 days → Card: date + details, status: "ok"
Last cleanup > 30 days → Card: date + details, status: "overdue" (visual alert)
```

## Validation Rules

- `qualityScore` must be 0-100 (enforced by existing compute logic)
- `qualityScoreDetails` JSON must parse via `parseQualityScoreDetails()` or dimensions show "---"
- Multiple verify jobs per ticket: use most recent COMPLETED one with non-null qualityScore (ORDER BY completedAt DESC, DISTINCT ON ticketId)
- `filesCleaned` and `remainingIssues` default to 0 when not available in job data
