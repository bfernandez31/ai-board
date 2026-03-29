# Quickstart: Health Dashboard - Workflow health-scan.yml

**Feature**: AIB-377 | **Date**: 2026-03-29

## What This Feature Does

Creates the `health-scan.yml` GitHub Actions workflow that executes project health scans when triggered from the Health Dashboard UI. The workflow clones the target repository, runs a scan command, reports results back to the API, creates remediation tickets, and updates the project's health score.

## Key Files to Create/Modify

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `.github/workflows/health-scan.yml` | Workflow definition |
| CREATE | `lib/health/scan-commands.ts` | Static scanType → command mapping |
| CREATE | `lib/health/ticket-creation.ts` | Report → remediation ticket grouping |
| CREATE | `tests/unit/health/scan-commands.test.ts` | Command mapping tests |
| CREATE | `tests/unit/health/ticket-creation.test.ts` | Ticket grouping tests |
| CREATE | `tests/integration/health/scan-status-tickets.test.ts` | End-to-end status + ticket flow |

## Implementation Order

1. **scan-commands.ts** — Pure utility, no dependencies. Start here.
2. **ticket-creation.ts** — Pure utility, depends on types from `lib/health/types.ts` and report schemas from `lib/health/report-schemas.ts`.
3. **Unit tests** — Test both utilities before integrating.
4. **health-scan.yml** — Workflow file using the utilities and calling existing API endpoints.
5. **Integration tests** — Verify the full flow (status updates → score recalculation → ticket creation).

## Existing Infrastructure (Do Not Recreate)

These are already implemented and should be called, not duplicated:

- `lib/health/scan-dispatch.ts` — `dispatchHealthScanWorkflow()` triggers the workflow
- `app/api/projects/[projectId]/health/scans/route.ts` — POST creates HealthScan + dispatches
- `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` — PATCH updates status + recalculates score
- `lib/health/score-calculator.ts` — `calculateGlobalScore()` averages sub-scores
- `lib/health/report-schemas.ts` — Zod schemas for all 4 report types
- `lib/health/types.ts` — All health-related TypeScript types

## Workflow Authentication

All API calls from the workflow use:
```
Authorization: Bearer ${WORKFLOW_API_TOKEN}
```

Same pattern as `speckit.yml` — the `WORKFLOW_API_TOKEN` secret must be available in the workflow context.

## Testing Quick Reference

```bash
# Unit tests
bun run test:unit -- tests/unit/health/

# Integration tests
bun run test:integration -- tests/integration/health/

# Type check
bun run type-check

# Lint
bun run lint
```
