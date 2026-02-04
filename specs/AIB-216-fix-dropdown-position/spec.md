# Quick Implementation: Fix dropdown position on command and ticket

**Feature Branch**: `AIB-216-fix-dropdown-position`
**Created**: 2026-02-03
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Fix dropdown position on command and ticket

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

**Quick-impl is suitable for**:
- Bug fixes (typos, minor logic corrections)
- UI tweaks (colors, spacing, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**For complex features**, use the full workflow: INBOX → SPECIFY → PLAN → BUILD

## Implementation

### Phase 1: React Portal for Overflow Clipping (Completed)

The command and ticket autocomplete dropdowns were being clipped by modal overflow constraints. Changed from relative to fixed viewport positioning using `createPortal` to render dropdowns at document body level.

**Changes**:
- Added `createPortal` import from `react-dom`
- Implemented `calculateFixedPosition` helper for viewport-based coordinates
- Wrapped dropdown rendering in portal targeting `document.body`
- Position dropdown using `position: fixed` with calculated viewport coordinates

### Phase 2: Scroll Event Handler (Completed)

Fixed issue where dropdown remained fixed while textarea moved on scroll.

**Problem**: The dropdown position was only calculated when the autocomplete opened. When the user scrolled the page or any scrollable container, the dropdown stayed in its original position while the textarea moved.

**Solution**: Added scroll event listener to update dropdown position dynamically:
- Listens to scroll events on window with capture phase (`true` flag) to catch all scroll events including bubbling from nested containers
- Updates dropdown position on every scroll event
- Properly cleans up event listener when autocomplete closes or component unmounts
