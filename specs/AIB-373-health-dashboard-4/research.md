# Research: Health Dashboard - 4 Health Scan Commands

**Branch**: `AIB-373-health-dashboard-4` | **Date**: 2026-03-29

## Research Tasks & Findings

### 1. Command Output Format — Alignment with Zod Schemas

**Decision**: Commands must output JSON matching the workflow extraction contract AND the Zod discriminated union in `report-schemas.ts`.

**Rationale**: The workflow (`health-scan.yml`) extracts fields via `jq` from stdout: `score`, `issuesFound`, `issuesFixed`, `report` (object), `tokensUsed`, `costUsd`. The `report` object is stored as JSON string in `HealthScan.report` and later parsed by `parseScanReport()` which validates against Zod schemas. The `parseScanReport()` function injects the `type` field from `scanType` if missing, so commands don't need to include `type` in the report — but it's cleaner to include it.

**Alternatives considered**:
- Flat format (rejected): Would require modifying Zod schemas and all UI rendering code
- Including `type` in report (chosen): Makes the output self-describing and passes Zod validation directly

### 2. Existing Command Files — Gap Analysis

**Decision**: All 4 command files exist but need significant updates to align with Zod schemas.

**Findings per command**:

| Command | File | Key Gaps |
|---------|------|----------|
| health-security | `.claude-plugin/commands/ai-board.health-security.md` | Issues use uppercase severity (`HIGH`), Zod expects lowercase (`high`). Missing `id` field on issues. Report has `summary` not in schema. |
| health-compliance | `.claude-plugin/commands/ai-board.health-compliance.md` | Issues missing `id` and `severity` fields (both required by `reportIssueSchema`). Report has `summary` not in schema. |
| health-tests | `.claude-plugin/commands/ai-board.health-tests.md` | Uses `issues`/`nonFixable` structure instead of `autoFixed`/`nonFixable` arrays of `ReportIssue`. Items missing `id`, `severity` fields. |
| health-spec-sync | `.claude-plugin/commands/ai-board.health-spec-sync.md` | Report has `summary` not in schema. Otherwise closest to correct format. |

**Rationale**: Fixing the command prompts is the only change needed — no infrastructure changes required.

### 3. ReportIssue Schema Requirements

**Decision**: Every issue in all commands must conform to the `reportIssueSchema`:

```typescript
{
  id: string,           // Required — unique identifier (e.g., "sec-001", "comp-ts-001")
  severity: 'high' | 'medium' | 'low',  // Required — lowercase
  description: string,  // Required
  file?: string,        // Optional
  line?: number,        // Optional
  category?: string     // Optional — used for grouping (compliance principle, security category)
}
```

**Rationale**: The Zod schema is the contract; `parseScanReport()` validates against it. Non-conforming output returns `null` and the scan appears as having no report data in the UI.

### 4. Incremental Scan Strategy (--base-commit)

**Decision**: Use `git diff --name-only <base>..<head>` to get changed files, then only analyze those files.

**Rationale**:
- Security/Compliance/Spec-Sync: Analyzing only changed files for incremental scans satisfies FR-003 and SC-006 (half the time of full scans)
- Tests (FR-005): Always runs full test suite regardless of `--base-commit` — test failures can originate from unchanged files affected by changed code

**Alternatives considered**:
- AST-level diff analysis: Too complex, overkill for command prompts executed by Claude
- Scope to changed + imported files: Would require dependency graph analysis not available in command context

### 5. Score Calculation Strategy

**Decision**: Each command calculates score based on issue count and severity.

**Formula approach**:
- Start at 100
- HIGH severity: -15 points each
- MEDIUM severity: -8 points each
- LOW severity: -3 points each
- Floor at 0

**Rationale**: Proportional scoring per FR-014. Higher-severity issues have more impact. The exact weights are guidance for the AI agent executing the command — slight variation is acceptable as long as the score reflects overall health.

### 6. Test Auto-Fix Strategy

**Decision**: For each failing test, attempt fix → re-run specific test → commit if passes → report as non-fixable if still fails.

**Rationale**: Per spec FR-009 and auto-resolved decision, individual commits provide traceability. The command prompt must instruct the agent to:
1. Run test suite to identify failures
2. For each failure: read test file and error, attempt fix, re-run that test
3. If fix succeeds: `git add` + `git commit` with descriptive message
4. If fix fails or requires architectural changes: report as `nonFixable`

**Alternatives considered**:
- Batch all fixes then commit: Rejected (spec decision requires individual commits)
- Only report, never fix: Rejected (FR-009 requires auto-fix attempts)

### 7. Constitution File Discovery

**Decision**: Commands read `.ai-board/memory/constitution.md` first, fall back to `.claude-plugin/memory/constitution.md`.

**Rationale**: Per spec FR-007 and auto-resolved decision. Project-level constitution takes precedence. If neither exists, report score 0 with an error-level issue per edge case spec.

### 8. Spec Sync — What to Compare

**Decision**: Read each file in `specs/specifications/` and compare documented contracts against implementation code.

**Scope**:
- `endpoints.md` → compare against `app/api/` routes
- `schemas.md` → compare against Prisma schema and Zod schemas
- `data-model.md` → compare against `prisma/schema.prisma`
- Functional specs → compare described behaviors against component/API code

**Rationale**: Per FR-011 and FR-012. The spec-sync command needs to detect both directions of drift: code without spec coverage and specs without code implementation.

### 9. GeneratedTickets Field

**Decision**: Commands output `generatedTickets: []` (empty array) in the report.

**Rationale**: Ticket creation is handled by the workflow AFTER the command completes (see `health-scan.yml` Step 5). The command itself doesn't create tickets. The `generatedTickets` field in the Zod schema is populated by the API when tickets are created and linked back. Commands always output an empty array.
