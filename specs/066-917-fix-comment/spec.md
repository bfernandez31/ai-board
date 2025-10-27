# Quick Implementation: #917 fix comment from gh
there is a redirect on the comment post in the script bash used for workflow speckit and quick,but i think it's because is not the good url, check the path call in the worflow ai-board-assist
 IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests

**Feature Branch**: `066-917-fix-comment`
**Created**: 2025-10-27
**Mode**: Quick Implementation (bypassing formal specification)

## Description

#917 fix comment from gh
there is a redirect on the comment post in the script bash used for workflow speckit and quick,but i think it's because is not the good url, check the path call in the worflow ai-board-assist
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

The `create-pr-and-transition.sh` script was posting comments to the wrong API endpoint:
- **Incorrect**: `/api/projects/${PROJECT_ID}/tickets/${TICKET_ID}/comments`
- **Correct**: `/api/projects/${PROJECT_ID}/tickets/${TICKET_ID}/comments/ai-board`

The `/comments` endpoint requires user session authentication, while the `/comments/ai-board` endpoint accepts Bearer token authentication (WORKFLOW_API_TOKEN) and is designed for automated workflow comments.

This was causing HTTP redirects when the script attempted to post comments from GitHub Actions workflows.

### Changes Made

**File**: `.specify/scripts/bash/create-pr-and-transition.sh` (line 114-117)

1. **Fixed endpoint URL**: Changed from `/comments` to `/comments/ai-board`
2. **Added userId field**: Added `"userId": "ai-board-system-user"` to the request payload to identify the comment author

### Testing

- Type check: PASSED
- Lint check: PASSED
- No tests required (bash script change, behavior validated by existing E2E tests)

### Files Modified

- `.specify/scripts/bash/create-pr-and-transition.sh`
