# Implementation Plan: Health Dashboard - Workflow health-scan.yml

**Branch**: `AIB-377-copy-of-health` | **Date**: 2026-03-29 | **Spec**: `specs/AIB-377-copy-of-health/spec.md`
**Input**: Feature specification from `/specs/AIB-377-copy-of-health/spec.md`

## Summary

Create the `health-scan.yml` GitHub Actions workflow that executes project health scans (Security, Compliance, Tests, Spec Sync) triggered by the ai-board API. The workflow clones the target repository, runs the appropriate scan command via Claude Code, reports results back to the status callback API, creates remediation tickets from findings, and recalculates the project's health score. Follows the established speckit.yml workflow pattern for dispatch, authentication, and status reporting.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0, GitHub Actions YAML
**Primary Dependencies**: Next.js 16 (App Router), Prisma 6.x, Octokit (workflow dispatch), Claude Code CLI (scan execution)
**Storage**: PostgreSQL 14+ via Prisma ORM (existing HealthScan, HealthScore, Ticket models)
**Testing**: Vitest (unit + integration) — workflow tested via integration tests against status callback API
**Target Platform**: GitHub Actions runner (ubuntu-latest), ai-board web application
**Project Type**: Web application (Next.js monolith) + GitHub Actions workflow
**Performance Goals**: Scan status updates visible in dashboard within 5s of state change; ticket creation within 30s of scan completion
**Constraints**: Static command mapping (no dynamic command construction), WORKFLOW_API_TOKEN auth, max 2000 char error messages, full git history clone (fetch-depth: 0)
**Scale/Scope**: 4 scan types, 1 new workflow file, scan command stubs, ticket creation logic in workflow

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All API routes and utilities use strict TypeScript; workflow YAML calls typed endpoints |
| II. Component-Driven | PASS | No new UI components — workflow and API only |
| III. Test-Driven | PASS | Integration tests for ticket creation API; unit tests for scan command mapping and score recalculation |
| IV. Security-First | PASS | Static command mapping prevents injection (FR-013); Bearer token auth (FR-012); Zod validation on all inputs |
| V. Database Integrity | PASS | HealthScan state machine enforced at API level; HealthScore upsert via Prisma transactions |
| V. Spec Clarification | PASS | AUTO → CONSERVATIVE decisions documented in spec (5 auto-resolved decisions) |
| VI. AI-First | PASS | No documentation files; all artifacts in `specs/` |

**Gate Result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```
specs/AIB-377-copy-of-health/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── health-scan-workflow.ts
└── tasks.md             # Phase 2 output (via /ai-board.tasks)
```

### Source Code (repository root)

```
.github/workflows/
└── health-scan.yml                          # NEW: Health scan workflow

lib/health/
├── scan-dispatch.ts                         # EXISTING: Dispatch function (already implemented)
├── scan-commands.ts                         # NEW: Static scan type → command mapping
├── ticket-creation.ts                       # NEW: Remediation ticket creation from scan reports
├── score-calculator.ts                      # EXISTING: Global score calculation (already implemented)
├── report-schemas.ts                        # EXISTING: Report Zod schemas (already implemented)
└── types.ts                                 # EXISTING: Health types (already implemented)

app/api/projects/[projectId]/health/scans/
├── route.ts                                 # EXISTING: POST trigger, GET history
└── [scanId]/status/route.ts                 # EXISTING: PATCH status updates (extend for ticket creation)

tests/
├── unit/
│   └── health/
│       ├── scan-commands.test.ts            # Unit test: static command mapping
│       └── ticket-creation.test.ts          # Unit test: report → ticket grouping logic
└── integration/
    └── health/
        └── scan-status-tickets.test.ts      # Integration test: status update + ticket creation flow
```

**Structure Decision**: Extends existing health feature directory in `lib/health/`. New workflow file follows established pattern from `speckit.yml`. Ticket creation logic is a new utility; scan command mapping is a pure function. No new database models — uses existing HealthScan, HealthScore, Ticket, and Project models.

## Implementation Design

### Layer 1: Workflow — health-scan.yml

**File**: `.github/workflows/health-scan.yml` (NEW)

Follows speckit.yml pattern with health-scan-specific inputs:

```yaml
on:
  workflow_dispatch:
    inputs:
      scan_id: { type: string, required: true }
      project_id: { type: string, required: true }
      scan_type: { type: string, required: true }  # SECURITY|COMPLIANCE|TESTS|SPEC_SYNC
      base_commit: { type: string, required: false, default: '' }
      head_commit: { type: string, required: false, default: '' }
      githubRepository: { type: string, required: true }  # owner/repo
```

**Job steps**:
1. Checkout target repository (actions/checkout with `repository: inputs.githubRepository`, `fetch-depth: 0`)
2. Update scan status to RUNNING via `PATCH /api/projects/{project_id}/health/scans/{scan_id}/status`
3. Map scanType to command using static lookup (case statement — no dynamic construction)
4. Execute scan command via Claude Code CLI with baseCommit/headCommit arguments
5. Parse JSON output (score, issues, report)
6. Create remediation tickets via API (grouped per scan type rules)
7. Update scan status to COMPLETED with score, report, issuesFound, issuesFixed, telemetry
8. On failure: Update scan status to FAILED with error message

**Authentication**: Uses `WORKFLOW_API_TOKEN` secret for Bearer token on all API callbacks.

### Layer 2: Utility — Static Command Mapping

**File**: `lib/health/scan-commands.ts` (NEW)

```typescript
export const SCAN_COMMAND_MAP: Record<HealthScanType, string> = {
  SECURITY: 'health-security',
  COMPLIANCE: 'health-compliance',
  TESTS: 'health-tests',
  SPEC_SYNC: 'health-spec-sync',
} as const;

export function getScanCommand(scanType: HealthScanType): string {
  const command = SCAN_COMMAND_MAP[scanType];
  if (!command) throw new Error(`Unknown scan type: ${scanType}`);
  return command;
}
```

Pure function, no dynamic construction. Adding new scan types requires updating this mapping.

### Layer 3: Utility — Remediation Ticket Creation

**File**: `lib/health/ticket-creation.ts` (NEW)

Parses scan reports and creates grouped remediation tickets:

```typescript
export interface RemediationTicket {
  title: string;
  description: string;
  stage: 'INBOX';
  workflowType: 'QUICK';
}

export function groupIssuesIntoTickets(
  scanType: HealthScanType,
  report: ScanReport
): RemediationTicket[]
```

**Grouping rules** (from spec FR-007):
- **SECURITY**: Group by severity level (e.g., one ticket for all HIGH issues, one for MEDIUM)
- **COMPLIANCE**: Group by violated constitution principle
- **TESTS**: One ticket per unfixable test
- **SPEC_SYNC**: One ticket per desynchronized spec

Each ticket includes affected files, line numbers, and issue descriptions in the body.

### Layer 4: Workflow Step — Ticket Creation via API

The workflow calls the ai-board API to create tickets after a successful scan. Uses existing `POST /api/projects/{projectId}/tickets` endpoint with:
- `title`: Generated from scan type + grouping key
- `description`: Detailed issue listing with file paths and line numbers
- `stage`: `INBOX`
- `workflowType`: `QUICK`

### Layer 5: API Extension — Score Recalculation on Status Update

**File**: `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` (EXISTING)

The existing PATCH endpoint already handles:
- State machine validation (PENDING → RUNNING → COMPLETED/FAILED)
- HealthScore upsert with module sub-score update
- Global score recalculation via `calculateGlobalScore()`

No modifications needed — the workflow simply calls the existing endpoint with the correct payload.

### Layer 6: Workflow — Error Handling & Telemetry

**Error handling**:
- Clone failure → FAILED with clone error message
- Command execution failure → FAILED with command stderr (truncated to 2000 chars)
- JSON parse failure → FAILED with parse error details
- API callback failure → Workflow step fails; GitHub Actions shows the failure

**Telemetry** (recorded on every completion/failure):
- `durationMs`: Wall clock time from workflow start to completion
- `tokensUsed`: Extracted from Claude Code CLI output
- `costUsd`: Extracted from Claude Code CLI output

## Testing Strategy

| Test | Type | Location | Covers |
|------|------|----------|--------|
| Static command mapping | Unit | `tests/unit/health/scan-commands.test.ts` | FR-004, FR-013 |
| Report → ticket grouping (all 4 scan types) | Unit | `tests/unit/health/ticket-creation.test.ts` | FR-007, FR-008, US-2 |
| Zero issues → no tickets | Unit | Same as above | US-2 scenario 5 |
| Status callback + score recalculation | Integration | `tests/integration/health/scan-status-tickets.test.ts` | FR-003, FR-006, FR-009, FR-010, FR-011, US-1, US-4, US-5 |
| Ticket creation API flow | Integration | Same as above | FR-007, FR-008, US-2 |
| Incremental scan commit passing | Integration | Same as above | FR-005, US-3 |

**Decision tree applied**:
- Command mapping → Unit test (pure function, no dependencies)
- Ticket grouping → Unit test (pure function, deterministic output)
- API status callbacks → Integration test (API + database operations)
- Workflow YAML → Not directly testable; validated by integration tests on the endpoints it calls

## Complexity Tracking

*No constitution violations — table not applicable.*

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Scan command produces invalid JSON | Wrap parse in try-catch; report FAILED with raw output snippet for debugging |
| Target repo clone fails (auth/permissions) | Workflow uses `GH_PAT` secret; FAILED status with clone error logged |
| Concurrent scans for same type | API already returns 409 SCAN_IN_PROGRESS when PENDING/RUNNING scan exists |
| baseCommit SHA missing after force push | Scan command falls back to full scan; warning logged in report |
| Ticket creation partially fails | Scan still marked COMPLETED; partial failures logged but don't roll back |
| Workflow API callback unreachable | Scan remains in last known state; GitHub Actions shows step failure |
