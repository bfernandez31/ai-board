# Quick Implementation: #911 Header ellipsis
Sur mobile le nom du projet dans le header a une ellipsis alors qu'il y a de la place. Il devrais prendre plus de place
 IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests

**Feature Branch**: `062-911-header-ellipsis`
**Created**: 2025-10-27
**Mode**: Quick Implementation (bypassing formal specification)

## Description

#911 Header ellipsis
Sur mobile le nom du projet dans le header a une ellipsis alors qu'il y a de la place. Il devrais prendre plus de place
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
On mobile, the project name in the header was showing an ellipsis even when there was available space. The issue was caused by:
1. A spacer `<div className="flex-1" />` that was taking up space even on mobile
2. The mobile project name container not having `flex-1` to claim available space

### Solution
Made two changes to `components/layout/header.tsx`:

1. **Mobile project container** (line 120): Added `flex-1 overflow-hidden` to allow the container to expand and claim available space
   - Added `shrink-0` to the separator `|` to prevent it from shrinking
   - Added `flex-1` to the project name span to maximize space before truncating

2. **Spacer div** (line 130): Made it conditional - hidden on mobile when project info exists
   - Changed from `className="flex-1"` to `className={projectInfo ? "hidden md:flex flex-1" : "flex-1"}`
   - This prevents the spacer from stealing space on mobile when there's project info

### Result
The project name now takes all available space between the logo and the right-side buttons on mobile before showing ellipsis. The `truncate` class still applies for very long project names to prevent overflow.

### Files Modified
- `components/layout/header.tsx` (lines 120-130)

### Tests
- All existing header E2E tests pass (4/4)
- Type checking passes
- Linting passes with no warnings
