# Feature Specification: Activity Heatmap on Projects Page

**Feature Branch**: `AIB-647-activity-heatmap-on`
**Created**: 2026-04-14
**Status**: Draft
**Input**: User description: "Add a GitHub-style contribution heatmap on the projects page, below the project cards grid. The heatmap displays AI activity across all user projects over the past year."

## Auto-Resolved Decisions

- **Decision**: Mobile responsive behavior — heatmap uses horizontal scroll with sticky day-of-week labels on smaller viewports rather than attempting to shrink cells below readable size
- **Policy Applied**: CONSERVATIVE (AUTO fallback — low confidence)
- **Confidence**: Low (score 0.3 — only neutral feature signals, absScore=1)
- **Fallback Triggered?**: Yes — AUTO promoted to CONSERVATIVE due to confidence < 0.5 with no conflicting buckets
- **Trade-offs**:
  1. Horizontal scroll is less elegant than a fully responsive grid but preserves readability and data accuracy
  2. No risk of misrepresenting data through overly compressed cells
- **Reviewer Notes**: Verify that horizontal scroll behavior on mobile feels natural and that month/day labels remain visible during scroll

---

- **Decision**: "Shipped" date for daily aggregation uses the timestamp when the ticket's most recent `ship` command job completed, falling back to ticket `updatedAt` when stage is SHIP
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score 0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Using job completion time is more precise than ticket `updatedAt` which could reflect unrelated edits
  2. Requires joining through jobs table, slightly more complex query
- **Reviewer Notes**: Confirm that `ship` command jobs reliably have `completedAt` timestamps in production data

---

- **Decision**: Color scale uses 5 discrete intensity levels (empty, low, medium, high, max) mapped to the violet palette, consistent with the aurora theme
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score 0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. 5 levels provide sufficient granularity without overwhelming users; matches GitHub's contribution graph pattern
  2. Discrete levels are easier to distinguish than continuous gradients, especially for accessibility
- **Reviewer Notes**: Validate that all 5 violet intensity levels maintain WCAG AA contrast on dark theme

---

- **Decision**: Empty state shows the full heatmap grid with all cells at the empty/transparent level plus a centered message indicating no activity for the selected period
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score 0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Showing the grid structure even when empty provides spatial context and avoids layout shift when data loads
  2. A completely hidden heatmap could confuse users who expect the section to exist
- **Reviewer Notes**: Ensure empty state message is informative (e.g., "No AI activity in this period")

---

- **Decision**: Scroll constraint on projects page is removed so the page scrolls naturally to reveal the heatmap section below the project cards grid
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score 0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Natural page scroll is more intuitive and allows the heatmap to be discoverable
  2. Users with many projects will need to scroll past all cards to reach the heatmap; this is acceptable since cards are the primary content
- **Reviewer Notes**: Verify that removing the scroll constraint doesn't cause layout issues when projects list is very short or very long

## User Scenarios & Testing

### User Story 1 - View Activity Heatmap (Priority: P1)

A user navigates to the projects page and sees a GitHub-style heatmap below their project cards showing AI job activity across all their projects over the past year. The heatmap uses a violet color scale where brighter cells represent more jobs on that day. Month labels appear along the top, day-of-week labels on the left, and an intensity legend at the bottom right.

**Why this priority**: The heatmap is the core deliverable — without it, no other feature (filters, tooltips, year selector) has meaning. This provides immediate visual value showing activity patterns.

**Independent Test**: Can be fully tested by loading the projects page with existing job data and verifying the heatmap renders with correct cell colors based on daily job counts.

**Acceptance Scenarios**:

1. **Given** a user has projects with jobs spanning the past 12 months, **When** they visit the projects page, **Then** they see a heatmap grid (52 columns x 7 rows) with violet-shaded cells reflecting job counts per day, month labels on top, day-of-week labels on the left, and an intensity legend at the bottom right
2. **Given** a user has no jobs in any project, **When** they visit the projects page, **Then** they see an empty heatmap grid with all cells at the lowest intensity and a message indicating no activity
3. **Given** a user has projects with jobs, **When** they view the heatmap, **Then** the page scrolls naturally past the project cards to reveal the full-width heatmap section below

---

### User Story 2 - Hover Tooltip with Activity Details (Priority: P1)

A user hovers over a heatmap cell to see a tooltip showing the number of tickets shipped that day, the number of jobs run plus total cost, and the formatted date.

**Why this priority**: Tooltips transform the heatmap from a decorative element into an actionable information tool. Users need to drill down into specific days to understand their activity.

**Independent Test**: Can be tested by hovering over cells with known data and verifying tooltip content matches the underlying job and ticket records.

**Acceptance Scenarios**:

1. **Given** a heatmap cell representing a day with 3 jobs ($1.50 total cost) and 1 shipped ticket, **When** the user hovers over that cell, **Then** a tooltip appears showing "1 ticket shipped", "3 jobs · $1.50", and the formatted date (e.g., "Monday, March 15, 2026")
2. **Given** a heatmap cell representing a day with jobs but no shipped tickets, **When** the user hovers, **Then** the tooltip shows "0 tickets shipped", the job count and cost, and the formatted date
3. **Given** a heatmap cell representing a day with no activity, **When** the user hovers, **Then** the tooltip shows "No activity" and the formatted date

---

### User Story 3 - Header with Summary Metrics (Priority: P2)

Above the heatmap grid, a header displays summary counters showing "X jobs · Y tickets shipped in the last year" reflecting the total activity for the displayed period.

**Why this priority**: Summary metrics provide at-a-glance value without requiring users to inspect individual cells, but the heatmap itself is usable without them.

**Independent Test**: Can be tested by verifying the header counters match the sum of all job counts and shipped ticket counts within the displayed date range.

**Acceptance Scenarios**:

1. **Given** a user with 150 jobs and 12 shipped tickets in the past year, **When** they view the heatmap, **Then** the header shows "150 jobs · 12 tickets shipped in the last year"
2. **Given** a user selects a specific calendar year with different totals, **When** the view updates, **Then** the header counters reflect only that calendar year's data

---

### User Story 4 - Year Selector (Priority: P2)

A dropdown allows the user to switch between a rolling 12-month view (default) and specific calendar years to browse historical activity.

**Why this priority**: Historical browsing extends the heatmap's utility beyond recent activity, but the default rolling view covers the most common use case.

**Independent Test**: Can be tested by switching between year options and verifying the heatmap grid, header counters, and tooltips all update to reflect the selected period.

**Acceptance Scenarios**:

1. **Given** the heatmap loads, **When** the user first sees it, **Then** the year selector defaults to "Last 12 months" showing rolling data from today back one year
2. **Given** the user has activity spanning 2024 and 2025, **When** they select "2024" from the dropdown, **Then** the heatmap shows January 1 to December 31, 2024 and the header counters update accordingly
3. **Given** the user selects a calendar year with no activity, **When** the view updates, **Then** the heatmap shows the empty state for that year

---

### User Story 5 - Agent Filter (Priority: P3)

A filter allows the user to view heatmap activity for a specific AI agent (e.g., Claude, Gemini) or all agents combined.

**Why this priority**: Agent filtering adds analytical depth but is a refinement — most users will primarily use the "all agents" default view.

**Independent Test**: Can be tested by selecting different agent filters and verifying that heatmap cells, tooltips, and header counters reflect only jobs associated with the selected agent.

**Acceptance Scenarios**:

1. **Given** the heatmap shows all-agents view with activity, **When** the user selects "Claude" from the agent filter, **Then** the heatmap updates to show only job activity from tickets assigned to the Claude agent
2. **Given** the user filters by an agent with no activity, **When** the filter is applied, **Then** the heatmap shows the empty state with an appropriate message
3. **Given** the user changes the agent filter, **When** the heatmap updates, **Then** the header counters and tooltips also reflect the filtered data

---

### Edge Cases

- What happens when a user has only one project? The heatmap still renders normally, aggregating that single project's data.
- What happens when a day has an extremely high job count (e.g., 50+ jobs)? The "max" intensity level caps the visual — the tooltip still shows the exact count.
- What happens when jobs span midnight? Jobs are attributed to the day of their `startedAt` timestamp.
- What happens when the user's timezone differs from the server? Dates are displayed in the user's local timezone for consistency with their perception of "today."
- What happens when job cost data is null? The tooltip shows the job count but omits cost (e.g., "3 jobs") rather than displaying "$0.00."
- What happens when both year selector and agent filter are active? Both filters apply simultaneously — the heatmap shows only the selected agent's activity within the selected year.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a GitHub-style heatmap grid with 52 columns (weeks) and 7 rows (days of week) on the projects page below the project cards
- **FR-002**: System MUST aggregate job counts across ALL projects owned by or shared with the authenticated user for each calendar day
- **FR-003**: System MUST render month labels along the top edge of the heatmap grid aligned to the corresponding week columns
- **FR-004**: System MUST render abbreviated day-of-week labels along the left edge of the heatmap grid (Mon, Wed, Fri at minimum, following the GitHub convention)
- **FR-005**: System MUST map daily job counts to a 5-level violet color scale (empty, low, medium, high, max) coherent with the aurora theme
- **FR-006**: System MUST display an intensity legend at the bottom right of the heatmap showing the color scale from "Less" to "More"
- **FR-007**: System MUST show a header above the heatmap displaying "X jobs · Y tickets shipped in the last year" (or appropriate period label) with real aggregated data
- **FR-008**: System MUST provide a year selector dropdown defaulting to "Last 12 months" (rolling) with options for specific calendar years based on available data
- **FR-009**: When a specific calendar year is selected, the heatmap MUST display January 1 through December 31 of that year
- **FR-010**: System MUST show a tooltip on cell hover containing: number of tickets shipped that day, number of jobs and total cost, and the formatted date
- **FR-011**: When a cell has no activity, the tooltip MUST show "No activity" and the formatted date
- **FR-012**: When job cost data is unavailable (null), the tooltip MUST display job count without cost rather than showing zero
- **FR-013**: System MUST provide an agent filter allowing users to view activity for a specific agent (Claude, Codex, Mistral, Gemini) or all agents
- **FR-014**: Agent filter MUST affect the heatmap cells, header counters, and tooltip data consistently
- **FR-015**: The projects page MUST scroll naturally to reveal the heatmap section below the project cards, removing the current scroll constraint on the project grid
- **FR-016**: The heatmap section MUST be full-width within the page container
- **FR-017**: On mobile and narrow viewports, the heatmap MUST support horizontal scrolling with sticky day-of-week labels
- **FR-018**: System MUST show an empty state when no activity exists for the selected period and filters, displaying the grid structure with a centered informational message
- **FR-019**: System MUST attribute jobs to calendar days based on the job's start timestamp in the user's local timezone
- **FR-020**: System MUST determine "tickets shipped" per day based on when the ticket's ship command job completed

### Key Entities

- **Daily Activity Cell**: Represents a single calendar day's aggregated activity — contains job count, total cost, and shipped ticket count. Mapped to a visual intensity level.
- **Heatmap Period**: The time range displayed in the heatmap — either a rolling 12-month window or a specific calendar year (January 1 - December 31).
- **Activity Summary**: The aggregated header metrics for the entire displayed period — total job count and total shipped ticket count.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can visually identify their most active and least active days within 5 seconds of viewing the heatmap
- **SC-002**: Heatmap renders with accurate data for all user projects within 2 seconds of page load
- **SC-003**: All 5 violet intensity levels are distinguishable on dark theme with minimum WCAG AA contrast (4.5:1 ratio for informational graphics)
- **SC-004**: Year selector switches the displayed period and updates all heatmap data within 1 second
- **SC-005**: Agent filter updates the heatmap within 1 second of selection
- **SC-006**: Tooltip appears within 200ms of hovering over a cell and displays accurate job count, cost, shipped ticket count, and formatted date
- **SC-007**: Heatmap is usable on viewports as narrow as 375px (standard mobile) via horizontal scrolling
- **SC-008**: No new database models are introduced — feature operates entirely on existing Job and Ticket data

### Assumptions

- The existing Job and Ticket tables contain sufficient historical data to populate a meaningful heatmap for active users
- The `costUsd` field on jobs is reliably populated for completed jobs (null values are handled gracefully)
- The existing agent resolution pattern (ticket agent to project default agent) provides accurate agent attribution
- Users primarily care about job volume patterns rather than granular cost breakdowns (cost is supplementary in tooltip, not a primary heatmap dimension)
- The violet color palette from the aurora theme provides sufficient range for 5 discrete intensity levels on dark backgrounds
