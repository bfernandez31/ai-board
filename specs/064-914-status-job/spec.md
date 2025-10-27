# Quick Implementation: #914 Status job verify/ship
Actuellement sur le ticket, le status du dernier job est affiché. Mais sur les stages verify et ship cela n'a pas de sens car ce ne sont pas les job de ces stages.
 IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests

**Feature Branch**: `064-914-status-job`
**Created**: 2025-10-27
**Mode**: Quick Implementation (bypassing formal specification)

## Description

#914 Status job verify/ship
Actuellement sur le ticket, le status du dernier job est affiché. Mais sur les stages verify et ship cela n'a pas de sens car ce ne sont pas les job de ces stages.
 IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

**Quick-impl is suitable for**:
- Bug fixes (typos, minor logic corrections)
- UI tweaks (colors, spacing, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**For complex features**, use the full workflow: INBOX → SPECIFY → PLAN → BUILD

## Implementation

### Problem

Workflow job statuses were being displayed on tickets in VERIFY and SHIP stages, which doesn't make sense because these stages don't have associated workflow jobs. The job status shown was from previous stages (BUILD or earlier), making it misleading for users.

### Solution

Updated the `getWorkflowJob()` function in `lib/utils/job-filtering.ts` to return `null` for VERIFY and SHIP stages (in addition to the existing INBOX filter). This ensures that only tickets in SPECIFY, PLAN, and BUILD stages show workflow job statuses.

### Changes Made

1. **lib/utils/job-filtering.ts:25-28**
   - Updated stage filter from `currentStage === 'INBOX'` to include VERIFY and SHIP
   - Added condition: `currentStage === 'INBOX' || currentStage === 'VERIFY' || currentStage === 'SHIP'`
   - Updated JSDoc comments to reflect the new behavior

2. **tests/unit/job-filtering.test.ts:34-76**
   - Added test case: "returns null for VERIFY stage (no workflow jobs in VERIFY)"
   - Added test case: "returns null for SHIP stage (no workflow jobs in SHIP)"
   - Both tests verify that workflow jobs are not displayed in these stages

### Testing

- ✅ All 15 unit tests pass (including 2 new tests)
- ✅ Type check passes (`bun run type-check`)
- ✅ Linter passes (`bun run lint`)
- ✅ TDD approach: Tests written first (red), then implementation (green)

### Files Modified

- `lib/utils/job-filtering.ts` - Core filtering logic
- `tests/unit/job-filtering.test.ts` - Test coverage for VERIFY and SHIP stages
- `specs/064-914-status-job/spec.md` - Implementation documentation

### Next Steps

- Create pull request to merge into main branch
- Manual testing: Verify that tickets in VERIFY and SHIP stages no longer show workflow job status indicators on the board UI
