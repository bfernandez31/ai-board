# Plan: Remove Clean Workflow - Merge Cleanup into Health Scan Compliance

**Feature**: AIB-409 | **Date**: 2026-03-31

## Strategy

This ticket removes the clean workflow and merges its useful analysis (dead code + temp file detection) into the existing COMPLIANCE health scan. The work is primarily deletions and simplifications — very little new code is written.

**Key insight**: The COMPLIANCE scan is an AI agent scan driven by a command prompt. Adding dead code and temp file detection only requires updating the prompt instructions and defining new issue categories. The existing `groupComplianceIssues` function in `ticket-creation.ts` already groups by arbitrary `category` values, so new categories ("Dead Code", "Temp Files") flow through to remediation ticket creation automatically.

## Architecture Impact

- **Before**: 6 health modules (4 active scans + Quality Gate + Last Clean), separate cleanup workflow
- **After**: 5 health modules (4 active scans + Quality Gate), COMPLIANCE scan covers dead code + temp files
- **Score calculation**: Unchanged — Last Clean was never in the score formula

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking historical CLEAN tickets | Keep `CLEAN` in enum, preserve badge rendering |
| Active cleanup job during migration | Migration clears `activeCleanupJobId` before dropping column |
| Dead code false positives | 30-day age gate filters WIP code |
| Missing temp file patterns | Patterns are exhaustive based on existing cleanup command analysis |

## Phases

### Phase 1: Enrich COMPLIANCE Scan (Low risk, instruction-only)
Update `.claude-plugin/commands/ai-board.health-compliance.md` with new detection phases. No code changes — only prompt engineering.

### Phase 2: Remove Last Clean Module (Medium risk, type changes cascade)
Remove `LAST_CLEAN` from types → components → API. Work top-down from types to avoid compilation errors during development. Delete the Last Clean drawer component and API route.

### Phase 3: Remove Clean Infrastructure (Medium risk, many file deletions)
Delete 7 files, modify 6+ files. Remove transition locking, cleanup banner, API route, workflow, command. Keep CLEAN enum and historical rendering.

### Phase 4: Database Migration (Low risk, column drops only)
Remove 3 columns from 2 tables. Simple DROP COLUMN operations with safety UPDATEs.

### Phase 5: Test Cleanup (Low risk)
Remove dead tests, add compliance category tests, verify health endpoint returns 5 modules.

## Testing Strategy

- **Unit tests**: Extend `ticket-creation.test.ts` with "Dead Code" and "Temp Files" categories
- **Integration tests**: Verify health endpoint returns 5 modules without `lastClean`
- **Manual verification**: Historical CLEAN tickets display correctly
- **Type safety**: `bun run type-check` catches any missed references to removed types
