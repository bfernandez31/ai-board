# Quick Implementation: Visual lock transition on cleanup

**Feature Branch**: `AIB-72-visual-lock-transition`
**Created**: 2025-11-23
**Mode**: Quick Implementation (bypassing formal specification)

## Description

When there is a cleanup, we can't have a transition, and that's working as intended.
But when we try to drag and drop, we can, or we should have the same behavior as when a transition is not permitted (job running on a ticket for example).

**Goal**: Apply the same visual lock behavior during cleanup that already exists when a job is running on a ticket. Users should see visual feedback that drag-and-drop transitions are disabled during cleanup.

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
