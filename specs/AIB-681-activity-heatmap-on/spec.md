# Feature Specification: Activity Heatmap on Projects Page

**Feature Branch**: `AIB-681-activity-heatmap-on`
**Created**: 2026-04-18
**Status**: Draft
**Input**: User description: "Add a GitHub-style contribution heatmap on the projects page, below the project cards grid. The heatmap displays AI activity across all user projects over the past year."

## Auto-Resolved Decisions

### Decision 1: Heatmap Cell Color Scale

- **Decision**: Use violet gradient from the project's aurora theme (`--primary-violet` / `--ctp-mauve`) for cell intensity, with 5 discrete levels: empty, low, medium, high, maximum. This aligns with the existing aurora utility classes and ensures dark-theme readability.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: +1; only "user-facing UI" signal detected, absScore < 3)
- **Fallback Triggered?**: Yes — low confidence triggered CONSERVATIVE fallback per scoring rules
- **Trade-offs**:
  1. A 5-level scale limits granularity but matches GitHub's proven UX pattern and avoids subtle color differences that are hard to distinguish on dark backgrounds
  2. Locking to violet means no per-project color customization; keeps implementation simpler and visually consistent
- **Reviewer Notes**: Verify the 5-level violet scale passes WCAG AA 4.5:1 contrast on the dark theme background. Confirm the empty-cell color is distinguishable from the page background.

### Decision 2: Tooltip Cost Display When Some Jobs Lack Cost Data

- **Decision**: Show total cost only for jobs that have a recorded cost. If all jobs on a given day lack cost data, omit the cost line entirely from the tooltip. Never display "$0" or "$NaN" for missing data. Format: "X jobs" or "X jobs · $Y.YY" when cost is available.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: +1)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Users might wonder why cost is sometimes absent; the approach is transparent and avoids misleading zeros
  2. No extra UI complexity (no "partial cost" disclaimers needed)
- **Reviewer Notes**: Confirm the tooltip layout doesn't shift awkwardly when the cost line toggles between present and absent.

### Decision 3: Year Selector Behavior for New Users

- **Decision**: When a user's account was created in the current year, show only "Last 12 months" as the default (and only) option. The dropdown is hidden or rendered as a static label — no disabled state that looks interactive but isn't.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: +1)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Hiding the dropdown entirely avoids dead UI, but means the user doesn't learn about the year-selection feature until their second calendar year
  2. A disabled dropdown would hint at future functionality but violates the "no dead controls" principle
- **Reviewer Notes**: Confirm the header layout remains balanced when the dropdown is absent.

### Decision 4: Agent Filter Visibility Threshold

- **Decision**: Hide the agent filter entirely when 0 or 1 distinct agents exist across the user's data (combining explicit ticket agents and effective project default agents). The "distinct" count considers effective agent resolution — a ticket with no explicit agent inherits its project's default.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: +1)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Hiding the filter when only one agent exists keeps the UI clean but means users don't see the filter until they use a second agent
  2. Always showing it would be discoverable but wastes space for most users
- **Reviewer Notes**: Verify the filter re-appears immediately when a second agent appears in the data (no cache staling).

### Decision 5: Mobile Tooltip Interaction

- **Decision**: On touch devices, tap a cell to show the tooltip; tap outside the tooltip or on another cell to dismiss it. Only one tooltip visible at a time.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: +1)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Tap-to-show is the standard mobile pattern for hover-equivalent interactions
  2. Long-press was considered but rejected because it conflicts with text selection and feels non-standard for data visualization
- **Reviewer Notes**: Ensure the tooltip doesn't obscure the cell being inspected and can be dismissed reliably.

### Decision 6: URL Filter Encoding

- **Decision**: Encode active filters as URL query parameters (`?year=2025&agent=CLAUDE`). Default values ("Last 12 months", "All agents") produce no query params — a clean URL. Filters survive page refresh and are shareable.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: +1)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Clean URLs for default state improve shareability
  2. Changing filters updates the URL without a page reload (client-side state sync)
- **Reviewer Notes**: Validate that shared URLs with filters render the same view for other users who have access to the same projects.

## User Scenarios & Testing

### User Story 1 - View Activity Heatmap (Priority: P1)

A user navigates to the projects page and sees a GitHub-style heatmap below their project cards showing AI job activity across all their projects over the past year. Each cell's intensity represents the number of jobs completed on that day. The header displays a summary counter showing total jobs and tickets shipped.

**Why this priority**: The core heatmap visualization is the foundational feature — without it, no other stories deliver value. Users get an immediate visual overview of their AI development activity.

**Independent Test**: Navigate to `/projects` as a user with job history. The heatmap grid renders below project cards with correct cell intensities based on job counts. The summary counter matches actual data.

**Acceptance Scenarios**:

1. **Given** a user with jobs spread across multiple days, **When** they visit `/projects`, **Then** the heatmap grid displays with 7 rows (days of week), month labels on top, day-of-week labels on the left, and cell colors reflecting job count intensity on a violet scale
2. **Given** a period starting on a non-Sunday (e.g., 2024 starts on Monday), **When** the heatmap renders for that year, **Then** cells before the first day are absent (GitHub-style "chipped" top-left corner), and cells after the last day of the period are also absent if the period doesn't end on Saturday
3. **Given** the current date, **When** the default view loads, **Then** the heatmap shows "Last 12 months" (rolling window from today minus 365 days to today)
4. **Given** the heatmap is rendered, **When** the user views the bottom-right corner, **Then** an intensity legend is displayed showing the scale from "Less" to "More" with representative color swatches

---

### User Story 2 - Tooltip with Day Details (Priority: P1)

When a user hovers over (or taps on mobile) a heatmap cell, a tooltip appears showing the tickets shipped that day, total job count, total cost (if available), and the formatted date.

**Why this priority**: The tooltip transforms the heatmap from a pretty visual into an actionable data exploration tool. Users need to drill into specific days to understand what happened.

**Independent Test**: Hover over a cell with activity; the tooltip appears with accurate data. Hover over a cell with no activity; the tooltip shows "No activity" with the date. Tap on mobile and verify dismiss behavior.

**Acceptance Scenarios**:

1. **Given** a day with 5 jobs (3 with cost data totaling $2.50, 2 without cost data) and 1 shipped ticket, **When** the user hovers over that cell, **Then** the tooltip shows "1 ticket shipped", "5 jobs · $2.50", and the formatted date
2. **Given** a day with 3 jobs and none have cost data, **When** the user hovers over that cell, **Then** the tooltip shows "3 jobs" with no cost line — no "$0" or "$NaN"
3. **Given** a mobile device, **When** the user taps a cell, **Then** the tooltip appears; **When** they tap outside or on another cell, **Then** the tooltip dismisses
4. **Given** a day with no activity, **When** the user hovers over the empty cell, **Then** the tooltip shows "No activity" and the formatted date

---

### User Story 3 - Year Selector (Priority: P2)

The heatmap header includes a year selector dropdown that defaults to "Last 12 months" (rolling) and offers each calendar year from the user's account creation year to the current year.

**Why this priority**: Enables historical exploration beyond the default rolling window. Dependent on the core heatmap (P1) being functional.

**Independent Test**: Click the year selector; it shows the correct list of years. Select a specific year; the heatmap grid updates to show that calendar year with correct boundaries.

**Acceptance Scenarios**:

1. **Given** a user who created their account in 2024 and the current year is 2026, **When** they open the year selector, **Then** the options are: "Last 12 months" (selected by default), "2024", "2025", "2026"
2. **Given** a user who created their account this year (2026), **When** they view the heatmap header, **Then** only "Last 12 months" is shown with no dropdown
3. **Given** the user selects "2025", **When** the heatmap updates, **Then** the grid shows January 1, 2025 through December 31, 2025, with correct chipped corners for the starting and ending weekdays
4. **Given** the user selects a year, **When** the heatmap updates, **Then** the summary counter updates to reflect jobs and tickets shipped within that year only

---

### User Story 4 - Agent Filter (Priority: P2)

An agent filter allows users to view heatmap activity for a specific AI agent, using the same effective agent resolution pattern as the analytics dashboard.

**Why this priority**: Adds data slicing capability. Dependent on the core heatmap (P1) and is only visible when the user has used multiple agents.

**Independent Test**: As a user with jobs from CLAUDE and CODEX agents, verify the agent filter appears. Select "CLAUDE"; verify the heatmap updates to show only CLAUDE activity (including tickets that inherit CLAUDE from their project's default agent).

**Acceptance Scenarios**:

1. **Given** a user whose jobs span CLAUDE and CODEX agents, **When** they view the heatmap, **Then** an agent filter appears with options: "All" (selected), "Claude", "Codex"
2. **Given** a user whose jobs all use a single agent, **When** they view the heatmap, **Then** no agent filter is displayed
3. **Given** the agent filter set to "Claude", **When** a ticket has no explicit agent but its project's default agent is CLAUDE, **Then** that ticket's jobs are included in the filtered view
4. **Given** the agent filter set to "Codex", **When** the heatmap updates, **Then** the grid boundaries remain unchanged (full period) but cell intensities reflect only Codex-agent jobs
5. **Given** the user selects an agent, **When** the URL updates, **Then** the `agent` query parameter reflects the selection and the view survives a page refresh

---

### User Story 5 - URL-Shareable Filters (Priority: P2)

Active filter selections (year, agent) are reflected in the URL as query parameters. Sharing a URL or refreshing the page reproduces the exact same filtered view.

**Why this priority**: Enables collaboration — users can share specific views with team members. Low effort given the filter infrastructure from P2 stories.

**Independent Test**: Set year to "2025" and agent to "CLAUDE"; copy the URL; open it in a new tab; verify the same filters are applied and the heatmap matches.

**Acceptance Scenarios**:

1. **Given** the user sets year to "2025" and agent to "CLAUDE", **When** they inspect the URL, **Then** it contains `?year=2025&agent=CLAUDE`
2. **Given** default filters (Last 12 months, All agents), **When** the user inspects the URL, **Then** no filter query params are present
3. **Given** a URL with `?year=2024&agent=CODEX`, **When** another user opens it, **Then** the heatmap shows 2024 data filtered to Codex-agent jobs

---

### User Story 6 - Empty State (Priority: P2)

When the selected period has zero activity, the heatmap grid is replaced with a centered message while the legend and filters remain visible.

**Why this priority**: Essential for new users and historical periods with no data. Prevents confusion from an empty grid.

**Independent Test**: As a new user with no jobs, visit `/projects`. The empty state message appears. Filters and legend are still visible.

**Acceptance Scenarios**:

1. **Given** a period with zero jobs, **When** the heatmap renders, **Then** a centered message reads "No activity to show yet — your AI work will appear here" in place of the grid
2. **Given** the empty state is shown, **When** the user looks at the header area, **Then** the counter shows "0 jobs · 0 tickets shipped" and the year selector and agent filter (if applicable) remain interactive
3. **Given** the empty state for "Last 12 months", **When** the user switches to a year with activity, **Then** the grid replaces the empty state message

---

### User Story 7 - Mobile Horizontal Scroll (Priority: P3)

On mobile devices, the heatmap grid scrolls horizontally while day-of-week labels stay pinned on the left. Cells never shrink below a tappable size.

**Why this priority**: Mobile usability polish. The heatmap must be usable on smaller screens but this is an enhancement over the core desktop experience.

**Independent Test**: View `/projects` on a mobile viewport. The grid scrolls horizontally. Day-of-week labels remain visible during scroll. Cells are large enough to tap.

**Acceptance Scenarios**:

1. **Given** a mobile viewport, **When** the heatmap renders, **Then** the grid scrolls horizontally and cells maintain a minimum tappable size (at least 44x44 CSS pixels touch target area)
2. **Given** horizontal scrolling, **When** the user scrolls the grid, **Then** the day-of-week labels on the left remain pinned/sticky
3. **Given** a mobile viewport, **When** the user taps a cell, **Then** the tooltip appears correctly positioned within the viewport

---

### User Story 8 - No Loading Flash (Priority: P3)

The heatmap renders with data immediately on first page load (server-rendered initial data). Background refetches update silently without blanking the UI.

**Why this priority**: Polish that prevents jarring loading states. Dependent on the data layer and core rendering being complete.

**Independent Test**: Navigate to `/projects`. The heatmap appears with data immediately — no spinner or skeleton flash. Subsequent refetches update cell data without visual disruption.

**Acceptance Scenarios**:

1. **Given** a user navigates to `/projects`, **When** the page loads, **Then** the heatmap is visible with data immediately (no loading spinner or skeleton for the initial render)
2. **Given** the heatmap is displayed, **When** a background refetch completes with updated data, **Then** the cells update silently without any visual blank or flicker

---

### Edge Cases

- What happens when a user has projects but no jobs at all? → Empty state message is shown for all periods
- What happens when a job is RUNNING (not yet completed) on a given day? → It counts toward the job count for that day based on its `createdAt` date, since the heatmap tracks all activity (not just completions)
- What happens when a "ship" job exists but has FAILED status? → It does NOT count toward the "tickets shipped" counter; only COMPLETED ship jobs count
- What happens when filters produce zero results but the overall period has activity? → Show the empty state message; the grid boundaries remain for the full period
- What happens when the user's account creation year is far in the past (e.g., 2020)? → The year selector shows all years from 2020 to current; no performance concern since only one year's data loads at a time
- What happens when daylight saving time causes a date boundary shift? → Dates are normalized to UTC to avoid double-counting or skipping days

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a heatmap grid below the project cards on the `/projects` page, spanning the full width of the content area
- **FR-002**: System MUST render the heatmap grid with 7 rows (one per day of week, Sunday through Saturday) and columns matching the number of weeks in the selected period
- **FR-003**: System MUST show month labels along the top of the grid and day-of-week labels along the left side
- **FR-004**: System MUST calculate cell intensity based on the total job count for each day across all of the user's projects
- **FR-005**: System MUST use a violet color gradient with 5 discrete intensity levels (empty, low, medium, high, maximum) using the project's aurora theme tokens
- **FR-006**: System MUST render "chipped corners" — omitting cells before the first day and after the last day of the selected period when those days don't fall on Sunday/Saturday respectively
- **FR-007**: System MUST display an intensity legend at the bottom-right of the grid showing the scale from "Less" to "More"
- **FR-008**: System MUST show a summary counter in the header formatted as "X jobs · Y tickets shipped in the last year" (or appropriate period label)
- **FR-009**: A ticket MUST only count as "shipped" on the day its `ship` workflow job completed with COMPLETED status — stage changes alone do not count
- **FR-010**: System MUST provide a year selector dropdown with "Last 12 months" as the default option and additional options for each calendar year from the user's account creation year to the current year
- **FR-011**: System MUST hide the year selector (or render it as a static label) when the user's account was created in the current year
- **FR-012**: System MUST display a tooltip on hover (desktop) or tap (mobile) showing: tickets shipped that day, job count, total cost (only when cost data exists), and the formatted date
- **FR-013**: System MUST never display "$0" or "$NaN" for jobs with missing cost data — the cost line is omitted entirely when no cost data is available for that day
- **FR-014**: System MUST provide an agent filter with an "All" option (default) and options for each distinct agent present in the user's job data
- **FR-015**: System MUST hide the agent filter when 0 or 1 distinct agents exist in the user's data
- **FR-016**: The agent filter MUST honor effective agent resolution: a ticket with no explicit agent on a project whose default agent matches the filter value must be included
- **FR-017**: Active filter selections (year, agent) MUST be reflected in URL query parameters and must survive page refresh
- **FR-018**: System MUST show a centered message "No activity to show yet — your AI work will appear here" when the selected period has zero activity, while keeping the legend and filters visible
- **FR-019**: System MUST render the heatmap with server-provided initial data to avoid a loading flash on first render
- **FR-020**: On mobile devices, the grid MUST scroll horizontally with day-of-week labels pinned on the left, and cells MUST NOT shrink below a tappable size
- **FR-021**: The page layout MUST allow natural scrolling to reveal the heatmap below the project cards grid (adjusting any existing scroll constraints on the project grid)

### Key Entities

- **Heatmap Cell**: Represents a single day; attributes include date, job count, shipped ticket count, total cost (nullable), and computed intensity level (0–4)
- **Heatmap Period**: The selected time range — either a rolling 12-month window or a specific calendar year; defines the grid boundaries (start date, end date, number of weeks)
- **Shipped Ticket**: A ticket whose `ship` command job reached COMPLETED status; counted on the day the job completed (via `completedAt` timestamp)
- **Effective Agent**: The resolved agent for a ticket — the ticket's explicit `agent` field if set, otherwise the parent project's `defaultAgent`

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can view their activity heatmap immediately upon loading the projects page — no loading delay or spinner visible for the initial render
- **SC-002**: All heatmap cells accurately reflect the job count for their respective dates, with zero discrepancy between tooltip data and underlying records
- **SC-003**: The "tickets shipped" counter matches the count of tickets with completed `ship` jobs within the selected period, with 100% accuracy
- **SC-004**: Shared URLs with filter parameters reproduce the identical heatmap view for any user with access to the same data
- **SC-005**: On mobile viewports, users can scroll the full heatmap grid horizontally while day-of-week labels remain visible, and every cell is tappable without precision issues
- **SC-006**: The heatmap renders correctly for all valid periods — from a single partial week to a full calendar year — with appropriate chipped corners and no visual artifacts
- **SC-007**: Users with no activity see a clear, friendly empty state message that sets expectations for future use

### Assumptions

- The existing Job and Ticket models contain sufficient data to compute heatmap values — no new database models or migrations are needed
- The `completedAt` field on the Job model reliably records the timestamp when ship jobs finish
- The effective agent resolution pattern (ticket agent → project default agent) is consistent with the existing analytics dashboard implementation
- The projects page currently has a scroll constraint that may need to be relaxed to accommodate the heatmap section below the project cards
- UTC date normalization is used to avoid timezone-related edge cases with day boundaries
