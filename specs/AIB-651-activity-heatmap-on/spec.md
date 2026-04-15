# Feature Specification: Activity Heatmap on Projects Page

**Feature Branch**: `AIB-651-activity-heatmap-on`
**Created**: 2026-04-15
**Status**: Draft
**Ticket**: AIB-651
**Input**: User description: "Add a GitHub-style contribution heatmap on the projects page displaying AI activity across all user projects over the past year"

## Auto-Resolved Decisions

- **Decision**: Color intensity scale thresholds — how to map job counts to the 5-level violet gradient
- **Policy Applied**: CONSERVATIVE (AUTO fallback — low confidence, absScore=1)
- **Confidence**: Low (0.3) — no strong risk/compliance signals; neutral UI feature
- **Fallback Triggered?**: Yes — AUTO recommended CONSERVATIVE due to confidence < 0.5
- **Trade-offs**:
  1. Quartile-based bucketing (0, 1-25th, 25-50th, 50-75th, 75th+) adapts to user's actual data distribution, avoiding empty or saturated scales
  2. Fixed thresholds would be simpler but could render poorly for users with very few or very many daily jobs
- **Reviewer Notes**: Confirm quartile approach produces visually distinct gradients; if user has very sparse data (e.g., 1 job/day max), the scale may collapse — verify empty state triggers correctly

---

- **Decision**: Heatmap data refresh interval
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Using existing 15-second analytics polling interval keeps consistency with the rest of the dashboard
  2. Heatmap data is historical and changes infrequently — a longer interval (e.g., 60s) would reduce server load but diverge from established patterns
- **Reviewer Notes**: 15s is conservative for data freshness; could be relaxed to 30-60s in a future optimization pass without user-visible impact

---

- **Decision**: Desktop cell size for heatmap grid
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. ~14px cells with 2px gap matches GitHub's proven heatmap density — fits a full year comfortably at typical viewport widths
  2. Larger cells improve accessibility but may require horizontal scroll on smaller desktops
- **Reviewer Notes**: Verify cell size renders at least 52 columns (weeks) without horizontal scroll at 1280px viewport width

---

- **Decision**: Tooltip positioning and behavior on desktop
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Tooltip appears above the hovered cell by default, repositioning to below when near the top edge — standard accessible pattern
  2. Alternative: fixed-position tooltip panel would avoid repositioning but breaks spatial association with the cell
- **Reviewer Notes**: Ensure tooltip does not clip outside the viewport at grid edges

---

- **Decision**: "Last 12 months" rolling window boundary calculation
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Rolling 12 months = today minus 364 days (52 full weeks), aligned to start on Sunday — ensures the grid is always exactly 53 columns, matching GitHub behavior
  2. Calendar-month-based rolling (e.g., April 2025 – April 2026) would produce variable column counts
- **Reviewer Notes**: Verify the rolling window starts on a Sunday and the grid column count is consistent regardless of the current day of week

## User Scenarios & Testing

### User Story 1 — View Activity Heatmap (Priority: P1)

A user navigates to the Projects page and sees, below their project cards, a full-width heatmap showing their AI activity over the past year. The grid uses a violet color scale to indicate the number of jobs run each day. Month labels appear along the top and day-of-week labels on the left. A summary line reads "X jobs · Y tickets shipped in the last year." An intensity legend at the bottom right shows the color scale from "Less" to "More."

**Why this priority**: This is the core visual deliverable. Without it, no other feature (filters, tooltips, year selection) has a surface to attach to.

**Independent Test**: Navigate to /projects as a user with existing job data. Verify the heatmap grid renders with correct day/week alignment, violet cells of varying intensity, month labels, day labels, summary counter, and legend.

**Acceptance Scenarios**:

1. **Given** a user with job data spanning the past 6 months, **When** they visit /projects, **Then** they see a heatmap grid below the project cards with cells colored by job count, month labels along the top, day-of-week labels on the left, a summary counter showing total jobs and shipped tickets, and an intensity legend.
2. **Given** the current date is mid-week, **When** the "Last 12 months" view is displayed, **Then** the grid starts on a Sunday 52 weeks ago and the top-left and bottom-right corners are "chipped" (missing cells) to match the actual date boundaries.
3. **Given** a user with zero jobs in the selected period, **When** they view the heatmap, **Then** the grid is replaced with the message "No activity to show yet — your AI work will appear here" while the legend and any filters remain visible.
4. **Given** the user visits /projects, **When** the page loads, **Then** the heatmap renders immediately with data (no loading spinner flash) and background refreshes happen silently.

---

### User Story 2 — Hover/Tap Tooltip (Priority: P2)

A user hovers over (desktop) or taps (mobile) a heatmap cell to see a tooltip with the formatted date, the number of jobs run that day, the total cost (if available), and which tickets were shipped that day.

**Why this priority**: Tooltips transform the heatmap from a visual overview into an actionable data explorer — high user value with moderate complexity.

**Independent Test**: Hover over a cell with job data and verify tooltip content; hover over a cell with a shipped ticket and verify it appears; hover over a cell where some jobs have no recorded cost and verify cost is omitted gracefully.

**Acceptance Scenarios**:

1. **Given** a heatmap cell representing a day with 5 jobs and a total cost of $1.23, **When** the user hovers over it, **Then** a tooltip shows the formatted date, "5 jobs", "$1.23", and lists any tickets shipped that day.
2. **Given** a day with 3 jobs where none have a recorded cost, **When** the user hovers over the cell, **Then** the tooltip shows "3 jobs" and omits the cost line entirely (no "$0" or "$NaN").
3. **Given** a day with 2 jobs where only 1 has a recorded cost of $0.50, **When** the user hovers, **Then** the tooltip shows "2 jobs" and "$0.50" (summing only the jobs with recorded costs).
4. **Given** a mobile user, **When** they tap a heatmap cell, **Then** the tooltip appears; **When** they tap outside the tooltip, **Then** it dismisses.

---

### User Story 3 — Year Selector (Priority: P2)

A user selects a specific calendar year or the rolling "Last 12 months" view from a dropdown in the heatmap header. The grid, summary counter, and tooltip data all update to reflect the selected period.

**Why this priority**: Enables historical exploration — essential for long-term users, but the default "Last 12 months" view covers most needs.

**Independent Test**: Select a past calendar year and verify grid boundaries match Jan 1 – Dec 31 of that year with correct chipped corners.

**Acceptance Scenarios**:

1. **Given** a user whose account was created in 2024, **When** they open the year selector, **Then** the options are: "Last 12 months" (selected by default), "2024", "2025", "2026".
2. **Given** a user whose account was created this year (2026), **When** they view the heatmap, **Then** the year selector is either hidden or disabled, showing only "Last 12 months."
3. **Given** the user selects "2025", **When** the heatmap updates, **Then** the grid shows Jan 1 – Dec 31, 2025, with chipped corners matching the days of the week for those dates, and the summary counter reflects only 2025 data.

---

### User Story 4 — Agent Filter (Priority: P3)

A user filters the heatmap by a specific AI agent. The filter options are built dynamically from the agents actually present in the user's job data, including effective agent resolution (tickets with no explicit agent inherit from their project's default). The filter is hidden when 0 or 1 agents exist.

**Why this priority**: Only relevant to users who use multiple agents — a minority but important power-user feature.

**Independent Test**: As a user with jobs across two different agents, verify the filter appears with "All" plus both agent options; select one agent and verify heatmap updates to show only that agent's data.

**Acceptance Scenarios**:

1. **Given** a user whose jobs span two agents (CLAUDE and GEMINI), **When** they view the heatmap, **Then** an agent filter dropdown appears with "All" (selected), "Claude", and "Gemini".
2. **Given** a user with all jobs on one agent, **When** they view the heatmap, **Then** the agent filter is hidden entirely.
3. **Given** a ticket with no explicit agent on a project whose default agent is CLAUDE, **When** the user filters by CLAUDE, **Then** that ticket's jobs are included in the heatmap.
4. **Given** the user selects "Gemini" from the agent filter, **When** the heatmap updates, **Then** the grid still shows the full period (boundaries unchanged) but cell intensities reflect only Gemini jobs.
5. **Given** the user selects the Gemini filter, **When** they copy the page URL and open it in a new tab, **Then** the heatmap loads with the Gemini filter pre-selected.

---

### User Story 5 — Mobile Horizontal Scroll (Priority: P3)

A mobile user views the heatmap and can scroll the grid horizontally. Day-of-week labels remain pinned on the left edge during scroll. Cells never shrink below a tappable size.

**Why this priority**: Mobile usability is important but the primary audience for a year-long heatmap is desktop users.

**Independent Test**: On a mobile viewport (375px), verify the heatmap grid scrolls horizontally, day labels stay fixed, and cells are at least 44x44px tap target (or grouped to meet tap target).

**Acceptance Scenarios**:

1. **Given** a mobile viewport, **When** the heatmap renders, **Then** the grid is horizontally scrollable and cells are at least a tappable size (minimum ~11px with adequate spacing, matching GitHub mobile behavior).
2. **Given** the user scrolls the heatmap grid horizontally, **When** they scroll right, **Then** the day-of-week labels (Mon, Wed, Fri or similar) remain pinned on the left edge.

---

### User Story 6 — Page Layout Adjustment (Priority: P1)

The projects page currently constrains the project cards grid with a max-height and overflow scroll. The heatmap is placed below the project cards, and the page scrolls naturally to reveal both sections.

**Why this priority**: Without this layout change, the heatmap may be hidden below the fold or unreachable.

**Independent Test**: Navigate to /projects with multiple projects and verify the page scrolls naturally to show both the project cards and the heatmap below.

**Acceptance Scenarios**:

1. **Given** a user with 10+ projects, **When** they visit /projects, **Then** the page scrolls naturally and the heatmap is visible below the project cards without being trapped inside the cards' scroll container.
2. **Given** a user with 1 project, **When** they visit /projects, **Then** both the project card and heatmap are visible without unnecessary whitespace.

### Edge Cases

- What happens when a user has jobs but all in a single day? The heatmap should still render the full period grid with one colored cell.
- What happens when the user's account was created mid-year and they select that year? The grid shows the full calendar year but cells before their account creation are naturally empty (zero jobs).
- What happens when a job is in RUNNING status? Only COMPLETED jobs count toward the heatmap intensity.
- What happens when multiple ship jobs exist for the same ticket on the same day? The ticket is counted once for the "shipped" counter on that day.
- What happens when a ticket reaches SHIP stage without a completed ship job? It does NOT count as shipped.
- What happens when filters reduce all visible data to zero? The empty state message appears ("No activity to show yet...") while filters and legend remain visible.
- What happens with timezone differences? Job dates are based on the `completedAt` timestamp, displayed in the user's local timezone.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a GitHub-style contribution heatmap below the project cards on the /projects page, spanning the full content width.
- **FR-002**: The heatmap grid MUST have 7 rows (one per day of week) with columns corresponding to weeks in the selected period.
- **FR-003**: Cell color intensity MUST be based on the count of COMPLETED jobs for that day, using a violet gradient scale consistent with the project's aurora theme.
- **FR-004**: The grid MUST render "chipped corners" — omitting cells before the first day and after the last day of the selected period when those days don't align with Sunday (top) or Saturday (bottom).
- **FR-005**: Month labels MUST appear along the top of the grid and day-of-week labels MUST appear on the left side.
- **FR-006**: An intensity legend MUST appear at the bottom right showing the color scale from "Less" to "More."
- **FR-007**: A summary counter MUST display "X jobs · Y tickets shipped in the last year" (or selected period) in the heatmap header.
- **FR-008**: A ticket MUST only count as "shipped" on the day its `ship` command job completed successfully (COMPLETED status). Stage changes to SHIP without a completed ship job MUST NOT count.
- **FR-009**: System MUST provide a year selector dropdown with "Last 12 months" as the default option, plus each calendar year from the user's account creation year to the current year.
- **FR-010**: If the user created their account in the current year, the year selector MUST be hidden or disabled (only "Last 12 months" available).
- **FR-011**: The heatmap MUST render immediately on page load using server-provided initial data, with background refreshes updating silently without blanking the display.
- **FR-012**: Hovering (desktop) or tapping (mobile) a cell MUST show a tooltip containing: the formatted date, the count of jobs, total cost (only if at least one job has a recorded cost), and a list of tickets shipped that day.
- **FR-013**: The tooltip MUST never display "$NaN", "$0", or any cost value when no jobs that day have a recorded cost.
- **FR-014**: On mobile, tapping outside the tooltip MUST dismiss it.
- **FR-015**: An agent filter MUST be built dynamically from the distinct agents present in the user's job data, following effective agent resolution (a ticket with no explicit agent inherits from its project's default agent).
- **FR-016**: The agent filter MUST include an "All" option selected by default and MUST be hidden entirely when 0 or 1 distinct agents exist in the data.
- **FR-017**: When an agent filter is active, the heatmap grid boundaries MUST remain unchanged (full period displayed); only cell intensities change.
- **FR-018**: Active filters (agent, year) MUST be reflected in URL query parameters so that the view is shareable and survives page refresh.
- **FR-019**: On mobile viewports, the heatmap grid MUST scroll horizontally with day-of-week labels pinned (sticky) on the left edge.
- **FR-020**: Heatmap cells MUST NOT shrink below a tappable size on mobile.
- **FR-021**: When the selected period has zero activity (after applying any filters), the grid MUST be replaced with a centered message: "No activity to show yet — your AI work will appear here." The legend and filters MUST remain visible.
- **FR-022**: The existing scroll constraint on the project cards grid MUST be adjusted so the page scrolls naturally to reveal the heatmap below.
- **FR-023**: No new database models MUST be created — the feature MUST use existing Job and Ticket data exclusively.

### Key Entities

- **Job**: The primary data source for heatmap cell intensity. Key attributes: completedAt (date bucketing), status (only COMPLETED counted), command (ship jobs for shipped counter), costUsd (tooltip cost display), ticketId (linking to tickets), projectId (cross-project aggregation).
- **Ticket**: Used for shipped-ticket counting and agent resolution. Key attributes: agent (explicit agent or null), stage, projectId.
- **Project**: Provides default agent for effective agent resolution. Key attributes: defaultAgent, userId (ownership for cross-project data access).
- **User**: Provides account creation date for year selector range. Key attribute: createdAt.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can see their activity heatmap within 1 second of the /projects page loading, with no loading spinner or content flash.
- **SC-002**: The heatmap accurately reflects all completed job data — cell intensity values match actual daily job counts for any selected period.
- **SC-003**: Shipped ticket count matches the number of tickets with a successfully completed `ship` job in the selected period, with zero false positives from stage-only transitions.
- **SC-004**: A URL with filter parameters, when shared and opened in a new browser, reproduces the exact same heatmap view (same year, same agent filter) 100% of the time.
- **SC-005**: On mobile devices (375px viewport and above), all heatmap cells are tappable and the grid scrolls horizontally with day labels staying visible.
- **SC-006**: The tooltip displays accurate data for every cell — correct date, job count, cost (when available), and shipped tickets — with no "$NaN" or erroneous cost values.
- **SC-007**: The agent filter correctly includes tickets using effective agent resolution — tickets with no explicit agent on a project with a matching default agent are always included when that agent is selected.
