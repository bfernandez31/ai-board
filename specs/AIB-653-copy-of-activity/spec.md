# Feature Specification: Copy of Activity Heatmap on Projects Page

**Feature Branch**: `AIB-653-copy-of-activity`  
**Created**: 2026-04-15  
**Status**: Draft  
**Input**: User description: "Add a GitHub-style contribution heatmap on the projects page, below the project cards grid. The heatmap displays AI activity across all user projects over the past year."

## Auto-Resolved Decisions

- **Decision**: Clarification policy resolution for this ticket
- **Policy Applied**: AUTO (fell back to CONSERVATIVE)
- **Confidence**: Low (0.3, net score +1 from neutral user-facing feature context with no strong counter-signals)
- **Fallback Triggered?**: Yes — AUTO confidence was below 0.5, so the specification defaults to conservative assumptions
- **Trade-offs**:
  1. Ambiguities are resolved toward consistency, auditability, and stable user expectations rather than minimal scope
  2. Some UI details are more tightly defined up front, reducing implementation flexibility but avoiding rework later
- **Reviewer Notes**: Validate that conservative defaults match the intended projects-page experience; no security or data-model concerns were introduced

- **Decision**: Activity source and shipped-count definition
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — the ticket explicitly states that shipped counts come from successful `ship` workflow completion, not ticket stage alone
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Counts remain historically accurate even if a ticket reaches SHIP without a successful shipping workflow
  2. Users may see fewer shipped tickets than they would from stage-only counting, but the metric is more trustworthy
- **Reviewer Notes**: Confirm that stakeholders want shipping metrics anchored to successful workflow completion across all views using this concept

- **Decision**: Agent filter behavior uses effective agent resolution
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — the feature description explicitly requires combining ticket-level agent overrides with inherited project defaults
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Filter results match actual workflow ownership rather than only explicit ticket overrides
  2. The filter logic is less obvious to users who expect “unset” tickets to be excluded from agent-specific views
- **Reviewer Notes**: Agent labels should make sense to users even when the matching activity came from inherited project defaults

- **Decision**: Period handling preserves full date boundaries even when filters reduce visible activity
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — the ticket explicitly requires the grid shape to remain fixed for the selected period
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users can compare periods consistently because week columns and date positions do not shift under filtering
  2. Filtered views may contain many zero-value cells, but the visual timeline remains stable and shareable
- **Reviewer Notes**: The fixed-grid rule applies to both the rolling “Last 12 months” option and calendar-year views

- **Decision**: Empty-state and first-render behavior
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) — the desired outcome is explicit, but the exact rendering mechanics were not prescribed beyond immediate visibility and no flash
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users always see either populated data or the final empty state immediately on first view
  2. Initial data requirements are stricter, but the page avoids distracting loading transitions
- **Reviewer Notes**: Background refreshes should preserve visible content and only update values when fresh data arrives

## User Scenarios & Testing

### User Story 1 - Review Annual AI Activity Across Projects (Priority: P1)

A signed-in user opens the projects page and immediately sees a year-scale heatmap summarizing daily AI activity across all of their accessible projects. They can scan which days were active, how much work happened, and how many tickets were successfully shipped.

**Why this priority**: This is the core value of the feature. Without a trustworthy at-a-glance activity view, the heatmap does not justify its space on the projects page.

**Independent Test**: Can be fully tested by loading the projects page with existing job and ticket history and verifying that the heatmap, summary counts, labels, legend, and empty state reflect the selected period correctly on first render.

**Acceptance Scenarios**:

1. **Given** the user has job activity within the selected period, **When** they open the projects page, **Then** they see a full-width activity heatmap below the project cards with one cell per day in the selected period and cell intensity reflecting that day’s job count.
2. **Given** at least one ticket has a successful `ship` workflow completed in the selected period, **When** the summary header renders, **Then** the shipped-ticket count reflects only those successful `ship` workflow completions and excludes tickets that merely changed to SHIP stage.
3. **Given** the selected period contains no activity at all, **When** the heatmap section renders, **Then** the filters and legend remain visible and the grid area is replaced by the message "No activity to show yet — your AI work will appear here."

---

### User Story 2 - Change Period and Share a Specific View (Priority: P1)

A user changes the heatmap period to compare the rolling last 12 months with a specific calendar year, then shares the resulting filtered view with someone else by copying the page URL.

**Why this priority**: The heatmap is only useful if users can move between periods without losing context and can reproduce the exact same view after refresh or sharing.

**Independent Test**: Can be tested by selecting a period and filter state, refreshing the page, and opening the copied URL in a new session to verify that the same period and filter combination is restored.

**Acceptance Scenarios**:

1. **Given** the user account was created before the current year, **When** the period selector opens, **Then** it offers "Last 12 months" plus each calendar year from the account creation year through the current year.
2. **Given** the user account was created during the current year, **When** the heatmap header renders, **Then** only "Last 12 months" is available and the year selector is hidden or clearly non-interactive.
3. **Given** the user changes the selected period or agent filter, **When** the page URL is copied and reopened elsewhere, **Then** the same period and filter state is restored automatically.
4. **Given** the selected period starts or ends mid-week, **When** the heatmap renders, **Then** leading or trailing cells outside that period are omitted so the first and last week columns show GitHub-style chipped corners instead of padded blanks.

---

### User Story 3 - Filter Activity by Agent (Priority: P2)

A user wants to understand which agent generated recent activity, so they narrow the heatmap to one agent without changing the selected time period.

**Why this priority**: Agent-specific analysis adds meaningful comparison value, but it depends on the base heatmap and period controls already working.

**Independent Test**: Can be tested by loading activity that includes both explicit and inherited agents, selecting a specific agent, and verifying that only matching days remain counted while the grid boundaries stay unchanged.

**Acceptance Scenarios**:

1. **Given** the user has activity from multiple distinct agents, **When** the heatmap header renders, **Then** an agent filter is shown with an "All" option selected by default and one option per distinct agent present in the user’s activity data.
2. **Given** the user has activity from zero or one distinct agent in the selected data set, **When** the heatmap header renders, **Then** the agent filter is hidden.
3. **Given** a ticket has no explicit agent and inherits its project default agent, **When** the user filters by that inherited agent, **Then** the ticket’s activity is included in the filtered results.
4. **Given** the user filters to a specific agent, **When** the heatmap updates, **Then** the date range and week-column layout remain identical to the unfiltered period while only the activity counts and counters change.

---

### User Story 4 - Inspect Daily Details on Desktop and Mobile (Priority: P3)

A user wants to understand what happened on a specific day, so they open the daily tooltip and review shipped tickets, job count, cost, and the exact date on either desktop or mobile.

**Why this priority**: Day-level inspection is secondary to the summary view, but it turns the heatmap from a decorative chart into an actionable reporting surface.

**Independent Test**: Can be tested by hovering on desktop and tapping on mobile to confirm that the tooltip shows the expected details, handles missing cost values gracefully, and dismisses correctly.

**Acceptance Scenarios**:

1. **Given** a day with one or more shipped tickets, **When** the user opens that day’s tooltip, **Then** the tooltip lists the tickets shipped that day, the job count, the total recorded cost when present, and the formatted date.
2. **Given** a day where one or more jobs have no recorded cost, **When** the tooltip opens, **Then** it shows the job count and omits the cost line rather than displaying an invalid or misleading value.
3. **Given** a user is on a mobile device, **When** they tap a heatmap cell, **Then** the tooltip opens for that day and dismisses when they tap outside it.
4. **Given** the heatmap is wider than the mobile viewport, **When** the user scrolls horizontally, **Then** the day-of-week labels remain pinned on the left and the heatmap cells retain a tappable size without wrapping or shrinking into unreadable targets.

### Edge Cases

- What happens when the selected period includes days before the user account existed? Those days are still part of the selected period when "Last 12 months" is active, but they show zero activity unless real records exist.
- What happens when multiple jobs occur on the same day across different projects? The cell intensity and daily totals aggregate all matching activity into a single day entry.
- What happens when a day has shipped tickets but zero billable cost recorded? The tooltip shows the shipped tickets and job count but omits the cost line entirely.
- What happens when the user has no accessible projects with activity in the selected period? The heatmap shows the empty-state message while preserving the header controls and legend.
- What happens when a filtered view removes all visible activity from the selected period? The heatmap shows the same full-period grid area replaced by the empty-state message; the selected filter remains active.
- What happens when the first or last day of a selected calendar year does not align to a full week? The heatmap omits out-of-period cells rather than rendering placeholder cells outside the selected date range.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display an AI activity heatmap on the projects page below the project cards area and spanning the full content width of that section.
- **FR-002**: System MUST aggregate heatmap activity across all projects the current user is authorized to view.
- **FR-003**: System MUST represent each day in the selected period with at most one heatmap cell whose intensity is based on the total number of jobs recorded for that day.
- **FR-004**: System MUST render the heatmap with seven day-of-week rows and week-based columns aligned to the selected period.
- **FR-005**: System MUST omit cells that fall outside the selected period rather than rendering padded placeholders, producing chipped first and last week columns when the period starts or ends mid-week.
- **FR-006**: System MUST display month labels above the grid and day-of-week labels along the left edge.
- **FR-007**: System MUST display an intensity legend labeled from less activity to more activity.
- **FR-008**: System MUST display a summary header in the format "X jobs · Y tickets shipped in the last year" or the equivalent wording for the selected period.
- **FR-009**: System MUST count a ticket as shipped only on the date a `ship` workflow job completed successfully.
- **FR-010**: System MUST NOT count a ticket as shipped solely because its stage changed to SHIP.
- **FR-011**: System MUST provide a default period option for "Last 12 months" using a rolling 12-month window ending on the current date.
- **FR-012**: System MUST provide additional period options for each calendar year from the user’s account creation year through the current year when at least one full-year option exists.
- **FR-013**: System MUST hide or disable the period selector when only one selectable period is available.
- **FR-014**: System MUST provide an agent filter with an "All" option and one option per distinct agent present in the user’s activity data for the selected period.
- **FR-015**: System MUST derive agent filter options and matching results using effective agent resolution, where a ticket-level agent overrides the project default agent and an unset ticket agent inherits the project default agent.
- **FR-016**: System MUST hide the agent filter when zero or one distinct agents are present in the relevant activity data.
- **FR-017**: System MUST preserve the selected period boundaries and grid shape when an agent filter is applied.
- **FR-018**: System MUST encode the selected period and agent filter in the page URL so the same view is restored on refresh and when the URL is opened elsewhere.
- **FR-019**: System MUST show day-level detail on interaction with a heatmap cell, including the formatted date, job count, tickets shipped that day, and total recorded cost for that day when cost data exists.
- **FR-020**: System MUST omit the cost line from the day detail when no recorded cost exists for the contributing jobs on that day.
- **FR-021**: System MUST support hover-based day detail on pointer-driven devices and tap-to-open, tap-outside-to-dismiss behavior on touch devices.
- **FR-022**: System MUST show the final heatmap content or final empty state immediately on first render without an initial blank or spinner-only flash.
- **FR-023**: System MUST allow background data refreshes without clearing already visible heatmap content.
- **FR-024**: System MUST display the message "No activity to show yet — your AI work will appear here" in place of the grid when the selected period contains zero matching activity.
- **FR-025**: System MUST keep the legend and applicable filters visible when the empty state is shown.
- **FR-026**: System MUST allow horizontal scrolling for the heatmap on narrow screens without wrapping columns onto multiple lines.
- **FR-027**: System MUST keep day-of-week labels pinned on the left while the heatmap grid scrolls horizontally on mobile layouts.
- **FR-028**: System MUST preserve a tappable cell size on mobile rather than shrinking cells below comfortable touch targets.
- **FR-029**: System MUST use the existing project activity sources and MUST NOT require any new database models to provide this feature.
- **FR-030**: System MUST ensure the projects page can scroll naturally to reveal the heatmap section below the project cards grid.

### Key Entities

- **Activity Day**: A calendar day within the selected heatmap period. It combines that day’s total job count, shipped-ticket count, optional total recorded cost, and the tickets shipped on that day across all accessible projects.
- **Period Option**: A selectable date range for the heatmap. It is either the rolling "Last 12 months" window or a full calendar year bounded by the user’s account age and the current year.
- **Agent Filter Option**: A distinct effective agent value available in the user’s activity data, plus the synthetic "All" option that includes every agent.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can reach a stable first-view heatmap or its final empty state within 2 seconds of opening the projects page under normal authenticated usage.
- **SC-002**: 100% of shipped-ticket counts shown in the heatmap header and day details match successful `ship` workflow completions for the selected period.
- **SC-003**: A copied heatmap URL reproduces the same period and agent filter state after refresh or in a new session in 100% of validation cases.
- **SC-004**: On mobile-sized viewports, users can inspect any visible day without cell wrapping and with day labels remaining visible throughout horizontal scrolling.
- **SC-005**: When cost data is missing for a day, 100% of tooltips omit the cost line instead of showing an invalid numeric value.
- **SC-006**: For dates at the beginning and end of a selected period, 100% of rendered cells fall within the selected period and no out-of-period padding cells are displayed.

## Assumptions

- The feature summarizes activity available to the currently signed-in user across all projects they can access, not only projects they own outright.
- Job count is the primary intensity metric for the heatmap even when shipped-ticket counts and costs are also shown in the header and tooltip.
- Distinct agent options are derived from activity records that appear in the selected period so the filter only shows relevant choices.
- The phrase "last year" in the header should adapt to the selected period when the user is viewing a specific calendar year.
- Existing project page structure can be adjusted enough to allow normal vertical scrolling to the new section without changing the feature’s core scope.
