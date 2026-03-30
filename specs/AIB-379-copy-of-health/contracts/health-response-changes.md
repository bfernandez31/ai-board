# API Contract: Health Response Changes

## GET `/api/projects/:projectId/health` — Updated Response

### Changes to `modules.qualityGate`

**Before** (current):
```json
{
  "score": 85,
  "label": "Good",
  "lastScanDate": "2026-03-25T14:30:00.000Z",
  "passive": true,
  "summary": "From latest verify job"
}
```

**After** (updated):
```json
{
  "score": 82,
  "label": "Good",
  "lastScanDate": "2026-03-25T14:30:00.000Z",
  "passive": true,
  "summary": "5 tickets — Good",
  "ticketCount": 5,
  "trend": "up",
  "trendDelta": 4,
  "distribution": {
    "excellent": 1,
    "good": 3,
    "fair": 1,
    "poor": 0
  }
}
```

New fields added:
- `ticketCount`: Number of qualifying tickets in the 30-day window
- `trend`: Direction vs previous 30-day period (`'up' | 'down' | 'stable' | null`)
- `trendDelta`: Numeric difference between periods
- `distribution`: Ticket count per threshold bucket

`score` changes from **latest single job** to **30-day average**.

### Changes to `modules.lastClean`

**Before** (current):
```json
{
  "score": null,
  "label": "OK",
  "lastCleanDate": "2026-03-20T10:00:00.000Z",
  "passive": true,
  "jobId": 456,
  "summary": "9 days ago"
}
```

**After** (updated):
```json
{
  "score": null,
  "label": "OK",
  "lastCleanDate": "2026-03-20T10:00:00.000Z",
  "passive": true,
  "jobId": 456,
  "summary": "9 days ago",
  "stalenessStatus": "ok",
  "filesCleaned": 12
}
```

New fields added:
- `stalenessStatus`: `'ok' | 'warning' | 'alert' | null` — drives card visual state
- `filesCleaned`: Number from job output (nullable)

### TypeScript Type Updates

Extend `HealthModuleStatus` in `lib/health/types.ts`:

```typescript
interface HealthModuleStatus {
  // ... existing fields ...
  ticketCount?: number;
  trend?: 'up' | 'down' | 'stable' | null;
  trendDelta?: number | null;
  distribution?: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  stalenessStatus?: 'ok' | 'warning' | 'alert' | null;
  filesCleaned?: number | null;
}
```
