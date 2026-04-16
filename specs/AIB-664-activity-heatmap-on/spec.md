# Feature Specification: Activity Heatmap on Projects Page

**Feature Branch**: `AIB-664-activity-heatmap-on`
**Created**: 2026-04-16
**Status**: Draft
**Input**: Ticket AIB-664 — Activity Heatmap on Projects Page

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Scope of "all user projects" — include projects the user owns AND projects where they are a member.
  - **Policy Applied**: AUTO → CONSERVATIVE
  - **Confidence**: Medium (score 3) — the heatmap header copy ("your AI work") and the existing `/projects` page listing both owned and joined projects point to the same scope.
  - **Fallback Triggered?**: No — neutral context with strong alignment to existing page semantics.
  - **Trade-offs**:
    1. Includes activity from collaborative projects, giving a richer personal history.
    2. A user could briefly see activity spikes from teams they just joined; acceptable because the cells surface jobs they can already see on their projects page.
  - **Reviewer Notes**: Confirm the data source matches project access rules enforced on `/projects` (owner OR member).

- **Decision**: Week starts on Sunday (rows Sunday → Saturday).
  - **Policy Applied**: AUTO → PRAGMATIC
  - **Confidence**: High (score 5) — the ticket explicitly references Sunday/Saturday chipped corners and GitHub's behavior, which uses Sunday-start weeks.
  - **Fallback Triggered?**: No.
  - **Trade-offs**:
    1. Matches the GitHub mental model users expect from a "contribution heatmap".
    2. Users in locales where the week starts Monday see a US convention; acceptable given the stated visual reference.
  - **Reviewer Notes**: Keep the choice consistent with any existing date-label conventions on the analytics dashboard.

- **Decision**: Tooltip cost is displayed as USD, summed across jobs that have a recorded cost for that day.
  - **Policy Applied**: AUTO → CONSERVATIVE
  - **Confidence**: High (score 5) — billing is USD throughout AI-Board and the ticket forbids "$NaN"/"$0" fallbacks.
  - **Fallback Triggered?**: No.
  - **Trade-offs**:
    1. Users always see a meaningful number or no number at all.
    2. Days mixing costed and non-costed jobs will show a partial sum; the tooltip notes this by showing only the aggregated line.
  - **Reviewer Notes**: Decide on decimal precision (2 decimals) and currency symbol placement during planning.

- **Decision**: Intensity scale uses 5 levels (0 = empty, then 4 violet shades) derived from the non-zero job-count distribution (quartile-style thresholds).
  - **Policy Applied**: AUTO → PRAGMATIC
  - **Confidence**: Medium (score 3) — matches GitHub's 5-level visual and the "Less □□■■■ More" legend in the ticket.
  - **Fallback Triggered?**: No.
  - **Trade-offs**:
    1. Adapts to each user's personal scale so heavy and light users both see a useful gradient.
    2. Two users comparing heatmaps can't deduce absolute volume from color alone; tooltip carries exact counts.
  - **Reviewer Notes**: Exact threshold formula (percentile vs. linear) is an implementation concern, document in plan.

- **Decision**: URL query params use `period` (values: `last-12-months` or a 4-digit year) and `agent` (value: enum agent code or `all`). Missing/invalid params fall back to defaults silently.
  - **Policy Applied**: AUTO → CONSERVATIVE
  - **Confidence**: Medium (score 3) — aligns with the analytics dashboard filter pattern mentioned in the ticket.
  - **Fallback Triggered?**: No.
  - **Trade-offs**:
    1. Shareable URLs reproduce the exact view.
    2. Users pasting malformed URLs still see a usable heatmap rather than an error.
  - **Reviewer Notes**: Param names must not collide with existing query keys on `/projects`.

- **Decision**: Background refetch cadence follows the analytics dashboard precedent (15s polling) with server-rendered initial data to avoid the loading flash.
  - **Policy Applied**: AUTO → PRAGMATIC
  - **Confidence**: High (score 5) — AI-Board CLAUDE.md lists a 15s analytics polling interval that should be reused.
  - **Fallback Triggered?**: No.
  - **Trade-offs**:
    1. Consistent freshness with other dashboards.
    2. Slight overhead for users leaving the projects page open.
  - **Reviewer Notes**: None.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Glance at recent AI activity (Priority: P1)

As an AI-Board user, when I visit my projects page, I want to see a heatmap of my AI activity over the last 12 months so that I can understand my momentum at a glance without navigating away.

**Why this priority**: This is the core value of the feature — a passive, instantly visible summary of the user's AI work. Without it, the rest of the controls have nothing to act on.

**Independent Test**: Load `/projects` as an authenticated user who has at least one job in the last year. Verify the heatmap renders immediately (no spinner flash), shows the correct job count in the header, and displays a violet gradient where activity occurred.

**Acceptance Scenarios**:

1. **Given** a signed-in user with jobs spread across the last year, **When** they open `/projects`, **Then** the heatmap is visible below the project cards with cells shaded according to daily job counts and the header reads "X jobs · Y tickets shipped in the last year".
2. **Given** the page is still loading data, **When** the user views the heatmap, **Then** initial data is server-rendered so the grid appears without a spinner flash; subsequent background refreshes update cells silently.
3. **Given** a user whose account was created within the last 12 months, **When** the page renders, **Then** the default period still reads "Last 12 months" and earlier days are simply empty (no broken grid).

---

### User Story 2 — Explore a specific calendar year (Priority: P2)

As an AI-Board user with more than one year of history, I want to switch the heatmap to a specific calendar year so that I can review that year's contributions in isolation.

**Why this priority**: Adds meaningful temporal navigation once the default view is in place; not essential for the first render but important for long-time users.

**Independent Test**: With a test account that has jobs in at least two calendar years, open the year selector, choose a past year, and confirm the grid boundaries snap to Jan 1–Dec 31 of that year with the correct chipped corners for partial first/last weeks.

**Acceptance Scenarios**:

1. **Given** a user whose account was created in a prior year, **When** they open the period selector, **Then** the dropdown lists "Last 12 months" (default) plus one option per calendar year from the account creation year to the current year, most recent first.
2. **Given** a selected year where January 1 falls on a day other than Sunday, **When** the heatmap renders that year, **Then** the cells before January 1 are omitted (chipped top-left corner) and cells after December 31 are omitted (chipped bottom-right corner if December 31 is not a Saturday).
3. **Given** a user whose account was created in the current year, **When** they view the selector, **Then** the dropdown shows only "Last 12 months" (either single-option or disabled) so the control remains predictable.
4. **Given** a user has selected a past year, **When** they copy the current URL and open it in another browser session, **Then** the heatmap loads with the same year pre-selected.

---

### User Story 3 — Filter activity by agent (Priority: P2)

As an AI-Board user who has used multiple AI agents, I want to filter the heatmap by a specific agent so that I can see which days each agent was responsible for my work.

**Why this priority**: Useful analytical lens for power users who run multiple agents; not required for the baseline visualization.

**Independent Test**: Seed a user with jobs across two different agents. Verify the agent filter appears, default value is "All", selecting a specific agent updates the cells and header counts, and the filter persists in the URL.

**Acceptance Scenarios**:

1. **Given** a user whose jobs span two or more distinct agents (counting project defaults when the ticket agent is null), **When** they open the heatmap, **Then** an "Agent" filter is visible with "All" selected and one option per distinct agent present in the data.
2. **Given** a user whose jobs only use one agent (or none), **When** the heatmap renders, **Then** the agent filter is hidden entirely.
3. **Given** a project whose default agent is Claude and a ticket on that project with no explicit agent, **When** the user filters by "Claude", **Then** jobs from that ticket are included in the counts.
4. **Given** an agent filter is applied, **When** the heatmap renders, **Then** the grid boundaries and row/column layout remain identical to the unfiltered view (only cell intensities and header counts change).
5. **Given** a user applies an agent filter, **When** they reload or share the URL, **Then** the same filter is active on the resulting view.

---

### User Story 4 — Inspect a specific day (Priority: P3)

As a user who sees a colored cell, I want to hover (or tap on mobile) to see exact job counts, total cost, and shipped tickets for that day so that I can correlate the visual with real work.

**Why this priority**: Enhances informational depth; the grid itself already conveys high-level patterns without it.

**Independent Test**: Hover a non-empty cell on desktop and tap a non-empty cell on mobile; verify the tooltip shows formatted date, shipped ticket count, job count, and cost line (omitted if no cost is recorded).

**Acceptance Scenarios**:

1. **Given** a cell with at least one job, **When** the user hovers (desktop) or taps (mobile), **Then** a tooltip appears with the formatted date, the number of tickets shipped that day, the job count, and the summed cost if any job has a recorded cost.
2. **Given** a day where no job has a recorded cost, **When** the tooltip opens, **Then** the cost line is omitted entirely (never "$NaN" or "$0").
3. **Given** a tooltip is open on mobile, **When** the user taps anywhere outside the cell, **Then** the tooltip dismisses.

---

### User Story 5 — View comfortably on mobile (Priority: P3)

As a mobile user, I want the heatmap to remain readable and usable at phone widths so that I can still review my activity away from my desk.

**Why this priority**: Broadens access but not blocking for a desktop-first dashboard audience.

**Independent Test**: Open `/projects` on a ~375px viewport and confirm the grid scrolls horizontally (not wrapped, not shrunk below a tappable cell size) while the day-of-week column stays pinned on the left.

**Acceptance Scenarios**:

1. **Given** a viewport narrower than the full grid, **When** the user scrolls horizontally, **Then** day-of-week labels remain anchored to the left edge and cells remain at a tappable size.
2. **Given** a mobile viewport, **When** the heatmap is visible, **Then** the page scrolls naturally so the heatmap is reachable without being blocked by an inner scroll container on the project grid above.

---

### Edge Cases

- Whole selected period has zero activity → grid area replaced by centered message "No activity to show yet — your AI work will appear here"; legend and filters remain visible.
- User has never run any jobs and account was created this year → only "Last 12 months" period is available, empty-state message shown, agent filter hidden.
- A ticket's stage is SHIP but its `ship` job was cancelled or failed → NOT counted in shipped tickets for the header or tooltip.
- A day has many jobs but none have a recorded cost → tooltip shows job count only; cost line omitted.
- URL arrives with an invalid `period` or `agent` param → fall back to defaults without surfacing an error to the user.
- User switches period while a background refetch is in flight → latest selection wins, no UI blanking.
- A project's default agent is changed after older jobs ran → effective-agent resolution uses the project's current default (matching the analytics dashboard's published behavior).
- Leap year (e.g., 2024) → 366 days render correctly across the grid columns.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `/projects` page MUST display a GitHub-style contribution heatmap below the project cards grid, full-width, scoped to the authenticated user's accessible projects (owned or member-of).
- **FR-002**: Cell intensity MUST be derived from the count of jobs the user has on that day and rendered using the product's aurora violet gradient, readable on the dark theme.
- **FR-003**: The grid MUST always have 7 rows (Sunday–Saturday) and a number of columns equal to the weeks in the selected period; cells outside the selected period's first/last week MUST be omitted, producing "chipped" corners when the period does not start on Sunday or end on Saturday.
- **FR-004**: Month labels MUST appear above the grid and day-of-week labels MUST appear on the left.
- **FR-005**: A 5-step intensity legend MUST be shown at the bottom-right of the heatmap in "Less … More" form.
- **FR-006**: The header above the grid MUST display "X jobs · Y tickets shipped in the last year" (wording updated to match the selected period), where `Y` counts only tickets whose `ship` workflow job completed successfully on a day in the selected period.
- **FR-007**: A period selector MUST be present. The default option MUST be "Last 12 months" (rolling). Additional options MUST be one per calendar year between the user's account creation year and the current year, in descending order. When the user's account was created in the current calendar year, the selector MUST present "Last 12 months" only (hidden or disabled extras).
- **FR-008**: An agent filter MUST be built dynamically from the distinct agents present in the user's data, combining explicit `ticket.agent` values with the effective agent inherited from each project's `defaultAgent`. The filter MUST include an "All" option, selected by default, and MUST be hidden entirely when only zero or one distinct agent exists.
- **FR-009**: When an agent filter is applied, the counts and cell intensities MUST honor effective agent resolution (tickets with no explicit agent are attributed to their project's default agent).
- **FR-010**: Applying the agent filter MUST NOT change the grid's period boundaries; only counts and intensities update.
- **FR-011**: The current selected period and agent filter MUST be reflected in the URL query string; opening the URL in a fresh session MUST reproduce the same view, and invalid parameters MUST fall back silently to defaults.
- **FR-012**: On hover (desktop) or tap (mobile), a tooltip MUST display for the targeted day: the formatted date, the number of tickets shipped, the job count, and the total job cost. If no job on that day has a recorded cost, the cost line MUST be omitted entirely (never rendered as "$NaN" or "$0").
- **FR-013**: On mobile, tapping outside an open tooltip MUST dismiss it.
- **FR-014**: The heatmap MUST render with server-provided initial data so no loading spinner or blank state flashes on first paint; background refreshes MUST update data silently.
- **FR-015**: If the selected period has zero activity after filtering, the grid area MUST be replaced by a centered message "No activity to show yet — your AI work will appear here"; the legend, header counter (showing zeroes), period selector, and agent filter MUST remain visible.
- **FR-016**: On narrow viewports, the grid MUST scroll horizontally (never wrap, never shrink cells below a tappable size) and the day-of-week labels MUST remain pinned on the left during horizontal scroll.
- **FR-017**: The existing scroll behavior of the project cards grid MUST be adjusted if necessary so that the page scrolls naturally to reveal the heatmap on all viewports.
- **FR-018**: The feature MUST use existing job and ticket data; no new database models may be introduced.
- **FR-019**: Authorization MUST restrict heatmap data strictly to the authenticated user's accessible jobs and tickets (same scope as the `/projects` listing).
- **FR-020**: A ticket MUST count as "shipped" for the header counter only when its `ship` workflow job has completed successfully; stage changes to SHIP without a successful ship job MUST NOT contribute to the count.

### Key Entities *(include if feature involves data)*

- **Job**: Existing entity. Source of daily counts and costs. Relevant attributes consumed: completion timestamp, command name (to detect `ship` completions), cost (optional), parent ticket (for agent resolution).
- **Ticket**: Existing entity. Contributes the explicit `agent` value (when set) and the link to its project for default-agent inheritance. A ticket is counted as "shipped on day D" when its `ship` job completed successfully on D.
- **Project**: Existing entity. Provides the `defaultAgent` used when a ticket has no explicit agent and establishes project membership for data-access scoping.
- **User**: Existing entity. Determines data scope and the earliest year available in the period selector (via `createdAt`).
- **Heatmap Day Cell** (derived, non-persisted): A per-day aggregation of `{ date, jobCount, shippedTicketCount, totalCost | null, breakdownByAgent }` produced by the query layer and consumed by the UI.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Heatmap Aggregation Query**: Triggered on server render of `/projects` and on client-side period/agent changes.
  - **Input**: Authenticated user id, selected period (rolling 12 months or a specific calendar year), optional agent filter.
  - **Phases**:
    1. Resolve the user's accessible project ids (owned OR member).
    2. Fetch jobs belonging to those projects whose completion timestamp falls in the selected period.
    3. Resolve each job's effective agent by combining `ticket.agent` with `project.defaultAgent` fallback.
    4. Apply agent filter if specified.
    5. Aggregate by date into daily `{ jobCount, totalCost, shippedTicketCount }`.
    6. Compute distinct agents list for the filter UI (always over the unfiltered data so the filter options stay stable).
  - **Output**: Ordered list of daily aggregates covering the selected period, a list of distinct agent codes, and header totals.
  - **Error behavior**: On query failure, fall back to a cached/last-known payload if available; otherwise render the grid area with the empty-state message and log the error for monitoring. Never display a broken or partial grid.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On first paint of `/projects` for a user with existing activity, the heatmap area shows real cell data with no visible loading spinner or skeleton (0ms "blank" state observed by the user).
- **SC-002**: 100% of days in the selected period are represented either by a rendered cell (in-period) or explicitly omitted (pre/post the period's first/last week), matching GitHub's chipped-corner convention.
- **SC-003**: Header counters (jobs and tickets shipped) match the underlying data with 100% accuracy — every ticket counted corresponds to a successful `ship` job completion on a day within the period.
- **SC-004**: The agent filter appears if-and-only-if the user's data contains at least two distinct effective agents; manual review of 10 seeded fixtures shows 10/10 correct visibility decisions.
- **SC-005**: URL-encoded views are fully reproducible: copying the URL after changing period and agent filters and opening it in a clean session yields an identical heatmap in 100% of test cases.
- **SC-006**: Tooltip cost display never shows "$NaN" or "$0" for missing-cost data across all tested days (0 incidents in QA seed dataset).
- **SC-007**: On a viewport of 375px width, the user can horizontally scroll the full grid while day-of-week labels remain visible; tap targets for cells meet the project's minimum tappable size.
- **SC-008**: A user with zero activity in the selected period sees the empty-state message (not a blank grid) while still being able to operate the period selector and agent filter.
