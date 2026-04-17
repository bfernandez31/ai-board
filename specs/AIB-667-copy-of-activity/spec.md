# Feature Specification: Copy of Activity Heatmap on Projects Page

**Feature Branch**: `AIB-667-copy-of-activity`
**Created**: 2026-04-17
**Status**: Draft
**Input**: User description: "Add a GitHub-style contribution heatmap on the projects page, below the project cards grid. The heatmap displays AI activity across all user projects over the past year."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Intensity scale uses 5 discrete levels (0 + 4 populated buckets) mirroring GitHub's contribution graph.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Medium (0.6) — well-established UI pattern explicitly referenced in the description ("GitHub-style").
- **Fallback Triggered?**: Yes — low overall signal score (netScore=+1) triggered conservative fallback per policy.
- **Trade-offs**:
  1. Five levels match user familiarity but require choosing bucket boundaries (see FR-008).
  2. Simpler than a continuous gradient; tooltip carries the precise count for accuracy.
- **Reviewer Notes**: Confirm bucket thresholds feel right once real usage data is plotted; tune if distribution is heavily skewed.

- **Decision**: Day bucketing uses the viewer's local timezone (browser date boundaries).
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) — heatmap represents "your AI work"; mismatching calendar boundaries would confuse users scanning their own activity.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A job run just before/after midnight may land in a different cell for two users in different timezones — acceptable since the view is personal.
  2. Server must either ship raw timestamps (client-side bucketing) or accept a timezone parameter.
- **Reviewer Notes**: Ensure server-rendered initial data uses the same bucketing rule as client refetches to avoid first-paint shifts.

- **Decision**: Header counter ("X jobs · Y tickets shipped") respects the active year selector and agent filter.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) — the description shows counter and grid as one coupled visualization; independent totals would contradict the filtered view.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Counter wording adapts: "Last 12 months" vs. a specific year label.
  2. Removes ambiguity: what the user sees colored matches what the counter totals.
- **Reviewer Notes**: Confirm copy variants (e.g., "X jobs · Y tickets shipped in 2025") read naturally.

- **Decision**: Aggregation scope covers projects the user **owns or is a member of** — matching the set already listed above on the same page.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) — description says "across all user projects"; the projects page itself already defines that set via existing access rules.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Membership changes (join/leave) naturally reshape the heatmap — acceptable.
  2. Avoids defining a new scope concept; reuses existing access semantics.
- **Reviewer Notes**: Verify consistency with how the project grid above filters projects.

- **Decision**: Agent filter options reflect the **entire account history** (not just the currently selected period), so switching years doesn't make a previously chosen agent vanish.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) — preserves URL-shareable state; a shared link pinned to "Last year + agent=X" must still render even if X has no jobs in the viewed range.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Filter may list an agent with zero cells in the current view — acceptable; the empty grid communicates the situation.
  2. Dynamic "0 or 1 distinct agent → hide filter" rule is evaluated against full account history, not the filtered slice.
- **Reviewer Notes**: Confirm behavior when a selected agent has no activity in the active period — filter stays visible, grid shows empty state.

- **Decision**: Background refresh cadence aligns with analytics dashboard (~15s polling) since both surfaces track similar job/ticket signals.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) — CLAUDE.md explicitly lists 15s for analytics/usage; this heatmap is functionally an analytics surface.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Fresh enough to feel live as workflows complete; not so aggressive it strains the server.
  2. Polling is silent (no loading flash) per the requirement.
- **Reviewer Notes**: Consider pausing polling when the tab is hidden.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See My AI Activity at a Glance (Priority: P1)

A user lands on `/projects`, scrolls past their project cards, and immediately sees a colored heatmap summarizing how much AI work has run across their projects in the last 12 months, plus a headline counter of jobs run and tickets shipped.

**Why this priority**: The core value of the feature — a zero-click, ambient signal of productivity and momentum. Without this, none of the filter/tooltip polish matters.

**Independent Test**: Navigate to `/projects` with a seeded account having jobs and at least one successful `ship` job. Verify the heatmap appears below the project grid, the grid shows shaded cells for days with activity, the counter reflects actual totals, and no loading spinner flashes on first render.

**Acceptance Scenarios**:

1. **Given** a user with historical AI jobs across multiple projects, **When** they load `/projects`, **Then** the heatmap renders with the data already visible (no spinner flash), counter reads "N jobs · M tickets shipped in the last year", and the default period is "Last 12 months".
2. **Given** a user whose account has zero jobs, **When** they load `/projects`, **Then** the heatmap area shows the centered message "No activity to show yet — your AI work will appear here" while the legend and any filters remain visible.
3. **Given** a brand-new account created today with no jobs, **When** the user loads `/projects`, **Then** the year selector exposes only "Last 12 months" (no additional year options) and the empty-state message is shown.

---

### User Story 2 - Drill Into a Specific Day (Priority: P2)

A user hovers (or taps, on mobile) a colored cell to see exactly which tickets shipped that day, how many jobs ran, and the total cost for those jobs.

**Why this priority**: Transforms the heatmap from decorative to useful — users can connect the colored pixel back to concrete work they did.

**Independent Test**: With a seeded account containing jobs on a known date (some with cost, some without), hover that date's cell and verify the tooltip contents; on a touch device, tap the cell and confirm it opens, then tap outside to dismiss.

**Acceptance Scenarios**:

1. **Given** a day with 3 jobs totaling $1.42 and 1 ticket shipped, **When** the user hovers that cell, **Then** the tooltip shows the formatted date, "1 ticket shipped", "3 jobs · $1.42".
2. **Given** a day where jobs ran but none have recorded cost, **When** the user hovers that cell, **Then** the tooltip shows the job count and omits the cost line entirely (never "$NaN" or "$0").
3. **Given** a user on a touch device, **When** they tap a cell, **Then** the tooltip appears; **When** they tap outside the cell, **Then** the tooltip dismisses.

---

### User Story 3 - Scope by Year and Agent (Priority: P2)

A user narrows the heatmap to a specific calendar year or to jobs driven by a specific AI agent, and can share that exact view by copying the URL.

**Why this priority**: Lets power users investigate trends ("what did I do in 2024?", "how much was Claude?") and collaborate by sharing reproducible views.

**Independent Test**: Select a year from the dropdown and an agent from the filter, copy the URL, open it in a new incognito window signed in as the same user, and confirm the view reproduces exactly.

**Acceptance Scenarios**:

1. **Given** an account created in 2024, **When** the user opens the year selector, **Then** the options are "Last 12 months" (default), "2026", "2025", "2024".
2. **Given** a user with jobs only ever run on one agent, **When** they view the heatmap, **Then** no agent filter control is shown.
3. **Given** a user with jobs run on 2+ distinct agents, **When** they select "Claude" from the agent filter, **Then** cells reflect only Claude-attributed activity, including tickets with no explicit agent on projects whose default agent is Claude.
4. **Given** an active year + agent filter, **When** the user copies the URL and opens it elsewhere, **Then** the new view loads with the same year and agent preselected and the grid shows the same data.
5. **Given** a selected year where the year starts on a Monday, **When** the grid renders, **Then** the Sunday cell of the first week is omitted (chipped top-left corner), matching GitHub's behavior.

---

### Edge Cases

- Year that ends mid-week (e.g., a Wednesday): the grid has a chipped bottom-right corner with no cells for the uncovered days.
- User opens `/projects` while a workflow is actively running: the initial server-rendered grid matches the moment of request; the next poll silently updates to include the new job.
- Agent filter is active when the user switches years: the filter stays selected (URL-backed) and the heatmap recalculates.
- Cell with a huge job count: tooltip still reads cleanly; intensity saturates at the top bucket rather than extending indefinitely.
- Ticket marked SHIP manually (no workflow ship job ever completed): **not** counted in the "tickets shipped" number, even though the ticket's current stage is SHIP.
- A `ship` job that completed successfully for a ticket later rolled back: still counts as shipped on its completion day (the historical event happened).
- Long horizontal scrolls on mobile: day-of-week labels remain visible (pinned left); cells never shrink below a tappable minimum.
- Browser in a timezone that puts a job at 23:59 local vs. 00:01 local on another device: the job lands in different cells for each viewer — expected and documented behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The projects page MUST display a GitHub-style contribution heatmap below the project cards grid, spanning the available page width.
- **FR-002**: The heatmap MUST aggregate AI job activity across every project the viewing user owns or is a member of.
- **FR-003**: The heatmap grid MUST have exactly 7 rows representing days of the week, with month labels across the top and day-of-week labels down the left side.
- **FR-004**: Cell shading MUST be driven by the count of jobs attributed to that calendar day for the viewing user.
- **FR-005**: The color scale MUST use a violet gradient consistent with the product's aurora theme and remain readable on the dark theme.
- **FR-006**: The grid MUST honor calendar boundaries of the selected period: cells before the first day of the period (when it doesn't start on a Sunday) and after the last day (when it doesn't end on a Saturday) MUST NOT be rendered, producing GitHub-style chipped corners.
- **FR-007**: When the selected period has zero activity, the heatmap area MUST show the centered message "No activity to show yet — your AI work will appear here" in place of the grid, while the legend and filters remain visible.
- **FR-008**: The intensity scale MUST use 5 discrete levels (zero + four populated buckets) with a legend labeled "Less □□■■■ More" at the bottom right.
- **FR-009**: The header MUST display a counter in the form "X jobs · Y tickets shipped in the last year" (with the period label adapting when a specific year is selected).
- **FR-010**: A ticket MUST be counted as shipped on the day its `ship` workflow job completed successfully. A stage transition to SHIP without a completed ship job MUST NOT increment the counter.
- **FR-011**: A year selector dropdown MUST be present with "Last 12 months" (rolling) as the default option.
- **FR-012**: The year selector MUST list each calendar year from the year the viewer's account was created through the current year, in addition to "Last 12 months".
- **FR-013**: If the viewer's account was created in the current calendar year, the dropdown MUST either be hidden or rendered disabled, since only "Last 12 months" is available.
- **FR-014**: Hovering a cell on a pointer device MUST display a tooltip containing: formatted date, number of tickets shipped that day, number of jobs that day, and — only if at least one job has recorded cost — the total cost for that day.
- **FR-015**: The tooltip MUST NOT render "$NaN" or "$0" when no cost data exists; the cost line MUST be omitted in that case.
- **FR-016**: On touch devices, tapping a cell MUST open its tooltip; tapping outside any cell MUST dismiss the open tooltip.
- **FR-017**: An agent filter MUST be present when the viewer's historical job data contains 2 or more distinct agents, and MUST be hidden entirely when only 0 or 1 distinct agent exists.
- **FR-018**: Agent options MUST be derived from actual data, combining explicit ticket agent values and the effective agent inherited from each project's default agent, plus a default "All" option selected by default.
- **FR-019**: When filtered to a specific agent, cells MUST include any ticket whose effective agent resolves to that value — i.e., tickets with no explicit agent on a project whose default is that agent MUST be included.
- **FR-020**: The grid boundaries (visible week range) MUST NOT change when an agent filter is applied; only the cell intensities and counter values change.
- **FR-021**: Active year and agent filters MUST be reflected in the page URL via query parameters, and loading that URL MUST reproduce the exact same view for the same viewer.
- **FR-022**: The header counter MUST reflect the active year and agent filters (e.g., filtering to one agent reduces both numbers accordingly).
- **FR-023**: The heatmap MUST be visible with real data on the very first paint (no spinner flash). Server-rendered initial data is required.
- **FR-024**: Subsequent background refreshes MUST update the view silently without blanking cells or showing loaders.
- **FR-025**: On mobile and other narrow viewports, the grid MUST scroll horizontally, never wrapping rows, and cells MUST never shrink below a tappable size.
- **FR-026**: Day-of-week labels MUST remain visible (pinned to the left) during horizontal scroll on mobile.
- **FR-027**: The existing scroll behavior of the projects page MUST be adjusted as needed so the page can scroll naturally to reveal the heatmap.
- **FR-028**: The feature MUST NOT introduce any new database models or schema additions — it MUST compose existing job and ticket data.
- **FR-029**: Day bucketing MUST use the viewer's local timezone so that cells align with the user's sense of "a day".

### Key Entities *(include if feature involves data)*

- **Job**: An AI workflow execution already recorded in the system. Relevant attributes: completion timestamp, status (for counting `ship` successes), command/kind (to identify `ship` jobs), cost (optional), agent (directly or inherited), and the ticket it belongs to.
- **Ticket**: A work item that may have an explicit agent and belongs to a project. Used to resolve effective agent (ticket agent or project default) and to identify which tickets were shipped on which day.
- **Project**: A container with an owner, optional members, and a default agent. Scopes the heatmap to the viewer's accessible projects and contributes its default agent to effective-agent resolution.
- **User (viewer)**: Supplies the account-creation date that bounds the year selector and the access rules that bound which projects count.
- **Heatmap Day Cell (derived, not persisted)**: A per-day aggregation of jobs (count, total cost) and shipped tickets for the viewer, used to render one cell and its tooltip.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Heatmap data refresh (client polling)**: Keeps the rendered heatmap close to real-time without disturbing the user.
  - **Input**: Current viewer identity, active period (year or rolling 12 months), active agent filter, viewer timezone.
  - **Phases**:
    1. On page load, receive server-rendered initial dataset — no loading state shown.
    2. On a ~15s cadence (aligned with analytics), silently request fresh aggregates for the same filters.
    3. Merge the fresh payload into the view without blanking cells or showing a spinner.
  - **Output**: Updated cell intensities, header counter, and tooltip contents — visible only where values actually changed.
  - **Error behavior**: A failed background refresh is silent; the last-known-good data remains on screen. Persistent errors do not trigger a blank state. Polling pauses when the tab is not visible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user loading `/projects` sees the heatmap fully populated with their real data on first paint, with no visible loading spinner or empty flash.
- **SC-002**: 100% of rendered cells can be hovered (or tapped on mobile) to reveal a tooltip whose numbers match the underlying day's activity.
- **SC-003**: The "tickets shipped" header number equals the number of tickets whose ship workflow completed successfully in the selected period — verified against a known seeded dataset to be exact, not approximate.
- **SC-004**: Copying the URL of a filtered view and opening it in another browser session (as the same viewer) reproduces the exact same grid, header counter, and selected filters.
- **SC-005**: On a viewport 375px wide, the grid scrolls horizontally without wrapping; day-of-week labels remain visible at the left edge; all cells remain at least 14px on their shortest side (comfortably tappable).
- **SC-006**: For an account whose activity includes 2+ distinct effective agents, the agent filter is shown; for an account with 0 or 1, the control is not present in the DOM.
- **SC-007**: For a brand-new account (created the same calendar year), the year dropdown exposes only "Last 12 months" — no additional years are selectable.
- **SC-008**: Tooltips for days where no job has recorded cost never contain the strings "$NaN" or "$0" — verified by inspecting the tooltip across a dataset that includes at least one cost-less job.
- **SC-009**: When the selected year starts mid-week, the grid's top-left corner is chipped (fewer cells in the first week); when it ends mid-week, the bottom-right corner is chipped — verified against 2024 (starts Monday) and a year ending mid-week.
- **SC-010**: The feature ships without adding a single new database table, column, or index.
