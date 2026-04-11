# Quick Implementation: Redesign Projects page header banner with plan-aware styling

**Feature Branch**: `AIB-609-redesign-projects-page`
**Created**: 2026-04-11
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Redesign Projects page header banner with plan-aware styling.

Replace the current `UsageBanner` with a **Plan Banner Card** that:
- Displays as a styled banner below the "Projects" title with a gradient background colored by plan
- Shows a plan badge pill (TEAM, PRO, FREE) on the left
- Shows usage counters next to the badge (ratios for Free, raw counts for paid)
- Shows a contextual action link on the right (Upgrade for Free, Manage plan for paid)
- Renders a skeleton placeholder of identical height while loading

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
