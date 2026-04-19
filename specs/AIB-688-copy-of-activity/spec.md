# Feature Specification: Activity Heatmap on Projects Page

**Feature Branch**: `AIB-688-copy-of-activity`
**Created**: 2026-04-19
**Status**: Draft
**Input**: User description: "Add a GitHub-style contribution heatmap on the projects page, below the project cards grid. The heatmap displays AI activity across all user projects over the past year."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Scope of "all user projects" — includes both projects the user owns and projects where the user is a member.
  - **Policy Applied**: AUTO → CONSERVATIVE (fallback)
  - **Confidence**: Low (signal score +1; user-data scoping is sensitive enough to warrant inclusive default that mirrors `/projects` page composition)
  - **Fallback Triggered?**: Yes — low overall confidence triggered CONSERVATIVE handling, which here means matching the existing `/projects` access model rather than inventing a narrower scope.
  - **Trade-offs**:
    1. Scope: Heatmap counts shared/member work the user collaborated on (matches what they already see on the page) at the cost of attributing some activity that wasn't initiated by them.
    2. Quality: Aligning with the existing project list avoids confusing UX where the page lists a project but its activity is missing from the heatmap.
  - **Reviewer Notes**: Confirm visibility expectations match the access model used by the project list directly above the heatmap.

- **Decision**: A "day" boundary for cells/tooltips uses the viewer's local browser time zone.
  - **Policy Applied**: AUTO → CONSERVATIVE (fallback)
  - **Confidence**: Low
  - **Fallback Triggered?**: Yes — explicit time zone is unspecified; CONSERVATIVE default is local time so what the user sees ("today") matches their wall clock, mirroring GitHub's contribution graph.
  - **Trade-offs**:
    1. UX: Days line up with the user's intuition ("Friday" looks right wherever they live).
    2. Consistency: Two users in different time zones will see the same job land on slightly different cells; acceptable because the heatmap is a personal view.
  - **Reviewer Notes**: Confirm acceptable; if backend pre-aggregation is preferred, switch to UTC and document.

- **Decision**: Intensity bucketing — five visual levels (level 0 = no activity, levels 1–4 = ascending violet shades) using quartile thresholds over the period's non-zero job counts.
  - **Policy Applied**: AUTO → CONSERVATIVE (fallback)
  - **Confidence**: Low
  - **Fallback Triggered?**: Yes — description shows a five-cell legend (`□□■■■`) but does not specify thresholds. Quartiles are the standard contribution-graph approach.
  - **Trade-offs**:
    1. UX: Adapts contrast to each user's data so light users still see meaningful gradient.
    2. Comparability: Heat across users is not directly comparable because thresholds are personal.
  - **Reviewer Notes**: Confirm quartile bucketing vs. fixed thresholds (e.g., 1, 3, 6, 10+).

- **Decision**: When a calendar year is selected and that year extends past today, only days up to today are colored; future cells in the partial period are rendered as empty (no activity), preserving the GitHub-style chipped-corner behavior at the trailing edge if applicable.
  - **Policy Applied**: AUTO → CONSERVATIVE
  - **Confidence**: Medium (the description specifies grid boundaries match the period, so this is an extension of stated behavior).
  - **Fallback Triggered?**: No
  - **Trade-offs**:
    1. UX: Avoids visually misleading "missing" data for days that have not happened.
    2. Simplicity: One rendering rule for past, current, and edge years.
  - **Reviewer Notes**: For the current calendar year, the trailing portion of the grid still shows empty cells (not chipped); only the leading non-Sunday start gets chipped. Confirm this matches expectations.

- **Decision**: Server-rendered initial data uses the user's default view ("Last 12 months", agent="All", no other filters). When the URL contains query params on first load, the server renders that view directly so there is still no spinner flash.
  - **Policy Applied**: AUTO → CONSERVATIVE
  - **Confidence**: Medium — the requirement explicitly forbids first-render spinner flash.
  - **Fallback Triggered?**: No
  - **Trade-offs**:
    1. UX: Shareable URLs render correctly on first paint.
    2. Cost: Server must read query params to drive the initial query.
  - **Reviewer Notes**: Confirm SEO/cache implications are acceptable (page is authenticated, so caching is per-user).

- **Decision**: Background refetch cadence aligns with the existing analytics dashboard polling interval (15s) so the heatmap updates silently without a separate polling channel.
  - **Policy Applied**: AUTO → CONSERVATIVE
  - **Confidence**: Medium
  - **Fallback Triggered?**: No
  - **Trade-offs**:
    1. Consistency: Reuses the analytics polling cadence already present in the product.
    2. Cost: Adds one more 15s polling channel on the projects page; lightweight payload (per-day aggregates).
  - **Reviewer Notes**: Confirm that piggy-backing on the analytics cadence is preferred over a longer interval (e.g., 60s) for a less-active page.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See my AI activity at a glance (Priority: P1)

A user opens the projects page and, below the grid of project cards, sees a contribution-graph-style heatmap showing how much AI work has been happening across their projects over the last 12 months. Brighter cells mean busier days. The header tells them how many jobs ran and how many tickets shipped in that period.

**Why this priority**: This is the core value of the feature — a single, immediate snapshot of "how productive has my AI been." Without this view there is no feature.

**Independent Test**: Sign in as a user with at least a few jobs and a couple of shipped tickets across the last year, navigate to `/projects`, and confirm: (a) the heatmap appears below the project cards on first paint with no spinner flash; (b) the header counter shows correct totals; (c) cells corresponding to days with jobs are visually shaded; (d) hovering a shaded cell shows the day's tooltip.

**Acceptance Scenarios**:

1. **Given** a signed-in user with jobs across multiple days in the last 12 months, **When** they load `/projects`, **Then** the heatmap renders immediately below the project cards with the correct date range, shaded cells for days with jobs, and a header reading "X jobs · Y tickets shipped in the last year".
2. **Given** the heatmap is visible, **When** the user hovers a shaded cell, **Then** a tooltip shows the formatted date, the ticket(s) shipped that day (if any), the job count, and the total cost (only when at least one job that day has a recorded cost).
3. **Given** the user has zero activity in the selected period, **When** the heatmap area renders, **Then** the grid is replaced by the message "No activity to show yet — your AI work will appear here", while the legend and any visible filters remain in place.

---

### User Story 2 - Drill into a specific year or agent (Priority: P2)

A user wants to look at activity for a specific calendar year (e.g., 2025) or to focus on jobs run by a specific agent. They use the year selector and the agent filter; the heatmap, header counter, and tooltips update to reflect the filtered view, and the URL updates so they can share or bookmark the exact view.

**Why this priority**: Without filtering, the heatmap is a static curiosity. Filters turn it into a tool for review, retros, and comparison. They are not P1 because the default ("Last 12 months", "All agents") covers the most common case.

**Independent Test**: As a user with multi-year activity and at least two distinct agents in their data, change the year selector to a past calendar year and the agent filter to a specific agent. Verify the grid boundaries match that calendar year exactly (chipped corners where appropriate), the header counter recomputes, and the URL contains query params reflecting the selection. Copy the URL into a new tab — same view appears with no spinner flash.

**Acceptance Scenarios**:

1. **Given** the user has account history spanning multiple years, **When** they open the year selector, **Then** the dropdown lists "Last 12 months" (default) plus each calendar year from the user's account creation year up to the current year, in descending order.
2. **Given** the user's data contains only one distinct agent (or zero), **When** the heatmap renders, **Then** the agent filter is hidden entirely.
3. **Given** the user's data contains two or more distinct agents, **When** the heatmap renders, **Then** the agent filter is visible with "All" selected by default and one option per distinct agent observed in the data.
4. **Given** a user filters by an agent that is set as a project's default but not explicitly on every ticket, **When** the heatmap is filtered to that agent, **Then** tickets without an explicit agent on that project are still counted (effective agent resolution).
5. **Given** the user has selected a year and agent, **When** they refresh the page or copy the URL into another browser tab, **Then** the same filters are applied and the same view renders on first paint.

---

### User Story 3 - Use the heatmap on mobile (Priority: P3)

A user on a phone opens `/projects`, scrolls past their project cards, and reaches the heatmap. The grid scrolls horizontally so cells stay tappable; the day-of-week labels stay pinned on the left as they scroll. Tapping a cell reveals its tooltip; tapping outside dismisses it.

**Why this priority**: Mobile usability matters but the heatmap is primarily a review/desktop tool. Treating mobile as P3 ensures the desktop experience ships first while not abandoning mobile.

**Independent Test**: Open `/projects` on a mobile viewport. Confirm the heatmap does not wrap or shrink cells below a tappable size, that horizontal scrolling works, that day-of-week labels stay visible while scrolling horizontally, and that tap-to-show / tap-outside-to-dismiss tooltip behavior works.

**Acceptance Scenarios**:

1. **Given** a mobile viewport, **When** the heatmap renders, **Then** cells are at least tappable size and the grid is horizontally scrollable rather than wrapped.
2. **Given** the heatmap is being scrolled horizontally on mobile, **When** the user scrolls past the start of the period, **Then** the day-of-week labels remain pinned on the left edge.
3. **Given** a tooltip is open after a cell tap, **When** the user taps outside the tooltip, **Then** it dismisses.

---

### Edge Cases

- **Brand-new user (account created today)**: No multi-year history; the year selector hides or disables additional options, leaving only "Last 12 months". If the user has no jobs at all, the empty-state message replaces the grid.
- **Period contains zero activity** (filtered or not): The grid area shows the centered empty-state message; legend and filters remain visible so the user can change the selection.
- **Day with jobs but no recorded cost**: Tooltip shows the job count and the date, omits the cost line entirely. Never display "$NaN" or "$0" as a placeholder for missing cost.
- **Day with shipped tickets but zero ship-job successes**: A ticket that was moved to SHIP without a successful `ship` workflow job is not counted as shipped that day. Counter and tooltip honor the same rule.
- **Calendar year that doesn't begin on Sunday or end on Saturday**: The grid renders with a chipped top-left and/or bottom-right corner — empty space where days outside the period would have been.
- **Future days within current calendar year**: Rendered as empty (no-activity) cells, not omitted, so the grid keeps a regular shape for the trailing edge of the current year.
- **Filter changes**: The grid boundaries and rendered cells stay the same; only intensity, header counter, and tooltip data change.
- **Long-running background refetch**: Background refetches must update silently. The heatmap must never blank out, swap to a spinner, or "flash" while a refetch is in flight.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `/projects` page MUST render an Activity Heatmap section, full-width, positioned below the project cards grid. Page scroll behavior MUST allow the heatmap to be reached naturally (the existing constraint on the project grid must be relaxed if it would prevent reaching the heatmap).
- **FR-002**: The heatmap MUST display a 7-row grid (one row per day of the week) with one column per week in the selected period; column count MUST match the selected period's week span.
- **FR-003**: Month labels MUST appear above the grid; day-of-week labels MUST appear to the left of the grid.
- **FR-004**: Cell intensity MUST be driven by the number of jobs for that calendar day (in the user's local time zone), bucketed into five visual levels (no-activity + four ascending shades) using a violet gradient consistent with the project's aurora theme and readable on the dark theme (WCAG AA contrast).
- **FR-005**: When the selected period does not begin on a Sunday or does not end on a Saturday, the grid MUST omit the cells outside the period rather than rendering placeholders, producing a "chipped" corner that matches the GitHub contribution-graph behavior.
- **FR-006**: An intensity legend MUST appear at the bottom-right of the heatmap area, labeled "Less" on the left and "More" on the right with five swatches between, matching the cell color scale.
- **FR-007**: A header counter MUST appear above the grid in the form "X jobs · Y tickets shipped in the last year" (or matching the selected period label) and MUST update when filters or period change.
- **FR-008**: A ticket counts as "shipped" on a given day if and only if its `ship` workflow job completed successfully on that day. Stage transitions to SHIP without a successful `ship` job MUST NOT contribute to the shipped count.
- **FR-009**: The period selector MUST default to "Last 12 months" (rolling) and MUST list, in descending order, each calendar year from the user's account creation year up to the current year. If the user's account was created in the current calendar year, the additional year options MUST NOT be presented (the dropdown is hidden or rendered disabled).
- **FR-010**: Tooltips MUST appear on hover (desktop) and on tap (mobile). Tooltips MUST include: the formatted date; the list of tickets shipped that day (if any); the job count for that day. Tooltips MUST include a total cost line only when at least one job that day has a recorded cost; tooltips MUST NEVER display "$NaN" or "$0" as a stand-in for missing cost data.
- **FR-011**: On mobile, tooltips MUST be dismissible by tapping outside them.
- **FR-012**: An agent filter MUST be available when the user's data contains two or more distinct agents (combining explicit `ticket.agent` values and the effective agent inherited from `project.defaultAgent`). If only zero or one distinct agent is present, the filter MUST be hidden entirely.
- **FR-013**: When visible, the agent filter MUST always include an "All" option, selected by default, plus one option per distinct agent actually present in the user's data.
- **FR-014**: When the user filters by a specific agent, the filter MUST honor effective agent resolution — tickets with no explicit agent on a project whose default is that agent MUST be included.
- **FR-015**: Filter state (period and agent) MUST be reflected in URL query parameters such that copying the URL and opening it elsewhere reproduces the same view, including on first paint.
- **FR-016**: The grid boundaries MUST always reflect the selected period; filters MUST NOT alter the grid boundaries, only the data within them.
- **FR-017**: Initial render MUST use server-supplied data so that the heatmap is visible immediately on first paint, with no spinner or skeleton flash. This MUST hold both for the default view and for any view requested via URL query params.
- **FR-018**: Background refetches MUST update the heatmap silently — no blanking of the grid, no spinner overlay, no layout shift.
- **FR-019**: When the entire selected period contains zero job activity, the grid area MUST be replaced by a centered message: "No activity to show yet — your AI work will appear here". The legend and filters MUST remain visible.
- **FR-020**: On mobile viewports, the grid MUST scroll horizontally rather than wrap or shrink cells below a tappable size.
- **FR-021**: On mobile, the day-of-week labels MUST remain visible (pinned to the left edge) while the grid is scrolled horizontally.
- **FR-022**: The feature MUST NOT introduce new database models; it MUST derive all data from the existing `Job` and `Ticket` records and their relationships.
- **FR-023**: The heatmap data scope MUST cover all projects accessible to the signed-in user (owner OR member), matching the access scope of the project list shown above the heatmap.

### Key Entities

- **Job**: A unit of AI work executed for a ticket. Drives the cell intensity (count) and the tooltip's job count and cost roll-up. Only `ship`-command jobs that completed successfully drive the "tickets shipped" counter and tooltip "shipped" list.
- **Ticket**: A unit of work that progresses through stages. Provides the `agent` value for filtering and is the unit counted as "shipped" once it has a successfully completed `ship` job.
- **Project**: Owns tickets and provides `defaultAgent`, used in effective agent resolution when a ticket has no explicit `agent`.
- **User**: Owner of the heatmap view. Account creation date drives the year-selector option list. Membership and ownership define which projects' data appear in the heatmap.

### Internal Processes

- **Heatmap data aggregation (server-side, on each page load and refetch)**:
  - **Input**: Authenticated user identity; selected period (default "Last 12 months" or a specific calendar year); optional agent filter; optional URL query params for both.
  - **Phases**:
    1. Resolve the set of projects accessible to the user (owned + member).
    2. Resolve the period's date range in the user's local time zone (server uses the timezone hint from the request, or falls back to UTC).
    3. Aggregate jobs across that scope and range into per-day buckets: count of jobs, sum of cost (skipping nulls so missing costs do not contaminate the total).
    4. Aggregate `ship`-command jobs that completed successfully into per-day "shipped tickets" lists.
    5. Compute the distinct agent set across the in-scope tickets (explicit `ticket.agent` ∪ effective agent inherited from `project.defaultAgent`) for filter visibility and option list.
    6. If an agent filter is applied, restrict the per-day aggregates to jobs whose ticket resolves to that agent (with effective resolution).
    7. Compute period totals (X jobs, Y tickets shipped) and the intensity bucket thresholds for the period.
  - **Output**: A single payload per request containing per-day records (date, job count, total cost or null, shipped ticket list), the distinct agent set, the period totals, and the intensity threshold values.
  - **Error behavior**: If aggregation fails for the requested period, the heatmap renders the empty-state message and a non-blocking error indicator; background refetches retry silently. Failures MUST NOT break the rest of the projects page.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On first paint of the `/projects` page for a signed-in user, the heatmap is visible with real data and no spinner/skeleton flash in 100% of page loads (verified via E2E).
- **SC-002**: The header counter ("X jobs · Y tickets shipped") matches an independently computed truth from the underlying job/ticket data within 0 deviation across at least 20 sampled user accounts.
- **SC-003**: The agent filter is hidden for users with 0 or 1 distinct agent in their data and visible (with "All" + one option per distinct agent) for users with 2 or more, in 100% of cases.
- **SC-004**: For any selected calendar year that does not start on Sunday or end on Saturday, the grid renders with the correct chipped corners (no out-of-period cells displayed), in 100% of years tested.
- **SC-005**: A URL with period and agent query params, when opened in a new browser session, reproduces the same heatmap view as the original session on first paint, in 100% of attempts.
- **SC-006**: Tooltips never display "$NaN" or "$0" for days where no job has a recorded cost; instead the cost line is omitted, in 100% of inspected tooltips.
- **SC-007**: On a mobile viewport (≤ 480px wide), all heatmap cells remain at least 14×14 CSS pixels (a tappable size) and the grid is horizontally scrollable; day-of-week labels remain visible while scrolling horizontally.
- **SC-008**: When the user has zero activity for the selected period, the empty-state message is shown in place of the grid in 100% of cases, while legend and filters remain visible.
