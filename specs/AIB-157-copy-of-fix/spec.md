# Quick Implementation: Copy of Fix display closed ticket modal

**Feature Branch**: `AIB-157-copy-of-fix`
**Created**: 2026-01-07
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Copy of Fix display closed ticket modal

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

When users search for a closed ticket and click on it, the modal does not display because:
1. Closed tickets are not in any stage column on the kanban board
2. The board component looks for tickets only in `allTickets` (which comes from the kanban stages)
3. When the ticket is not found, the modal never opens

### Solution

**Frontend Changes (components/board/board.tsx:210-285)**:
- Enhanced the URL param parsing effect to fetch tickets from the API when not found in kanban
- When `ticket` is not in `allTickets`, make a GET request to `/api/projects/{projectId}/tickets/{ticketKey}`
- Add the fetched ticket to the TanStack Query cache so the modal can display it
- Handle error cases with appropriate toast messages

**API Support**:
- Existing GET endpoint `/api/projects/[projectId]/tickets/[id]/route.ts` already supports fetching by ticket key (line 74-91)
- No backend changes required

**Tests Added**:
- Added test case in `tests/unit/components/ticket-search.test.tsx` to verify clicking a closed ticket navigates to the correct modal URL
- All existing tests pass (176 tests across 14 test files)
