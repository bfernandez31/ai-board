# Feature Specification: Add Stats Tab to Ticket Detail Modal

**Feature Branch**: `AIB-98-add-stats-tab`
**Created**: 2025-12-06
**Status**: Draft
**Input**: User description: "Add a fourth tab 'Stats' to the ticket detail modal that displays aggregated telemetry metrics from all workflow jobs associated with the ticket."

## Auto-Resolved Decisions

- **Decision**: Tab visibility behavior when no jobs exist
- **Policy Applied**: PRAGMATIC
- **Confidence**: Medium (score: -2) - internal tooling feature with clear UX implications
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Hiding tab entirely when no jobs exist keeps UI clean but users may not know the feature exists
  2. Alternative would show empty state within tab, but adds visual clutter for new tickets
- **Reviewer Notes**: The requirement explicitly states "tab only visible when ticket has at least one job" - this is implemented as specified. Consider if a subtle indicator would help discoverability.

---

- **Decision**: Data source for stats display (polling vs. fetched data)
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (score: -2, explicit requirement) - requirement states "reuse existing ticket.jobs data"
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Using existing polled job data (2s interval) ensures consistency with other UI elements
  2. May not include full telemetry fields if current polling endpoint returns minimal data - implementation may need to expand TicketJob type
- **Reviewer Notes**: Verify that job polling returns telemetry fields (inputTokens, outputTokens, etc.) or plan to extend the polling response schema.

---

- **Decision**: Empty state behavior vs. zero-value display
- **Policy Applied**: PRAGMATIC
- **Confidence**: High - explicit requirement: "Empty state message when no jobs exist"
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Empty state message is more informative than showing zeros
  2. Simple approach that matches user expectation
- **Reviewer Notes**: None - requirement is explicit.

## User Scenarios & Testing

### User Story 1 - View Aggregated Job Metrics (Priority: P1)

A project manager opens a ticket detail modal to understand how much AI processing has been consumed for a particular feature. They click the Stats tab and immediately see summary cards showing total cost, duration, tokens used, and cache efficiency across all workflow executions.

**Why this priority**: Core value proposition - users need visibility into AI resource consumption to understand costs and optimize workflows.

**Independent Test**: Can be fully tested by creating a ticket with completed jobs containing telemetry data, opening the modal, and verifying the Stats tab displays accurate aggregated metrics.

**Acceptance Scenarios**:

1. **Given** a ticket with 3 completed jobs (costing $0.15, $0.22, $0.08), **When** user opens the Stats tab, **Then** total cost displays "$0.45"
2. **Given** a ticket with jobs having durations of 45000ms and 30000ms, **When** user opens the Stats tab, **Then** total duration displays "1m 15s"
3. **Given** a ticket with 50,000 input tokens and 10,000 output tokens across all jobs, **When** user opens the Stats tab, **Then** total tokens displays "60,000"
4. **Given** jobs with 20,000 cache read tokens and 50,000 total input tokens, **When** user opens the Stats tab, **Then** cache efficiency displays "40%"

---

### User Story 2 - Review Individual Job Details (Priority: P2)

A developer investigating a slow workflow execution wants to see the breakdown of each job. They view the jobs timeline showing all executions in chronological order, then expand a specific job to see its token breakdown.

**Why this priority**: Secondary to aggregated view - provides drill-down capability for troubleshooting and analysis.

**Independent Test**: Can be tested by opening a ticket with multiple jobs and verifying the timeline displays job rows with correct data, and that expanding a row reveals token breakdown.

**Acceptance Scenarios**:

1. **Given** a ticket with 5 jobs, **When** user views the Stats tab, **Then** all 5 jobs appear in the timeline ordered by start time (oldest first)
2. **Given** a job with command "implement", status COMPLETED, duration 45s, cost $0.22, model "claude-sonnet-4-20250514", **When** user views its row, **Then** row displays stage "BUILD", check icon, "45s", "$0.22", "claude-sonnet-4-20250514"
3. **Given** a job row, **When** user clicks to expand, **Then** token breakdown shows input tokens, output tokens, cache read tokens, cache creation tokens

---

### User Story 3 - Analyze Tool Usage Patterns (Priority: P3)

A team lead wants to understand which AI tools are used most frequently across a feature's development. They scroll to the tools usage section to see aggregated counts of tools used.

**Why this priority**: Nice-to-have analytics for optimization - less critical than cost/duration visibility.

**Independent Test**: Can be tested by creating jobs with varying toolsUsed arrays and verifying the aggregated count displays correctly, sorted by frequency.

**Acceptance Scenarios**:

1. **Given** jobs with toolsUsed: ["Edit", "Read", "Edit", "Bash", "Read", "Edit"], **When** user views tools usage, **Then** display shows "Edit (3), Read (2), Bash (1)"
2. **Given** no jobs have toolsUsed data, **When** user views tools usage section, **Then** section shows appropriate empty state or is hidden

---

### Edge Cases

- What happens when job telemetry fields are null/undefined? Display as "—" or "0" with graceful fallback.
- How does cache efficiency display when total input tokens is zero? Show "—" instead of attempting division.
- What happens with jobs still in PENDING or RUNNING status? Include in timeline but mark appropriately; exclude incomplete metrics from aggregates.
- What happens when a single job has extremely high values (e.g., millions of tokens)? Use number formatting with appropriate abbreviations (e.g., "1.2M").

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a "Stats" tab as the fourth tab in the ticket detail modal, positioned after Files
- **FR-002**: System MUST show the Stats tab only when the ticket has at least one associated job
- **FR-003**: System MUST display four summary cards: Total Cost, Total Duration, Total Tokens, Cache Efficiency
- **FR-004**: System MUST calculate Total Cost as the sum of costUsd across all jobs, formatted as "$X.XX"
- **FR-005**: System MUST calculate Total Duration as the sum of durationMs across all jobs, formatted as "Xm Xs"
- **FR-006**: System MUST calculate Total Tokens as the sum of (inputTokens + outputTokens) across all jobs
- **FR-007**: System MUST calculate Cache Efficiency as (cacheReadTokens / total inputTokens) × 100, displayed as percentage
- **FR-008**: System MUST display a chronologically-ordered timeline of all jobs associated with the ticket
- **FR-009**: System MUST show for each job row: stage/command label, status icon, duration, cost, and model used
- **FR-010**: System MUST allow users to expand job rows to reveal token breakdown (input, output, cache read, cache creation tokens)
- **FR-011**: System MUST display aggregated tool usage counts across all jobs, sorted by frequency descending
- **FR-012**: System MUST refresh stats data using the existing job polling mechanism (2-second interval)
- **FR-013**: System MUST display an empty state message when the ticket has no jobs (if tab is shown despite FR-002)
- **FR-014**: System MUST support keyboard shortcut Cmd+4/Ctrl+4 for navigating to the Stats tab

### Key Entities

- **Job**: Workflow execution record containing telemetry metrics (inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd, durationMs, model, toolsUsed, command, status)
- **Ticket**: Parent entity that has many Jobs; Stats tab aggregates data from all associated jobs

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can view complete job telemetry metrics for any ticket within 2 seconds of opening the Stats tab
- **SC-002**: Summary calculations (cost, duration, tokens, cache efficiency) are accurate to within 0.01% of actual aggregated values
- **SC-003**: Stats tab loads and renders within 100ms when job data is already available from polling
- **SC-004**: Users can expand and collapse job rows to view detailed token breakdown within 200ms interaction response time
- **SC-005**: All four summary metrics are visible without scrolling on standard desktop viewport (1024px width)
