# Feature Specification: Activity Heatmap on Projects Page

**Feature Branch**: `AIB-654-copy-of-activity`
**Created**: 2026-04-15
**Status**: Draft
**Input**: User description: "Add a GitHub-style contribution heatmap on the projects page displaying AI activity across all user projects over the past year"

## Auto-Resolved Decisions

### Decision 1: Polling Interval for Heatmap Data

- **Decision**: Background refetch interval set to 15 seconds, consistent with the analytics dashboard and activity feed patterns already used across the application
- **Policy Applied**: CONSERVATIVE (AUTO fallback — low confidence)
- **Confidence**: Low (score: 1, absScore: 1)
- **Fallback Triggered?**: Yes — AUTO confidence was 0.3 (below 0.5 threshold), promoted to CONSERVATIVE
- **Trade-offs**:
  1. 15-second interval may cause slightly stale data but avoids unnecessary server load
  2. Aligns with existing patterns, reducing cognitive overhead for maintenance
- **Reviewer Notes**: Verify 15s is appropriate for a cross-project aggregate query that may span a full year of data. If the query is expensive, consider a longer interval (e.g., 60s).

### Decision 2: Heatmap Cell Minimum Size on Mobile

- **Decision**: Cells maintain a minimum tappable size on touch devices. Horizontal scrolling is used rather than shrinking cells below a comfortable interaction threshold.
- **Policy Applied**: CONSERVATIVE (AUTO fallback — low confidence)
- **Confidence**: Low (score: 1, absScore: 1)
- **Fallback Triggered?**: Yes — promoted to CONSERVATIVE for accessibility compliance
- **Trade-offs**:
  1. Larger cells mean more horizontal scrolling on small screens
  2. Ensures all users can interact with the heatmap reliably on touch devices
- **Reviewer Notes**: Consider whether GitHub's ~11px desktop cell size is appropriate on mobile. A pragmatic alternative would be smaller cells with touch-to-reveal tooltip behavior. The exact pixel minimum should be determined during design/implementation.

### Decision 3: Cost Display in Tooltip

- **Decision**: When a job has no recorded cost (`costUsd` is null), that job's cost is excluded from the total. The cost line is omitted entirely from the tooltip when ALL jobs on that day lack cost data. There is no "$0.00" or "$NaN" display.
- **Policy Applied**: CONSERVATIVE (AUTO fallback — low confidence)
- **Confidence**: Low (score: 1, absScore: 1)
- **Fallback Triggered?**: Yes — promoted to CONSERVATIVE for data integrity
- **Trade-offs**:
  1. Users may wonder why cost is sometimes missing, but this prevents misleading data
  2. Directly honors the explicit constraint from the feature description
- **Reviewer Notes**: The description explicitly states "never $NaN or $0 for missing data." This decision directly honors that constraint.

### Decision 4: Year Selector Behavior for New Accounts

- **Decision**: When the user's account was created in the current year, the year selector is hidden entirely (not shown as a disabled dropdown). Only the "Last 12 months" view is available as the implicit default.
- **Policy Applied**: CONSERVATIVE (AUTO fallback — low confidence)
- **Confidence**: Low (score: 1, absScore: 1)
- **Fallback Triggered?**: Yes — promoted to CONSERVATIVE
- **Trade-offs**:
  1. Cleaner UI for new users with no historical data to navigate
  2. The dropdown reappears naturally once a new calendar year begins
- **Reviewer Notes**: The description offers both "no dropdown, or a disabled one" — hiding it entirely was chosen as the simpler, less confusing option.

### Decision 5: URL Query Parameter Naming

- **Decision**: Filter state is persisted in URL query parameters using descriptive names: `year` for the period selector (values: `rolling` or a four-digit year) and `agent` for the agent filter (values: `all` or a named agent). These parameters are read on initial render to restore the view.
- **Policy Applied**: CONSERVATIVE (AUTO fallback — low confidence)
- **Confidence**: Low (score: 1, absScore: 1)
- **Fallback Triggered?**: Yes — promoted to CONSERVATIVE
- **Trade-offs**:
  1. Descriptive parameter names are readable in shared URLs
  2. Must not conflict with any existing query parameters on the projects page
- **Reviewer Notes**: Verify no existing query params on `/projects` would collide with `year` or `agent`.

## User Scenarios & Testing

### User Story 1 - View Activity Heatmap (Priority: P1)

A user navigates to the projects page and sees a GitHub-style heatmap below their project cards. The heatmap shows the intensity of AI job activity across all their projects for the last 12 months. Each cell represents a single day, with darker violet shading indicating more jobs. Month labels run across the top and day-of-week labels appear on the left side.

**Why this priority**: This is the core visualization — without it, there is no feature. It provides an at-a-glance view of AI usage patterns that doesn't exist elsewhere in the application.

**Independent Test**: Can be fully tested by navigating to `/projects` as a user with existing job history and verifying the heatmap grid renders with correct date boundaries and intensity coloring.

**Acceptance Scenarios**:

1. **Given** a user with jobs spanning multiple months, **When** they visit `/projects`, **Then** a heatmap grid appears below the project cards showing 7 rows (Sun-Sat) with columns spanning the last 12 months, cells colored by job count on each day
2. **Given** a user with no jobs in the selected period, **When** they view the heatmap, **Then** a centered message reads "No activity to show yet — your AI work will appear here" in place of the grid, while the legend and any visible filters remain
3. **Given** the current rolling 12-month period starts mid-week, **When** the heatmap renders, **Then** cells before the start date in the first partial week are not rendered (GitHub-style chipped corner)
4. **Given** a user visits the projects page, **When** the page loads, **Then** the heatmap displays immediately with server-rendered data (no loading spinner or blank flash)

---

### User Story 2 - Header Summary and Year Selector (Priority: P1)

Above the heatmap grid, the user sees a summary counter showing the total number of jobs and tickets shipped in the selected period. A year selector dropdown lets them switch between "Last 12 months" (rolling, default) and specific calendar years.

**Why this priority**: The counter provides essential context for interpreting the heatmap, and the year selector enables historical exploration. Together they frame the data.

**Independent Test**: Can be tested by verifying the counter values match the actual job and shipped ticket counts in the database for the selected period, and by switching years to confirm the grid and counter update accordingly.

**Acceptance Scenarios**:

1. **Given** a user with 150 jobs and 12 tickets shipped via completed `ship` jobs in the last 12 months, **When** they view the heatmap header, **Then** the counter reads "150 jobs · 12 tickets shipped in the last year"
2. **Given** a ticket moved to SHIP stage but whose `ship` job did not complete successfully, **When** the counter calculates shipped tickets, **Then** that ticket is NOT counted
3. **Given** a user whose account was created in 2024, **When** they open the year selector, **Then** the options are: "Last 12 months", "2024", "2025", "2026"
4. **Given** a user whose account was created in the current year (2026), **When** they view the heatmap, **Then** no year selector dropdown is shown; only the rolling "Last 12 months" view is available
5. **Given** a user selects "2025" from the year dropdown, **When** the heatmap updates, **Then** the grid shows January 1 through December 31, 2025, with chipped corners if Jan 1 is not Sunday or Dec 31 is not Saturday

---

### User Story 3 - Tooltip on Hover/Tap (Priority: P2)

When a user hovers over (desktop) or taps (mobile) a heatmap cell, a tooltip appears showing the day's details: tickets shipped that day, job count, total cost (if available), and the formatted date.

**Why this priority**: Tooltips provide the detail layer that makes the heatmap actionable beyond a visual overview. The heatmap is still useful without tooltips (P1 delivers the grid).

**Independent Test**: Can be tested by hovering over cells with known data and verifying tooltip content matches expected values, including edge cases where cost is null.

**Acceptance Scenarios**:

1. **Given** a day with 5 jobs (total cost $1.23) and 1 shipped ticket, **When** the user hovers over that cell, **Then** a tooltip shows: the shipped ticket info, "5 jobs · $1.23", and the formatted date (e.g., "Tuesday, March 15, 2026")
2. **Given** a day with 3 jobs where none have recorded costs, **When** the user hovers over that cell, **Then** the tooltip shows "3 jobs" with no cost line — no "$0" or "$NaN" appears
3. **Given** a day with 2 jobs where one has a cost of $0.50 and the other has no cost, **When** the user hovers, **Then** the tooltip shows "2 jobs · $0.50" (summing only the jobs that have recorded costs)
4. **Given** a mobile user, **When** they tap a cell, **Then** the tooltip appears; **When** they tap outside the tooltip, **Then** it dismisses

---

### User Story 4 - Agent Filter (Priority: P2)

When a user has jobs from multiple distinct agents across their projects, an agent filter appears allowing them to view heatmap activity for a specific agent. The filter considers both explicit ticket-level agents and the effective agent inherited from project defaults.

**Why this priority**: Filtering adds analytical depth but is not required for the core visualization. The filter is hidden when there's only one agent, so many users may never see it.

**Independent Test**: Can be tested by creating jobs under tickets with different agents (including tickets inheriting from project defaults) and verifying the filter options and filtered results are correct.

**Acceptance Scenarios**:

1. **Given** a user whose jobs span tickets with agents CLAUDE and CODEX (including tickets inheriting agent from project defaults), **When** the heatmap loads, **Then** an agent filter is visible with options: "All", "Claude", "Codex"
2. **Given** a user selects "Claude" in the agent filter, **When** the heatmap updates, **Then** it shows only jobs from tickets where the effective agent is CLAUDE (either explicitly set on the ticket or inherited from the project's default agent)
3. **Given** a user whose all jobs belong to a single agent, **When** the heatmap loads, **Then** no agent filter is displayed
4. **Given** the agent filter is set to "Codex", **When** the heatmap grid renders, **Then** the grid boundaries (date range, chipped corners) remain unchanged — only cell intensities reflect the filtered data
5. **Given** a user selects an agent filter and year, **When** they copy the page URL and open it in another browser, **Then** the same filters and view are restored

---

### User Story 5 - Mobile Experience (Priority: P3)

On mobile devices, the heatmap grid scrolls horizontally while day-of-week labels stay pinned on the left. Cells never shrink below a tappable size.

**Why this priority**: Mobile responsiveness is important for accessibility but the primary use case is desktop/tablet where the full grid is visible without scrolling.

**Independent Test**: Can be tested by viewing the projects page on a mobile viewport and verifying horizontal scroll behavior, sticky labels, and tap-to-tooltip interaction.

**Acceptance Scenarios**:

1. **Given** a mobile viewport (< 768px), **When** the user views the heatmap, **Then** the grid scrolls horizontally and day-of-week labels (Mon, Wed, Fri, etc.) remain pinned on the left edge
2. **Given** a mobile viewport, **When** the user scrolls the heatmap grid horizontally, **Then** cells maintain a minimum tappable size and do not wrap to a new line
3. **Given** a mobile user, **When** they tap a heatmap cell, **Then** a tooltip appears; tapping outside dismisses it

---

### Edge Cases

- What happens when a user has projects but zero jobs? The empty state message is displayed in place of the grid.
- What happens when a user has jobs only on a single day? The grid renders the full period with one colored cell and the rest empty.
- What happens when the user switches years rapidly? The most recent selection takes effect; intermediate requests are superseded.
- What happens when cost data is partially available for a day? Only jobs with non-null `costUsd` contribute to cost totals; the cost line is omitted from tooltips only when ALL jobs on that day lack cost data.
- What happens when a ticket's `ship` job was CANCELLED or FAILED? That ticket is NOT counted as shipped for that day.
- What happens when there are multiple completed `ship` jobs for the same ticket? The ticket is counted as shipped on the date of its first completed `ship` job only (no double-counting).
- What happens when the page scrolls? The heatmap is part of the natural page flow below the project cards — no fixed positioning or separate scroll container for the heatmap section itself.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a GitHub-style activity heatmap below the project cards grid on the projects page (`/projects`)
- **FR-002**: Heatmap MUST aggregate job data across ALL of the user's projects (not per-project)
- **FR-003**: Heatmap grid MUST have 7 rows (one per day of week, Sunday through Saturday) with columns matching the selected time period's week boundaries
- **FR-004**: Grid MUST use GitHub-style "chipped corners" — cells before the period's start date and after the period's end date within partial weeks MUST NOT be rendered
- **FR-005**: Cell intensity MUST be based on job count for that calendar day, using a violet color gradient consistent with the aurora theme
- **FR-006**: An intensity legend MUST appear at bottom right of the grid showing the scale (Less to More with graduated color blocks)
- **FR-007**: Month labels MUST appear above the grid columns; day-of-week labels MUST appear to the left of grid rows
- **FR-008**: A header counter MUST display "X jobs · Y tickets shipped in the last year" (or the selected period name)
- **FR-009**: A ticket MUST be counted as "shipped" ONLY when its `ship` command job has a COMPLETED status. Stage transitions to SHIP without a completed `ship` job do NOT qualify.
- **FR-010**: The shipped ticket MUST be attributed to the date the `ship` job completed (`completedAt` field)
- **FR-011**: System MUST provide a year selector dropdown with "Last 12 months" as the default option plus each calendar year from the user's account creation year to the current year
- **FR-012**: When the user's account was created in the current year, the year selector MUST be hidden
- **FR-013**: When a user hovers (desktop) or taps (mobile) a cell, a tooltip MUST display: tickets shipped that day, job count, total cost (only if at least one job has recorded cost), and the formatted date
- **FR-014**: Cost values in tooltips MUST never show "$NaN" or "$0" when the underlying data is null/missing; the cost line is omitted entirely when no jobs on that day have recorded costs
- **FR-015**: An agent filter MUST be provided when the user's jobs span 2 or more distinct effective agents; it MUST be hidden when 0 or 1 distinct agents exist
- **FR-016**: Agent filter options MUST be dynamically derived from the user's actual job data, including both explicit ticket agents and effective agents inherited from project defaults
- **FR-017**: When filtering by agent, the system MUST include tickets with no explicit agent whose parent project's default agent matches the selected filter value (effective agent resolution)
- **FR-018**: Grid boundaries (date range, chipped corners) MUST remain unchanged when an agent filter is applied — only cell intensities change
- **FR-019**: Active filter selections (year, agent) MUST be persisted in URL query parameters so that copying and sharing the URL reproduces the exact view
- **FR-020**: The heatmap MUST render with server-provided initial data on first load — no loading spinner or blank flash
- **FR-021**: Background data refetches MUST update the heatmap silently without blanking the existing UI
- **FR-022**: When the selected period has zero activity (no jobs), a centered message "No activity to show yet — your AI work will appear here" MUST replace the grid while legend and filters remain visible
- **FR-023**: On mobile viewports, the heatmap grid MUST scroll horizontally with day-of-week labels pinned (sticky) on the left
- **FR-024**: On mobile viewports, heatmap cells MUST NOT shrink below a tappable size; horizontal scrolling accommodates the full grid
- **FR-025**: On mobile, tapping a cell shows its tooltip; tapping outside the tooltip dismisses it
- **FR-026**: The projects page layout MUST scroll naturally to reveal the heatmap below the project cards (adjusting any existing scroll constraints if necessary)
- **FR-027**: No new database models or tables are required — the heatmap MUST use existing Job and Ticket data

### Key Entities

- **Job**: The primary data source for heatmap intensity. Key attributes: `startedAt` (determines which calendar day a job is plotted on), `completedAt` (used for dating shipped tickets via `ship` jobs), `command` (identifies `ship` jobs), `status` (COMPLETED required for ship counting), `costUsd` (for tooltip cost aggregation, nullable)
- **Ticket**: Links jobs to projects and carries the `agent` field (nullable) used for effective agent resolution. The `stage` field is NOT used for shipped counting — only the job's completion status matters.
- **Project**: Provides `defaultAgent` for effective agent resolution when a ticket has no explicit agent. All of a user's projects contribute to the aggregate heatmap.
- **User**: `createdAt` determines the year selector's range of available calendar years

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can view a full year of AI activity at a glance — the heatmap grid renders correctly for any selected period with accurate day-level job counts
- **SC-002**: The projects page loads with the heatmap visible on first render — no spinner or empty state flash before data appears
- **SC-003**: Shared URLs with filter parameters reproduce the exact same heatmap view for the same user in a different browser session
- **SC-004**: The "shipped" counter matches the actual count of tickets with completed `ship` jobs — no false positives from stage-only transitions
- **SC-005**: Agent filtering correctly isolates activity by effective agent — tickets inheriting their project's default agent are included when that agent is selected
- **SC-006**: On mobile devices, the heatmap is fully navigable via horizontal scroll with day-of-week labels remaining visible at all times
- **SC-007**: Tooltip cost data is never misleading — missing costs are omitted rather than displayed as zero
- **SC-008**: The heatmap is readable and visually coherent on the dark theme using the aurora violet color scale
