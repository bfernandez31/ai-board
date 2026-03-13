# Feature Specification: Analytics Filters (Agent/Status) & Dynamic Shipped Card

**Feature Branch**: `AIB-287-analytics-filtres-agent`
**Created**: 2026-03-13
**Status**: Draft
**Input**: User description: "Analytics: filtres agent/statut, carte shipped dynamique"

## Auto-Resolved Decisions

- **Decision**: Agent filter uses the `model` field on jobs (as specified in the ticket) rather than the `agent` enum on tickets. The selector groups distinct model values into human-readable labels (e.g., "claude-opus-4" displayed as "Claude Opus 4") and lists only models that have at least one job in the project.
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score 0.3) -- netScore -1, absScore 1, confidence below 0.5 triggered CONSERVATIVE fallback
- **Fallback Triggered?**: Yes -- AUTO recommended PRAGMATIC but low confidence forced CONSERVATIVE
- **Trade-offs**:
  1. Using job-level `model` field provides finer granularity than ticket-level `agent` enum but may result in more selector options
  2. Grouping by raw model string keeps implementation simple; future normalization can be added later
- **Reviewer Notes**: Verify that model string values in the database are consistent enough for user-friendly display. Confirm that grouping by raw model value produces a manageable number of options.

---

- **Decision**: CLOSED tickets visibility is implemented as a dedicated second card next to "Tickets Shipped" rather than merging into a single card with sub-details. This keeps each card focused on a single metric and avoids overloading the existing card.
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score 0.3) -- the ticket offered both options ("carte a cote" or "integre"); chose the cleaner separation
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Two cards take more horizontal space but improve readability and scanability
  2. A single merged card would save space but complicate the UI with sub-details
- **Reviewer Notes**: If dashboard space is constrained, the team may reconsider merging into a single card with SHIP/CLOSED breakdown.

---

- **Decision**: The status filter defaults to "SHIP only" and applies globally to all analytics metrics, including the velocity chart and workflow distribution. When the user selects "CLOSED only" or "SHIP + CLOSED", metrics are recalculated based on jobs belonging to tickets in those stages.
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score 0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Global filter application ensures consistency across all dashboard widgets
  2. May require adjusting all existing queries to include ticket stage filtering
- **Reviewer Notes**: Confirm that filtering by ticket stage (SHIP/CLOSED) on job-level metrics produces meaningful data. Verify that jobs for CLOSED tickets are meaningful to analyze.

---

- **Decision**: The status filter and agent filter are additive (AND logic). When both are set, only jobs matching the selected agent AND belonging to tickets in the selected stage(s) are included.
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score 0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. AND logic is the most intuitive behavior for combined filters
  2. Could result in empty data sets for narrow filter combinations
- **Reviewer Notes**: Ensure the UI gracefully handles empty states when filter combinations return no data.

## User Scenarios & Testing

### User Story 1 - Filter Analytics by Ticket Status (Priority: P1)

As a project manager, I want to filter analytics metrics by ticket status (SHIP, CLOSED, or both) so I can analyze performance for shipped versus closed tickets separately.

**Why this priority**: The status filter fundamentally changes what data the entire dashboard displays. All other features depend on this filtering mechanism working correctly.

**Independent Test**: Can be fully tested by selecting different status options and verifying that all overview cards, charts, and metrics update to reflect only tickets in the selected stage(s).

**Acceptance Scenarios**:

1. **Given** I am on the analytics dashboard, **When** I open the status filter, **Then** I see three options: "Shipped" (default selected), "Closed", and "Shipped + Closed"
2. **Given** the status filter is set to "Shipped" (default), **When** I view any metric or chart, **Then** only data from jobs belonging to tickets in the SHIP stage is included
3. **Given** the status filter is set to "Closed", **When** I view any metric or chart, **Then** only data from jobs belonging to tickets in the CLOSED stage is included
4. **Given** the status filter is set to "Shipped + Closed", **When** I view any metric or chart, **Then** data from jobs belonging to tickets in both SHIP and CLOSED stages is included
5. **Given** I change the status filter, **When** the dashboard refreshes, **Then** all widgets update simultaneously: overview cards, cost over time, cost by stage, top tools, token usage, cache efficiency, velocity, and workflow distribution

---

### User Story 2 - Dynamic Tickets Shipped Card (Priority: P1)

As a project manager, I want the "Tickets Shipped" card to reflect the currently selected time period so that the count matches the rest of the dashboard's data scope.

**Why this priority**: This is a bug fix -- the card currently always shows the current calendar month regardless of the selected time range, which is misleading and inconsistent.

**Independent Test**: Can be tested by switching between time ranges (7d, 30d, 90d, all) and verifying the card value and label update correctly.

**Acceptance Scenarios**:

1. **Given** I select the "7 days" time range, **When** I view the Tickets Shipped card, **Then** it displays the count of shipped tickets from the last 7 days and the label reads "last 7 days"
2. **Given** I select the "30 days" time range, **When** I view the Tickets Shipped card, **Then** it displays the count of shipped tickets from the last 30 days and the label reads "last 30 days"
3. **Given** I select the "90 days" time range, **When** I view the Tickets Shipped card, **Then** it displays the count of shipped tickets from the last 90 days and the label reads "last 90 days"
4. **Given** I select "All time", **When** I view the Tickets Shipped card, **Then** it displays the total count of all shipped tickets and the label reads "all time"
5. **Given** I change both the time range and the status filter, **When** I view the card, **Then** the count respects both the selected time period and status filter

---

### User Story 3 - Filter Analytics by Agent (Priority: P2)

As a project manager, I want to filter analytics by the agent (model) that executed jobs so I can compare performance between different AI agents.

**Why this priority**: Agent filtering adds a new dimension of analysis but is secondary to the foundational status filtering and the shipped card bug fix.

**Independent Test**: Can be tested by selecting a specific agent from the dropdown and verifying all metrics reflect only jobs executed by that agent.

**Acceptance Scenarios**:

1. **Given** I am on the analytics dashboard, **When** I open the agent filter, **Then** I see "All Agents" (default selected) plus a list of agents that have at least one job on this project
2. **Given** only "Claude Opus 4" and "Codex" have executed jobs on this project, **When** I open the agent filter, **Then** I see exactly those two agents listed plus "All Agents"
3. **Given** I select a specific agent, **When** the dashboard refreshes, **Then** all metrics, charts, and cards reflect only jobs executed by that agent
4. **Given** I select "All Agents", **When** the dashboard refreshes, **Then** metrics include jobs from all agents (default behavior)
5. **Given** no jobs exist for a selected agent in the current time range, **When** I view the dashboard, **Then** an appropriate empty state is shown with zeroed metrics

---

### User Story 4 - Tickets Closed Card (Priority: P2)

As a project manager, I want to see the number of closed tickets for the selected time period so I can track closure rates alongside shipment rates.

**Why this priority**: Provides visibility into a previously hidden metric. Complements the existing shipped card but is not as critical as the bug fix or status filter.

**Independent Test**: Can be tested by verifying the card displays the correct count of CLOSED tickets within the selected time range.

**Acceptance Scenarios**:

1. **Given** I am on the analytics dashboard, **When** I view the overview section, **Then** I see a "Tickets Closed" card displayed alongside the "Tickets Shipped" card
2. **Given** the time range is set to "30 days", **When** I view the Tickets Closed card, **Then** it displays the number of tickets that moved to CLOSED stage within the last 30 days
3. **Given** the time range changes, **When** I view the Tickets Closed card, **Then** the count and label update to match the selected period
4. **Given** no tickets were closed in the selected period, **When** I view the Tickets Closed card, **Then** it displays "0"

---

### Edge Cases

- What happens when a project has zero completed jobs? All metrics show zero/empty state, filters remain functional
- What happens when the agent filter is applied but all jobs for that agent are outside the selected time range? Dashboard shows empty state with zeroed metrics
- What happens when a ticket moves from SHIP to CLOSED? The ticket appears in CLOSED filter results, not SHIP
- What happens when the database has null or empty `model` values on jobs? Those jobs are excluded from agent-specific filters but included in "All Agents"
- What happens when status filter is set to "Closed" but no tickets have reached CLOSED? Dashboard shows empty state, cards display zero

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a status filter with three options: "Shipped" (SHIP stage only, default), "Closed" (CLOSED stage only), and "Shipped + Closed" (both stages)
- **FR-002**: The status filter MUST apply to all analytics metrics and charts: overview cards, cost over time, cost by stage, top tools, token usage, cache efficiency, velocity, and workflow distribution
- **FR-003**: System MUST provide an agent filter with "All Agents" as default and dynamically populated agent options based on distinct job `model` values that exist for the project
- **FR-004**: The agent filter MUST apply to all analytics metrics and charts
- **FR-005**: Status filter and agent filter MUST combine with AND logic (both conditions must be satisfied)
- **FR-006**: Both filters MUST combine with the existing time range filter (AND logic across all three filters)
- **FR-007**: The "Tickets Shipped" card MUST display the count for the currently selected time range instead of the current calendar month
- **FR-008**: The "Tickets Shipped" card label MUST reflect the selected time period (e.g., "last 7 days", "last 30 days", "last 90 days", "all time")
- **FR-009**: System MUST display a "Tickets Closed" card alongside the "Tickets Shipped" card showing the count of tickets that reached CLOSED stage within the selected time period
- **FR-010**: The "Tickets Closed" card MUST respect the selected time range filter
- **FR-011**: Filter selections MUST persist in the URL as query parameters so they survive page refreshes and can be shared
- **FR-012**: Agent filter options MUST be derived dynamically from existing job data; agents with no jobs on the project MUST NOT appear in the selector

### Key Entities

- **Ticket**: Represents a work item with a `stage` field (SHIP or CLOSED being relevant for filtering) and an `updatedAt` timestamp for period-based counting
- **Job**: Represents an execution unit with a `model` field (string identifying the AI agent/model), `completedAt` for time filtering, and various metrics (cost, tokens, duration, tools) that feed analytics

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can filter analytics by ticket status within 2 clicks (open dropdown, select option)
- **SC-002**: Users can filter analytics by agent within 2 clicks (open dropdown, select option)
- **SC-003**: The "Tickets Shipped" card count matches the selected time range 100% of the time (no more calendar-month mismatch)
- **SC-004**: All dashboard widgets update consistently when any filter changes -- no widget shows stale or unfiltered data
- **SC-005**: Filter state is preserved across page refreshes via URL parameters
- **SC-006**: Dashboard loads with filtered data within the same performance envelope as the current unfiltered load (no perceptible degradation)
- **SC-007**: Users can see both shipped and closed ticket counts at a glance without switching filters
