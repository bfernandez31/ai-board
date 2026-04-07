# Quick Implementation: Add agent icon and workflow type badge to comparison cards

**Feature Branch**: `AIB-552-add-agent-icon`
**Created**: 2026-04-07
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Add agent icon and workflow type badge to comparison cards.

On the comparison screen, both the winner card and participant cards should show the same agent icon treatment used on board ticket cards and a workflow badge in the top-right corner. The winner card uses a 20px icon, participant cards use a 16px icon, the icon tooltip should show the provider name, and cards without agent data should omit the icon cleanly. Workflow badges should match board styling for QUICK and CLEAN while also rendering a neutral FULL badge for comparison history data.

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
