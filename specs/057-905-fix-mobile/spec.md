# Quick Implementation: #905 Fix mobile scrolling
On mobile, scrolling is difficult on the columns because of the drag-and-drop feature. When a column is full of tickets, trying to scroll often triggers drag-and-drop instead. Please fix this with a better UX
 IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests

**Feature Branch**: `057-905-fix-mobile`
**Created**: 2025-10-26
**Mode**: Quick Implementation (bypassing formal specification)

## Description

#905 Fix mobile scrolling
On mobile, scrolling is difficult on the columns because of the drag-and-drop feature. When a column is full of tickets, trying to scroll often triggers drag-and-drop instead. Please fix this with a better UX
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

### Problem Analysis
On mobile devices, the drag-and-drop TouchSensor was configured with:
- `delay: 250ms` (long-press to activate drag)
- `tolerance: 8px` (movement allowed during delay)

The low tolerance (8px) was too sensitive, causing vertical scroll gestures to trigger drag operations instead of allowing smooth column scrolling.

### Solution
Increased TouchSensor `tolerance` from 8px to 20px while maintaining the 250ms delay:
- **Delay: 250ms** - Users must long-press for deliberate drag operations
- **Tolerance: 20px** - Allows natural vertical scroll swipes without triggering drag
- **Better UX** - Quick swipes scroll, long-press enables drag

### Changes Made

1. **components/board/board.tsx** (line 126)
   - Updated TouchSensor tolerance from 8px to 20px
   - Added comment referencing T905 (this ticket)

2. **tests/e2e/board/drag-drop.spec.ts**
   - Added T012: Test mobile scrolling does not trigger accidental drag
   - Added T013: Test mobile long-press triggers drag operation
   - Validates the tolerance threshold behavior

### Testing
- ✅ Mobile scrolling test passes (quick swipes don't trigger drag)
- ✅ Type checking passes
- ✅ Linting passes
- Note: Long-press test uses mouse events (PointerSensor) not touch events, so it validates general drag behavior but not specifically TouchSensor tolerance

### Technical Details
The @dnd-kit library's TouchSensor uses the `tolerance` parameter to define how much finger movement is allowed during the `delay` period before canceling the drag activation. By increasing this from 8px to 20px, users can initiate vertical scroll gestures without accidentally triggering drag-and-drop.
