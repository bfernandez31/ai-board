# Feature Specification: Activity Heatmap on Projects Page

**Feature Branch**: `AIB-643-activity-heatmap-on`
**Created**: 2026-04-14
**Status**: Draft
**Input**: User description: "Add a GitHub-style contribution heatmap on the projects page, below the project cards grid. The heatmap displays AI activity across all user projects over the past year."

## Auto-Resolved Decisions

- **Decision**: "Shipped tickets" defined as tickets that have reached the SHIP stage (not CLOSED)
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score 0.3 — neutral UI feature with internal dashboard signals; absScore=1 < 3)
- **Fallback Triggered?**: Yes — AUTO confidence below 0.5 threshold, promoted to CONSERVATIVE
- **Trade-offs**:
  1. Counting only SHIP stage is stricter — excludes tickets that were closed without shipping
  2. Aligns with existing analytics dashboard conventions for "shipped" metric
- **Reviewer Notes**: Verify that SHIP-stage-only counting matches stakeholder expectations for "shipped" metric

---

- **Decision**: Agent filter derives agent from the parent ticket's `agent` field, not from the job directly
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — Job model lacks a direct agent field; ticket.agent is the only source
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Accurate per-ticket agent attribution; a ticket's jobs all share the same agent
  2. If agent field is null on older tickets, those jobs appear only under "All" filter
- **Reviewer Notes**: Confirm no edge cases where different jobs on the same ticket used different agents

---

- **Decision**: Heatmap covers all projects the user has access to (owner + member), consistent with the projects page listing
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — projects page already shows both owned and member projects
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Inclusive view provides full activity picture across collaborations
  2. No per-project filtering needed since the heatmap is an aggregate view
- **Reviewer Notes**: None — straightforward alignment with existing page behavior

---

- **Decision**: Color scale uses 5 intensity levels (empty, low, medium, high, max) following GitHub contribution graph conventions
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) — GitHub-style heatmap convention is well-established; 5 levels provide sufficient granularity
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. 5 levels are intuitive and match user expectations from GitHub
  2. Intensity thresholds should be relative to the user's own max activity (percentile-based), not absolute counts
- **Reviewer Notes**: Validate that violet palette provides sufficient contrast across all 5 levels on dark theme

---

- **Decision**: Mobile responsive behavior uses horizontal scrolling for the heatmap grid
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) — standard pattern for wide data grids on mobile; preserves data fidelity over truncation
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Horizontal scroll preserves full year view without data loss
  2. Slightly less ergonomic on small screens, but familiar pattern from GitHub mobile
- **Reviewer Notes**: Ensure scroll indicators are visible so users know more content exists

---

- **Decision**: Jobs with null `costUsd` are included in job counts but excluded from cost totals; tooltip displays cost only when data is available
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — cost data may be missing for older or failed jobs; showing partial data is more accurate than hiding entire days
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Accurate job counts regardless of cost tracking completeness
  2. Cost totals may underreport if many jobs lack cost data
- **Reviewer Notes**: Consider showing a note when cost data is incomplete for the selected period

---

- **Decision**: The existing scroll constraint on the projects container must be adjusted to allow natural page scrolling so the heatmap below the grid is accessible
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — current constraint clips content below the project cards; the heatmap requires the page to scroll naturally
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Removing the scroll constraint enables the heatmap to be visible below the grid
  2. Users with many projects will scroll the full page instead of just the grid; this is the expected behavior for a content-rich page
- **Reviewer Notes**: Verify that removing the constraint doesn't break layout on screens with very few projects

## User Scenarios & Testing

### User Story 1 - View Activity Heatmap (Priority: P1)

A user navigates to the `/projects` page and sees their project cards grid. Below the grid, a full-width heatmap section displays their AI activity over the past rolling 12 months. Each cell represents a day, colored by job count intensity using a violet palette. The header shows aggregate metrics: total jobs run and tickets shipped in the displayed period.

**Why this priority**: This is the core feature — the heatmap visualization itself. Without it, no other stories deliver value.

**Independent Test**: Can be fully tested by navigating to `/projects` with existing job data and verifying the heatmap renders with correct day-cell coloring, month labels, day-of-week labels, and header metrics.

**Acceptance Scenarios**:

1. **Given** a user with job activity across multiple projects, **When** they visit `/projects`, **Then** a heatmap grid appears below the project cards showing 52 columns (weeks) x 7 rows (days), with violet-shaded cells proportional to daily job count
2. **Given** a user with no job activity, **When** they visit `/projects`, **Then** the heatmap renders with all cells at the empty/transparent level and header shows "0 jobs · 0 tickets shipped"
3. **Given** the heatmap is rendered, **When** the user views the header, **Then** it displays "X jobs · Y tickets shipped in the last year" with accurate counts
4. **Given** the heatmap is rendered, **When** the user views the bottom-right corner, **Then** an intensity legend is displayed showing the color scale from "Less" to "More"
5. **Given** the projects page has project cards above, **When** the user scrolls down, **Then** the page scrolls naturally to reveal the heatmap section below the grid

---

### User Story 2 - Tooltip on Hover (Priority: P2)

When a user hovers over any heatmap cell, a tooltip appears showing the number of tickets shipped that day, the number of jobs run plus total cost, and the formatted date.

**Why this priority**: Tooltips transform the heatmap from a visual summary into an actionable data exploration tool. Critical for understanding specific days.

**Independent Test**: Can be tested by hovering over populated cells and verifying tooltip content matches actual job/ticket data for that date.

**Acceptance Scenarios**:

1. **Given** a heatmap cell for a day with 3 jobs (total cost $0.45) and 1 shipped ticket, **When** the user hovers over the cell, **Then** a tooltip displays "1 ticket shipped", "3 jobs · $0.45", and the formatted date (e.g., "Monday, March 15, 2026")
2. **Given** a heatmap cell for a day with jobs but no cost data, **When** the user hovers, **Then** the tooltip shows job count without a cost figure
3. **Given** a heatmap cell for a day with no activity, **When** the user hovers, **Then** the tooltip displays "No activity" and the formatted date

---

### User Story 3 - Year Selector (Priority: P3)

The heatmap header includes a year selector dropdown. The default view shows a rolling 12-month window. The user can switch to specific calendar years to browse historical activity.

**Why this priority**: Enables historical exploration beyond the default rolling window. Valuable but not essential for the initial impression.

**Independent Test**: Can be tested by selecting different years from the dropdown and verifying the heatmap grid, header metrics, and cell data update to reflect the chosen period.

**Acceptance Scenarios**:

1. **Given** the heatmap loads, **When** the user views the year selector, **Then** it defaults to "Last 12 months" showing a rolling window from today
2. **Given** the year selector is open, **When** the user selects "2025", **Then** the heatmap shows January 1 – December 31, 2025 and header metrics reflect only that year
3. **Given** the user selects a year with no activity, **When** the heatmap updates, **Then** all cells are empty and header shows "0 jobs · 0 tickets shipped in 2025"

---

### User Story 4 - Agent Filter (Priority: P4)

An agent filter control allows the user to filter heatmap data by AI agent (e.g., Claude, Gemini, or all agents). The heatmap, header metrics, and tooltips all update to reflect the selected filter.

**Why this priority**: Useful for multi-agent users who want to compare agent usage patterns, but most users currently use a single agent.

**Independent Test**: Can be tested by selecting different agent options and verifying that heatmap cells, header counts, and tooltip data change to show only jobs from tickets assigned to the selected agent.

**Acceptance Scenarios**:

1. **Given** the heatmap is displayed, **When** the user views the agent filter, **Then** it defaults to "All" showing activity from all agents
2. **Given** the user selects "Claude" from the agent filter, **When** the heatmap updates, **Then** only jobs from tickets with agent=CLAUDE are reflected in cell intensity, header metrics, and tooltips
3. **Given** the user selects an agent with no activity, **When** the heatmap updates, **Then** all cells are empty and metrics show zero

### Edge Cases

- What happens when a user has activity on the current day? The cell reflects real-time data up to the last data fetch.
- How does the heatmap handle timezone differences? Activity is aggregated by date in the user's local timezone (client-side date grouping from UTC timestamps).
- What happens when the user has access to many projects (50+)? The data endpoint aggregates efficiently across all accessible projects without noticeable delay.
- What if the user gains or loses project membership mid-year? The heatmap reflects current access — historical cells may shift as project access changes.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a GitHub-style heatmap grid below the project cards on the `/projects` page, with 52 columns (weeks) and 7 rows (days of the week)
- **FR-002**: System MUST label months along the top of the heatmap and days of the week along the left side
- **FR-003**: System MUST color each cell using a violet palette with 5 intensity levels based on the job count for that day relative to the user's maximum daily activity in the displayed period
- **FR-004**: System MUST display a header above the heatmap showing "X jobs · Y tickets shipped in the last year" (or selected year) with accurate aggregate counts
- **FR-005**: System MUST display an intensity legend at the bottom-right showing the color scale from "Less" to "More"
- **FR-006**: System MUST show a tooltip on cell hover containing: tickets shipped that day, job count and total cost (when available), and formatted date
- **FR-007**: System MUST provide a year selector dropdown defaulting to "Last 12 months" (rolling window), with options for specific calendar years based on the user's activity history
- **FR-008**: System MUST provide an agent filter (All, Claude, Gemini, etc.) that updates the heatmap, header metrics, and tooltips when changed
- **FR-009**: System MUST aggregate job data across all projects the user has access to (owned and member projects)
- **FR-010**: System MUST allow the page to scroll naturally so the heatmap is accessible below the project cards grid
- **FR-011**: System MUST support horizontal scrolling for the heatmap grid on mobile devices to preserve the full year view
- **FR-012**: System MUST use a violet color palette that maintains readable contrast on dark theme backgrounds (WCAG AA compliant)

### Key Entities

- **Daily Activity Aggregate**: Represents one day's worth of activity data — job count, total cost, shipped ticket count — derived from existing Job and Ticket records. No new database models required.
- **Heatmap Period**: Either a rolling 12-month window or a specific calendar year, defining the date range for data aggregation and grid rendering.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can view and interact with the activity heatmap within 2 seconds of the projects page loading
- **SC-002**: Heatmap accurately reflects 100% of job activity across all accessible projects for the selected period
- **SC-003**: All 5 violet intensity levels are visually distinguishable on dark theme (minimum WCAG AA contrast between adjacent levels and background)
- **SC-004**: Year selector switches displayed period and updates all metrics within 1 second
- **SC-005**: Agent filter updates heatmap and metrics within 1 second
- **SC-006**: Tooltip displays accurate per-day data (job count, cost, shipped tickets, date) on hover with no perceptible delay
- **SC-007**: Heatmap remains usable on mobile screens (320px width and above) via horizontal scrolling
- **SC-008**: No new database tables or models are introduced — feature relies entirely on existing Job and Ticket data
