# Feature Specification: Activity Heatmap on Projects Page

**Feature Branch**: `AIB-692-activity-heatmap-on`
**Created**: 2026-04-19
**Status**: Draft
**Input**: User description: "Add a GitHub-style contribution heatmap on the projects page, below the project cards grid. The heatmap displays AI activity across all user projects over the past year."

## Auto-Resolved Decisions

### Decision 1: Heatmap Intensity Levels

- **Decision**: Use 5 discrete intensity levels (empty, low, medium, high, max) for the violet color scale, matching GitHub's contribution graph pattern
- **Policy Applied**: AUTO (resolved CONSERVATIVE via low-confidence fallback)
- **Confidence**: Low (score: 1) — neutral UI feature with no conflicting signals
- **Fallback Triggered?**: Yes — AUTO promoted to CONSERVATIVE because absScore (1) yielded confidence 0.3, below the 0.5 threshold
- **Trade-offs**:
  1. 5 levels provide clear visual differentiation without overwhelming the user; fewer levels would lose nuance, more would be hard to distinguish in a violet gradient
  2. Quantile-based thresholds (computed from user's actual data distribution) avoid the problem of fixed thresholds rendering most cells the same color for low-activity users
- **Reviewer Notes**: Verify that the 5-level violet scale meets WCAG AA contrast requirements on the dark theme background; the empty-cell color must be visually distinct from the lowest-activity level

### Decision 2: Empty Cell Tooltip Behavior

- **Decision**: Hovering over a cell with zero activity shows only the formatted date and "No activity" text; no cost or job count lines are displayed
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — directly analogous to GitHub's empty-cell tooltip behavior, widely understood UX convention
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent tooltip behavior across all cells (always shows on hover) avoids confusing users who might think empty cells are non-interactive
  2. Minimal tooltip content for empty cells avoids clutter
- **Reviewer Notes**: Confirm that mobile tap behavior on empty cells is consistent — tapping an empty cell should show the same minimal tooltip

### Decision 3: Background Refresh Interval

- **Decision**: Heatmap data refreshes silently every 60 seconds (not the 15-second interval used for real-time data like analytics). The initial render uses server-provided data to eliminate loading flash.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) — heatmap data is daily-granular, making frequent polling wasteful; 60 seconds balances freshness with efficiency
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Longer polling interval reduces server load for data that only changes meaningfully once per day
  2. A user who completes a job and immediately checks the heatmap may wait up to 60 seconds to see the update; this is acceptable given the visualization's purpose (historical overview, not real-time monitoring)
- **Reviewer Notes**: Ensure the staleTime is set appropriately so cached data is used during the interval window without triggering unnecessary re-renders

### Decision 4: Intensity Threshold Calculation Method

- **Decision**: Use quantile-based thresholds computed from the user's actual activity data for the selected period, rather than fixed absolute thresholds (e.g., 1-2, 3-5, 6-10, 11+)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) — quantile-based thresholds adapt to each user's activity level, preventing the heatmap from appearing uniformly light (low-activity users) or uniformly dark (high-activity users)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Quantile-based thresholds require computing the distribution of daily job counts for the period, adding minor complexity
  2. A user's perception of "high activity" scales with their own usage rather than an arbitrary absolute number, which is more meaningful
- **Reviewer Notes**: When all non-zero days have the same count, all active cells should render at the same mid-intensity level rather than being spread across the scale

### Decision 5: URL Query Parameter Naming

- **Decision**: Use `year` for the period selector (values: `rolling` for "Last 12 months", or a 4-digit year like `2025`) and `agent` for the agent filter (values: `all` or an agent identifier). These appear as query parameters on the `/projects` page URL.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — follows existing conventions in the analytics dashboard where filters are reflected in URL search params
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Short, readable parameter names make URLs easy to share and understand
  2. Adding query params to `/projects` means the projects page now has stateful URL behavior; this is intentional per the ticket requirement
- **Reviewer Notes**: Verify that existing `/projects` page functionality (if any query params exist) is not disrupted by the new parameters

## User Scenarios & Testing

### User Story 1 - View Activity Heatmap (Priority: P1)

A user navigates to the projects page and sees a full-width activity heatmap below their project cards. The heatmap displays a grid of colored cells representing daily AI job activity across all their projects over the last 12 months. A header above the grid shows summary counters: total jobs completed and total tickets shipped. The grid uses a violet color gradient where darker cells indicate more activity. Month labels appear along the top and day-of-week labels on the left side. An intensity legend at the bottom right helps the user interpret the color scale.

**Why this priority**: The heatmap is the core deliverable — without it, no other feature (filters, tooltips, year selection) has value. This story delivers the fundamental visualization that lets users understand their AI activity patterns at a glance.

**Independent Test**: Can be fully tested by verifying that the heatmap renders with correct data from existing jobs, displays the proper grid layout with month/day labels, and shows accurate summary counters. Delivers immediate value as a visual activity overview.

**Acceptance Scenarios**:

1. **Given** a user with jobs completed across multiple days in the last 12 months, **When** they navigate to `/projects`, **Then** they see a heatmap grid below the project cards with cells colored by daily job count using a violet gradient, month labels along the top, day-of-week labels on the left, and an intensity legend at the bottom right showing "Less" to "More"
2. **Given** a user with no activity in the selected period, **When** they view the heatmap, **Then** they see a centered message "No activity to show yet — your AI work will appear here" in place of the grid, while the legend and any filters remain visible
3. **Given** the current period starts mid-week, **When** the heatmap renders, **Then** cells before the first day of the period are not rendered (chipped top-left corner) and cells after the last day are not rendered (chipped bottom-right corner), matching GitHub's contribution graph behavior
4. **Given** a user navigates to the projects page, **When** the page loads, **Then** the heatmap is visible immediately with data (no loading spinner or blank flash), using server-provided initial data
5. **Given** the header displays summary counters, **When** a ticket has a successfully completed `ship` workflow job, **Then** that ticket is counted in the "Y tickets shipped" counter on the day the ship job completed; tickets that reached the SHIP stage without a completed ship job are not counted

---

### User Story 2 - Filter by Time Period (Priority: P2)

A user wants to explore their activity history beyond the default rolling 12-month view. They use a year selector dropdown in the heatmap header to switch between "Last 12 months" (default rolling window) and specific calendar years. The dropdown is built dynamically: it always includes "Last 12 months" and adds each calendar year from the user's account creation year up to the current year. When the user selects a different period, the grid boundaries, summary counters, and cell intensities update to reflect that period.

**Why this priority**: Period selection is the primary way users explore historical data. Without it, users are locked into the rolling 12-month view and cannot examine specific years or compare activity across periods.

**Independent Test**: Can be tested by switching between periods and verifying that grid boundaries, counters, and cell data update correctly. Delivers value by enabling historical exploration.

**Acceptance Scenarios**:

1. **Given** a user whose account was created in 2024, **When** they view the year selector in 2026, **Then** the dropdown shows: "Last 12 months" (selected by default), "2024", "2025", "2026"
2. **Given** a user whose account was created in 2026 (current year), **When** they view the heatmap, **Then** the year selector is hidden or disabled since only "Last 12 months" is available
3. **Given** the user selects "2025" from the year selector, **When** the grid updates, **Then** it shows January 1 through December 31, 2025, with chipped corners if the year doesn't start on Sunday or end on Saturday
4. **Given** the user selects a different year, **When** the grid updates, **Then** the summary counters (jobs and shipped tickets) reflect only data from the selected period

---

### User Story 3 - Filter by Agent (Priority: P2)

A user who works with multiple AI agents wants to see activity broken down by agent. An agent filter appears next to the heatmap controls, with options dynamically derived from the distinct agents present in the user's job data. The filter uses effective agent resolution: tickets without an explicit agent inherit their project's default agent. When filtering by a specific agent, only jobs from tickets associated with that agent (explicitly or via inheritance) are counted. The grid boundaries remain unchanged — only the cell intensities and counters update.

**Why this priority**: Agent filtering enables users to compare agent-specific activity patterns, which is a key insight for users managing multiple agents. Ranked alongside period selection as a core filtering capability.

**Independent Test**: Can be tested by verifying filter options match actual agent usage, that effective agent resolution is correct, and that selecting an agent updates the heatmap data without changing the grid shape.

**Acceptance Scenarios**:

1. **Given** a user whose jobs span tickets using CLAUDE and CODEX (some explicit, some inherited from project defaults), **When** the heatmap loads, **Then** the agent filter shows "All" (selected by default), "Claude", and "Codex"
2. **Given** a user whose jobs all use only one agent (either explicitly or via project default), **When** the heatmap loads, **Then** the agent filter is hidden entirely
3. **Given** the user selects "Claude" from the agent filter, **When** a ticket has no explicit agent but its project's defaultAgent is CLAUDE, **Then** that ticket's jobs are included in the filtered heatmap
4. **Given** the user selects a specific agent, **When** the grid updates, **Then** the grid boundaries (start/end dates, chipped corners) remain the same as the unfiltered view; only cell intensities and counters change

---

### User Story 4 - View Activity Details via Tooltip (Priority: P3)

A user hovers over (desktop) or taps (mobile) a heatmap cell to see detailed information about that day's activity. The tooltip shows: tickets shipped that day, job count, total cost (if available), and the formatted date. If a job has no recorded cost, the cost line is omitted entirely — no "$NaN" or "$0" placeholders for missing data.

**Why this priority**: Tooltips provide drill-down detail that enriches the heatmap experience. The heatmap is useful without tooltips (the visual pattern is the primary value), making this a valuable but non-blocking enhancement.

**Independent Test**: Can be tested by hovering over cells with various data conditions (multiple jobs, zero activity, jobs with/without cost) and verifying tooltip content accuracy.

**Acceptance Scenarios**:

1. **Given** a day with 5 jobs (3 with recorded costs totaling $2.40, 2 with no cost recorded) and 1 ticket shipped, **When** the user hovers over that cell, **Then** the tooltip shows: "1 ticket shipped", "5 jobs", "$2.40" (sum of non-null costs only), and the formatted date
2. **Given** a day with 3 jobs and none have a recorded cost, **When** the user hovers over that cell, **Then** the tooltip shows job count and date but no cost line at all
3. **Given** a day with zero activity, **When** the user hovers over that cell, **Then** the tooltip shows only the formatted date and "No activity"
4. **Given** a user on a mobile device, **When** they tap a heatmap cell, **Then** the tooltip appears; **When** they tap outside the tooltip, **Then** it dismisses

---

### User Story 5 - Share Filtered View via URL (Priority: P3)

A user applies filters (year period and/or agent) to the heatmap. The active filters are reflected in the page URL as query parameters. The user copies the URL and shares it; when someone else opens it, they see the exact same filtered view (assuming they have the same data access).

**Why this priority**: URL-based state persistence is a convenience feature that builds on the filtering functionality. It enables sharing and bookmarking specific views.

**Independent Test**: Can be tested by applying filters, copying the URL, opening it in a new session, and verifying the same filters are pre-applied.

**Acceptance Scenarios**:

1. **Given** the user selects year "2025" and agent "Claude", **When** they look at the browser URL, **Then** it includes query parameters reflecting those selections (e.g., `?year=2025&agent=claude`)
2. **Given** a URL with heatmap filter query parameters, **When** a user navigates to that URL, **Then** the heatmap loads with those filters pre-applied
3. **Given** the user resets filters to defaults, **When** they look at the URL, **Then** the query parameters are removed (clean URL for default state)
4. **Given** the user refreshes the page with filter parameters in the URL, **Then** the filters persist and the heatmap shows the filtered view

---

### User Story 6 - Mobile Heatmap Experience (Priority: P3)

A user views the heatmap on a mobile device. The grid scrolls horizontally to accommodate the full period without wrapping or shrinking cells below a tappable size. Day-of-week labels remain pinned on the left edge during horizontal scrolling so the user always knows which row corresponds to which day.

**Why this priority**: Mobile usability ensures the feature works across all devices. The heatmap grid is naturally wide, so horizontal scrolling with sticky labels is essential for mobile usability.

**Independent Test**: Can be tested on a mobile viewport by scrolling horizontally and verifying labels stay pinned, cells remain tappable, and the grid doesn't wrap.

**Acceptance Scenarios**:

1. **Given** a mobile viewport, **When** the heatmap renders, **Then** the grid scrolls horizontally and cells maintain a minimum tappable size
2. **Given** the user scrolls the heatmap grid horizontally on mobile, **When** they scroll past the first columns, **Then** the day-of-week labels (Mon, Wed, Fri, etc.) remain visible and pinned to the left edge
3. **Given** the projects page on mobile, **When** the user scrolls vertically past the project cards, **Then** the heatmap is naturally reachable without being cut off by any scroll constraint

---

### Edge Cases

- What happens when a user has exactly one day of activity in a 12-month period? The heatmap should render the full period grid with one colored cell and all others empty; quantile thresholds treat the single active day as maximum intensity.
- What happens when a user switches from a year with dense activity to one with no activity? The grid updates to show the empty state message; switching back restores the populated grid. Counters reset to zero for the empty period.
- What happens when a job completes between background refreshes? The heatmap updates on the next 60-second refresh cycle; the user does not need to manually reload.
- What happens when the user's account was created mid-year and they select that year? The grid shows the full calendar year, but cells before the account creation date have no data (they appear empty, not hidden).
- What happens when all jobs for a day have null costs? The tooltip shows job count and date but omits the cost line entirely.
- What happens when the selected agent filter no longer has any matching data for the period? The heatmap shows the empty state message; the agent filter remains visible with the selection active so the user can change it.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a full-width activity heatmap below the project cards grid on the projects page
- **FR-002**: System MUST render the heatmap as a 7-row grid (one row per day of week) with columns corresponding to weeks in the selected period
- **FR-003**: System MUST color heatmap cells using a violet gradient with 5 discrete intensity levels, where intensity is based on the job count for that day calculated using quantile-based thresholds from the user's actual data distribution
- **FR-004**: System MUST display month labels along the top of the grid and day-of-week labels on the left side
- **FR-005**: System MUST display an intensity legend at the bottom right showing the color scale from "Less" to "More"
- **FR-006**: System MUST show a summary header with "X jobs + Y tickets shipped in the last year" (or selected period), where shipped tickets are counted based on successful completion of a `ship` workflow job, not stage transitions
- **FR-007**: System MUST provide a year selector dropdown with "Last 12 months" as the default option plus each calendar year from the user's account creation year to the current year
- **FR-008**: System MUST hide or disable the year selector when the user's account was created in the current year (only "Last 12 months" is applicable)
- **FR-009**: System MUST provide an agent filter with options dynamically derived from distinct agents present in the user's job data, using effective agent resolution (ticket agent if set, otherwise project default agent)
- **FR-010**: System MUST hide the agent filter when 0 or 1 distinct agents exist across the user's data
- **FR-011**: System MUST include an "All" option in the agent filter, selected by default
- **FR-012**: System MUST reflect active filters (year period, agent) in the page URL as query parameters, enabling URL sharing and bookmark persistence
- **FR-013**: System MUST restore filter state from URL query parameters on page load
- **FR-014**: System MUST show a tooltip on hover (desktop) or tap (mobile) displaying: tickets shipped that day, job count, total cost (sum of non-null costs only; omit cost line entirely when no costs are recorded), and formatted date
- **FR-015**: System MUST display "No activity" and the formatted date for tooltip on cells with zero activity
- **FR-016**: System MUST dismiss mobile tooltips when the user taps outside the tooltip area
- **FR-017**: System MUST render the heatmap with server-provided initial data to prevent any loading flash on first render
- **FR-018**: System MUST silently refresh heatmap data in the background without blanking the visible UI
- **FR-019**: System MUST support horizontal scrolling on mobile with day-of-week labels pinned to the left edge
- **FR-020**: System MUST maintain a minimum tappable cell size on mobile devices
- **FR-021**: System MUST not render cells outside the selected period boundaries (chipped corners for partial first/last weeks matching GitHub's contribution graph)
- **FR-022**: System MUST show a centered empty state message "No activity to show yet — your AI work will appear here" when the selected period has zero activity, while keeping the legend and filters visible
- **FR-023**: System MUST allow the projects page to scroll naturally to reveal the heatmap below the project cards, removing or adjusting any existing scroll constraints on the project grid
- **FR-024**: System MUST use only existing database models (Job, Ticket, Project, User) — no new database models are introduced

### Key Entities

- **Activity Day**: An aggregation of all job completions for a specific calendar day across the user's projects, containing job count, total cost (sum of non-null costs), and list of tickets shipped (via completed `ship` jobs). Not a persisted entity — computed from existing Job and Ticket data.
- **Heatmap Period**: The time range being visualized, either a rolling 12-month window or a specific calendar year. Determines grid boundaries (start date, end date) and which weeks/days are rendered including chipped corners for partial weeks.
- **Effective Agent**: The resolved agent for a ticket, determined by the ticket's explicit agent value if set, otherwise inherited from the parent project's default agent. Used for filtering and agent option derivation.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can view their cross-project activity heatmap within 1 second of navigating to the projects page, with no intermediate loading state visible
- **SC-002**: Heatmap data accurately reflects 100% of the user's completed jobs, with daily counts matching the sum of jobs completed on each calendar day
- **SC-003**: Shipped ticket count matches exactly the number of tickets with a successfully completed `ship` workflow job in the selected period — zero false positives from stage-only transitions
- **SC-004**: Users can switch between available time periods and agent filters and see updated results within 2 seconds
- **SC-005**: A URL with heatmap filter parameters, when opened in a new browser session, reproduces the identical filtered view 100% of the time
- **SC-006**: All heatmap cells meet minimum tappable size requirements on mobile devices, and day-of-week labels remain visible during horizontal scrolling
- **SC-007**: The violet color scale provides sufficient contrast to distinguish all 5 intensity levels on the dark theme, meeting WCAG AA contrast guidelines
- **SC-008**: Tooltip data is accurate: cost values are shown only when at least one job has a recorded cost, with no "$NaN", "$0", or missing-data artifacts displayed
