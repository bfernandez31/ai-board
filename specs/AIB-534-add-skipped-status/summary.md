# Implementation Summary: Add SKIPPED Status for Health Scans

**Branch**: `AIB-534-add-skipped-status` | **Date**: 2026-04-04
**Spec**: [spec.md](spec.md)

## Changes Summary

Added SKIPPED as a terminal status in the health scan lifecycle. Scans that find nothing to evaluate (e.g., REVIEW_QUALITY with no PRs, SECURITY with no changed files) now complete with SKIPPED status instead of a misleading score-100 COMPLETED. HealthScore aggregates are preserved on SKIPPED. Dashboard shows distinct "Skipped" badges. Trend charts and global score exclude SKIPPED. COMPLIANCE and TESTS scans are never SKIPPED.

## Key Decisions

- SKIPPED is detected in the workflow's "Merge Scan Outputs" step by checking the result JSON for `status: "SKIPPED"` or `skipped: true`, with a guard excluding COMPLIANCE and TESTS scan types.
- The existing HealthScore upsert guard (`status === 'COMPLETED'`) naturally excludes SKIPPED — no additional skip logic needed in the transaction.
- ScoreBadge renders both the previous numeric score and a "Skipped" badge side-by-side for skipped modules that have prior scores.

## Files Modified

- `prisma/schema.prisma` — Added SKIPPED to HealthScanStatus enum
- `prisma/migrations/20260404*` — Migration SQL
- `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` — Zod schema, transitions, validation, completedAt
- `app/api/projects/[projectId]/health/route.ts` — latestScans query, buildModuleStatus()
- `components/health/health-module-card.tsx` — CardState, getCardState, ScoreBadge, BUTTON_LABELS
- `components/health/drawer/drawer-states.tsx` — DrawerState, getDrawerState, skipped case
- `components/health/drawer/drawer-history.tsx` — SKIPPED badge in HistoryEntry
- `.github/workflows/health-scan.yml` — SKIPPED detection, status update step, scan type guard
- `tests/integration/health/health-scan-skipped.test.ts` — New: 6 SKIPPED transition tests
- `tests/integration/health/health-score.test.ts` — Extended: 2 SKIPPED GET tests
- `tests/unit/components/health-module-card.test.tsx` — Extended: 2 skipped card state tests

## Manual Requirements

None
