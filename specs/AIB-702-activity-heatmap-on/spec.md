# Feature Specification: Activity Heatmap on Projects Page

**Feature Branch**: `AIB-702-activity-heatmap-on`  
**Created**: 2026-04-20
**Status**: Draft  
**Input**: User description: Add a GitHub-style contribution heatmap on the projects page, below the project cards grid. The heatmap displays AI activity across all user projects over the past year.

## Auto-Resolved Decisions

- **Decision**: No automated decisions required
- **Policy Applied**: AUTO
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**: None
- **Reviewer Notes**: The provided specification was exceptionally comprehensive and did not require any AI-driven clarifications or assumptions.

## User Scenarios & Testing

### User Story 1 - View Rolling Annual Heatmap (Priority: P1)

As a user, I want to see a heatmap of my AI activity over the last 12 months so I can visualize my usage patterns at a glance without waiting for data to load.

**Why this priority**: Core value of the feature; immediate visual feedback on the main projects page.

**Independent Test**: Can be tested by visiting the `/projects` page and verifying the heatmap renders immediately (no flash) with the correct 12-month rolling data.

**Acceptance Scenarios**:

1. **Given** I am on the `/projects` page, **When** the page loads, **Then** I see the activity heatmap below the project cards immediately without a loading spinner.
2. **Given** I have activity in the last 12 months, **When** viewing the heatmap, **Then** I see a 7-row grid with cell intensity based on job counts.
3. **Given** I have zero activity in the selected period, **When** viewing the heatmap, **Then** I see a centered message "No activity to show yet — your AI work will appear here".

---

### User Story 2 - Filter Heatmap by Agent (Priority: P2)

As a user, I want to filter my activity heatmap by specific AI agents so I can compare how much work different agents have done.

**Why this priority**: Enhances the analytical value of the heatmap by leveraging the agent data.

**Independent Test**: Can be tested by using the agent dropdown filter and verifying the heatmap data updates and the URL changes.

**Acceptance Scenarios**:

1. **Given** I have jobs completed by more than one distinct agent, **When** I look at the heatmap header, **Then** I see an agent filter dropdown.
2. **Given** I select a specific agent in the filter, **When** the heatmap updates, **Then** it only counts jobs for that specific agent (including effective agents from project defaults).
3. **Given** I select a filter, **When** I copy the current page URL and open it in a new tab, **Then** the page loads with the same filter applied.
4. **Given** I have jobs completed by 0 or 1 distinct agents, **When** I look at the heatmap header, **Then** the agent filter is hidden.

---

### User Story 3 - Select Historical Year (Priority: P3)

As a long-term user, I want to view my activity heatmap for previous calendar years so I can review historical AI performance.

**Why this priority**: Important for historical data exploration, but secondary to the current rolling year view.

**Independent Test**: Can be tested by changing the year dropdown and verifying the grid layout adapts to the correct year boundaries.

**Acceptance Scenarios**:

1. **Given** my account was created prior to the current year, **When** I click the year selector, **Then** I see "Last 12 months" and all calendar years back to my account creation year.
2. **Given** I select a specific calendar year, **When** the heatmap updates, **Then** the grid boundaries match that year exactly (with chipped corners for partial first/last weeks).
3. **Given** my account was created in the current year, **When** I view the header, **Then** the year selector is either hidden or disabled showing only "Last 12 months".

---

### User Story 4 - View Detailed Daily Activity (Priority: P2)

As a user, I want to see specific details about a day's activity by hovering or tapping on a heatmap cell so I can understand what was accomplished and how much it cost.

**Why this priority**: Essential for drilling down from the high-level visual representation to actual metrics.

**Independent Test**: Can be tested by hovering on a cell on desktop or tapping on mobile to verify the tooltip contents.

**Acceptance Scenarios**:

1. **Given** I hover over a cell on desktop, **When** the tooltip appears, **Then** I see the tickets shipped, job count, total cost, and formatted date.
2. **Given** a day has jobs with no recorded cost, **When** I view its tooltip, **Then** I see the job count but the cost line is omitted entirely.
3. **Given** I am on a mobile device, **When** I tap a cell, **Then** the tooltip appears, and tapping outside dismisses it.

### Edge Cases

- What happens when a user's account creation date is missing or invalid? (Fallback to treating them as a new user with only "Last 12 months" available).
- How does the system handle leap years in the calendar year view? (Grid dynamically calculates the exact number of days).
- How does the "chipped" edge logic behave if a year starts on Sunday or ends on Saturday? (No chipped edges, perfectly rectangular at those ends).

## Requirements

### Functional Requirements

- **FR-001**: System MUST render a 7-row heatmap grid below the project cards on the `/projects` page.
- **FR-002**: System MUST calculate cell intensity based on the count of AI jobs for that day.
- **FR-003**: System MUST apply a violet color gradient utilizing the existing project aurora theme for the heatmap cells.
- **FR-004**: System MUST display "chipped" corners (omitting unrendered cells) for days falling outside the selected period's start and end boundaries.
- **FR-005**: System MUST display a header counter in the format: "X jobs · Y tickets shipped in the last year" (or selected period).
- **FR-006**: System MUST count a ticket as "shipped" only on the date its `ship` workflow job completed successfully.
- **FR-007**: System MUST provide a year selector dropdown populated from the user's account creation year to the current year, defaulting to "Last 12 months".
- **FR-008**: System MUST provide an agent filter dynamically generated from distinct agents present in the user's jobs (accounting for both explicit ticket agents and effective project default agents).
- **FR-009**: System MUST hide the agent filter if the user's data contains 0 or 1 distinct agents.
- **FR-010**: System MUST sync active heatmap filters (year, agent) to the URL query parameters.
- **FR-011**: System MUST render the heatmap immediately on page load utilizing server-rendered initial data to avoid a loading flash.
- **FR-012**: System MUST allow horizontal scrolling of the heatmap on mobile viewports while keeping day-of-week labels pinned to the left.
- **FR-013**: System MUST display a detailed tooltip showing shipped tickets, job count, total cost, and date on hover (desktop) or tap (mobile).
- **FR-014**: System MUST omit the cost line in the tooltip if no cost data is recorded for that day's jobs.
- **FR-015**: System MUST display a centered empty state message with the text "No activity to show yet — your AI work will appear here" when the selected period contains zero jobs.

### Key Entities

- **Job**: Existing entity. Used to count daily activity and calculate daily costs.
- **Ticket**: Existing entity. Used to determine "shipped" status based on associated `ship` workflow jobs.
- **Project**: Existing entity. Provides the `defaultAgent` used in effective agent resolution.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Heatmap data is fully visible on initial page load (First Contentful Paint) without any loading spinners.
- **SC-002**: URL sharing reliably recreates the exact view state (year and agent filter) 100% of the time.
- **SC-003**: Tooltip displays accurately on mobile tap and is dismissible by tapping outside.
- **SC-004**: Implementation introduces zero new database models or schema migrations.
