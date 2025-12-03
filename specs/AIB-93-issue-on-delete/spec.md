# Quick Implementation: issue on delete ticker

**Feature Branch**: `AIB-93-issue-on-delete`
**Created**: 2025-12-03
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Bug fix for ticket deletion issue where deleting a ticket via drag-and-drop works the first time, but attempting to delete a second ticket results in an error.

## Root Cause

The bug was in the `useDeleteTicket` mutation hook (`lib/hooks/mutations/useDeleteTicket.ts`). The `onMutate` callback was not properly handling the case where `queryClient.getQueryData` returns `undefined` after the first deletion completes and the cache is invalidated.

Specifically:
1. First deletion succeeds and `onSettled` invalidates the query
2. Cache refetch occurs, but during the second deletion, the mutation context wasn't properly initialized
3. The `previousTickets` snapshot could be `undefined`, causing issues with the optimistic update logic

## Implementation

### Changes Made

**File: `lib/hooks/mutations/useDeleteTicket.ts`**

1. **Fixed mutation context type**: Changed from `{ previousTickets?: Ticket[] | undefined }` to `{ previousTickets: Ticket[] }` to ensure context is always valid

2. **Fixed `onMutate` callback**:
   - Now properly handles `undefined` cache data by returning an empty array
   - Always returns a valid context with `previousTickets ?? []`
   - Added explicit null check in the updater function

3. **Fixed `onError` callback**:
   - Simplified condition to just check if context exists
   - Context now always contains a valid array

### Test Coverage

Added new test case in `tests/api/tickets-delete.spec.ts`:
- `DELETE multiple tickets consecutively (200 OK)`: Tests that consecutive deletions work without errors

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

**Quick-impl is suitable for**:
- Bug fixes (typos, minor logic corrections) ✓
- UI tweaks (colors, spacing, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**For complex features**, use the full workflow: INBOX → SPECIFY → PLAN → BUILD

## Validation

- ✅ All existing tests pass (14 tests in tickets-delete.spec.ts)
- ✅ New test case passes
- ✅ Type checking passes
- ✅ Linting passes
- ✅ No breaking changes
