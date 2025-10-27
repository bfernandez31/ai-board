# Quick Implementation: #909 New mobile scroll
On mobile, we can't scroll within a column if it contains tickets, because the drag-and-drop feature is active on the tickets.
To solve this, if a column has a scrollable area, we should display a small floating button with an arrow that allows scrolling up or down.
This button should appear at the top of the column if it's possible to scroll up, and at the bottom if it's possible to scroll down.
 IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests

**Feature Branch**: `061-909-new-mobile`
**Created**: 2025-10-27
**Mode**: Quick Implementation (bypassing formal specification)

## Description

#909 New mobile scroll
On mobile, we can't scroll within a column if it contains tickets, because the drag-and-drop feature is active on the tickets.
To solve this, if a column has a scrollable area, we should display a small floating button with an arrow that allows scrolling up or down.
This button should appear at the top of the column if it's possible to scroll up, and at the bottom if it's possible to scroll down.
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

### Summary

Added mobile scroll buttons to board columns to enable scrolling on touch devices where drag-and-drop interferes with native scrolling.

### Changes Made

1. **Created `mobile-scroll-button.tsx` component**:
   - Floating button with up/down arrow icons
   - Only visible on mobile devices (`md:hidden` class)
   - Positioned at top/bottom of column based on scroll state
   - Smooth scroll animation on click

2. **Enhanced `scroll-area.tsx` component**:
   - Added `viewportRef` prop to expose viewport element
   - Allows parent components to access scroll position

3. **Updated `stage-column.tsx` component**:
   - Added scroll position detection logic
   - Tracks `canScrollUp` and `canScrollDown` states
   - Integrated mobile scroll buttons
   - 200px scroll increment per button click

### Technical Details

**Scroll Detection**:
- Uses `scrollTop`, `scrollHeight`, and `clientHeight` to determine scroll position
- 10px threshold to account for rounding errors
- Updates on scroll events and when ticket list changes

**Button Visibility**:
- Up button: visible when `scrollTop > 10px`
- Down button: visible when `scrollTop + clientHeight < scrollHeight - 10px`
- Hidden on desktop (≥768px) via `md:hidden` Tailwind class

**User Experience**:
- Smooth scroll behavior (`behavior: 'smooth'`)
- Visual feedback: hover states and active scale animation
- No interference with drag-and-drop functionality

### Files Modified

- `components/board/mobile-scroll-button.tsx` (new)
- `components/ui/scroll-area.tsx` (enhanced)
- `components/board/stage-column.tsx` (enhanced)

### Testing

- ✓ Type check passed (`npm run type-check`)
- ✓ Linter passed (`npm run lint`)
- ⚠️ Manual testing recommended on mobile device or mobile emulation
