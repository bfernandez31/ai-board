# Contract: GET /api/projects/{projectId}/health

## Changes for SKIPPED Status

### Module Status (updated)

When the latest scan for a module is SKIPPED:

```typescript
{
  score: number | null,      // Previous score from HealthScore (NOT overwritten)
  label: string | null,      // Based on previous score, or null if never scored
  lastScanDate: string | null, // Previous scan date (NOT updated by SKIPPED)
  scanStatus: 'SKIPPED',    // Latest scan status
  issuesFound: number | null,
  summary: string,           // "Nothing to evaluate" for SKIPPED
}
```

### buildModuleStatus() Changes

The function needs to handle `scanStatus === 'SKIPPED'` as a distinct case:
- Score comes from `HealthScore` aggregate (unchanged by SKIPPED)
- Summary shows "Nothing to evaluate" when latest scan was SKIPPED
- `scanStatus` reflects the latest scan's status (including SKIPPED)

### latestScans Query Changes

Current query filters `status: 'COMPLETED'`. Must also include SKIPPED to detect when the latest scan was SKIPPED (for the module card's visual treatment). Query changes to: `status: { in: ['COMPLETED', 'SKIPPED'] }`.

### Global Score

No change — `calculateGlobalScore()` reads from `HealthScore` which is not modified by SKIPPED scans.
