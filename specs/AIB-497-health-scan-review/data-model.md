# Data Model: Health Scan — Review Quality Analysis

**Ticket**: AIB-497
**Date**: 2026-04-03

---

## Schema Changes

### 1. HealthScanType Enum Extension

```prisma
enum HealthScanType {
  SECURITY
  COMPLIANCE
  TESTS
  SPEC_SYNC
  REVIEW_QUALITY   // NEW
}
```

### 2. HealthScore Model Extension

```prisma
model HealthScore {
  // ... existing fields ...
  reviewQualityScore    Int?        // NEW — latest coverage score (0-100)
  lastReviewQualityScan DateTime?   // NEW — timestamp of last completed scan
}
```

**Migration**: Add two nullable columns to `HealthScore`. No data backfill needed — null means "never scanned".

---

## TypeScript Entities

### MissedFinding

Represents a single review gap — an issue caught by Codex or Copilot but not by ai-board custom.

```typescript
interface MissedFinding {
  id: string;                // UUID for deduplication
  prNumber: number;          // GitHub PR number
  source: 'codex' | 'copilot';  // Which external reviewer caught it
  category: ReviewGapCategory;
  severity: 'high' | 'medium' | 'low';
  description: string;       // What the external reviewer flagged
  file: string;              // File path
  line: number;              // Line number
  sourceCommentUrl?: string; // Link to the original GitHub comment
}
```

### ReviewGapCategory

Enumerated categories for classification (spec FR-007).

```typescript
type ReviewGapCategory =
  | 'state-lifecycle'
  | 'edge-case-validation'
  | 'test-quality'
  | 'error-handling'
  | 'ui-ux-state'
  | 'ci-workflow'
  | 'api-contract'
  | 'security'
  | 'performance';
```

### RecurringPattern

Aggregated insight from cumulative analysis.

```typescript
interface RecurringPattern {
  category: ReviewGapCategory;
  occurrences: number;        // Number of distinct PRs with this category
  prNumbers: number[];        // PR numbers where this appeared
  suggestedRule: string;      // Proposed constitution rule or review prompt
  target: 'constitution' | 'review-prompt';
  alreadyTicketed: boolean;   // True if [Review Gap] ticket exists
  ticketKey?: string;         // Existing ticket key if alreadyTicketed
}
```

### ReviewQualityReport

The report stored in `HealthScan.report` JSON field.

```typescript
interface ReviewQualityReport {
  type: 'REVIEW_QUALITY';
  summary: {
    prsAnalyzed: number;
    totalMissedFindings: number;
    coverageScore: number;        // 0-100, floor at 0
    scoreBreakdown: {
      base: 100;
      highPenalty: number;        // count × -15
      mediumPenalty: number;      // count × -8
      lowPenalty: number;         // count × -3
    };
  };
  missedFindings: MissedFinding[];
  cumulativeAnalysis: {
    windowDays: 30;
    reportsAnalyzed: number;
    recurringPatterns: RecurringPattern[];
  };
  generatedTickets: GeneratedTicket[];  // Reuses existing type
}
```

### Scoring Formula

```
coverageScore = max(0, 100 - (highCount × 15) - (mediumCount × 8) - (lowCount × 3))
```

---

## Validation Rules

| Field | Rule |
|-------|------|
| `MissedFinding.id` | UUID v4, unique within report |
| `MissedFinding.prNumber` | Positive integer, must correspond to a real merged PR |
| `MissedFinding.file` | Non-empty string, valid file path |
| `MissedFinding.line` | Positive integer |
| `RecurringPattern.occurrences` | >= 3 (threshold for pattern detection) |
| `ReviewQualityReport.summary.coverageScore` | Integer 0-100 |
| `ReviewQualityReport.cumulativeAnalysis.windowDays` | Always 30 |

---

## State Transitions

The Review Quality scan follows the standard `HealthScan` state machine:

```
PENDING → RUNNING → COMPLETED (with score & report)
       └→ RUNNING → FAILED (with errorMessage)
```

No additional state transitions are introduced.

---

## Relationships

- `HealthScan` → `Project`: Existing FK, no changes needed
- `HealthScore.reviewQualityScore` → Cached from latest COMPLETED `REVIEW_QUALITY` scan
- Generated `[Review Gap]` tickets → `Ticket` model via existing ticket creation API (no FK — linked by title convention)
