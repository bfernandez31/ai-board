# Feature Specification: Activity Heatmap on Projects Page

**Feature Branch**: `AIB-644-activity-heatmap-on`  
**Created**: 2026-04-14  
**Status**: Draft  
**Input**: User description: "Add a GitHub-style contribution heatmap on the projects page, below the project cards grid. The heatmap displays AI activity across all user projects over the past year."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: `AUTO` policy produced a low-confidence recommendation, so ambiguity resolution fell back to `CONSERVATIVE` for the entire spec. The net score was `+1` from neutral user-facing feature context, with no strong speed or compliance signals.
- **Policy Applied**: AUTO -> CONSERVATIVE
- **Confidence**: Low (`0.3`, net score `+1`)
- **Fallback Triggered?**: Yes — low confidence required a conservative fallback under the clarification guardrails.
- **Trade-offs**:
  1. The spec prefers clearer reporting rules, accessibility, and bounded behavior over looser MVP assumptions.
  2. This increases definition detail for filtering, empty states, and metric handling, but reduces rework risk during planning.
- **Reviewer Notes**: Confirm that conservative defaults for aggregation rules and historical browsing match the intended analytics experience.

- **Decision**: The heatmap covers all projects the current user can already access from the projects list, including owned projects and shared-member projects, because the page is a workspace-wide view rather than an owner-only dashboard.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium — aligns with existing projects page behavior and avoids under-reporting activity.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users get a complete workspace activity view without switching contexts.
  2. Shared-project activity may increase visible totals, so reviewers should confirm that this is desired for member access.
- **Reviewer Notes**: Validate that the workspace-level aggregation should include project memberships, not only ownership.

- **Decision**: Daily intensity is based on the number of jobs started on that calendar day, while the tooltip also reports shipped tickets completed that day and the total recorded job cost for jobs on that day. Jobs without recorded cost still count toward activity.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium — this preserves visible activity even when cost telemetry is incomplete.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users see all execution activity, not just successful or fully costed runs.
  2. Daily cost totals may be lower than job totals imply when some jobs have no recorded cost.
- **Reviewer Notes**: Confirm that "job count" should reflect started jobs rather than only completed jobs.

- **Decision**: The year selector defaults to a rolling last-12-months view and also allows selecting prior full calendar years. Each selected view always renders a full-year grid, including zero-activity days needed to preserve consistent weekly columns.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium — directly derived from the request and framed to keep comparisons stable.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users get consistent geometry for both rolling and historical views.
  2. Calendar-year views may show leading or trailing inactive days to maintain the full-year layout.
- **Reviewer Notes**: Validate whether the selector should include the current calendar year in addition to the rolling view.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan Workspace Activity Trends (Priority: P1)

As a signed-in user, I want to see a year-long heatmap of AI activity directly on the projects page so I can understand when my workspace has been most active without opening each project separately.

**Why this priority**: The primary value is a fast, cross-project summary that extends the existing projects overview page.

**Independent Test**: Can be fully tested by loading the projects page with historical job and shipped-ticket data and verifying the grid, totals, labels, legend, and empty days without using any other new feature.

**Acceptance Scenarios**:

1. **Given** the user has accessible projects with job history in the active date range, **When** they open `/projects`, **Then** a full-width activity heatmap appears below the project cards grid and shows one cell per day across a full-year view.
2. **Given** the selected date range contains days with different job volumes, **When** the heatmap renders, **Then** higher-activity days use stronger violet intensity than lower-activity or empty days, and the legend communicates the progression from less to more activity.
3. **Given** the user has both job history and shipped tickets in the displayed range, **When** the section header renders, **Then** it shows both totals in the format `X jobs · Y tickets shipped in the last year`.

---

### User Story 2 - Inspect Daily Activity Details (Priority: P2)

As a user, I want to hover or focus on a day in the heatmap so I can inspect the specific amount of work completed on that date.

**Why this priority**: The heatmap is only useful if users can translate color intensity into actual daily metrics.

**Independent Test**: Can be fully tested by interacting with a populated day cell and confirming the detail panel shows the expected date, shipped-ticket count, job count, and daily cost values.

**Acceptance Scenarios**:

1. **Given** a day has one or more jobs, **When** the user hovers over or keyboard-focuses that day, **Then** a tooltip presents the formatted date, number of shipped tickets for that day, number of jobs for that day, and total recorded cost for that day's jobs.
2. **Given** a day has no shipped tickets but does have jobs, **When** the user inspects the cell, **Then** the tooltip still shows the date and reports `0` shipped tickets while preserving the job and cost values.
3. **Given** a day has no activity, **When** the user inspects the cell, **Then** the tooltip reports zero shipped tickets, zero jobs, and zero cost rather than hiding the day.

---

### User Story 3 - Change Time Range and Agent Scope (Priority: P3)

As a user, I want to switch between the rolling view, past years, and agent-specific activity so I can analyze patterns for a chosen period and AI provider.

**Why this priority**: Filtering makes the visualization more useful, but the page still delivers value without it.

**Independent Test**: Can be fully tested by changing the year selector and agent filter, then verifying that the grid remains full-year while metrics, legend context, and tooltips update to match the selected scope.

**Acceptance Scenarios**:

1. **Given** the user is on the default rolling view, **When** they choose a specific past year, **Then** the heatmap updates to that full calendar year and keeps the same 7-row weekly layout.
2. **Given** the selected range includes jobs from multiple agents, **When** the user applies an agent filter, **Then** the heatmap, totals, and tooltip values update to include only activity from the chosen agent while preserving shipped-ticket counts that belong to matching filtered activity.
3. **Given** the projects page is opened on a mobile viewport, **When** the heatmap section renders, **Then** the page remains scrollable, labels remain understandable, and users can inspect daily details without horizontal overflow that blocks the rest of the page.

### Edge Cases

- Days outside the selected rolling or calendar-year range are not displayed, even if adjacent weeks contain activity.
- If the user has no qualifying activity in the selected range, the section still renders a full-year grid with empty-state totals and zero-intensity cells.
- If some jobs are missing recorded cost, daily totals include only available cost values while still counting the jobs themselves.
- If the selected agent has no activity in the chosen year, the heatmap stays visible with zero totals and an explicit no-activity state rather than reverting the filter.
- If the user can access many projects, the projects page must continue to scroll naturally so both the card grid and heatmap remain reachable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST add a full-width activity heatmap section to the `/projects` page below the project cards area for authenticated users who can access the projects list.
- **FR-002**: The system MUST aggregate heatmap data across all projects visible to the current user on the projects page, including both owned projects and projects where the user is a member.
- **FR-003**: The heatmap MUST render one cell per day in a 7-row weekly grid covering exactly one full year at a time.
- **FR-004**: The default heatmap view MUST represent the rolling previous 12 months ending on the current day.
- **FR-005**: The year selector MUST allow the user to switch between the rolling previous 12 months view and individual prior calendar years using the same full-year grid layout.
- **FR-006**: The heatmap MUST display month labels across the top and day-of-week labels alongside the grid in a way that remains understandable on desktop and mobile screens.
- **FR-007**: Each day's cell intensity MUST be based on that day's total job count, using a violet scale that preserves readable contrast in the application's dark theme.
- **FR-008**: The section MUST include a visible legend that communicates the progression from lower to higher activity.
- **FR-009**: The section header MUST display both the total number of jobs and total number of tickets shipped for the currently selected year and agent scope.
- **FR-010**: The system MUST provide an agent filter with an `All agents` option and separate options for each agent represented in the selected dataset.
- **FR-011**: Changing the agent filter or year selection MUST refresh the heatmap cells, header totals, legend context, and tooltip values to match the selected scope without requiring the user to navigate away from the projects page.
- **FR-012**: When a user hovers over or focuses on a day cell, the system MUST show a tooltip containing the formatted date, shipped-ticket count for that day, total job count for that day, and total recorded job cost for that day.
- **FR-013**: Daily job counts MUST include jobs started on that day, regardless of whether cost data exists for each job.
- **FR-014**: Daily shipped-ticket counts MUST reflect tickets whose shipped completion date falls on that day within the selected time range.
- **FR-015**: When a selected range or filter has no activity, the section MUST continue to render the full-year heatmap structure and show zero-value totals with a clear no-activity state.
- **FR-016**: The projects page layout MUST allow natural page scrolling so users can access both the project cards grid and the heatmap section on desktop and mobile devices.
- **FR-017**: The heatmap section MUST remain usable on mobile devices, including readable labels, reachable filters, and accessible daily detail inspection.
- **FR-018**: Users without access to the projects page MUST not be shown any heatmap data.
- **FR-019**: The feature MUST use the existing job and ticket records as its source of truth and MUST NOT require creation of new persisted data entities solely for this view.

### Key Entities *(include if feature involves data)*

- **Daily Activity Summary**: A per-day aggregate for the selected year and agent scope containing the date, job count, shipped-ticket count, total recorded cost, and visual intensity level.
- **Year View Option**: A selectable reporting period representing either the rolling previous 12 months or a specific calendar year.
- **Agent Scope**: The selected activity source grouping, consisting of all agents or a single agent available in the current dataset.

### Assumptions & Dependencies

- The projects page continues to represent the user's full accessible workspace, so the heatmap may rely on the same access rules and project set already used for the project cards.
- Existing job records contain a usable job date, agent identity, and optional recorded cost, while shipped tickets expose a completion date that can be aggregated by day.
- Historical data quality may vary; when cost is missing for some jobs, the feature reports available cost totals without suppressing the related activity.
- The application already distinguishes shipped tickets from non-shipped tickets so the feature can calculate daily shipped counts without redefining ticket lifecycle rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing or acceptance review, users can identify the busiest activity day for the selected range from the heatmap in under 10 seconds.
- **SC-002**: For a seeded dataset covering multiple projects, 100% of displayed header totals and sampled daily tooltip values match the underlying job, shipped-ticket, and cost records for the chosen year and agent filter.
- **SC-003**: On mobile and desktop acceptance testing, users can reach the heatmap from the projects page and inspect at least one day without layout clipping or blocked page scrolling.
- **SC-004**: When the selected year or agent has no activity, the interface still communicates the empty state clearly enough that all acceptance reviewers can distinguish `no data for this scope` from a loading or rendering failure.
