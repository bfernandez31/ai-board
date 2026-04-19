# Feature Specification: Activity Heatmap on Projects Page

**Feature Branch**: `AIB-690-activity-heatmap-on`
**Created**: 2026-04-19
**Status**: Draft
**Input**: User description: "Add a GitHub-style contribution heatmap on the projects page, below the project cards grid. The heatmap displays AI activity across all user projects over the past year."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Use 5 intensity buckets for cell coloring (matching the "Less □□■■■ More" legend with five squares).
  - **Policy Applied**: AUTO (fallback to CONSERVATIVE)
  - **Confidence**: Medium (0.6) — legend directly encodes five levels.
  - **Fallback Triggered?**: No — the legend makes the count explicit.
  - **Trade-offs**:
    1. Five buckets provide enough granularity to distinguish slow vs. busy days without overwhelming the eye.
    2. Requires choosing bucket thresholds; handled by dynamic quantile computation across the visible period so scale adapts to each user's volume.
  - **Reviewer Notes**: Confirm the quantile thresholds (e.g., 25/50/75/95 percentiles of non-zero days) render legibly on low-activity accounts; ensure bucket 1 is never empty when any jobs exist that day.

- **Decision**: Background refresh cadence for the heatmap data matches the analytics dashboard (15-second polling, silent refetches).
  - **Policy Applied**: AUTO (CONSERVATIVE)
  - **Confidence**: High (0.9) — analytics polling cadence is an established project convention and the ticket calls out "background refetches update silently".
  - **Fallback Triggered?**: No.
  - **Trade-offs**:
    1. Users see near-live updates without manual refresh.
    2. Negligible cost vs. the existing analytics endpoint polling pattern.
  - **Reviewer Notes**: Validate that the shared pattern does not double-poll when the analytics dashboard is also visible elsewhere.

- **Decision**: URL query parameter names are `heatmapPeriod` (values: `last12months` or a four-digit year like `2025`) and `heatmapAgent` (values: `all` or an agent identifier such as `CLAUDE`).
  - **Policy Applied**: AUTO (CONSERVATIVE)
  - **Confidence**: Medium (0.6) — ticket requires URL-shareable filters but does not name parameters; namespaced names avoid collisions with other `/projects` page state.
  - **Fallback Triggered?**: No.
  - **Trade-offs**:
    1. Namespaced names prevent clashes if other widgets add filters later.
    2. Slightly longer URLs than bare `period=` / `agent=`.
  - **Reviewer Notes**: Ensure both params are absent when defaults are active (keep URL clean on fresh loads).

- **Decision**: Minimum cell size on mobile is 14 px (plus 2 px gap) with horizontal scroll; below that, cells are not shrunk further and the grid overflows.
  - **Policy Applied**: AUTO (CONSERVATIVE)
  - **Confidence**: Medium (0.6) — ticket requires "tappable size" without a number; GitHub uses ~11 px cells but hover-only. Slightly larger cells keep tap targets comfortable.
  - **Fallback Triggered?**: No.
  - **Trade-offs**:
    1. Cells stay readable and tappable on narrow viewports.
    2. Users must scroll horizontally to see the full year.
  - **Reviewer Notes**: Validate that ~14 px provides an adequate tap target for tooltips on real devices; adjust upward if users miss targets.

- **Decision**: "Tickets shipped" count uses the count of **completed** `ship` jobs on that day (not distinct tickets), except the header counter which counts **distinct tickets** with at least one completed ship job in the period.
  - **Policy Applied**: AUTO (CONSERVATIVE)
  - **Confidence**: Medium (0.6) — ticket defines the event ("the day its `ship` job completed successfully") but not what happens when a ticket is re-shipped after rollback.
  - **Fallback Triggered?**: No.
  - **Trade-offs**:
    1. Daily tooltip shows ship-job completions — matches the "activity" theme (retries count as activity).
    2. Header dedupes by ticket — avoids overstating "tickets shipped in the last year".
  - **Reviewer Notes**: Confirm this split is intuitive when a ticket is shipped, rolled back, then re-shipped.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View AI Activity Across All Projects (Priority: P1)

As a signed-in user on the `/projects` page, I scroll past my project cards and immediately see a GitHub-style heatmap showing every day over the last 12 months colored by how much AI work happened that day across all of my projects combined. At a glance I can tell whether last Tuesday was busy, whether I went quiet over the holidays, and how this quarter compares to last.

**Why this priority**: This is the core value delivered — a single-screen portrait of the user's cumulative AI output. Without it, the feature has no reason to exist.

**Independent Test**: Sign in as a user with multiple projects containing jobs spread across the year, open `/projects`, scroll past the cards, and verify the heatmap renders a 7-row grid spanning ~53 columns with cells colored by job count. Cells with zero jobs appear empty/background-toned; cells with more jobs appear progressively more saturated in the violet scale.

**Acceptance Scenarios**:

1. **Given** a user with 300+ jobs spread across the last 12 months, **When** they open `/projects`, **Then** the heatmap appears below the project cards with no loading spinner flash, shows the full 12-month grid, and the cells visually encode job density.
2. **Given** a user whose year started on a Monday (e.g., viewing 2024), **When** they view the grid for that year, **Then** the top-left cell for Sunday is omitted (chipped corner) and the grid begins visually at Monday.
3. **Given** a user with zero jobs in the selected period, **When** the heatmap renders, **Then** the grid is replaced by the centered message "No activity to show yet — your AI work will appear here", while the legend and filters remain visible.

---

### User Story 2 - See What a Specific Day Contained (Priority: P1)

As a user who notices an unusually dark cell on the heatmap, I hover over it (on desktop) or tap it (on mobile) to see a tooltip summarizing that day: how many tickets I shipped, how many jobs ran, and what the total cost was.

**Why this priority**: The grid alone is ornamental without this drill-down. Being able to interrogate a specific day is what turns the heatmap from decoration into insight.

**Independent Test**: On a desktop, hover over any non-empty cell and verify the tooltip shows the formatted date, ship count, job count, and total cost. On mobile, tap the cell and verify the tooltip appears; tap outside to dismiss it.

**Acceptance Scenarios**:

1. **Given** a day with 4 jobs totaling $1.23 and 1 ticket shipped, **When** the user hovers that cell, **Then** the tooltip shows the formatted date, "1 ticket shipped", "4 jobs · $1.23".
2. **Given** a day where at least one of the jobs has no recorded cost, **When** the user hovers, **Then** the tooltip shows the job count but omits the cost line entirely (no "$NaN" or misleading "$0").
3. **Given** a user on a mobile device, **When** they tap a cell, **Then** the tooltip is shown pinned to that cell; **When** they tap anywhere outside, **Then** the tooltip dismisses.

---

### User Story 3 - Change the Time Window (Priority: P2)

As a user who wants to look at a specific calendar year (e.g., "what did I do in 2025?"), I use a year selector above the heatmap to switch from the default rolling 12-month view to a specific year. Only years in which my account existed appear in the list.

**Why this priority**: Adds analytical flexibility once the baseline view works. Not required for MVP value but highly requested for end-of-year retrospectives and cross-year comparisons.

**Independent Test**: Create an account in 2024, add jobs spanning 2024–2026, and verify the selector offers "Last 12 months" (default), 2026, 2025, and 2024. Switching selections updates the grid boundaries and re-renders the cells for the chosen period; the URL query parameter updates accordingly.

**Acceptance Scenarios**:

1. **Given** a user created in 2024 viewing `/projects` in 2026, **When** they open the year selector, **Then** they see "Last 12 months", 2026, 2025, 2024 (in that order).
2. **Given** a user created in 2026 viewing `/projects` in 2026, **When** the heatmap renders, **Then** no year dropdown is shown (or it is shown disabled) because "Last 12 months" is the only option.
3. **Given** a user selects "2025", **When** the grid renders, **Then** it spans from 2025-01-01 to 2025-12-31 with chipped corners reflecting which weekdays 2025 starts and ends on, and the URL updates to include `heatmapPeriod=2025`.

---

### User Story 4 - Filter by Agent (Priority: P2)

As a user who uses multiple AI agents (e.g., Claude and another), I filter the heatmap to a single agent to understand how my usage is split.

**Why this priority**: Valuable but conditional — only users with multiple agents benefit, and the filter is hidden when it would do nothing.

**Independent Test**: Seed a user with jobs on two different agents. Open `/projects` and verify an agent filter appears with "All" selected plus each distinct agent. Select a specific agent and verify the grid updates to show only that agent's activity; counts and tooltips reflect the filter. Copy the URL, open it in a new tab, and verify the same filtered view is reproduced.

**Acceptance Scenarios**:

1. **Given** a user with jobs on two agents across five projects (some projects have no explicit ticket agent and rely on `project.defaultAgent`), **When** they filter by a specific agent, **Then** jobs from tickets with that explicit agent **and** jobs from tickets inheriting that effective agent are both included.
2. **Given** a user with jobs on exactly one agent (or zero agents), **When** the heatmap loads, **Then** the agent filter is not rendered at all.
3. **Given** a filtered view, **When** the user copies the URL and opens it on another device or in an incognito window (after signing in), **Then** the same period and agent filter are applied.

---

### User Story 5 - Navigate and Scroll on Mobile (Priority: P3)

As a user on a phone, I can still view the full heatmap by scrolling horizontally within the grid. The day-of-week labels on the left remain visible as I scroll so I always know whether a cell is a Monday or a Thursday.

**Why this priority**: Polish for mobile — the feature must not be unusable on small screens, but it is acceptable for interaction to be slightly more deliberate than on desktop.

**Independent Test**: Open `/projects` on a phone viewport (~375 px wide). Confirm the heatmap overflows horizontally with a scrollbar, cells stay at a tappable size, and the day-of-week column stays pinned on the left as the rest of the grid scrolls.

**Acceptance Scenarios**:

1. **Given** a phone viewport, **When** the heatmap renders, **Then** cells maintain at least their minimum tappable size and the grid scrolls horizontally rather than wrapping or shrinking below that minimum.
2. **Given** horizontal scroll within the grid, **When** the user drags, **Then** the left-edge day labels remain visible (sticky) while the cells move beneath the month labels.

---

### Edge Cases

- **User with only one project** — heatmap still aggregates across that one project and renders the full period.
- **User with jobs only on a single day** — that cell renders in the deepest violet bucket; all others are empty; no special empty-state treatment.
- **Period straddles DST transitions** — each cell represents a local calendar day in the user's browser timezone; no duplicate or missing cells around the spring/fall DST boundaries.
- **Very old account (created >10 years ago)** — selector shows a long dropdown; no pagination, but rendered as a standard select to remain usable.
- **Account created mid-year** — "Last 12 months" is the default and always available; calendar years from the account-creation year onward appear. The account-creation year may be a partial year but is shown in full (pre-account cells simply have zero activity, which is correct).
- **Future-dated jobs (clock skew)** — cells dated after "today" render as empty cells in the violet scale; tooltips show `0 jobs` and no ship count.
- **Filter results in zero activity for the period** (e.g., user filters by an agent they only used last year but is viewing this year) — shows the same centered empty-state message as an unfiltered empty period.
- **Invalid query params in URL** (e.g., `heatmapPeriod=1999` for a user created in 2024, or `heatmapAgent=BOGUS`) — invalid values are ignored and defaults apply; the URL is silently corrected on next interaction.
- **Large volume outlier** (e.g., one day with 10× the typical volume) — bucket thresholds use quantiles so a single outlier does not flatten the rest of the scale into a single light bucket.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render an activity heatmap on the `/projects` page, positioned below the project cards grid, full-width.
- **FR-002**: System MUST render the grid as seven rows (days of the week) with columns spanning the selected period (one column per ISO week intersecting the period).
- **FR-003**: System MUST color each cell using a 5-level violet intensity scale derived from the aurora theme, where bucket 0 represents zero jobs and buckets 1–4 represent increasing non-zero job counts using quantile thresholds computed over the days in the selected period that have at least one job.
- **FR-004**: System MUST omit (not render) cells for weekdays that fall before the first day of the selected period or after the last day, producing the "chipped corner" effect on partial weeks at period boundaries.
- **FR-005**: System MUST display month labels along the top of the grid, aligned to the column in which each month begins.
- **FR-006**: System MUST display day-of-week labels along the left side of the grid (at minimum every other row to reduce clutter, consistent with the GitHub-style convention).
- **FR-007**: System MUST render a legend in the bottom-right of the heatmap showing five swatches from least to most intense, labeled "Less" on the left and "More" on the right.
- **FR-008**: System MUST, when the selected period has zero jobs (after any active filter is applied), replace the grid with a centered message "No activity to show yet — your AI work will appear here" while keeping the legend and filter controls visible.
- **FR-009**: System MUST display a header line above the grid in the form "X jobs · Y tickets shipped in the last year" (or "in 2025", etc., matching the selected period), where X is the total job count for the period and Y is the number of distinct tickets whose `ship` workflow job completed successfully within the period.
- **FR-010**: A ticket MUST only be counted as "shipped" when its `ship` workflow job reached a completed/successful terminal state. Stage changes to SHIP without a successful ship job MUST NOT increment the counter.
- **FR-011**: System MUST render a year selector above the heatmap whose options are: (a) "Last 12 months" (default), and (b) each calendar year from the user's account creation year through the current year, ordered from most recent to oldest after the default.
- **FR-012**: System MUST hide the year selector (or render it disabled) when the only available option is "Last 12 months" (i.e., the user was created in the current calendar year).
- **FR-013**: System MUST support an agent filter whose options are derived dynamically from the distinct agents present in the user's jobs, combining explicit `ticket.agent` values with the effective agent inherited from `project.defaultAgent`. An "All" option MUST be included and selected by default.
- **FR-014**: System MUST hide the agent filter entirely when fewer than two distinct agents are present across the user's data.
- **FR-015**: When filtering by a specific agent, system MUST include jobs from tickets with that explicit agent AND jobs from tickets with no explicit agent whose project's default agent matches the filter value (effective-agent resolution).
- **FR-016**: Period selection and agent filter state MUST be reflected in URL query parameters so that sharing the URL reproduces the same view. Defaults MUST NOT appear in the URL.
- **FR-017**: On cell hover (desktop) or tap (mobile), system MUST display a tooltip containing: the formatted date (human-readable), the count of tickets shipped that day (e.g., "2 tickets shipped"), and the job count plus total cost in the form "N jobs · $X.XX".
- **FR-018**: When any job contributing to a cell has no recorded cost, the tooltip MUST omit the cost portion entirely (showing "N jobs" on its own). The tooltip MUST NOT display "$NaN", "$0", or any fabricated cost value.
- **FR-019**: On mobile (touch devices), tapping a cell MUST show the tooltip and tapping outside the cell MUST dismiss it. Only one tooltip may be visible at a time.
- **FR-020**: System MUST render the heatmap immediately on first page load without a loading spinner flash, by providing initial data through server-side rendering. Subsequent background refetches MUST update the data silently without blanking the UI.
- **FR-021**: On viewports too narrow to display the full grid, the grid MUST scroll horizontally within its container. Cells MUST NOT be shrunk below their tappable minimum size, and weekday rows MUST NOT wrap to a second visual row.
- **FR-022**: During horizontal scroll on mobile, the day-of-week label column MUST remain pinned to the left edge of the container (sticky positioning) while the cells and month labels scroll underneath.
- **FR-023**: The grid MUST adjust the `/projects` page's existing scroll behavior so that the heatmap is reachable by natural page scroll, rather than being cut off by an internal scroll constraint on the project cards region.
- **FR-024**: The agent filter MUST NOT change the grid boundaries or the set of rendered cells; it only changes the job/ticket counts used for coloring and tooltips.
- **FR-025**: The heatmap data MUST be scoped to the signed-in user — including jobs from projects they own and projects they are a member of — matching the existing authorization model used elsewhere on the `/projects` page.
- **FR-026**: System MUST NOT introduce any new database models or persisted schemas; all data MUST be derived from existing `Job`, `Ticket`, `Project`, and `User` records.
- **FR-027**: All text rendered inside the heatmap (header, tooltip, legend, empty state) MUST meet WCAG AA 4.5:1 contrast against its background in both the default (dark) theme and any other themes the app supports.

### Key Entities *(include if feature involves data)*

- **Daily Activity Cell**: A derived, non-persisted view of one calendar day for the signed-in user. Attributes: date (local timezone), total job count, completed ship-job count, distinct shipped ticket count, total cost (may be null if any contributing job lacks cost), intensity bucket (0–4).
- **Heatmap Period**: The time window shown — either a rolling 12-month window ending today, or a specific calendar year from the user's account-creation year to the current year.
- **Agent Option**: A distinct agent identifier surfaced in the filter, derived from the union of explicit `ticket.agent` values and effective agents resolved via `project.defaultAgent`, across the user's accessible jobs. Always prepended with an "All" entry.
- **Heatmap Summary**: Aggregated header figures for the selected period after filters are applied: total jobs and distinct tickets with at least one completed ship job.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Heatmap Aggregation (server-side initial render + polled refresh)**: Fetches and shapes activity data for the current user's accessible projects.
  - **Input**: Authenticated user identity, selected period (rolling 12 months or calendar year), optional agent filter value.
  - **Phases**:
    1. Resolve the user's accessible project set (owned + member).
    2. Enumerate jobs for those projects within the period; enumerate tickets whose associated `ship` jobs completed within the period.
    3. If the agent filter is active, apply effective-agent resolution to filter both jobs and ticket-ship events.
    4. Aggregate per local calendar day: job count, distinct-ship-ticket count, and total cost (with null-propagation so that a single missing cost omits the cost line).
    5. Compute bucket thresholds via quantiles over non-zero days; assign each cell an intensity level 0–4.
    6. Compute the header summary (total jobs, total distinct shipped tickets in the period).
    7. Derive the agent options list (for the filter visibility/population).
  - **Output**: A daily-cell collection keyed by date, a header summary object, an agent-options list, and the bucket thresholds used. The server renders these into initial HTML; the client uses them as the initial query cache so no spinner is shown on first paint.
  - **Error behavior**: If the aggregation fails, the `/projects` page MUST still render the cards; the heatmap region MUST show a non-blocking error state ("Couldn't load activity — please refresh") instead of crashing the page. Polled refreshes that fail MUST NOT blank the current grid; they retry silently on the next interval.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a signed-in user opens the `/projects` page, the heatmap is visible below their project cards within one page render (no separate spinner/blank frame) in at least 95% of sessions.
- **SC-002**: Users can identify a specific day's activity (ship count, job count, cost) by hovering or tapping one cell in under 3 seconds.
- **SC-003**: Users can switch between the default "Last 12 months" view and any historical calendar year in at most two interactions (open selector + choose), and the grid reflects the new period within one refresh cycle.
- **SC-004**: A shared URL copied from a filtered heatmap view reproduces the exact same period and agent filter in 100% of cases when opened by the same user in another tab or browser.
- **SC-005**: On a mobile viewport of 375 px width, the entire year's grid is reachable via horizontal scroll with the day-of-week labels remaining visible; cells remain tappable (no mis-tap on adjacent cells in routine use).
- **SC-006**: Accounts with zero activity in the selected period see the empty-state message instead of a blank grid, in 100% of such cases, with filters and legend still visible.
- **SC-007**: The "Y tickets shipped" figure matches an independent audit that counts distinct tickets with at least one successful `ship` job in the period, with zero discrepancy.
- **SC-008**: No additional database tables, columns, or migrations are introduced by this feature (verifiable by inspecting schema history on the feature branch).
