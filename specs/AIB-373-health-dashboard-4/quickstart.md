# Quickstart: Health Dashboard - 4 Health Scan Commands

**Branch**: `AIB-373-health-dashboard-4` | **Date**: 2026-03-29

## What This Feature Does

Updates 4 existing Claude Code command files (`.claude-plugin/commands/ai-board.health-*.md`) so their output format matches the Zod schemas in `lib/health/report-schemas.ts`. No new files, no infrastructure changes.

## Files to Modify

| File | Change |
|------|--------|
| `.claude-plugin/commands/ai-board.health-security.md` | Fix output format: lowercase severity, add `id` field, add `type: "SECURITY"`, remove `summary`, add `generatedTickets: []` |
| `.claude-plugin/commands/ai-board.health-compliance.md` | Fix output format: add `id` and `severity` fields, add `type: "COMPLIANCE"`, remove `summary`, add `generatedTickets: []` |
| `.claude-plugin/commands/ai-board.health-tests.md` | Fix output format: rename `issues` to `autoFixed`, use `ReportIssue` schema for both arrays, add `type: "TESTS"`, add `generatedTickets: []` |
| `.claude-plugin/commands/ai-board.health-spec-sync.md` | Fix output format: add `type: "SPEC_SYNC"`, remove `summary`, add `generatedTickets: []` |

## Key Integration Points

- **Workflow reads**: `jq -r '.score // 0'`, `jq -c '.report // {}'` from command stdout
- **Zod validates**: `parseScanReport()` in `lib/health/report-schemas.ts`
- **Tickets from**: `groupIssuesIntoTickets()` in `lib/health/ticket-creation.ts`
- **UI renders**: `drawer/drawer-issues.tsx` branches on report type

## Testing Strategy

| What | Type | Location |
|------|------|----------|
| Command output validates against Zod schemas | Unit test | `tests/unit/health/command-output-validation.test.ts` |
| `parseScanReport()` handles updated formats | Unit test | `tests/unit/health/report-schemas.test.ts` (extend existing) |
| `groupIssuesIntoTickets()` with valid reports | Unit test | `tests/unit/health/ticket-creation.test.ts` (extend existing) |
| Scan trigger → status update flow | Integration test | `tests/integration/health/scan-lifecycle.test.ts` (extend existing) |

No E2E tests needed — commands run in CI workflow context, not in browser.
