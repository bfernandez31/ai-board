# Feature Specification: Activity Heatmap on Projects Page

**Feature Branch**: `AIB-701-activity-heatmap-on`  
**Created**: 2026-04-20  
**Status**: Draft  
**Input**: User description: "Add a GitHub-style contribution heatmap on the projects page, below the project cards grid. The heatmap displays AI activity across all user projects over the past year."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Clarification policy outcome

- **Decision**: Use the ticket-provided `AUTO` policy, but apply conservative defaults because the request is a standard user-facing feature with low-confidence heuristics rather than a strong speed or risk signal.
- **Policy Applied**: AUTO
- **Confidence**: Low (net score `+1`, confidence `0.3`) — detected neutral user-facing feature context, with no strong sensitive, compliance, or explicit speed signals.
- **Fallback Triggered?**: Yes — AUTO fell back to CONSERVATIVE because confidence was below `0.5`.
- **Trade-offs**:
  1. Preserves a higher-quality default for data definitions, empty states, and shareable filtering behavior.
  2. May keep some polish expectations that a purely speed-focused interpretation would defer.
- **Reviewer Notes**: Validate that the conservative fallback matches product intent for this analytics-style experience; no unresolved ambiguity remains after fallback.

### Decision 2: Period and boundary behavior

- **Decision**: The heatmap always preserves the full selected period, including partial first and last weeks with GitHub-style chipped corners instead of padded blank cells.
- **Policy Applied**: AUTO with CONSERVATIVE fallback
- **Confidence**: Medium (`0.6`) — the prompt explicitly describes chipped-corner behavior and unchanged grid boundaries under filtering.
- **Fallback Triggered?**: No — the requirement is explicit enough to stand on its own after the policy fallback.
- **Trade-offs**:
  1. Keeps the visualization faithful to the selected period rather than distorting it with filler cells.
  2. Requires users to interpret irregular first and last week shapes, which is less uniform but more accurate.
- **Reviewer Notes**: Confirm the product team wants parity with GitHub’s visual convention rather than a rectangular calendar grid.

### Decision 3: Shipped ticket counting rule

- **Decision**: A ticket contributes to the shipped total only on the date a successful `ship` workflow job completes; stage changes alone never count.
- **Policy Applied**: AUTO with CONSERVATIVE fallback
- **Confidence**: High (`0.9`) — the prompt explicitly defines the counting rule.
- **Fallback Triggered?**: No.
- **Trade-offs**:
  1. Produces a trustworthy shipped metric tied to an auditable completion event.
  2. Tickets advanced manually without a successful ship run will not increase the shipped total, which may differ from some users’ expectations.
- **Reviewer Notes**: This rule should remain aligned with any future reporting surfaces that summarize shipped work.

### Decision 4: Agent filtering semantics

- **Decision**: The agent filter uses effective agent resolution, combining explicit ticket-level agent choices with inherited project defaults, and is hidden when there is nothing meaningful to filter.
- **Policy Applied**: AUTO with CONSERVATIVE fallback
- **Confidence**: High (`0.9`) — the feature description specifies both the data source and the inheritance rule.
- **Fallback Triggered?**: No.
- **Trade-offs**:
  1. Users see filtering behavior that matches how work was actually assigned.
  2. The filter may surface agent names that are not explicitly stored on every ticket, which requires clear interpretation in review and testing.
- **Reviewer Notes**: Confirm naming and ordering remain consistent with the analytics dashboard pattern the feature references.

### Decision 5: First-render data behavior

- **Decision**: The first page render must show populated heatmap data immediately for the default view, while later refreshes update in the background without blanking the visible state.
- **Policy Applied**: AUTO with CONSERVATIVE fallback
- **Confidence**: High (`0.9`) — the requirement explicitly forbids a first-render loading flash.
- **Fallback Triggered?**: No.
- **Trade-offs**:
  1. Improves perceived quality and avoids layout flicker on a primary dashboard page.
  2. Increases the requirement for initial data completeness instead of relying on an empty loading shell.
- **Reviewer Notes**: Validate the same “no blanking” expectation for filter and year changes, not only for the initial page load.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review Yearly AI Activity Across Projects (Priority: P1)

A signed-in user opens the projects page and sees a full-width activity heatmap beneath the project cards. They can quickly understand how much AI work happened across all of their projects over the selected period, including total jobs and shipped tickets.

**Why this priority**: This is the core value of the feature. Without the at-a-glance activity view and summary counters, the heatmap does not help users assess recent project activity.

**Independent Test**: Can be fully tested by loading the projects page with existing project, ticket, and job history and verifying that the heatmap cells, counters, month labels, legend, and empty-state behavior match the selected period.

**Acceptance Scenarios**:

1. **Given** a user has AI job history across one or more projects, **When** they open the projects page, **Then** they see a heatmap below the project cards grid showing one cell per day across the selected period, with intensity based on that day’s job count.
2. **Given** a day includes one or more successfully completed `ship` jobs, **When** the user views the heatmap header or tooltip for that day, **Then** the shipped ticket totals count only the tickets associated with those successful ship-job completions.
3. **Given** the selected period begins or ends mid-week, **When** the heatmap renders, **Then** the first and last weeks show only in-period dates, creating chipped corners rather than padded out-of-period cells.
4. **Given** the selected period contains no activity at all, **When** the user opens the page, **Then** the heatmap area shows the message "No activity to show yet — your AI work will appear here" while the summary controls and legend remain visible.

---

### User Story 2 - Change Time Range and Share a Specific View (Priority: P2)

A user wants to inspect a different time range or share a filtered view with another teammate or device. They choose a year option and, when applicable, an agent filter, and the page URL preserves that exact view.

**Why this priority**: Filtering and URL persistence make the visualization useful beyond a passive dashboard element, but the main value still depends on the base heatmap existing first.

**Independent Test**: Can be tested by selecting different year and agent combinations, refreshing the page, and opening the copied URL in a new session to confirm the same period and filter state are restored.

**Acceptance Scenarios**:

1. **Given** a user account created before the current year, **When** the user opens the projects page, **Then** they can choose "Last 12 months" or any calendar year from their account creation year through the current year.
2. **Given** the user account was created during the current year, **When** the user views the heatmap controls, **Then** only the "Last 12 months" period is available and no unnecessary active year selector is shown.
3. **Given** the user selects a specific period and agent, **When** they refresh the page or open the copied URL elsewhere, **Then** the same period and agent-filtered view is restored.
4. **Given** the user applies an agent filter, **When** the heatmap updates, **Then** the grid boundaries remain fixed to the selected period and only the aggregated activity values change.

---

### User Story 3 - Inspect Daily Details on Desktop and Mobile (Priority: P3)

A user wants to understand what happened on a particular day. They hover or tap a heatmap cell to inspect shipped tickets, job count, total recorded cost when available, and the exact date, even on smaller screens.

**Why this priority**: Day-level inspection enriches the chart and supports decision-making, but users still receive baseline value from the heatmap without drilling in.

**Independent Test**: Can be tested by interacting with populated cells on desktop and mobile-sized viewports and verifying the tooltip content, dismissal behavior, horizontal scrolling, and pinned day labels.

**Acceptance Scenarios**:

1. **Given** a day has recorded jobs with recorded cost, **When** the user opens that day’s tooltip, **Then** the tooltip shows the formatted date, shipped ticket count, job count, and the day’s total recorded cost.
2. **Given** a day has recorded jobs but some or all of those jobs have no recorded cost, **When** the tooltip is shown, **Then** it shows the job count and omits the cost line rather than showing misleading missing-cost values.
3. **Given** a user is on mobile, **When** they view the heatmap, **Then** the grid scrolls horizontally without wrapping or shrinking cells below a tappable size, and the day-of-week labels remain pinned on the left.
4. **Given** a user opens a tooltip on mobile, **When** they tap outside the tooltip, **Then** the tooltip dismisses.

---

### Edge Cases

- What happens when only one or zero distinct effective agents exist in the selected data? The agent filter is hidden because it would not change the view.
- What happens when some days contain jobs with missing cost data? The tooltip still reports the job count and suppresses the cost line for that day.
- What happens when the selected period spans dates before the user created their account? The grid still reflects the requested period, but activity remains zero for dates before any user activity could exist.
- What happens when a user has project access but no projects with jobs or shipped tickets? The heatmap area shows the empty-state message instead of an all-zero grid.
- What happens when the project cards section previously constrained vertical scrolling? The page must allow natural scrolling so users can reach the heatmap without the grid trapping scroll.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display a full-width activity heatmap on the projects page below the project cards grid.
- **FR-002**: The system MUST aggregate activity across all projects the signed-in user can access within the selected period.
- **FR-003**: The system MUST render one cell per calendar day in the selected period, arranged in 7 rows by day of week and as many columns as needed for the selected range.
- **FR-004**: The system MUST use daily job count to determine each cell’s visual intensity.
- **FR-005**: The system MUST show month labels above the grid and day-of-week labels along the left side of the grid.
- **FR-006**: The system MUST preserve the exact selected-period boundaries, omitting out-of-period cells at the beginning and end of the grid rather than rendering filler cells.
- **FR-007**: The system MUST display an intensity legend that communicates lower-to-higher activity using the same violet visual family as the Aurora theme.
- **FR-008**: The system MUST show a header summary in the format "X jobs · Y tickets shipped in the last year" or the equivalent wording for the currently selected period.
- **FR-009**: The system MUST count a ticket as shipped only on the day a successful `ship` workflow job completes for that ticket.
- **FR-010**: The system MUST NOT count tickets as shipped solely because their stage changed to SHIP.
- **FR-011**: The system MUST provide a default "Last 12 months" period option.
- **FR-012**: The system MUST provide additional calendar-year options from the user’s account creation year through the current year whenever more than one distinct year is available.
- **FR-013**: The system MUST hide or disable the year selector when "Last 12 months" is the only valid period option.
- **FR-014**: The system MUST derive agent filter options from the distinct effective agents present in the user’s job history for the selected data set.
- **FR-015**: The system MUST always include an "All" agent option and select it by default.
- **FR-016**: The system MUST hide the agent filter when there are zero or one distinct effective agents available.
- **FR-017**: When a specific agent is selected, the system MUST include work where that agent was set explicitly on the ticket and work where the ticket inherited that agent from the project default.
- **FR-018**: Changing the agent filter MUST update the aggregated activity values without changing the selected period boundaries.
- **FR-019**: The system MUST persist the selected period and agent filter in the page URL so the same view is restored after refresh or when the URL is opened elsewhere.
- **FR-020**: The system MUST show daily details on interaction with a cell, including the formatted date, shipped ticket count for that day, and job count.
- **FR-021**: The system MUST show the total recorded cost for a day only when cost data exists for the jobs represented in that day’s tooltip.
- **FR-022**: The system MUST omit the cost line when no cost data is recorded for that day rather than displaying a misleading missing-value amount.
- **FR-023**: On pointer-based devices, the system MUST reveal the day details on hover.
- **FR-024**: On touch devices, the system MUST reveal the day details on tap and dismiss the details when the user taps outside the open tooltip.
- **FR-025**: The system MUST render the heatmap with populated initial data on first page load for the default view, without a blank loading flash.
- **FR-026**: The system MUST allow subsequent data refreshes to update the visible heatmap without clearing the current view first.
- **FR-027**: When the selected period contains zero activity, the system MUST replace the grid with the provided empty-state message while keeping the legend and filters visible.
- **FR-028**: On mobile-sized viewports, the system MUST allow horizontal scrolling of the heatmap grid without wrapping columns or shrinking cells below a practical tap target size.
- **FR-029**: On mobile-sized viewports, the system MUST keep the day-of-week labels pinned on the left while the grid scrolls horizontally.
- **FR-030**: The projects page layout MUST allow natural vertical scrolling so users can reach and interact with the heatmap below the project cards section.
- **FR-031**: The feature MUST use existing job, ticket, project, and user-account data only and MUST NOT require new database models.

### Key Entities *(include if feature involves data)*

- **Daily Activity Summary**: A derived per-day record for the selected period that combines total job count, total shipped ticket count, and total recorded cost when available for the signed-in user’s accessible projects.
- **Heatmap Period**: The selected reporting window for the visualization, either the rolling last 12 months or a specific calendar year bounded by the user’s account age and the current date.
- **Effective Agent**: The agent identity attributed to a piece of work after resolving ticket-level agent selection first and project default agent second.
- **Tooltip Detail**: The day-level information shown when a user inspects a cell, including formatted date, shipped ticket count, job count, and optional total recorded cost.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On first load of the projects page, users see a populated heatmap or the correct empty state immediately, without a blank intermediary state.
- **SC-002**: 100% of shipped-ticket totals shown in the heatmap header and tooltips match the count of tickets with successful `ship` workflow completions during the selected period.
- **SC-003**: 100% of copied heatmap URLs reopen with the same selected period and agent-filtered view after refresh or cross-device opening.
- **SC-004**: Users can inspect day-level activity details in one interaction on desktop and one tap on mobile.
- **SC-005**: On mobile-sized viewports, users can access the full heatmap range through horizontal scrolling while day labels remain visible throughout the interaction.
- **SC-006**: When only zero or one distinct effective agents exist, the page suppresses the agent filter in all cases.
- **SC-007**: When a selected period has no activity, users see the empty-state message instead of an all-zero rendered grid in 100% of cases.

## Assumptions

- The projects page remains accessible only to authenticated users viewing their own accessible project set.
- Daily activity is attributed by the day on which the relevant job completed or was recorded, using a consistent calendar basis for the entire view.
- The legend remains visible even when the grid is replaced by the zero-activity message because the prompt explicitly keeps legend and filters present.
- Year options are derived from the user account creation year, not from the first year in which any project activity exists.
- The period selector and agent filter should preserve their current selection in the URL whenever either control changes.

## Out of Scope

- Per-project filtering within the heatmap
- Drill-down navigation from a heatmap cell into project or ticket detail pages
- Exporting heatmap data
- Additional metrics beyond job count, shipped tickets, and recorded cost
