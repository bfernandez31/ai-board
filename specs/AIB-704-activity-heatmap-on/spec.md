# Feature Specification: Activity Heatmap on Projects Page

**Feature Branch**: `AIB-704-activity-heatmap-on`
**Ticket**: AIB-704
**Created**: 2026-04-21
**Status**: Draft
**Input**: User description: "Add a GitHub-style contribution heatmap on the projects page, below the project cards grid. The heatmap displays AI activity across all user projects over the past year."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

Clarification policy requested: **AUTO**. Signal analysis produced a neutral/low net score (~+1, absScore ≈ 1, Low confidence), so every automated decision below fell back to **CONSERVATIVE** per the guardrail. All fallbacks are safe defaults that can be revisited during planning if reviewers disagree.

- **Decision**: What counts as a "user's project" for heatmap data scope.
  - **Policy Applied**: AUTO → CONSERVATIVE (fallback)
  - **Confidence**: Low (0.3)
  - **Fallback Triggered?**: Yes — neutral signal set
  - **Trade-offs**:
    1. Include both owned and member projects, matching the existing projects-page data scope; slightly larger query set than "owned only".
    2. Gives the member-heavy collaborator a meaningful heatmap instead of an empty one.
  - **Reviewer Notes**: Confirm the product wants member activity surfaced here too; if not, scope should narrow to `project.userId = currentUser` only.

- **Decision**: Day boundary used to bucket activity into heatmap cells.
  - **Policy Applied**: AUTO → CONSERVATIVE (fallback)
  - **Confidence**: Low (0.3)
  - **Fallback Triggered?**: Yes
  - **Trade-offs**:
    1. Aggregate by the server's native date bucket so totals are stable and cache-friendly across clients.
    2. Users in very different time zones may see a job land on the adjacent day relative to their wall-clock — acceptable for a yearly overview, not for minute-level analytics.
  - **Reviewer Notes**: If the product insists on per-user-time-zone buckets, add a server-side time zone hint to the query and flag in planning.

- **Decision**: Which job commands contribute to the "job count" cell intensity.
  - **Policy Applied**: AUTO → CONSERVATIVE (fallback)
  - **Confidence**: Low (0.3)
  - **Fallback Triggered?**: Yes
  - **Trade-offs**:
    1. Count every job command the system records (specify/plan/implement/verify/ship/quick-impl/iterate/health-scan/comment-*/deploy-preview/rollback-reset). Matches the "AI activity" framing in the ticket.
    2. Deploy/rollback days show activity even if nothing user-visible shipped — users must read the tooltip for nuance, but cell color is never misleadingly empty.
  - **Reviewer Notes**: If any job commands should be excluded (e.g., rollback-reset is arguably "negative" activity), list them in planning and the aggregation filter will be narrowed.

- **Decision**: How "tickets shipped" is counted when a project has never dispatched a ship job (legacy data).
  - **Policy Applied**: AUTO → CONSERVATIVE (fallback)
  - **Confidence**: Low (0.3)
  - **Fallback Triggered?**: Yes
  - **Trade-offs**:
    1. Strictly use `ship` job `completedAt` when `status = COMPLETED`. Legacy tickets whose stage reached SHIP without a ship job simply do not appear in the counter (honors the ticket's explicit instruction).
    2. Back-dated or manually-shipped tickets look absent, which surfaces a data gap rather than fabricating a ship date.
  - **Reviewer Notes**: If historical accuracy matters for onboarding demos, consider a one-time backfill of ship jobs — out of scope for this feature.

- **Decision**: Cell-intensity bucketing algorithm when the user has a wildly skewed distribution.
  - **Policy Applied**: AUTO → CONSERVATIVE (fallback)
  - **Confidence**: Low (0.3)
  - **Fallback Triggered?**: Yes
  - **Trade-offs**:
    1. Five buckets (0, low, medium, high, very-high), thresholds derived from the period's non-zero percentiles (e.g., p50, p75, p90 — final boundaries are a planning concern). Mirrors GitHub's adaptive scale.
    2. Fixed thresholds (e.g., 1/3/5/10) are simpler but make heavy users' heatmaps saturate and light users' read as blank.
  - **Reviewer Notes**: Confirm the bucketing strategy with design; if a simpler fixed scale is preferred for consistency across users, switch in planning.

- **Decision**: Layout change needed to reveal the heatmap below the existing project grid.
  - **Policy Applied**: AUTO → CONSERVATIVE (fallback)
  - **Confidence**: Low (0.3)
  - **Fallback Triggered?**: Yes
  - **Trade-offs**:
    1. Relax the current inner-scroll constraint on the project grid so the whole page scrolls naturally. Heatmap is reachable by scrolling the page, not a nested container.
    2. Loses the "always-visible grid with sticky chrome" affordance; the trade is acceptable because the grid was already bounded only by a viewport-height calc.
  - **Reviewer Notes**: If product wants the grid to keep its fixed viewport height, the heatmap must live in a separate scroll region and the relationship with the grid should be clarified before planning.

- **Decision**: Refetch cadence for the heatmap once the page is loaded.
  - **Policy Applied**: AUTO → CONSERVATIVE (fallback)
  - **Confidence**: Low (0.3)
  - **Fallback Triggered?**: Yes
  - **Trade-offs**:
    1. Background refresh on window focus and on an interval comparable to the analytics dashboard (~15s). Updates are applied silently.
    2. A heatmap rarely changes minute-to-minute; this is mildly wasteful for idle users but keeps behavior consistent with other dashboards.
  - **Reviewer Notes**: If cost/perf is a concern, relax to on-focus-only during planning.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — See my AI activity at a glance (Priority: P1)

As a signed-in user on `/projects`, I scroll past my project cards and land on a yearly heatmap of my AI activity across every project I can access. Each cell represents one day; the darker the violet, the more jobs ran that day.

**Why this priority**: This is the feature's core value — surfacing that AI work is happening and producing a satisfying "streak" artifact users will share. Without this, everything else (filters, tooltips) is meaningless.

**Independent Test**: Sign in as a user with at least one project and a handful of jobs over the last year, load `/projects`, scroll down, and verify a heatmap appears rendering a violet cell for each day that has jobs and an empty cell for each day that does not. The summary counter above the grid reports total jobs and tickets shipped in the rendered period.

**Acceptance Scenarios**:

1. **Given** I am signed in and my account has jobs completed on several past days, **When** I open `/projects`, **Then** the heatmap renders with populated cells on those days and the counter reads "N jobs · M tickets shipped in the last year" where N and M reflect real data.
2. **Given** I open `/projects` with prior heatmap data, **When** the page first paints, **Then** the heatmap is visible immediately with data (no spinner flash) because the initial payload is rendered server-side.
3. **Given** I am signed in but have no jobs anywhere in the selected period, **When** I view the heatmap, **Then** an empty-state message appears ("No activity to show yet — your AI work will appear here") while the filters and legend remain visible.

---

### User Story 2 — Switch between a rolling year and specific calendar years (Priority: P1)

I can change the period shown in the heatmap using a selector. The default is a rolling "Last 12 months" ending today. I can also pick any calendar year from the year I joined up to the current year.

**Why this priority**: Without a period selector the header text "in the last year" is meaningless and users cannot revisit historical periods. This is part of the core feature surface.

**Independent Test**: As a user who joined more than one calendar year ago, open the period selector and confirm it offers "Last 12 months" plus each calendar year between the join year and the current year. Select a past year; the grid redraws with that year's boundaries and the counter updates.

**Acceptance Scenarios**:

1. **Given** I joined in a prior calendar year, **When** I open the period selector, **Then** I see "Last 12 months" (default) plus each calendar year from my join year through the current year, in reverse chronological order.
2. **Given** I created my account earlier this calendar year, **When** I look for a period selector, **Then** either no selector is shown or it is shown disabled with only "Last 12 months" — there are no picker options that would reveal years before I signed up.
3. **Given** I select a specific calendar year, **When** the grid re-renders, **Then** the grid spans exactly January 1 through December 31 of that year; weeks that the year does not fully cover are "chipped" (no cells rendered before January 1 if it is not a Sunday, no cells rendered after December 31 if it is not a Saturday).
4. **Given** I select "Last 12 months", **When** the grid renders, **Then** it spans the day exactly 365 days before today through today, with chipped corners as needed for partial weeks at both ends.

---

### User Story 3 — Inspect a single day without clicking through (Priority: P1)

I can hover (or tap on mobile) a cell to see a tooltip with the date, the count of jobs that ran, the total cost of those jobs, and the tickets that shipped on that day.

**Why this priority**: The heatmap as a pure color block is eye candy; the tooltip is where it becomes actionable. Shipping tickets and cost are the two signals users want most.

**Independent Test**: Hover a populated cell and verify the tooltip shows (in order) the formatted date, the tickets shipped that day (if any), and a single "N jobs · $X.XX" line. Hover a day where jobs exist but none recorded cost and verify the cost is omitted — never rendered as "$NaN" or "$0".

**Acceptance Scenarios**:

1. **Given** a day had jobs that all recorded a cost, **When** I hover its cell, **Then** the tooltip shows "N jobs · $X.XX" where $X.XX is the sum of recorded costs.
2. **Given** a day had jobs but none of them recorded a cost, **When** I hover its cell, **Then** the tooltip shows "N jobs" only — no cost line at all.
3. **Given** a day had some jobs with cost and some without, **When** I hover its cell, **Then** the tooltip shows "N jobs · $X.XX" where $X.XX is the sum of costs that were recorded. The summary does not claim to cover jobs without cost data.
4. **Given** one or more tickets had their `ship` job complete successfully on that day, **When** I hover the cell, **Then** the tooltip lists each shipped ticket by its key and title.
5. **Given** a ticket's stage changed to SHIP on that day but no `ship` job ever completed successfully, **When** I hover the cell, **Then** that ticket is NOT listed as shipped.
6. **Given** I am on a touch device, **When** I tap a cell, **Then** its tooltip appears and remains visible until I tap outside the cell, at which point it dismisses.

---

### User Story 4 — Filter by AI agent (Priority: P2)

When my account has work from more than one AI agent, I can filter the heatmap to a single agent. A ticket with no explicit agent on a project whose default is that agent is included when I filter for that agent.

**Why this priority**: Agent filtering is secondary to the core heatmap but is called out as a must-have for multi-agent accounts and matches an established pattern from the analytics dashboard.

**Independent Test**: As a user with jobs from two or more distinct agents, confirm the agent filter is visible with an "All" default plus one option per distinct agent. Select a specific agent and verify cells redraw to include only jobs whose effective agent matches the selection, including tickets that inherit the agent via their project's default.

**Acceptance Scenarios**:

1. **Given** my account's jobs span two or more distinct agents (resolved as `ticket.agent ?? project.defaultAgent`), **When** I open `/projects`, **Then** an agent filter is visible with "All" (selected by default) plus one option per distinct agent.
2. **Given** my account's jobs all resolve to 0 or 1 agent, **When** I open `/projects`, **Then** no agent filter is rendered — there is nothing to filter.
3. **Given** I pick a specific agent in the filter, **When** the grid recomputes, **Then** every counted job belongs to a ticket whose effective agent equals the selected agent; tickets whose `agent` field is null but whose project `defaultAgent` matches are included.
4. **Given** I change the agent filter, **When** the grid redraws, **Then** the grid boundaries (start date, end date, chipped corners) are identical to the unfiltered view — only the cell values change.

---

### User Story 5 — Share a filtered view via URL (Priority: P2)

The period and agent I've selected are reflected in the URL query string. Copying the URL and opening it in another tab or window reproduces the same view.

**Why this priority**: Sharability is a standard expectation for filter-driven dashboards and makes the heatmap useful for reporting and cross-device continuity.

**Independent Test**: Set a specific year and a specific agent, copy the browser URL, open it in a new private window logged in as the same user, and confirm the heatmap restores the same period and agent filter.

**Acceptance Scenarios**:

1. **Given** I change the period selector, **When** the view updates, **Then** a corresponding query parameter in the URL updates to reflect the new period.
2. **Given** I change the agent filter, **When** the view updates, **Then** a corresponding query parameter in the URL updates to reflect the new agent.
3. **Given** I open a URL with both parameters set, **When** `/projects` loads, **Then** the heatmap honors both and renders the matching view on first paint.
4. **Given** I land on `/projects` with no query parameters, **When** the page loads, **Then** the heatmap defaults to "Last 12 months" and agent "All" (or agent filter hidden if not applicable).

---

### User Story 6 — Use the heatmap on mobile (Priority: P3)

On a narrow screen, the grid scrolls horizontally instead of wrapping or shrinking cells below a tappable size. Day-of-week labels stay pinned to the left edge during horizontal scroll so I never lose my orientation.

**Why this priority**: Nice-to-have polish that ensures the feature is usable on phones.

**Independent Test**: Open `/projects` on a narrow viewport (≤ 480px wide), confirm cells stay at a tappable size, scroll horizontally, and confirm the day-of-week column stays pinned while months/dates scroll beneath it.

**Acceptance Scenarios**:

1. **Given** a narrow viewport, **When** the heatmap renders, **Then** cells remain at a tappable size and the grid overflows horizontally rather than wrapping to multiple rows of weeks.
2. **Given** the grid overflows horizontally on a narrow viewport, **When** I scroll it horizontally, **Then** the left-side day-of-week labels (Mon/Wed/Fri) remain pinned in place.
3. **Given** I tap a cell on a touch device, **When** the tooltip appears, **Then** tapping outside the cell dismisses it.

---

### Edge Cases

- **Brand-new account (no jobs yet)**: empty-state message shown in place of the grid; filters and legend remain visible; year selector collapses or hides per US-2.
- **Year selector overlaps account creation date**: the earliest year offered equals the join year; earlier years are never shown.
- **Jobs exist but every single one is missing cost data**: counter is accurate; tooltips omit the cost line everywhere; no "$NaN" or stray "$0" appears.
- **Future-dated job timestamps (clock drift)**: days in the future are not rendered as cells even if a job timestamp says otherwise; clamp to today.
- **Very long day (≥ 1,000 jobs in one cell)**: intensity caps at the top bucket; tooltip displays the real count (no truncation).
- **Agent filter reduces the visible data to zero**: grid renders empty cells across the period; the empty-state message does NOT appear (it's reserved for a genuinely inactive period).
- **User is signed out or session expires while the page is open**: the heatmap does not leak data across accounts; on the next refresh, it either redirects to login or shows the empty state for the anonymous session.
- **Tickets shipped via legacy flow (stage changed to SHIP without a completed ship job)**: not counted as shipped (honors the ticket rule); an audit discrepancy would be handled as a separate data-backfill task, out of scope.
- **Timezone edge (jobs near UTC midnight)**: a job completed around midnight may fall into the adjacent day relative to the user's wall clock. Acceptable for a yearly overview; flagged in Auto-Resolved Decisions.

## Requirements *(mandatory)*

### Functional Requirements

**Data scope & aggregation**

- **FR-001**: The system MUST render the activity heatmap using only jobs and tickets from projects the current user owns OR is a member of.
- **FR-002**: The system MUST bucket jobs into daily cells by the job's completion date (or creation date when completion is unavailable), aggregated server-side.
- **FR-003**: The system MUST compute "tickets shipped" on a given day as the count of tickets whose `ship` job `completedAt` falls on that day with job `status = COMPLETED`. Stage changes to SHIP without a corresponding completed ship job MUST NOT be counted.
- **FR-004**: The system MUST compute the tooltip's total cost for a day as the sum of `costUsd` across that day's jobs, treating null/missing `costUsd` as "no data" rather than zero. If every job on a day has null cost, the tooltip MUST omit the cost line entirely.

**Grid & layout**

- **FR-005**: The system MUST render a 7-row grid (one row per day of the week) whose column count matches the number of calendar weeks spanned by the selected period.
- **FR-006**: The system MUST render month labels above the grid and day-of-week labels to the left of the grid.
- **FR-007**: The system MUST NOT render cells that fall outside the selected period's date boundaries. When the first day of the period is not a Sunday, the cells from Sunday up to (but excluding) that day MUST be absent, producing a "chipped" top-left corner. The symmetric rule MUST apply to the bottom-right when the last day of the period is not a Saturday.
- **FR-008**: The system MUST use a 5-level violet intensity scale consistent with the aurora theme, where level 0 is "no activity" and levels 1–4 represent increasing cell density derived from the non-zero distribution within the selected period.
- **FR-009**: The system MUST render a legend at the bottom-right of the heatmap showing the intensity scale from "Less" to "More".
- **FR-010**: The system MUST render an empty-state message ("No activity to show yet — your AI work will appear here") in place of the grid — while keeping filters and legend visible — when the entire selected period has zero jobs AND zero shipped tickets across the user's data.
- **FR-011**: The heatmap MUST live below the project cards grid on `/projects` and occupy the full content width.
- **FR-012**: The layout of `/projects` MUST allow the page to scroll naturally so the user can reach the heatmap by scrolling the page (not a nested scroll region). The existing viewport-height constraint on the project-cards container MUST be adjusted accordingly.

**Header & period selector**

- **FR-013**: The system MUST render a header counter in the form "X jobs · Y tickets shipped in the last year" (or "in {year}" when a specific year is selected), where X and Y are computed from the filtered, period-bounded data set.
- **FR-014**: The system MUST provide a period selector with "Last 12 months" as the default option and one option per calendar year from the user's account creation year through the current year.
- **FR-015**: If the user's account was created in the current calendar year, the period selector MUST either be hidden or presented disabled, with "Last 12 months" as the only effective option. Years prior to the account creation year MUST NEVER be offered.

**Agent filter**

- **FR-016**: The system MUST build agent filter options dynamically from the user's actual data, combining explicit `ticket.agent` values and the effective agent inherited from `project.defaultAgent` when `ticket.agent` is null.
- **FR-017**: The agent filter MUST include an "All" option and MUST default to "All" on initial load.
- **FR-018**: If the user's data resolves to 0 or 1 distinct agent, the agent filter MUST NOT be rendered.
- **FR-019**: When a specific agent is selected, the system MUST include jobs from tickets whose effective agent (resolved as `ticket.agent ?? project.defaultAgent`) equals the selected agent.
- **FR-020**: Applying the agent filter MUST NOT change grid boundaries, chipped corners, legend, or the period header; it MUST only change the data used to compute cell intensity, the counter, and tooltip contents.

**Tooltip**

- **FR-021**: Hovering a cell on a pointer device MUST display a tooltip containing (in order): the formatted date, the shipped tickets for that day (if any, listed by ticket key and title), and a job summary line.
- **FR-022**: The job summary line MUST read "N jobs · $X.XX" when at least one job has recorded cost, where $X.XX is the sum of recorded costs that day. When no job on that day recorded cost, the line MUST read "N jobs" with no cost fragment, dollar sign, or zero placeholder.
- **FR-023**: On touch devices, tapping a cell MUST display its tooltip and tapping outside the cell MUST dismiss it.

**URL, loading, and refresh behavior**

- **FR-024**: Active period and agent filters MUST be reflected in the page URL as query parameters such that opening the URL in a new browser tab or window (signed in as the same user) restores the same view.
- **FR-025**: The initial render of the heatmap MUST include real data (server-rendered) so the user sees the populated grid without a loading spinner or blanked region on first paint.
- **FR-026**: Background refetches of heatmap data MUST NOT blank, shimmer, or flash the visible grid; updates MUST apply silently when they land.

**Mobile**

- **FR-027**: On narrow viewports, the grid MUST overflow horizontally rather than wrap or shrink cells below a tappable size (minimum target: comfortable tap — precise dimensions are a planning concern).
- **FR-028**: On narrow viewports with a horizontally scrollable grid, the day-of-week labels MUST remain pinned to the left edge while months/dates scroll beneath them.

**Data model**

- **FR-029**: This feature MUST NOT introduce new database models. All data presented MUST be derived from existing `User`, `Project`, `Ticket`, and `Job` records.

### Key Entities

- **User**: the signed-in viewer. Provides the "account creation year" used as the lower bound of the period selector and the access scope (owned projects plus member projects).
- **Project**: owned by a user; has a `defaultAgent` that participates in effective-agent resolution. Membership relations widen the set of projects whose activity is visible to a viewer.
- **Ticket**: belongs to a project. Carries optional `agent` (falls back to `project.defaultAgent`). Its "shipped" status for counting purposes is derived exclusively from its `ship` job completion, not from its stage field.
- **Job**: belongs to a ticket. Key attributes used by this feature: `command` (including `ship`), `status` (notably `COMPLETED`), `completedAt` (used as the day-of-record), and `costUsd` (nullable — treated as "no data", never zero).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On `/projects`, the heatmap is visible and populated with real user data within the first paint (no visible loading spinner or skeleton on the heatmap region on initial load) for at least 95% of page loads by authenticated users with prior activity.
- **SC-002**: Selecting a different period (year or "Last 12 months") updates the grid, header counter, and URL within 1 second on a broadband connection.
- **SC-003**: Selecting a different agent updates cell intensities, header counter, and URL within 1 second without changing the grid boundaries.
- **SC-004**: Copying the `/projects` URL with filters applied and opening it in a new browser context (same signed-in user) reproduces the identical heatmap view 100% of the time.
- **SC-005**: On a mobile viewport ≤ 480px wide, the grid is horizontally scrollable with day-of-week labels pinned; cells remain at a tappable size.
- **SC-006**: For a day whose jobs all have null cost, the tooltip never contains the substring "$NaN" and never shows "$0" as a stand-in for missing cost data.
- **SC-007**: A ticket whose stage is SHIP but whose `ship` job never completed is never counted in the "tickets shipped" header or in any day's tooltip.
- **SC-008**: For a user account with zero activity in the selected period, the empty-state message appears once in place of the grid; filters and legend remain rendered and interactive.
- **SC-009**: A user whose data spans two or more distinct effective agents sees the agent filter; a user whose data resolves to 0 or 1 agent does not.
- **SC-010**: The first day of the selected period renders in the correct row (aligned to its weekday); no cells are rendered before that day or after the last day of the period.
