# Research: Add SKIPPED Status for Health Scans

**Date**: 2026-04-04
**Branch**: `AIB-534-add-skipped-status`

## Unknowns Resolved

### 1. How should the Prisma enum migration work?

- **Decision**: Add `SKIPPED` to the `HealthScanStatus` enum via a new Prisma migration
- **Rationale**: Prisma enum migrations for PostgreSQL use `ALTER TYPE ... ADD VALUE` which is non-destructive and doesn't require table recreation
- **Alternatives considered**: Using a string field instead of enum — rejected because the existing codebase uses Prisma enums consistently and TypeScript type safety depends on it

### 2. How does the workflow communicate SKIPPED status?

- **Decision**: The workflow's status PATCH endpoint already handles terminal states. Add `SKIPPED` as a valid status in the Zod schema and transition map. The workflow result file (`/tmp/health-scan-result.json`) includes a `status: "SKIPPED"` field. The workflow's "Update Status" step sends this status to the API.
- **Rationale**: Minimal change — reuses the existing status update pipeline rather than introducing a parallel mechanism
- **Alternatives considered**: Adding a separate `skipped` boolean field to HealthScan — rejected as redundant with status enum

### 3. How should the dashboard distinguish SKIPPED from never-scanned?

- **Decision**: Add a new card state `skipped` to `HealthModuleCard` alongside `never_scanned`, `scanning`, `completed`, `failed`. Display a "Skipped" badge (muted styling) and "Nothing to evaluate" summary. The module retains its previous score from `HealthScore` aggregate.
- **Rationale**: SKIPPED is semantically different from never-scanned (a scan ran but found nothing) and from completed (a scan evaluated and scored). Requires distinct visual treatment per FR-010.
- **Alternatives considered**: Reusing the `completed` state with score=null — rejected because it conflates two different outcomes

### 4. How do trend queries exclude SKIPPED scans?

- **Decision**: The trends endpoint already filters `status: 'COMPLETED'` and `score: { not: null }`. SKIPPED scans have `score: null` and `status: 'SKIPPED'`, so they are automatically excluded from trend data. No code change needed in the trends API.
- **Rationale**: The existing filter is sufficient — SKIPPED scans will never match `status: 'COMPLETED'`
- **Alternatives considered**: Adding an explicit `status: { not: 'SKIPPED' }` filter — unnecessary given the existing COMPLETED filter

### 5. How does the global score calculation handle SKIPPED?

- **Decision**: When a scan is SKIPPED, the `HealthScore` aggregate is NOT updated (no upsert). The module retains its previous score. `calculateGlobalScore()` already handles null modules by excluding them from the average. No change needed to the score calculator.
- **Rationale**: FR-004 requires no score update on SKIPPED. The existing null-filtering logic in `calculateGlobalScore()` already handles this correctly.

## Existing Files

### Source Files to Modify

| File | Purpose | Action |
|------|---------|--------|
| `prisma/schema.prisma` (line 492-497) | `HealthScanStatus` enum definition | Add `SKIPPED` value |
| `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` | Scan status PATCH endpoint | Add SKIPPED to Zod schema, transitions, skip HealthScore upsert |
| `app/api/projects/[projectId]/health/route.ts` | Main health GET endpoint | Handle SKIPPED in `buildModuleStatus()`, include in latestScans query |
| `app/api/projects/[projectId]/health/scans/route.ts` | Scan history GET endpoint | No change needed — returns all statuses |
| `app/api/projects/[projectId]/health/trends/route.ts` | Trends GET endpoint | No change needed — already filters `status: 'COMPLETED'` |
| `lib/health/types.ts` | TypeScript type definitions | No change needed — `HealthScanStatus` is imported from Prisma |
| `components/health/health-module-card.tsx` | Module card component | Add `skipped` card state, "Skipped" badge, distinct summary |
| `components/health/health-hero.tsx` | Hero score display | No change needed — reads from HealthScore aggregate which is unchanged on SKIPPED |
| `components/health/drawer/drawer-states.tsx` | Drawer empty states | Add `skipped` state with "Nothing to evaluate" message |
| `components/health/drawer/drawer-history.tsx` | Scan history list in drawer | Add SKIPPED badge for history entries |
| `components/health/sparkline.tsx` | Sparkline chart | No change needed — data comes from trends API which excludes SKIPPED |
| `.github/workflows/health-scan.yml` | Health scan workflow | Update status update step to send SKIPPED status when result indicates it |

### Source Files — No Changes Required

| File | Reason |
|------|--------|
| `lib/health/score-calculator.ts` | Already handles null scores correctly |
| `lib/health/quality-gate.ts` | Quality Gate is passive, not affected |
| `lib/health/scan-dispatch.ts` | Dispatch logic unchanged |
| `lib/health/scan-commands.ts` | Command mapping unchanged |
| `lib/health/report-schemas.ts` | SKIPPED scans have no report body to validate |
| `lib/health/ticket-creation.ts` | SKIPPED scans create no remediation tickets |
| `lib/health/format.ts` | Formatting utilities unchanged |
| `components/health/health-dashboard.tsx` | Orchestration only — delegates to child components |
| `components/health/drawer/score-trend-chart.tsx` | Fed by trends API which excludes SKIPPED |
| `components/health/drawer/drawer-header.tsx` | Score display from HealthScore (unchanged on SKIPPED) |
| `components/health/drawer/drawer-issues.tsx` | SKIPPED scans have no issues to display |
| `.github/workflows/nightly-health.yml` | Nightly trigger unchanged — individual scan workflows handle SKIPPED |

### Existing Test Files

| File | Covers | Action |
|------|--------|--------|
| `tests/integration/health/health-score.test.ts` | GET /health endpoint | Extend — add SKIPPED scenario tests |
| `tests/unit/components/health-module-card.test.tsx` | HealthModuleCard states | Extend — add `skipped` state test |
| `tests/unit/components/health-hero.test.tsx` | HealthHero rendering | No change needed |
| `tests/e2e/health-navigation.spec.ts` | Sidebar nav to health page | No change needed |
| `tests/unit/health-review-quality.test.ts` | Review quality metrics | No change needed |

### New Test Files

| File | Justification |
|------|---------------|
| `tests/integration/health/health-scan-skipped.test.ts` | New integration tests for SKIPPED status transitions, HealthScore preservation, and scan history inclusion. Separate file because existing `health-score.test.ts` tests the GET /health endpoint, while these test the PATCH /status endpoint specifically for SKIPPED flows. Mixing concerns would be confusing. |
