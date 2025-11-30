# Cleanup Tasks

**Branch**: `AIB-91-cleanup`
**Created**: 2025-11-30

## Discovery
- [x] T001: Merge point received from workflow: `2c38bf0a6aa9cee55f0ed23c5b0643fb0e8b089b`
- [x] T002: Analyzed diff since last cleanup (124 files changed)

## Analysis
- [x] T003: Dead code detection - Found 1 issue
- [x] T004: Project impact assessment - No issues found
- [x] T005: Spec synchronization check - No issues found

## Issues Found

### Issue 1: Dead code - TicketsByStage interface in lib/types.ts
- **Location**: `lib/types.ts:17-23`
- **Problem**: Hardcoded interface missing SPECIFY stage, never imported anywhere
- **Correct version**: `app/lib/types/query-types.ts` has `Record<Stage, TicketWithVersion[]>`
- **Action**: Remove unused interface

### Issue 2: Incomplete test - Missing SPECIFY stage validation
- **Location**: `tests/api/tickets-get.spec.ts`
- **Problem**: Tests only validate 5 stages, missing SPECIFY
- **Action**: Add SPECIFY stage validation

## Fixes
- [x] T006: Remove unused TicketsByStage interface from lib/types.ts
- [x] T007: Add SPECIFY stage validation to tests/api/tickets-get.spec.ts

## Validation
- [x] T099: Run impacted tests (tickets-get.spec.ts) - PASSED
- [x] T100: Type check - PASSED
- [x] T101: Final review - COMPLETE
