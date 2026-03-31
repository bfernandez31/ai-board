# Research: Remove Clean Workflow - Merge Cleanup into Health Scan Compliance

**Feature**: AIB-409 | **Date**: 2026-03-31

## R1: Compliance Scan Extensibility — Can the Existing System Handle New Categories?

**Decision**: No code changes needed to `lib/health/ticket-creation.ts`. The existing `groupComplianceIssues` function groups by `category` field and generates one remediation ticket per unique category.

**Rationale**: Reading `ticket-creation.ts:95-109`, `groupComplianceIssues` uses `groupBy(report.issues, (i) => i.category || 'General')` and creates tickets titled `[Compliance] Fix N violations - {category}`. Adding issues with `category: "Dead Code"` or `category: "Temp Files"` will automatically produce correctly grouped remediation tickets without any code changes.

**Alternatives considered**: None — the existing system is already designed for arbitrary categories.

## R2: Dead Code Detection Scope — What the Clean Workflow Currently Does

**Decision**: The clean workflow's dead code detection (Phase 2 of `ai-board.cleanup.md`) performs:
1. Unused exports (functions, types, components not imported elsewhere)
2. Orphaned files (not imported by any other file)
3. Deprecated implementations superseded by newer code

These three checks will be added as instructions to the COMPLIANCE scan command (`ai-board.health-compliance.md`), with the 30-day age gate applied via `git log` timestamp checking.

**Rationale**: The COMPLIANCE scan is already an AI agent scan that reads the codebase and reports issues. Adding dead code and temp file detection is purely an instruction change — no infrastructure changes needed.

## R3: Last Clean Module in Score Calculation

**Decision**: The `LAST_CLEAN` module does NOT contribute to the global health score. The `score-calculator.ts` uses 5 sub-scores: security, compliance, tests, specSync, and qualityGate. Removing Last Clean from the UI does not affect score calculation.

**Rationale**: Reading `lib/health/score-calculator.ts`, the global score averages only the 5 sub-scores. `LAST_CLEAN` is a passive module with no score — it only displays the last clean date and staleness status. The `ALL_MODULE_TYPES` array has 6 entries but the score calculator only uses 5.

**Alternatives considered**: None — no calculation change needed.

## R4: Clean Workflow Infrastructure Inventory

**Decision**: Full inventory of clean-specific code to remove:

**Files to delete (7)**:
1. `.github/workflows/cleanup.yml` — GitHub Actions workflow
2. `.claude-plugin/commands/ai-board.cleanup.md` — Claude cleanup command
3. `app/api/projects/[projectId]/clean/route.ts` — API route to trigger cleanup
4. `components/cleanup/CleanupInProgressBanner.tsx` — Banner shown during active cleanup
5. `components/cleanup/CleanupConfirmDialog.tsx` — Confirmation dialog
6. `lib/transition-lock.ts` — Project locking functions (`isProjectLocked`, `clearCleanupLock`, `getCleanupLockDetails`)
7. `lib/db/cleanup-analysis.ts` — Cleanup analysis database helpers

**Files to delete (Last Clean module, 2)**:
1. `components/health/drawer/last-clean-drawer.tsx` — Detail drawer
2. `app/api/projects/[projectId]/health/last-clean/route.ts` — Last clean API

**Files to modify (10+)**:
- Schema, types, components, API routes (see spec.md Phase 2 & 3 tables)

**Rationale**: Searched for `activeCleanup`, `CleanupInProgress`, `CleanupConfirm`, `transition-lock`, `cleanup-analysis`, `LAST_CLEAN`, `LastClean`, and `cleanup.yml` across the codebase.

## R5: Transition Locking — Is It Used for Anything Besides Clean?

**Decision**: The `lib/transition-lock.ts` file is exclusively for cleanup locking. It can be deleted entirely.

**Rationale**: The file exports 3 functions (`isProjectLocked`, `clearCleanupLock`, `getCleanupLockDetails`), all of which operate on the `activeCleanupJobId` field of the `Project` model. No other locking mechanism exists in the file, and the `activeCleanupJobId` field is only used by cleanup. The transition route and close route check `isProjectLocked()` to prevent operations during active cleanup — these checks are removed along with the field.

## R6: CLEAN WorkflowType Enum — Keep vs Remove

**Decision**: Keep `CLEAN` in the Prisma `WorkflowType` enum. Remove only the ability to create new CLEAN tickets.

**Rationale**: Historical tickets with `workflowType: CLEAN` exist in the database. Removing the enum value would require a data migration to update those tickets to a different type. The ticket card already has rendering logic for CLEAN badges that must remain. The cost of keeping a single unused enum value is negligible compared to the risk of breaking historical data.
