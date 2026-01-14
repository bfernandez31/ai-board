# Quick Implementation: Fix position of the notification bell and menu on analytics view

**Feature Branch**: `AIB-165-fix-position-of`
**Created**: 2026-01-14
**Mode**: Quick Implementation (bypassing formal specification)

## Description

The notification bell and user menu should be positioned on the right side of the header on every page. However, on the analytics page (and other non-board project pages), they were incorrectly positioned due to a regression from adding the search input.

**Root Cause**: The header spacer logic was `projectInfo ? "hidden" : "flex-1"`, which hid the spacer whenever project info existed. But the search input (which provides its own `flex-1` centering) only renders on the board page. On analytics and other project pages, there was no `flex-1` element to push the right-side buttons to the right.

**Fix**: Changed spacer logic to `!projectInfo || !isBoardPage ? "flex-1" : "hidden"`, which shows the spacer when:
- No project info exists (landing page, etc.)
- OR when not on the board page (analytics, settings, etc.)

The spacer is only hidden when on the board page, where the search input provides the flex spacing.

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

**Quick-impl is suitable for**:
- Bug fixes (typos, minor logic corrections)
- UI tweaks (colors, spacing, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**For complex features**, use the full workflow: INBOX → SPECIFY → PLAN → BUILD

## Implementation

Implementation will be done directly by Claude Code based on the description above.
