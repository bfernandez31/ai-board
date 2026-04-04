# Data Model: Add SKIPPED Status for Health Scans

**Branch**: `AIB-535-copy-of-add` | **Date**: 2026-04-04

## Entity Changes

### 1. HealthScanStatus Enum (Prisma)

**Change**: Add `SKIPPED` value to existing enum.

```prisma
enum HealthScanStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  SKIPPED    // NEW — terminal state for scans with nothing to evaluate
}
```

**Migration**: `ALTER TYPE "HealthScanStatus" ADD VALUE 'SKIPPED';`
- Non-destructive — existing records are unaffected (FR-011)
- No default value change needed — new scans start as PENDING

### 2. HealthScan Model

**No schema changes required.** The existing model already supports the SKIPPED state:
- `score: Int?` — already nullable, will be `null` for SKIPPED scans
- `report: String?` — will contain a JSON object with skip reason
- `status: HealthScanStatus` — will use new `SKIPPED` value

**SKIPPED scan record example:**
```json
{
  "status": "SKIPPED",
  "score": null,
  "report": "{\"type\":\"REVIEW_QUALITY\",\"skipped\":true,\"skipReason\":\"No qualifying PRs since last scan\",\"missedFindings\":[],\"cumulativeAnalysis\":{\"windowDays\":30,\"reportsAnalyzed\":0,\"recurringPatterns\":[]},\"generatedTickets\":[],\"summary\":{\"prsAnalyzed\":0,\"totalMissedFindings\":0,\"coverageScore\":0,\"scoreBreakdown\":{\"base\":100,\"highPenalty\":0,\"mediumPenalty\":0,\"lowPenalty\":0}}}",
  "issuesFound": 0,
  "issuesFixed": 0,
  "completedAt": "2026-04-04T12:00:00Z"
}
```

### 3. HealthScore Model

**No schema changes required.** When a scan is SKIPPED:
- The corresponding module score field is **NOT updated** (preserves last COMPLETED score)
- The `lastXxxScan` timestamp is **NOT updated** (preserves last meaningful scan date)
- `globalScore` is **NOT recalculated** (remains based on last COMPLETED scores)

This ensures SKIPPED scans don't overwrite meaningful historical data.

### 4. Scan Result File Schema (Agent → Workflow)

**Change**: Add `skipped` boolean to `/tmp/health-scan-result.json`.

**Current schema:**
```typescript
{
  score: number;           // 0-100
  issuesFound: number;
  issuesFixed: number;
  report: object;          // ScanReport discriminated union
  tokensUsed?: number;
  costUsd?: number;
}
```

**Extended schema:**
```typescript
{
  score: number | null;    // null when skipped
  skipped?: boolean;       // true when nothing to evaluate
  skipReason?: string;     // human-readable reason
  issuesFound: number;     // 0 when skipped
  issuesFixed: number;     // 0 when skipped
  report: object;          // still includes type-appropriate report structure
  tokensUsed?: number;
  costUsd?: number;
}
```

## State Transitions

### Updated HealthScanStatus Lifecycle

```
PENDING ──→ RUNNING ──→ COMPLETED  (normal: score 0-100)
   │           │
   │           ├──→ SKIPPED     (nothing to evaluate: score null)
   │           │
   │           └──→ FAILED      (error: score null)
   │
   └──→ FAILED                  (dispatch error)
```

**Valid transitions (updated):**
| From | To |
|------|-----|
| PENDING | RUNNING, FAILED |
| RUNNING | COMPLETED, SKIPPED, FAILED |
| COMPLETED | *(terminal)* |
| SKIPPED | *(terminal)* |
| FAILED | *(terminal)* |

## Validation Rules

1. **SKIPPED status requires**: `score` must be null/undefined (enforced by API)
2. **SKIPPED status allows**: `report` with skip reason, `issuesFound: 0`, `issuesFixed: 0`
3. **COMPLIANCE scans**: Workflow defensively ignores `skipped: true` for COMPLIANCE type (FR-005)
4. **TESTS scans**: Workflow defensively ignores `skipped: true` for TESTS type (FR-006)
5. **Backward compatibility**: Agents that don't emit `skipped` field behave exactly as before
