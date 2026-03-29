# Data Model: Health Dashboard - Workflow health-scan.yml

**Branch**: `AIB-372-health-dashboard-workflow` | **Date**: 2026-03-29

## Entities

This feature does NOT introduce new database entities. All models already exist. This document catalogs the existing entities the workflow interacts with and documents the workflow's data flow.

### HealthScan (existing — no schema changes)

**Source**: `prisma/schema.prisma` (lines 457-494)

| Field | Type | Workflow Role |
|-------|------|---------------|
| `id` | Int (PK) | Received as `scan_id` input; used in PATCH status calls |
| `projectId` | Int (FK → Project) | Received as `project_id` input |
| `scanType` | HealthScanType enum | Received as `scan_type` input; maps to command name |
| `status` | HealthScanStatus enum | Updated: PENDING → RUNNING → COMPLETED/FAILED |
| `score` | Int? (0-100) | Set on COMPLETED from parsed report |
| `report` | String? (JSON) | Set on COMPLETED; stringified scan report |
| `issuesFound` | Int? | Set on COMPLETED from report data |
| `issuesFixed` | Int? | Set on COMPLETED from report data (TESTS scan type) |
| `baseCommit` | String? | Received as `base_commit` input (from previous scan) |
| `headCommit` | String? (40 chars) | Set by workflow after repo checkout (`git rev-parse HEAD`) |
| `durationMs` | Int? | Set on COMPLETED/FAILED; wall-clock execution time |
| `tokensUsed` | Int? | Set on COMPLETED/FAILED; parsed from agent output |
| `costUsd` | Float? | Set on COMPLETED/FAILED; parsed from agent output |
| `errorMessage` | String? (max 2000) | Set on FAILED; error description |
| `startedAt` | DateTime? | Set server-side on RUNNING transition |
| `completedAt` | DateTime? | Set server-side on COMPLETED/FAILED transition |

**State Machine**:
```
PENDING ──→ RUNNING ──→ COMPLETED
   │           │
   └───→ FAILED ←──┘
```

### HealthScore (existing — no schema changes)

**Source**: `prisma/schema.prisma` (lines 496-528)

Updated automatically by the PATCH status endpoint when a scan transitions to COMPLETED. The workflow does NOT update HealthScore directly.

| Field | Updated When |
|-------|-------------|
| `securityScore` | SECURITY scan COMPLETED |
| `complianceScore` | COMPLIANCE scan COMPLETED |
| `testsScore` | TESTS scan COMPLETED |
| `specSyncScore` | SPEC_SYNC scan COMPLETED |
| `globalScore` | Any scan COMPLETED (recalculated from all non-null modules) |
| `lastSecurityScan` | SECURITY scan COMPLETED |
| `lastComplianceScan` | COMPLIANCE scan COMPLETED |
| `lastTestsScan` | TESTS scan COMPLETED |
| `lastSpecSyncScan` | SPEC_SYNC scan COMPLETED |

### Ticket (existing — no schema changes)

Created by the workflow via `POST /api/projects/:projectId/tickets` for each issue group.

| Field | Value from Workflow |
|-------|-------------------|
| `title` | `[Health:{ScanType}] {group identifier}` (max 100 chars) |
| `description` | Markdown listing issues with file paths, line numbers, scan reference |
| `stage` | INBOX (default) |
| `workflowType` | QUICK (simple fixes) |

## Data Flow

```
1. API creates HealthScan (PENDING) → dispatches workflow
2. Workflow starts → PATCH status to RUNNING
3. Workflow clones repo → captures HEAD SHA
4. Workflow executes scan command → captures JSON report
5. Workflow parses report → extracts score, issues, telemetry
6. Workflow creates tickets for issue groups → POST tickets API
7. Workflow records ticket keys in report → PATCH status to COMPLETED
   └─ Server-side: updates HealthScore, recalculates globalScore
```

## Report Schemas (existing — no changes)

All report schemas defined in `lib/health/report-schemas.ts`. The workflow produces these from scan command output.

### SecurityReport
```json
{
  "type": "SECURITY",
  "issues": [{ "id": "...", "severity": "high|medium|low", "description": "...", "file": "...", "line": 42, "category": "..." }],
  "generatedTickets": [{ "ticketKey": "AIB-999", "stage": "INBOX" }]
}
```

### ComplianceReport
```json
{
  "type": "COMPLIANCE",
  "issues": [{ "id": "...", "severity": "high|medium|low", "description": "...", "file": "...", "line": 42, "category": "principle-name" }],
  "generatedTickets": [{ "ticketKey": "AIB-999", "stage": "INBOX" }]
}
```

### TestsReport
```json
{
  "type": "TESTS",
  "autoFixed": [{ "id": "...", "severity": "...", "description": "...", "file": "...", "line": 42 }],
  "nonFixable": [{ "id": "...", "severity": "...", "description": "...", "file": "...", "line": 42 }],
  "generatedTickets": [{ "ticketKey": "AIB-999", "stage": "INBOX" }]
}
```

### SpecSyncReport
```json
{
  "type": "SPEC_SYNC",
  "specs": [{ "specPath": "specs/...", "status": "synced|drifted", "drift": "description of drift" }],
  "generatedTickets": [{ "ticketKey": "AIB-999", "stage": "INBOX" }]
}
```

## Validation Rules

- `score`: Integer 0-100, required for COMPLETED status
- `headCommit`: Exactly 40 hex characters (SHA-1)
- `errorMessage`: Max 2000 characters
- `report`: Must parse as valid JSON matching the Zod schema for the scan type
- State transitions enforced server-side (invalid transitions return 409)
