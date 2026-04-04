# Contract: Scan Result File (`/tmp/health-scan-result.json`)

## Change Summary

Add `skipped` and `skipReason` fields to the result file written by health scan agents.

## Schema (Agent → Workflow)

```typescript
interface HealthScanResult {
  score: number | null;      // CHANGED: nullable when skipped
  skipped?: boolean;         // NEW: true when nothing to evaluate
  skipReason?: string;       // NEW: human-readable reason
  issuesFound: number;       // 0 when skipped
  issuesFixed: number;       // 0 when skipped
  report: ScanReport;        // type-appropriate report (may be minimal for skipped)
  tokensUsed?: number;
  costUsd?: number;
}
```

## Workflow Behavior

When parsing the result file, the workflow must:

1. Check `skipped` field: `jq -r '.skipped // false'`
2. Check scan type against skip-allowed list (REVIEW_QUALITY, SECURITY, SPEC_SYNC)
3. If `skipped == true` AND scan type is in the allowed list:
   - Send `SKIPPED` status to API with `score: null`
   - Include `skipReason` from the result
   - Skip remediation ticket creation
4. If `skipped == true` BUT scan type is COMPLIANCE or TESTS:
   - **Ignore** the skipped flag (defensive guard per FR-005, FR-006)
   - Treat as normal COMPLETED with `score` from result (fallback to 100)

## Example: Skipped Result

```json
{
  "score": null,
  "skipped": true,
  "skipReason": "No qualifying PRs since last scan",
  "issuesFound": 0,
  "issuesFixed": 0,
  "report": {
    "type": "REVIEW_QUALITY",
    "summary": {
      "prsAnalyzed": 0,
      "totalMissedFindings": 0,
      "coverageScore": 0,
      "scoreBreakdown": { "base": 100, "highPenalty": 0, "mediumPenalty": 0, "lowPenalty": 0 }
    },
    "missedFindings": [],
    "cumulativeAnalysis": { "windowDays": 30, "reportsAnalyzed": 0, "recurringPatterns": [] },
    "generatedTickets": []
  }
}
```
