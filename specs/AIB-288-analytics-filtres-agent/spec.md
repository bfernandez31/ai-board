# Feature Specification: Analytics Filters by Agent and Status, Period-Aware Shipped Card

**Feature Branch**: `AIB-288-analytics-filtres-agent`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "Analytics: filtres agent/statut, carte shipped dynamique"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Whether the ticket-status filter should default to shipped tickets only or include closed tickets by default
- **Policy Applied**: AUTO (resolved as CONSERVATIVE due to low confidence fallback)
- **Confidence**: Low (score: 0.3; netScore: +1, absScore: 1 — general user-facing analytics feature with no sensitive/compliance or explicit speed signals)
- **Fallback Triggered?**: Yes — AUTO promoted to CONSERVATIVE because confidence was below 0.5
- **Trade-offs**:
  1. Defaulting to shipped tickets preserves the current business meaning of delivery-focused analytics and avoids inflating core metrics with non-delivered work
  2. Users must opt in to closed-ticket analysis, but they gain a clearer baseline view
- **Reviewer Notes**: Confirm that delivery-focused reporting should remain the default across all analytics views and exported screenshots.

---

- **Decision**: Whether the agent selector should show only agents active in the selected period or all agents that have jobs in the project
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6 — the request explicitly says agents with jobs on the project, while period-sensitive filtering would make the control unstable)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A project-wide agent list keeps the filter stable as the user changes date ranges
  2. Selecting an agent with no activity in the chosen period can produce zero-value results, but that is easier to understand than options appearing and disappearing
- **Reviewer Notes**: Validate that a stable project-wide list is preferable to a period-scoped list for this dashboard.

---

- **Decision**: How to expose closed-ticket volume alongside shipped-ticket volume
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6 — the request allows either a second card or an embedded split; a dedicated second card is clearer and more testable)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A separate closed-ticket card makes status totals immediately visible and avoids overloading the shipped summary
  2. The dashboard uses more summary space, but each metric remains easier to scan and compare
- **Reviewer Notes**: Confirm that the dashboard has room for two primary ticket-status summary cards without harming smaller-screen layouts.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Analyze Delivered Work Only by Default (Priority: P1)

A project stakeholder opens the analytics dashboard and sees delivery-oriented metrics based only on shipped tickets unless they intentionally broaden the scope to closed work.

**Why this priority**: This changes the meaning of every key metric on the page and must be correct before any secondary filtering behavior matters.

**Independent Test**: Can be fully tested by opening analytics for a project that contains both shipped and closed tickets and verifying that the default dashboard reflects only shipped-ticket activity across every summary and chart.

**Acceptance Scenarios**:

1. **Given** a project with both shipped and closed tickets in the selected period, **When** the user opens analytics for the first time, **Then** all summary metrics and charts show shipped-ticket data only.
2. **Given** the default shipped-only view, **When** the user changes the status filter to closed only, **Then** every metric and chart refreshes to show only closed-ticket data for the selected period.
3. **Given** the user selects shipped plus closed, **When** the dashboard refreshes, **Then** every metric and chart reflects the combined totals for both statuses without mixing in other ticket states.

---

### User Story 2 - Compare Analytics by Agent (Priority: P1)

A project stakeholder narrows analytics to a single AI agent to understand its cost, usage, and delivery behavior compared with the full project.

**Why this priority**: Agent-level analysis is a core business need in the request and affects decision-making on cost and productivity.

**Independent Test**: Can be fully tested by using a project with jobs from multiple agents, selecting a specific agent, and verifying that all dashboard metrics and charts update to that agent only while the default view still combines all agents.

**Acceptance Scenarios**:

1. **Given** a project with jobs from multiple agents, **When** the user opens analytics, **Then** the agent filter defaults to all agents combined.
2. **Given** a project with jobs from multiple agents, **When** the user selects one agent, **Then** all summary metrics and charts refresh to show only that agent's jobs within the chosen status filter and date range.
3. **Given** a project where an agent exists historically but has no activity in the selected period, **When** the user selects that agent, **Then** the dashboard shows zero or empty-state results rather than removing the option from the filter.

---

### User Story 3 - See Period-Accurate Ticket Totals (Priority: P2)

A project stakeholder changes the date range and immediately sees shipped and closed ticket totals that match the selected period, with labels that clearly state what timeframe is being shown.

**Why this priority**: The existing shipped-ticket card is misleading today, but the filtering foundation in P1 is still more critical because it affects the entire dashboard.

**Independent Test**: Can be fully tested by switching between 7-day, 30-day, 90-day, and all-time ranges and verifying that the ticket summary cards update both values and labels to match each selection.

**Acceptance Scenarios**:

1. **Given** the user selects the last 7 days, **When** the dashboard refreshes, **Then** the shipped-ticket card shows the number of shipped tickets from those 7 days and its label indicates the 7-day period.
2. **Given** the user switches from 30 days to 90 days, **When** the dashboard refreshes, **Then** both shipped and closed ticket totals update to the new period rather than retaining calendar-month values.
3. **Given** the user selects all time, **When** the dashboard refreshes, **Then** the ticket summary labels indicate all-time coverage and the counts reflect the full project history included by the active status and agent filters.

### Edge Cases

- What happens when the selected status and agent combination has no matching tickets in the chosen period? The dashboard should show zero-value summaries and empty-state chart messaging instead of stale values.
- What happens when a project has jobs for only one agent? The agent filter should still be present, default to the combined view, and list the single available agent without creating duplicate meanings.
- What happens when the user changes the date range after selecting a non-default status or agent filter? The dashboard should keep the active filters and recompute all summaries and charts for the new period.
- What happens when a project has shipped tickets but no closed tickets, or vice versa, during the selected period? Both ticket-status cards should remain visible, with the missing status shown as zero.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The analytics dashboard MUST provide a ticket-status filter with exactly three options: shipped only, closed only, and shipped plus closed.
- **FR-002**: The ticket-status filter MUST default to shipped only whenever the analytics dashboard first loads for a project.
- **FR-003**: The selected ticket-status filter MUST apply consistently to all analytics summaries and visualizations on the page, including cost over time, cost by workflow stage, top tools, token usage, cache efficiency, velocity, workflow distribution, total cost, total tokens, average duration, and success rate.
- **FR-004**: The analytics dashboard MUST provide an agent filter that defaults to all agents combined.
- **FR-005**: The agent filter MUST allow the user to select any agent that has recorded job activity for the project.
- **FR-006**: When a specific agent is selected, all analytics summaries and visualizations MUST recalculate using only that agent's recorded job activity within the active date range and ticket-status filter.
- **FR-007**: The list of selectable agents MUST be generated dynamically from the agents that have recorded jobs for the project, and the list MUST remain stable when the user changes the date range.
- **FR-008**: The shipped-ticket summary card MUST recalculate its value according to the currently selected date range instead of using the current calendar month.
- **FR-009**: The shipped-ticket summary card label MUST describe the active date range in user-friendly language for each supported period option.
- **FR-010**: The dashboard MUST display the number of closed tickets for the selected date range as a separate summary card adjacent to the shipped-ticket card.
- **FR-011**: The closed-ticket summary card MUST honor the same active date range and agent filter as the shipped-ticket summary card.
- **FR-012**: Changing the date range, ticket-status filter, or agent filter MUST update all affected dashboard summaries and visualizations as one coherent filtered view.
- **FR-013**: When no records match the active filter combination, the dashboard MUST display empty or zero states that clearly indicate there is no data for the selected scope.

### Key Entities *(include if feature involves data)*

- **Analytics Filter State**: The current combination of date range, ticket-status scope, and agent scope that determines which records are included in dashboard calculations.
- **Ticket Status Summary**: The shipped-ticket count and closed-ticket count shown for the active filter state and labeled with the selected period.
- **Agent Dimension**: The set of agents that have recorded job activity in the project and can be used to segment analytics.
- **Dashboard Metric Set**: The complete collection of summary metrics and charts that must stay in sync when filters change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In validation datasets containing both shipped and closed tickets, 100% of dashboard summaries and charts match the selected ticket-status scope with no cross-status leakage.
- **SC-002**: In projects with multiple agents, selecting an individual agent changes all dashboard summaries and charts to that agent's data within one refresh cycle, with zero components left on the combined view.
- **SC-003**: For each supported date range option (7 days, 30 days, 90 days, all time), the shipped-ticket and closed-ticket summary cards display counts that exactly match the records included in that period.
- **SC-004**: At least 90% of reviewed dashboard states present labels and empty states that let stakeholders identify the active period, status scope, and agent scope without additional explanation.

## Assumptions

- The dashboard already supports selectable date ranges of 7 days, 30 days, 90 days, and all time.
- Shipped and closed are the only ticket statuses that must be available in the new analytics status filter.
- Existing analytics records already contain enough information to attribute activity to a ticket status and an agent.
- The dashboard currently has room to show an additional ticket summary card without redefining the broader analytics scope.
