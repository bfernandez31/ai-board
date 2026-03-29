# Data Model: Health Dashboard - 4 Health Scan Commands

**Branch**: `AIB-373-health-dashboard-4` | **Date**: 2026-03-29

## Entities

This feature does NOT introduce new data models. All persistence entities already exist from prior health dashboard tickets. This document maps the existing entities that the 4 commands interact with.

### HealthScan (existing — Prisma model)

The commands produce output that the workflow stores in this model.

| Field | Type | Relevance to Commands |
|-------|------|----------------------|
| `score` | `Int?` | Set from command's top-level `score` field (0-100) |
| `report` | `String?` | Set from JSON-stringified command `report` object |
| `issuesFound` | `Int?` | Set from command's top-level `issuesFound` field |
| `issuesFixed` | `Int?` | Set from command's top-level `issuesFixed` field (tests only) |
| `baseCommit` | `String?` | Passed TO command as `--base-commit` arg |
| `headCommit` | `String?` | Set from workflow's `git rev-parse HEAD` or `--head-commit` |
| `durationMs` | `Int?` | Measured by workflow, not by command |
| `tokensUsed` | `Int?` | Set from command's optional `tokensUsed` field |
| `costUsd` | `Float?` | Set from command's optional `costUsd` field |

### Report Types (existing — Zod discriminated union)

**Source**: `lib/health/report-schemas.ts`

Each command produces a report matching one variant of the `ScanReport` discriminated union:

#### SecurityReport
```typescript
{
  type: 'SECURITY',
  issues: ReportIssue[],        // Findings grouped by severity in UI
  generatedTickets: GeneratedTicket[]  // Always [] from command
}
```

#### ComplianceReport
```typescript
{
  type: 'COMPLIANCE',
  issues: ReportIssue[],        // Grouped by category (principle) in UI
  generatedTickets: GeneratedTicket[]
}
```

#### TestsReport
```typescript
{
  type: 'TESTS',
  autoFixed: ReportIssue[],     // Tests that were auto-fixed
  nonFixable: ReportIssue[],    // Tests that couldn't be fixed
  generatedTickets: GeneratedTicket[]
}
```

#### SpecSyncReport
```typescript
{
  type: 'SPEC_SYNC',
  specs: SpecSyncEntry[],       // Per-spec sync status
  generatedTickets: GeneratedTicket[]
}
```

### ReportIssue (existing — shared across reports)

```typescript
{
  id: string,                    // Unique ID (e.g., "sec-001")
  severity: 'high' | 'medium' | 'low',
  description: string,
  file?: string,                 // File path where issue found
  line?: number,                 // Line number
  category?: string              // Grouping key (security category, principle name)
}
```

**Validation rules**:
- `severity` MUST be lowercase (`high`, not `HIGH`)
- `id` MUST be unique within a single report
- `file` SHOULD be a relative path from repo root
- `category` is used by ticket grouping: security groups by severity, compliance groups by category

### SpecSyncEntry (existing — spec-sync only)

```typescript
{
  specPath: string,              // Path to spec file
  status: 'synced' | 'drifted',
  drift?: string                 // Description of drift (only when drifted)
}
```

## Command Output Wrapper

All 4 commands output a top-level JSON object that wraps the report:

```typescript
{
  score: number,           // 0-100
  issuesFound: number,     // Total issues count
  issuesFixed: number,     // Auto-fixed count (tests only, 0 for others)
  report: ScanReport,      // Typed report matching the scan type
  tokensUsed?: number,     // Optional telemetry
  costUsd?: number         // Optional telemetry
}
```

The workflow extracts these fields via `jq` and passes them to the status update API.

## State Transitions

No new state transitions. Commands are stateless — they read the codebase, produce JSON output, and exit. The workflow manages the `HealthScan.status` lifecycle: `PENDING → RUNNING → COMPLETED|FAILED`.
