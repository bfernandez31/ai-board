# API Contract: PATCH /api/projects/:projectId/health/scans/:scanId/status

## Change Summary

Add `SKIPPED` as a valid status value in the scan status update endpoint.

## Request Schema (updated)

```typescript
{
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';  // SKIPPED added
  score?: number;        // Required for COMPLETED, forbidden for SKIPPED
  report?: string;       // JSON string — may contain skipReason for SKIPPED
  issuesFound?: number;  // 0 for SKIPPED
  issuesFixed?: number;  // 0 for SKIPPED
  headCommit?: string;
  durationMs?: number;
  tokensUsed?: number;
  costUsd?: number;
  errorMessage?: string;
  skipReason?: string;   // NEW — human-readable reason for SKIPPED
}
```

## Validation Changes

1. **SKIPPED status**: `score` must NOT be provided (or must be null)
2. **COMPLETED status**: `score` remains required (no change)
3. **State transition**: RUNNING → SKIPPED is now valid

## Behavior Changes

### On SKIPPED status:
- HealthScan record updated: `status: SKIPPED`, `score: null`, `completedAt: now`
- HealthScore aggregate: **NOT updated** (preserves last COMPLETED score)
- Global score: **NOT recalculated**

### On COMPLETED status (unchanged):
- HealthScan record updated with score and report
- HealthScore aggregate updated with new module score
- Global score recalculated

## Response (unchanged)

```typescript
{
  scan: {
    id: number;
    status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
    score: number | null;
  }
}
```
