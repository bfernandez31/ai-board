# API Contract: GET /api/projects/:projectId/health

## Change Summary

Add SKIPPED scan handling to the health response's module status objects.

## Response Schema Changes

### HealthModuleStatus (updated)

```typescript
interface HealthModuleStatus {
  score: number | null;          // unchanged — null when never scanned OR all scans SKIPPED
  label: string | null;          // unchanged
  lastScanDate?: string | null;  // unchanged — date of last COMPLETED scan
  scanStatus?: string | null;    // NEW values: may now be 'SKIPPED'
  issuesFound?: number | null;   // unchanged
  passive?: boolean;             // unchanged
  jobId?: number | null;         // unchanged
  summary: string;               // updated — "Skipped: {reason}" for SKIPPED
  skipReason?: string | null;    // NEW — reason for skip (e.g., "No qualifying PRs since last scan")
  ticketCount?: number;          // unchanged
  trend?: 'up' | 'down' | 'stable' | null;  // unchanged
  trendDelta?: number | null;    // unchanged
  distribution?: ThresholdDistribution;       // unchanged
}
```

### New field: `skipReason`

- Present only when the most recent scan for the module has status `SKIPPED`
- Contains a human-readable string explaining why the scan was skipped
- Example values:
  - `"No qualifying PRs since last scan"` (REVIEW_QUALITY)
  - `"No changed files to scan"` (SECURITY in incremental mode)
  - `"No spec files found"` (SPEC_SYNC)

## Behavior Changes

### Module with latest scan SKIPPED:
- `score`: Last COMPLETED score (from HealthScore aggregate), or null if never completed
- `scanStatus`: `'SKIPPED'`
- `summary`: `"Skipped: {reason}"`
- `skipReason`: Human-readable reason
- `lastScanDate`: Date of last COMPLETED scan (not the SKIPPED scan)

### Global score calculation (unchanged):
- Uses HealthScore aggregate (which is NOT updated on SKIPPED)
- Null modules excluded from average (existing behavior)

## Backward Compatibility

- New `skipReason` field is optional — clients that don't check it are unaffected
- `scanStatus` can now be `'SKIPPED'` — clients must handle this new value
- Score and label behavior unchanged for COMPLETED/FAILED/PENDING/RUNNING states
