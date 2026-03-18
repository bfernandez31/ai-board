# Feature Specification: Analytics Filters and Dynamic Shipping Metrics

**Feature Branch**: `AIB-289-copy-of-analytics`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "Copy of Analytics: filtres agent/statut, carte shipped dynamique"

## Auto-Resolved Decisions

- **Decision**: Apply the ticket's `AUTO` clarification policy as `CONSERVATIVE` for unresolved product choices because the request is a neutral analytics enhancement with no strong speed or risk signal.
- **Policy Applied**: AUTO
- **Confidence**: Low (0.3, net score +1 from neutral feature context only)
- **Fallback Triggered?**: Yes - AUTO fell back to CONSERVATIVE because confidence was below 0.5
- **Trade-offs**:
  1. Favors explicit, consistent dashboard behavior over minimal UI changes
  2. Adds some scope to avoid leaving interpretation gaps across cards and charts
- **Reviewer Notes**: Confirm the team wants consistency and auditability to outweigh the smallest possible UI change for this ticket.

- **Decision**: Show closed-ticket visibility as a separate overview card next to "Tickets Shipped" rather than merging both counts into one card.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6, clearer comparison with lower ambiguity)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Adds one more summary element, but makes SHIP and CLOSED counts independently scannable
  2. Avoids overloading a single card with dual meanings and period labels
- **Reviewer Notes**: Validate that the overview area can accommodate a fifth card or a responsive wrap without harming readability.

- **Decision**: Populate the agent filter from agents with recorded job history in the selected project and include an "All agents" default option.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6, aligns with the request while minimizing irrelevant filter options)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Keeps the selector immediately useful by hiding agents with no data in the project
  2. Prevents confusion caused by offering filter choices that would always return empty analytics
- **Reviewer Notes**: Confirm whether jobs without a recognizable agent label should appear under an "Unknown agent" option or be excluded from agent-specific filtering.

## User Scenarios & Testing

### User Story 1 - Filter Analytics by Ticket Outcome (Priority: P1)

As a project user reviewing analytics, I want to switch between shipped and closed ticket data so I can analyze the right set of completed work for the selected period.

**Why this priority**: The default analytics currently mix or misrepresent completion states, which directly affects the credibility of every headline metric and chart.

**Independent Test**: Can be fully tested by changing the ticket-status filter and confirming every summary card and chart recalculates from the same selected outcome set.

**Acceptance Scenarios**:

1. **Given** I open analytics for a project, **When** the dashboard first loads, **Then** all metrics and charts show data for shipped tickets only.
2. **Given** the dashboard is showing shipped-only data, **When** I change the outcome filter to closed-only, **Then** every summary metric and chart updates to include only closed tickets in the selected period.
3. **Given** I select shipped plus closed, **When** the dashboard refreshes, **Then** every summary metric and chart reflects the combined set without leaving any visualization on the previous filter.

---

### User Story 2 - Filter Analytics by Agent (Priority: P1)

As a project user comparing AI contributors, I want to narrow analytics to one agent or all agents so I can understand usage and performance by agent.

**Why this priority**: Agent-level analysis is a core requested capability and affects cost, token, tool, and performance interpretation across the full dashboard.

**Independent Test**: Can be fully tested by selecting different agent options and confirming that overview metrics and all charts update to reflect only jobs attributed to that agent.

**Acceptance Scenarios**:

1. **Given** a project contains jobs from multiple agents, **When** I open analytics, **Then** the agent filter defaults to all agents and the dashboard shows combined results.
2. **Given** the project has jobs from at least one named agent, **When** I open the agent filter, **Then** I see only agents that actually have job history in that project plus the all-agents option.
3. **Given** I select a single agent, **When** the dashboard updates, **Then** cost, tools, tokens, duration, success rate, and all charts reflect only that agent's jobs within the selected period and ticket-outcome filter.

---

### User Story 3 - Read Period-Accurate Completion Cards (Priority: P1)

As a project user tracking delivery results, I want shipped and closed ticket counts to match the selected time range so the overview cards are trustworthy.

**Why this priority**: A headline metric that ignores the selected period undermines confidence in the entire analytics dashboard.

**Independent Test**: Can be fully tested by switching among available time ranges and confirming the shipped and closed ticket cards both change their counts and labels accordingly.

**Acceptance Scenarios**:

1. **Given** I am viewing analytics with a 7-day range, **When** I read the completion cards, **Then** the shipped count and closed count both represent only the last 7 days and label that period clearly.
2. **Given** I switch from 30 days to 90 days, **When** the dashboard refreshes, **Then** the completion-card values and labels update to the new period.
3. **Given** I select all time, **When** the dashboard updates, **Then** the completion cards show all-time counts and a label that clearly indicates the full history view.

---

### User Story 4 - Understand Empty and Sparse Results (Priority: P2)

As a project user applying narrow filters, I want clear empty states so I can tell whether there is no matching data or the dashboard failed to load.

**Why this priority**: Combining time range, outcome, and agent filters can legitimately produce empty results, and the UI needs to distinguish that from errors.

**Independent Test**: Can be fully tested by selecting filters that produce no matching jobs or tickets and confirming the dashboard explains the absence of data without showing stale results.

**Acceptance Scenarios**:

1. **Given** I select a filter combination with no matching jobs, **When** the dashboard updates, **Then** each affected metric or chart shows a no-data state tied to the current filters.
2. **Given** only some visualizations have matching data, **When** I view the dashboard, **Then** populated visualizations remain visible while empty ones show filter-aware empty states.

### Edge Cases

- What happens when the selected agent has ticket activity in the period but no matching jobs for one or more charts? The dashboard shows zero or no-data states for affected visualizations without falling back to all-agent data.
- What happens when a project has closed tickets but no shipped tickets, or the reverse, in the selected period? The completion cards show independent counts so one can be zero while the other remains populated.
- What happens when filters produce no matching shipped or closed tickets in the selected period? The completion cards show zero for that period and keep the active period label visible.
- What happens when historical jobs are missing a recognizable agent label? Their data remains included in the all-agents view and must not be misattributed to another named agent.

## Requirements

### Functional Requirements

- **FR-001**: The analytics dashboard MUST provide a ticket-outcome filter with exactly three options: shipped only, closed only, and shipped plus closed.
- **FR-002**: The default ticket-outcome filter MUST be shipped only whenever the analytics dashboard is first opened.
- **FR-003**: The selected ticket-outcome filter MUST apply consistently to all overview metrics and all analytics visualizations on the page.
- **FR-004**: The analytics dashboard MUST provide an agent filter with an all-agents default option and one option for each agent that has recorded job history in the current project.
- **FR-005**: The default agent filter MUST show combined results for all agents.
- **FR-006**: When a specific agent is selected, the dashboard MUST recalculate all metrics and visualizations using only data attributed to that agent within the active time range and ticket-outcome filter.
- **FR-007**: The available agent options MUST be derived from recorded job agent identities already present in the project rather than from a fixed global list.
- **FR-008**: The "Tickets Shipped" overview card MUST use the active time range rather than the current calendar month.
- **FR-009**: The "Tickets Shipped" overview card MUST display a period label that matches the active range selection.
- **FR-010**: The dashboard MUST display a separate overview metric for closed tickets for the active time range.
- **FR-011**: The closed-ticket overview metric MUST use the same active time range and period label logic as the shipped-ticket metric.
- **FR-012**: The following analytics views MUST respect the active time range, ticket-outcome filter, and agent filter together: cost over time, cost by stage, top tools, token usage, cache efficiency, velocity, workflow distribution, total cost, average duration, and success rate.
- **FR-013**: When a filter combination has no matching data, the dashboard MUST show clear no-data states and MUST NOT display stale values from a previous selection.
- **FR-014**: Changing any analytics filter MUST update the dashboard as a single coherent state change so summary metrics and charts remain aligned with one another.

### Key Entities

- **Project Analytics View**: The project-scoped dashboard that summarizes cost, token, tool, workflow, and completion outcomes for selected filters.
- **Ticket Outcome**: The completion state used for analytics scoping in this feature, specifically shipped and closed.
- **Agent**: The AI contributor label recorded with job history and used for dashboard filtering.
- **Job Record**: The execution history that supplies cost, duration, token, tool, and success data for analytics.
- **Time Range**: The selected reporting window used to scope overview cards and visualizations.

### Assumptions & Dependencies

- The project already exposes a time-range selector with the supported ranges used by the current analytics dashboard.
- Recorded job history contains a stable agent label suitable for distinguishing agents such as Claude and Codex.
- Shipped and closed ticket counts can be determined reliably from existing ticket lifecycle history for the selected period.
- Existing project access controls for analytics remain unchanged by this feature.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In validation datasets containing both shipped and closed tickets, 100% of overview metrics and analytics visualizations match the active ticket-outcome filter.
- **SC-002**: In projects with multiple recorded agents, users can switch between all-agents and any single available agent in one interaction and see all dashboard values update without any visualization remaining on the previous filter state.
- **SC-003**: For each supported time range (7 days, 30 days, 90 days, all time), shipped and closed overview cards display counts that exactly match the selected period in test data.
- **SC-004**: Users can identify whether a project shipped more tickets than it closed, or vice versa, within 5 seconds by reading the overview area for the selected period.
- **SC-005**: When filters produce no matching data, 100% of affected dashboard sections show an explicit no-data state instead of stale or contradictory values.
