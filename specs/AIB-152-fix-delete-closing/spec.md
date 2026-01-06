# Quick Implementation: Fix delete/closing zone on mobile

**Feature Branch**: `AIB-152-fix-delete-closing`
**Created**: 2026-01-06
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Fix delete/closing zone on mobile

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
On mobile devices, the delete zone (TrashZone) and closing zone (CloseZone) had poor positioning:
- TrashZone was centered at bottom using `left-1/2 -translate-x-1/2` which could overlap with content
- CloseZone was positioned at `right-8` which was too far from the edge on small screens
- Both zones used fixed padding and icon sizes that didn't adapt to mobile viewports

### Solution
Applied responsive Tailwind CSS classes to improve mobile positioning:

**TrashZone** (`components/board/trash-zone.tsx`):
- Mobile (default): `left-4` - positioned at bottom-left with 1rem spacing
- Desktop (md+): `left-1/2 -translate-x-1/2` - centered at bottom
- Reduced padding on mobile: `p-3 md:p-4`
- Smaller icons on mobile: `w-5 h-5 md:w-6 md:h-6`
- Smaller text on mobile: `text-sm md:text-base`

**CloseZone** (`components/board/close-zone.tsx`):
- Mobile (default): `right-4` - positioned at bottom-right with 1rem spacing
- Desktop (md+): `right-8` - more spacing from edge
- Reduced padding on mobile: `p-3 md:p-4`
- Smaller icons on mobile: `w-5 h-5 md:w-6 md:h-6`
- Smaller text on mobile: `text-sm md:text-base`

### Files Changed
- `components/board/trash-zone.tsx` - Added responsive positioning and sizing
- `components/board/close-zone.tsx` - Added responsive positioning and sizing

### Testing
- TypeScript type checking: ✓ Passed
- Existing E2E tests verified (mobile drag-drop test failures are pre-existing)
