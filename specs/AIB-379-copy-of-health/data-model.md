# Data Model: Health Dashboard — Passive Modules (Quality Gate & Last Clean)

## No Schema Changes Required

This feature reads from existing models only. No Prisma migrations needed.

---

## Existing Entities Used

### Job (source of truth for both modules)

| Field | Type | Relevance |
|-------|------|-----------|
| `id` | Int | Primary key, used for `lastCleanJobId` |
| `command` | String | Filter: `'verify'` for Quality Gate, `'clean'` for Last Clean |
| `status` | String | Filter: `'COMPLETED'` only |
| `qualityScore` | Int? | 0-100, populated on COMPLETED verify jobs |
| `qualityScoreDetails` | String? | JSON with per-dimension sub-scores and weights |
| `completedAt` | DateTime? | Timestamp for trend data and staleness calculation |
| `output` | String? | May contain structured cleanup results |
| `ticketId` | Int | Foreign key to Ticket |

**Quality Gate query filter**: `command = 'verify'`, `status = 'COMPLETED'`, `qualityScore IS NOT NULL`, `ticket.workflowType = 'FULL'`, `ticket.stage = 'SHIP'`, `completedAt >= 30 days ago`

**Last Clean query filter**: `command = 'clean'`, `status = 'COMPLETED'`, `ticket.projectId = X`, ordered by `completedAt DESC`

### Ticket (join for project/workflow filtering)

| Field | Type | Relevance |
|-------|------|-----------|
| `id` | Int | Primary key |
| `ticketKey` | String | Display in drawer ticket list |
| `title` | String | Display in drawer ticket list |
| `projectId` | Int | Project scoping |
| `stage` | String | Filter: `'SHIP'` for Quality Gate |
| `workflowType` | String | Filter: `'FULL'` for Quality Gate |

### HealthScore (aggregate cache)

| Field | Type | Relevance |
|-------|------|-----------|
| `qualityGate` | Int? | Updated with 30-day average score |
| `lastCleanDate` | DateTime? | Date of most recent completed cleanup |
| `lastCleanJobId` | Int? | ID of the cleanup job |

---

## New API Response Shapes (not persisted)

### QualityGateDetails (computed per request)

```typescript
interface QualityGateDetails {
  averageScore: number | null;       // Arithmetic mean of qualifying jobs
  ticketCount: number;               // Number of qualifying tickets
  trend: 'up' | 'down' | 'stable' | null;  // vs previous 30 days
  trendDelta: number | null;         // Score difference
  distribution: {
    excellent: number;  // count >=90
    good: number;       // count >=70
    fair: number;       // count >=50
    poor: number;       // count <50
  };
  dimensions: Array<{
    name: string;       // e.g., "Compliance"
    averageScore: number | null;
    weight: number;
  }>;
  recentTickets: Array<{
    ticketKey: string;
    title: string;
    score: number;
    completedAt: string; // ISO date
  }>;
  trendData: Array<{
    ticketKey: string;
    score: number;
    date: string;        // ISO date
  }>;
}
```

### LastCleanDetails (computed per request)

```typescript
interface LastCleanDetails {
  lastCleanDate: string | null;      // ISO date
  stalenessStatus: 'ok' | 'warning' | 'alert' | null;
  daysSinceClean: number | null;
  filesCleaned: number | null;       // From job output, if available
  remainingIssues: number | null;    // From job output, if available
  summary: string | null;            // From job output, if available
  history: Array<{
    jobId: number;
    completedAt: string;             // ISO date
    filesCleaned: number | null;
    remainingIssues: number | null;
    summary: string | null;
  }>;
}
```

---

## State Transitions

### Last Clean Staleness State Machine

```
No cleanup exists → null (display: "No cleanup yet")
       ↓ (first cleanup completes)
Cleanup < 30 days → 'ok' (display: green/OK)
       ↓ (time passes)
Cleanup 30-60 days → 'warning' (display: yellow/Warning)
       ↓ (time passes)
Cleanup > 60 days → 'alert' (display: red/Alert)
       ↓ (new cleanup completes)
Cleanup < 30 days → 'ok' (resets)
```

### Quality Gate Trend Direction

```
No previous period data → null (display: "---")
Current avg > Previous avg + 1 → 'up'
Current avg < Previous avg - 1 → 'down'
|Current - Previous| <= 1 → 'stable'
```

---

## Validation Rules

- `qualityScore` is always 0-100 (enforced by verify workflow)
- `qualityScoreDetails` JSON must match `DIMENSION_CONFIG` structure (validated by `parseQualityScoreDetails()`)
- Staleness thresholds are deterministic from `lastCleanDate` — no user input validation needed
- All date comparisons use UTC to avoid timezone drift
