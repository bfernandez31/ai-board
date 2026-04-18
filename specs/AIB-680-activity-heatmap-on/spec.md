# Quick Implementation: Activity Heatmap on Projects Page opus 4,6

**Feature Branch**: `AIB-680-activity-heatmap-on`
**Created**: 2026-04-18
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Add a GitHub-style contribution heatmap on the projects page, below the project cards grid. The heatmap displays AI activity across all user projects over the past year.

### Heatmap Grid
- 7 rows (days of week), column count matches the selected period
- Month labels on top, day-of-week labels on left
- Cell intensity based on **job count** for that day
- Color scale: violet gradient using the project's aurora theme 
- The grid adapts to the selected period's boundaries. When a year doesn't start on Sunday (e.g., 2024 starts on a Monday), the cells before the first day of the year are not rendered — the grid has a "chipped" top-left corner, matching GitHub's behavior. Same applies to the bottom-right if the year doesn't end on Saturday.
- Intensity legend at bottom right (Less □□■■■ More)
- If the whole period has zero activity: show a centered message "No activity to show yet — your AI work will appear here" in place of the grid (legend + filters stay visible)

### Header
- Counter: "X jobs · Y tickets shipped in the last year"
- **A ticket counts as shipped** on the day its `ship` workflow job completed successfully. A stage change to SHIP without a completed ship job does NOT count.
- Year selector dropdown, built dynamically:
  - Default option: "Last 12 months" (rolling)
  - Additional options: each calendar year from the user's account creation year up to the current year
  - If the user created their account this year, only "Last 12 months" is shown (no dropdown, or a disabled one)

### Tooltip on Hover
- Tickets shipped that day
- Job count + total cost; if a job has no recorded cost, show the count and omit the cost line (never "$NaN" or "$0" for missing data)
- Formatted date
- On mobile: tap to show, tap outside to dismiss

### Filters
- **Agent filter** built dynamically from the data, following the same pattern as the analytics dashboard:
  - Options are derived from the distinct agents actually present in the user's jobs (combining explicit ticket.agent values and the effective agent inherited from project.defaultAgent)
  - Always include an "All" option, selected by default
  - If only 0 or 1 distinct agent is present across the user's data, hide the filter entirely (nothing to filter)
- When filtering by a specific agent, the filter honors **effective agent resolution**: a ticket with no explicit agent on a project whose default is that agent must be included
- The heatmap always shows a full period (grid boundaries unchanged by the filter)
- Active filters are reflected in the URL (query params): copying the URL and opening it elsewhere must reproduce the exact same view

### Layout & Loading
- Placed below the project cards on the `/projects` page, full-width
- The current scroll constraint on the project grid may need adjustment so the page scrolls naturally to reveal the heatmap
- **No loading flash on first render**: the heatmap is visible immediately (use server-rendered initial data). Background refetches update silently without blanking the UI.

### Mobile
- Horizontal scroll for the grid — never wrap, never shrink cells below a tappable size
- Day-of-week labels stay pinned on the left during horizontal scroll

## Acceptance Criteria
- Heatmap renders from real job + ticket data; violet scale readable on dark theme
- Year selector shows only years from the user's account creation to today, defaulting to "Last 12 months"
- Agent filter is built from actual data and hidden when only 0-1 agents exist; when shown, it honors effective agent resolution
- "Shipped" counter reflects `ship` job completion, not stage changes
- Tooltip handles missing cost gracefully
- Filters are URL-shareable and survive refresh
- First render shows data immediately (no spinner flash)
- Mobile: horizontal scroll with sticky day-of-week labels
- Empty state message appears when the period has no activity
- Grid boundaries match the selected period exactly (GitHub-style chipped corners for partial first/last weeks)
- No new database models — uses existing job and ticket data

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
