# Quick Implementation: Sort projects by activity level

**Feature Branch**: `AIB-713-sort-projects-by`
**Created**: 2026-04-22
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Problem

On the projects page, projects are currently displayed in an arbitrary or fixed order. Users managing multiple projects have no way to quickly identify which projects are currently the most active, making it harder to prioritize their attention.

## Expected Behavior

Projects on the projects page should be automatically sorted from most active to least active, so users can immediately see which projects need their attention or are progressing the fastest.

## Definition of "Activity"

Activity should reflect recent engagement with a project. Relevant signals may include (in rough priority order):

- Recent ticket state transitions (e.g. tickets moved to BUILD, VERIFY, SHIP)
- Recently shipped tickets
- Recently updated tickets
- Last workflow execution date

The most recently active project should appear first. Projects with no recent activity should appear last.

## Acceptance Criteria

- Projects on the projects page are ordered from most active to least active by default
- The sort order updates to reflect recent changes (e.g. refreshing the page or after a ticket is moved)
- Projects with no activity are grouped at the bottom
- The ordering is consistent and predictable for the user

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
