# Quick Implementation: #907 Fix images modal
There are two crosses to close the image modal. Fix it.
 IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests

**Feature Branch**: `059-907-fix-images`
**Created**: 2025-10-27
**Mode**: Quick Implementation (bypassing formal specification)

## Description

#907 Fix images modal
There are two crosses to close the image modal. Fix it.
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

### Root Cause
The ImageLightbox component had two close buttons:
1. A custom close button rendered at lines 209-217 (absolute positioned in top-right)
2. The built-in close button from shadcn/ui DialogContent component (line 46-49 in dialog.tsx)

### Changes Made
**File**: `components/ticket/image-lightbox.tsx`

1. Removed the custom close button (lines 208-217):
   - Removed the redundant Button component with X icon
   - The shadcn Dialog component automatically includes a close button

2. Cleaned up unused import:
   - Removed `X` from lucide-react imports (no longer needed)

### Testing
- Type check: ✅ Passed (no errors)
- Linter: ✅ Passed (no warnings or errors)
- Visual verification: The modal now shows only one close button (from DialogContent)

### Result
The image modal now displays only one close button in the top-right corner, improving the UI consistency and removing visual clutter.
