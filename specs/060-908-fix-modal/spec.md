# Quick Implementation: #908 Fix modal image
Y a un problème de chevauchement avec la croix et la loupe sur la version mobile.
 IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests

**Feature Branch**: `060-908-fix-modal`
**Created**: 2025-10-27
**Mode**: Quick Implementation (bypassing formal specification)

## Description

#908 Fix modal image
Y a un problème de chevauchement avec la croix et la loupe sur la version mobile.
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
The ImageLightbox component header had a layout issue on mobile where the zoom controls (Maximize, 100%, ZoomIn buttons) overlapped with the Dialog's built-in close button (X).

The close button is absolutely positioned at `right-4 top-4` (1rem from right edge) in the DialogContent component (`components/ui/dialog.tsx:46`). The header section had only `p-4` padding, which wasn't sufficient to prevent the zoom controls from overlapping with the close button on small screens.

### Changes Made
**File**: `components/ticket/image-lightbox.tsx:112`

Changed the header div padding from `p-4` to `p-4 pr-12`:
- Added `pr-12` (padding-right: 3rem) to create adequate space for the close button
- The 3rem right padding provides enough clearance for the close button (positioned 1rem from right)
- This prevents overlap between zoom controls and close button on mobile devices

### Testing
- Type check: ✅ Passed (no errors)
- Linter: ✅ Passed (no warnings or errors)

### Result
The image modal header now has sufficient spacing on the right side to prevent the zoom controls from overlapping with the close button on mobile devices. The fix maintains the existing layout on larger screens while solving the mobile overlap issue.
