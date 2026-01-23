# Quick Implementation: fix call to activity

**Feature Branch**: `AIB-182-fix-call-to`
**Created**: 2026-01-23
**Mode**: Quick Implementation (bypassing formal specification)

## Description

We have a 400 error on the GET for the feed activity:
- Request URL: https://ai-board-three.vercel.app/api/projects/3/activity?limit=50
- Request Method: GET
- Response: {"error":"Invalid query parameters"}

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
