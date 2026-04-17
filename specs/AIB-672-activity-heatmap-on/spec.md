# Feature Specification: Activity Heatmap on Projects Page

**Feature Branch**: `AIB-672-activity-heatmap-on`
**Created**: 2026-04-17
**Status**: Draft
**Input**: User description: "Add a GitHub-style contribution heatmap on the projects page, below the project cards grid. The heatmap displays AI activity across all user projects over the past year."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Which projects contribute to the heatmap data
- **Policy Applied**: AUTO (confidence Low → CONSERVATIVE fallback)
- **Confidence**: Low (score 1, neutral feature signals)
- **Fallback Triggered?**: Yes — ambiguous scope defaults to the most inclusive, least surprising interpretation
- **Trade-offs**:
  1. Heatmap aggregates activity across every project the signed-in user can access (owned + member). This matches the ticket phrase "across all user projects" and mirrors what the user already sees on the projects page.
  2. No per-project filter in v1 — keeps scope narrow. A future enhancement can add it if requested.
- **Reviewer Notes**: Confirm that member-project activity should be counted as part of the user's AI activity. If members should see only their own owned projects, adjust the aggregation rule before planning.

---

- **Decision**: Timezone for grouping jobs into calendar days
- **Policy Applied**: AUTO (confidence Low → CONSERVATIVE fallback)
- **Confidence**: Low (no explicit signal)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Days are bucketed in the viewer's browser-local timezone (matches GitHub's contribution graph). This makes "today" feel correct to the user but means the same job can appear on different days for viewers in different timezones.
  2. Alternative (UTC) would be globally consistent but users near day boundaries would see activity on a surprising day.
- **Reviewer Notes**: If product expects a single canonical timezone (e.g., UTC or account-configured), override this choice before planning.

---

- **Decision**: Which jobs are counted for the activity intensity
- **Policy Applied**: AUTO (confidence Medium)
- **Confidence**: Medium (ticket says "AI activity" and "job count")
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Every job owned by the user — regardless of status (completed/failed/cancelled/running) or command — counts once toward the day it started. Matches the "AI activity" framing and avoids penalising failed attempts.
  2. The shipped-ticket counter remains stricter: only `ship` jobs that completed successfully count.
- **Reviewer Notes**: Confirm whether cancelled/failed jobs should be excluded from intensity. If yes, tighten FR-003.

---

- **Decision**: Period covered by "Last 12 months"
- **Policy Applied**: AUTO (confidence High)
- **Confidence**: High (industry standard)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Rolling window: today back through the same date one year ago, inclusive of today. Matches GitHub's rolling contribution graph.
  2. Grid therefore spans 52–53 weeks with chipped top-left and bottom-right to reflect partial first/last weeks relative to Sunday start.
- **Reviewer Notes**: None — matches user expectation.

---

- **Decision**: Number of intensity buckets
- **Policy Applied**: AUTO (confidence Medium)
- **Confidence**: Medium (ticket legend shows 5 glyphs "Less □□■■■ More")
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Five levels total (0 = empty, plus 4 non-zero intensity steps) matching the legend illustration. Thresholds are computed from the active period's max job count using quartile-style breakpoints so the scale stays meaningful for low- and high-volume users alike.
  2. Alternative fixed thresholds (e.g., 1/3/5/10) risk looking flat for power users or too hot for quiet users.
- **Reviewer Notes**: None.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See at-a-glance AI activity over the last year (Priority: P1)

A signed-in user visits `/projects`. Below their project cards they see a full-width heatmap that summarises their AI activity across all their projects for the last 12 months. A header above the grid tells them how many jobs ran and how many tickets shipped in that period. They can immediately tell which days and weeks were most active.

**Why this priority**: This is the core reason the feature exists — converting raw job data into a memorable, motivating visual summary. Without this, nothing ships.

**Independent Test**: With a seeded user whose projects contain a known set of jobs and shipped tickets over the last year, open `/projects` and verify the heatmap renders immediately (no loading spinner), the grid is shaped correctly with chipped corners if the period doesn't align to Sunday/Saturday boundaries, cells are coloured according to job counts, and the header counter matches the seeded totals.

**Acceptance Scenarios**:

1. **Given** a user with jobs distributed across the last year, **When** they open `/projects`, **Then** they see a heatmap below the project cards showing one cell per day for the last 12 months with cell intensity proportional to job count and a header reading "N jobs · M tickets shipped in the last year".
2. **Given** a user whose jobs are concentrated on 3 specific days, **When** they view the heatmap, **Then** only those 3 cells are visibly filled (others are at the empty-state colour) and the intensity scale is calibrated so those 3 cells are clearly distinguishable.
3. **Given** the current year did not start on a Sunday, **When** the user selects that calendar year from the year selector, **Then** the top-left of the grid is chipped (empty week-start cells are not rendered), matching GitHub's behaviour.
4. **Given** a user has never run any jobs, **When** they view `/projects`, **Then** in place of the coloured grid they see a centred message "No activity to show yet — your AI work will appear here" while filters and legend remain visible.

---

### User Story 2 - Inspect a specific day (Priority: P2)

A user wants to know exactly what happened on a particular day. They hover (desktop) or tap (mobile) a cell and see a tooltip listing the formatted date, the tickets shipped that day, the job count, and the total cost for that day's jobs.

**Why this priority**: Drives understanding and trust in the aggregate visualisation. Without drill-down, the heatmap is pretty but not useful.

**Independent Test**: Hover a known cell and assert the tooltip content matches the expected date, ticket list, job count, and formatted cost. Repeat on a mobile viewport using a tap; verify a tap outside dismisses the tooltip.

**Acceptance Scenarios**:

1. **Given** a day with 3 jobs totalling $1.24 and 1 ticket shipped ("Add login"), **When** the user hovers that cell, **Then** the tooltip shows the date, "1 ticket shipped: Add login", and "3 jobs · $1.24".
2. **Given** a day whose jobs have no recorded cost, **When** the user views the tooltip, **Then** the job count is shown but the cost line is omitted entirely — never "$NaN" and never "$0" as a cost placeholder.
3. **Given** a day with zero activity, **When** the user hovers the cell, **Then** the tooltip shows the date with a "No activity" line (no confusing cost or ticket rows).
4. **Given** a mobile user taps a cell, **When** they tap anywhere outside the tooltip, **Then** the tooltip dismisses.

---

### User Story 3 - Navigate by calendar year (Priority: P2)

A user who has been active for multiple years wants to compare activity year by year. They open a year selector and pick a specific calendar year; the grid redraws to the exact boundaries of that year.

**Why this priority**: Unlocks the value of the tool for users with history. Without it, only the rolling window is visible.

**Independent Test**: Seed a user whose account was created 3 years ago with activity in each year. Open the selector: confirm the default is "Last 12 months" and additional options list each calendar year from the account creation year through the current year. Switch selections and verify the grid's left/right boundaries and header counters change accordingly.

**Acceptance Scenarios**:

1. **Given** a user whose account was created in 2023 and today is in 2026, **When** they open the year selector, **Then** the options are: "Last 12 months" (selected), 2026, 2025, 2024, 2023.
2. **Given** a user whose account was created this calendar year, **When** they view the header, **Then** the selector is either hidden or disabled (only "Last 12 months" is reachable).
3. **Given** the user selects a past calendar year that starts on a Monday and ends on a Wednesday, **When** the grid renders, **Then** the top-left has a chipped corner where Sunday of the first week would have fallen before Jan 1, and the bottom-right has chipped cells where Thu/Fri/Sat would have fallen after Dec 31.
4. **Given** the user selects a calendar year, **When** they read the header counter, **Then** the counter's period phrase changes from "in the last year" to reflect the selected year (e.g., "in 2024").

---

### User Story 4 - Filter by AI agent (Priority: P3)

A user with projects running under more than one AI agent (e.g., Claude and Codex) wants to see activity attributed only to a specific agent. They pick an agent from a filter; the heatmap, counter, and tooltips update to reflect only that agent's activity.

**Why this priority**: Valuable for users comparing agent behaviours but only useful when the user actually has multiple agents represented in their data.

**Independent Test**: Seed a user whose jobs span two agents. Verify the filter appears with "All" + each agent, is hidden when only 0–1 distinct agents exist, and that selecting a specific agent updates the intensity (but not grid boundaries) and the counters to that agent's slice. Confirm that a ticket with no explicit agent on a project whose default is the selected agent is included (effective agent resolution).

**Acceptance Scenarios**:

1. **Given** a user whose jobs include both Claude and Codex, **When** they open the heatmap, **Then** the agent filter is visible with options "All" (default), "Claude", "Codex".
2. **Given** a user whose jobs are all under a single agent, **When** they open the heatmap, **Then** the filter control is not rendered.
3. **Given** a ticket with `agent = null` on a project whose `defaultAgent = CLAUDE`, **When** the user filters by "Claude", **Then** jobs for that ticket are counted in the heatmap and header.
4. **Given** the user applies the "Claude" filter, **When** the grid redraws, **Then** the grid boundaries (chipped corners, left/right dates) are unchanged — only cell intensities and counters change.

---

### User Story 5 - Share a specific view by URL (Priority: P3)

A user wants to share a link to a specific heatmap view (e.g., "2024 filtered by Codex"). They copy the current browser URL and send it to a colleague (or themselves on another device). Opening the link reproduces the exact same view.

**Why this priority**: Makes the feature usable for retrospectives and reporting but not required for MVP value.

**Independent Test**: Change the year selector and agent filter, then copy the URL. Open the URL in a new tab and verify the heatmap renders immediately with the identical selections applied.

**Acceptance Scenarios**:

1. **Given** the user has set the year to 2025 and agent to "Claude", **When** they copy the URL, **Then** the URL contains query parameters reflecting both selections.
2. **Given** a URL with heatmap query parameters, **When** any user opens it, **Then** the heatmap loads with those exact selections applied and without a spinner flash.
3. **Given** the user clears a filter back to "All" / "Last 12 months", **When** the URL updates, **Then** the default values are omitted from the query string so clean-state URLs stay short.

---

### Edge Cases

- **Period with zero activity**: Grid is replaced by the centred empty-state message. Header shows "0 jobs · 0 tickets shipped in …". Legend and filters remain visible.
- **Jobs with null `costUsd`**: Counted in the job count; omitted from cost sums. Days where *all* jobs have null cost show no cost line in the tooltip. Days where *some* jobs have cost show the sum of the recorded portion, clearly labelled so the reader understands it excludes the null entries.
- **Very high activity day**: Intensity scale is computed from the period's max so a single spike day doesn't flatten the rest of the grid. That cell reaches the top colour step; the tooltip shows the exact count.
- **Grid boundaries**: A calendar year that starts on Monday has the Sunday cell of week 1 omitted (chipped). Similarly for bottom-right when Dec 31 isn't Saturday. Rolling "Last 12 months" renders exactly 365 (or 366) day cells arranged in week columns with the same chipping rules.
- **Mobile horizontal scroll**: The grid scrolls horizontally on narrow viewports. The day-of-week labels column remains pinned on the left (sticky) while the columns scroll under it. Cell size never shrinks below a tappable target.
- **Selecting a future year**: Not possible — selector only exposes years from account creation to current year, inclusive.
- **Account created on a future date relative to the clock** (clock skew): Defensive — year options are clamped to the range `[min(createdYear, currentYear), currentYear]`.
- **Viewer in a non-Sunday-first locale**: The grid always uses Sunday as the first row (matches the ticket description and GitHub convention). Locale-specific week starts are out of scope for v1.
- **Shipped counter vs stage**: A ticket whose stage was manually set to SHIP but whose `ship` job never ran or failed does NOT count as shipped. The counter only counts `ship` jobs that completed successfully in the period.
- **Multiple ship attempts**: If `ship` ran, failed, re-ran, and succeeded in the same day for the same ticket, the ticket is counted once in the "shipped" counter on the day of the successful completion.
- **Deleted project/ticket**: If a project or ticket has been deleted, its historical jobs still appear in the heatmap intensity (they happened) but deleted tickets are not listed by name in the tooltip — they are collapsed into a count (e.g., "2 more tickets shipped").

## Requirements *(mandatory)*

### Functional Requirements

**Data & Aggregation**

- **FR-001**: System MUST aggregate job activity across every project that the signed-in user owns or is a member of when rendering the heatmap.
- **FR-002**: System MUST bucket each job into a single day of the heatmap, keyed by the job's start time translated into the viewer's browser-local timezone.
- **FR-003**: System MUST count every job toward its day's intensity regardless of the job's status or command, unless excluded by the agent filter.
- **FR-004**: System MUST count a ticket as "shipped" on the day its `ship` workflow job completed with a successful terminal status. Stage changes to SHIP without a successful `ship` job MUST NOT increment the shipped counter.
- **FR-005**: System MUST NOT introduce any new database models; all data comes from existing `Job`, `Ticket`, and `Project` records.

**Heatmap Grid**

- **FR-006**: System MUST render a 7-row grid (one row per day of week, Sunday first) whose column count equals the number of weeks spanned by the selected period.
- **FR-007**: System MUST display month labels along the top of the grid and day-of-week labels along the left.
- **FR-008**: System MUST map each day's job count to one of 5 intensity levels (empty + 4 non-zero steps) using thresholds derived from the active period's maximum so that low-volume and high-volume users both see a readable distribution.
- **FR-009**: System MUST colour non-empty cells using the aurora violet gradient already defined in the application theme; empty cells MUST use the existing muted surface tone. Colours MUST meet WCAG AA contrast on both light and dark themes.
- **FR-010**: System MUST omit (chip) cells that fall outside the selected period boundary — e.g., cells before the first day of a calendar year that doesn't start on Sunday, or after the last day of a calendar year that doesn't end on Saturday.
- **FR-011**: System MUST display an intensity legend at the bottom-right reading "Less" followed by five coloured squares (empty + 4 steps) followed by "More".
- **FR-012**: System MUST replace the grid with a centred message "No activity to show yet — your AI work will appear here" when the selected period contains zero job activity. The legend and filter controls MUST remain visible in this state.

**Header & Counter**

- **FR-013**: System MUST display above the grid a counter of the form "X jobs · Y tickets shipped in {period phrase}", where the period phrase reads "the last year" for the rolling default and "{YYYY}" for a selected calendar year.
- **FR-014**: Counter values MUST update live when the user changes the year or agent filter.

**Year Selector**

- **FR-015**: System MUST expose a year selector whose default option is "Last 12 months" (a rolling window ending today, inclusive).
- **FR-016**: Year selector options MUST include, in addition to the default, each calendar year from the user's account-creation year up to and including the current year.
- **FR-017**: If the user's account-creation year equals the current year, the selector MUST be hidden or disabled so that only "Last 12 months" is reachable.

**Tooltip**

- **FR-018**: System MUST show a tooltip on hover (desktop) or tap (mobile/touch) for every cell, including empty cells.
- **FR-019**: Tooltip content MUST include: the formatted date; the list of tickets shipped that day (by title, with a sensible fallback for deleted tickets); the job count; and the total cost of that day's jobs.
- **FR-020**: When one or more jobs on a given day have no recorded cost, the tooltip MUST NOT render "$NaN" and MUST NOT render "$0" as a substitute for missing data. If every job that day has a null cost, the tooltip MUST omit the cost line entirely.
- **FR-021**: On touch devices, tapping anywhere outside the tooltip MUST dismiss it.

**Agent Filter**

- **FR-022**: System MUST derive agent filter options from the set of distinct agents actually represented in the user's jobs, combining explicit `ticket.agent` values with the effective agent inherited from `project.defaultAgent`.
- **FR-023**: The agent filter MUST always include an "All" option that is selected by default.
- **FR-024**: If the user's data contains 0 or 1 distinct agents, the filter control MUST NOT be rendered.
- **FR-025**: When the user selects a specific agent, counts MUST respect effective-agent resolution: a ticket with `agent = null` on a project whose `defaultAgent` matches the selected agent MUST be included.
- **FR-026**: Applying a filter MUST NOT change the grid's boundaries or chipped corners — only cell intensities and counter values change.

**URL State**

- **FR-027**: System MUST reflect non-default year and agent selections in the page URL as query parameters so that the URL can be copied and reopened to reproduce the exact same view.
- **FR-028**: Default values (year = "Last 12 months"; agent = "All") MUST be omitted from the URL so a clean view produces a clean URL.

**Loading & Layout**

- **FR-029**: System MUST render the heatmap with server-provided initial data on first page load so that no loading spinner or blank placeholder is visible before the grid appears.
- **FR-030**: Background refetches (e.g., polling or invalidation) MUST update the heatmap in place without blanking the UI or flashing a spinner.
- **FR-031**: System MUST place the heatmap full-width on the `/projects` page below the project cards grid.
- **FR-032**: Any existing scroll constraint on the project cards grid MUST be adjusted as needed so that the full page — including the heatmap — scrolls naturally in the viewport.

**Mobile**

- **FR-033**: On narrow viewports, the grid MUST scroll horizontally rather than wrapping or shrinking cells below a tappable size.
- **FR-034**: The day-of-week labels column MUST remain pinned (sticky) to the left edge of the heatmap container during horizontal scroll.

### Key Entities *(include if feature involves data)*

- **Job**: An AI workflow execution attached to a project and (optionally) a ticket. Attributes used: start day, terminal status, command (e.g., `ship`), recorded cost in USD (nullable), owning user/project.
- **Ticket**: A unit of work. Attributes used: title, explicit `agent` (nullable), parent project, stage, and its relation to its `ship` job.
- **Project**: A container for tickets. Attributes used: members, owner, `defaultAgent`.
- **User**: The signed-in viewer. Attributes used: account creation date (drives the year selector range), set of accessible projects.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Heatmap aggregation query**: Triggered when the `/projects` page is rendered server-side or when the client refetches heatmap data after a filter/year change.
  - **Input**: Authenticated user ID, selected period (rolling 12 months or a calendar year), optional agent filter, viewer timezone.
  - **Phases**:
    1. Resolve the set of projects the user can access (owned + member).
    2. Collect jobs belonging to those projects whose start day falls within the period.
    3. Group by day (in the viewer's timezone) to produce `{date, jobCount, totalCost}`.
    4. Collect successful `ship` jobs whose completion day falls within the period; join their tickets to produce per-day shipped-ticket lists.
    5. If an agent filter is applied, restrict jobs and shipped tickets to those whose effective agent (explicit `ticket.agent` or the project `defaultAgent` when `ticket.agent` is null) matches the selected agent.
    6. Produce a dataset of daily buckets plus the two aggregate counters.
  - **Output**: A serialisable structure consumed by the UI for the grid, the counter, and the tooltip payloads; also the distinct effective agents for the filter dropdown.
  - **Error behavior**: Errors are logged and surfaced as a non-blocking inline notice; the rest of `/projects` still renders without the heatmap so the page never breaks. The request is retryable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a typical `/projects` page load for a user with one year of data, the heatmap is visible immediately below the project cards without a layout shift or spinner flash on first paint.
- **SC-002**: 100% of rendered cells show a tooltip with correct date, correct job count, and — when cost is recorded — correct total cost; zero tooltips ever render "$NaN" or "$0" for days where all jobs have null cost.
- **SC-003**: For a user with activity under two or more agents, switching the agent filter updates the counter and all cell intensities within 200 ms of selection and keeps grid boundaries identical.
- **SC-004**: A URL copied from one device with specific year + agent selections opens on a second device reproducing the same view, with zero additional clicks.
- **SC-005**: On a mobile viewport (≤375 px wide), users can scroll horizontally through every week in the period, day-of-week labels remain visible throughout the scroll, and every cell remains tappable (minimum touch target respected).
- **SC-006**: For users whose period contains zero activity, the empty-state message appears in place of the grid while filters and legend remain visible; no empty grid is ever drawn.
- **SC-007**: The shipped-tickets counter matches the count of successful `ship` jobs in the period — never the count of stage transitions to SHIP — verifiable by seeding a ticket whose stage is SHIP without a completed `ship` job and confirming it is NOT counted.
- **SC-008**: The year selector offers exactly the set `{"Last 12 months"} ∪ {createdYear..currentYear}` and defaults to "Last 12 months"; a new user whose account was created this calendar year sees no selectable calendar years.
