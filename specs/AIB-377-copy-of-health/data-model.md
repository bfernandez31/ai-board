# Data Model: Health Dashboard - Workflow health-scan.yml

**Feature**: AIB-377 | **Date**: 2026-03-29

## Existing Entities (No Schema Changes)

This feature creates no new database models. All entities are already defined in `prisma/schema.prisma`.

### HealthScan (existing — lines 457-494)

| Field | Type | Notes |
|-------|------|-------|
| id | Int (PK) | Auto-increment |
| projectId | Int (FK → Project) | Cascade delete |
| scanType | HealthScanType | SECURITY, COMPLIANCE, TESTS, SPEC_SYNC |
| status | HealthScanStatus | PENDING → RUNNING → COMPLETED/FAILED |
| score | Int? | 0-100, set on COMPLETED |
| report | String? | JSON string, validated by Zod schemas in `lib/health/report-schemas.ts` |
| issuesFound | Int? | Total issues detected |
| issuesFixed | Int? | Issues auto-remediated |
| baseCommit | String?(40) | Previous scan's headCommit (null for first scan) |
| headCommit | String?(40) | Current HEAD at scan time |
| durationMs | Int? | Wall clock duration |
| tokensUsed | Int? | Claude Code token consumption |
| costUsd | Float? | Estimated cost |
| errorMessage | String?(2000) | Failure details |
| startedAt | DateTime? | Set when status → RUNNING |
| completedAt | DateTime? | Set when status → COMPLETED/FAILED |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

**State Transitions**:
```
PENDING → RUNNING (workflow starts)
PENDING → FAILED  (dispatch error)
RUNNING → COMPLETED (scan succeeds)
RUNNING → FAILED    (scan error)
```

**Indexes**:
- `[projectId, scanType, createdAt DESC]` — scan history queries
- `[projectId, scanType, status]` — duplicate scan prevention
- `[projectId, status]` — active scan polling
- `[createdAt]` — retention/cleanup

### HealthScore (existing — lines 496-528)

| Field | Type | Notes |
|-------|------|-------|
| id | Int (PK) | Auto-increment |
| projectId | Int (unique FK → Project) | One-to-one |
| globalScore | Int? | Proportional average of available sub-scores |
| securityScore | Int? | From latest SECURITY scan |
| complianceScore | Int? | From latest COMPLIANCE scan |
| testsScore | Int? | From latest TESTS scan |
| specSyncScore | Int? | From latest SPEC_SYNC scan |
| qualityGate | Int? | From latest verify Job.qualityScore (passive) |
| lastSecurityScan | DateTime? | Timestamp of latest SECURITY scan completion |
| lastComplianceScan | DateTime? | Timestamp of latest COMPLIANCE scan completion |
| lastTestsScan | DateTime? | Timestamp of latest TESTS scan completion |
| lastSpecSyncScan | DateTime? | Timestamp of latest SPEC_SYNC scan completion |
| lastCleanDate | DateTime? | From latest cleanup Job (passive) |
| lastCleanJobId | Int? | Reference to cleanup Job |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

**Score Recalculation**: `calculateGlobalScore()` in `lib/health/score-calculator.ts` averages all non-null sub-scores (securityScore, complianceScore, testsScore, specSyncScore, qualityGate). Null modules are excluded from the denominator.

### Ticket (existing — used for remediation tickets)

Remediation tickets are standard Ticket records created with:
- `stage`: `INBOX`
- `workflowType`: `QUICK`
- `projectId`: From the scan's project
- `title`: Generated from scan type + grouping key
- `description`: Issue details with affected files/lines

No new fields needed on the Ticket model.

## Report Types (existing Zod schemas)

Report JSON structure is defined in `lib/health/report-schemas.ts` as a discriminated union:

### SecurityReport
```typescript
{
  type: 'SECURITY',
  issues: Array<{
    severity: 'HIGH' | 'MEDIUM' | 'LOW',
    title: string,
    description: string,
    file: string,
    line?: number,
    recommendation: string
  }>,
  generatedTickets: Array<{ title: string, issueCount: number }>
}
```

### ComplianceReport
```typescript
{
  type: 'COMPLIANCE',
  violations: Array<{
    principle: string,
    description: string,
    file: string,
    line?: number,
    suggestion: string
  }>,
  generatedTickets: Array<{ title: string, violationCount: number }>
}
```

### TestsReport
```typescript
{
  type: 'TESTS',
  failures: Array<{
    testName: string,
    testFile: string,
    error: string,
    autoFixAttempted: boolean,
    autoFixSucceeded: boolean
  }>,
  generatedTickets: Array<{ title: string }>
}
```

### SpecSyncReport
```typescript
{
  type: 'SPEC_SYNC',
  drifts: Array<{
    specFile: string,
    codeFiles: string[],
    description: string,
    severity: 'HIGH' | 'MEDIUM' | 'LOW'
  }>,
  generatedTickets: Array<{ title: string }>
}
```

## New TypeScript Interfaces

### RemediationTicket (new — `lib/health/ticket-creation.ts`)

```typescript
export interface RemediationTicket {
  title: string;
  description: string;
  stage: 'INBOX';
  workflowType: 'QUICK';
}
```

### ScanCommandMap (new — `lib/health/scan-commands.ts`)

```typescript
export const SCAN_COMMAND_MAP: Record<HealthScanType, string> = {
  SECURITY: 'health-security',
  COMPLIANCE: 'health-compliance',
  TESTS: 'health-tests',
  SPEC_SYNC: 'health-spec-sync',
} as const;
```
