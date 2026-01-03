# Feature Specification: Add Telemetry Metrics to Ticket Comparison

**Feature Branch**: `AIB-130-add-telemetry-metrics`
**Created**: 2026-01-03
**Status**: Draft
**Input**: User description: "Add telemetry metrics to ticket comparison"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: File location for telemetry context file
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: Medium (0.6) - Standard pattern for workflow-generated context files
- **Fallback Triggered?**: No - Clear pattern exists in codebase for spec-adjacent files
- **Trade-offs**:
  1. Using `specs/$BRANCH/.telemetry-context.json` aligns with existing patterns (`.ai-board-result.md`)
  2. Alternative location in `ticket-assets/` would require additional cleanup handling
- **Reviewer Notes**: Verify file naming follows existing conventions for dot-prefixed workflow artifacts

---

- **Decision**: Telemetry data structure format
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (0.9) - Existing `TicketTelemetry` interface in `lib/types/comparison.ts` defines the structure
- **Fallback Triggered?**: No - Direct reuse of existing types
- **Trade-offs**:
  1. Reusing existing types ensures consistency across the codebase
  2. Extending the interface would be a separate scope item if additional fields needed
- **Reviewer Notes**: The existing `TicketTelemetry` interface already contains all required fields

---

- **Decision**: API endpoint for telemetry retrieval
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (0.9) - Existing `/api/projects/[projectId]/tickets/[id]/jobs` endpoint returns telemetry data
- **Fallback Triggered?**: No - Clear existing infrastructure
- **Trade-offs**:
  1. Using existing API avoids creating duplicate endpoints
  2. Multiple API calls may be needed for multiple tickets (acceptable for workflow context)
- **Reviewer Notes**: Workflow already has WORKFLOW_API_TOKEN for authenticated API access

---

- **Decision**: Handling tickets without telemetry data
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (0.9) - Existing `createEmptyTelemetry()` function handles this case
- **Fallback Triggered?**: No - Established pattern
- **Trade-offs**:
  1. Displaying "N/A" for missing data is consistent with current behavior
  2. Report remains readable even when some tickets lack telemetry
- **Reviewer Notes**: Efficiency criterion (10% weight) gracefully degrades when data unavailable

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Telemetry Metrics in Comparison Report (Priority: P1)

A project manager triggers a `/compare #AIB-127 #AIB-128` command to evaluate which ticket implementation is more cost-effective. The comparison report includes actual cost, duration, and token usage data for each ticket, allowing data-driven decision making about which implementation to ship.

**Why this priority**: This is the core value proposition - enabling cost-based comparison decisions.

**Independent Test**: Can be fully tested by executing a comparison on tickets with completed jobs and verifying the report contains a Metrics Comparison table with Cost and Duration columns.

**Acceptance Scenarios**:

1. **Given** tickets AIB-127 and AIB-128 have completed jobs with telemetry data, **When** user runs `/compare #AIB-127 #AIB-128`, **Then** the comparison report includes a Metrics Comparison table showing inputTokens, outputTokens, costUsd, and durationMs for each ticket.
2. **Given** the workflow executes before Claude, **When** the telemetry step runs, **Then** a `.telemetry-context.json` file is created in the spec branch directory with aggregated telemetry for all tickets involved.
3. **Given** the comparison report is generated, **When** reviewing the Efficiency criterion, **Then** the 10% weight calculation uses actual cost data from the telemetry context file.

---

### User Story 2 - Graceful Handling of Missing Telemetry (Priority: P2)

A developer runs a comparison where one of the tickets has no job telemetry (e.g., a very old ticket or one with only failed jobs). The comparison still completes successfully, displaying "N/A" for unavailable metrics while using available data for other tickets.

**Why this priority**: Ensures feature robustness without blocking on data availability.

**Independent Test**: Can be tested by comparing a ticket with telemetry against one without, verifying the report renders correctly with "N/A" values.

**Acceptance Scenarios**:

1. **Given** AIB-127 has telemetry data but AIB-128 has no completed jobs, **When** comparison runs, **Then** the report shows actual metrics for AIB-127 and "N/A" for AIB-128's metrics.
2. **Given** no tickets in the comparison have telemetry, **When** comparison runs, **Then** the Metrics Comparison table displays "N/A" for all entries and the Efficiency criterion score defaults to equal weighting.

---

### User Story 3 - Workflow Generates Telemetry Context (Priority: P1)

The ai-board-assist workflow, before executing the `/compare` command, queries the ai-board API to fetch job telemetry for all referenced tickets and writes the aggregated data to a context file that Claude can read during comparison.

**Why this priority**: This is the technical enabler for the entire feature - without this step, Claude cannot access telemetry.

**Independent Test**: Can be tested by running the workflow step in isolation and verifying the context file is created with correct structure.

**Acceptance Scenarios**:

1. **Given** a comment contains `/compare #AIB-127 #AIB-128`, **When** the workflow processes the request, **Then** it parses ticket references and calls the jobs API for each ticket.
2. **Given** API calls return job data, **When** workflow aggregates telemetry, **Then** `.telemetry-context.json` is written with the structure `{ "ticketKey": { inputTokens, outputTokens, costUsd, durationMs } }`.
3. **Given** the context file exists, **When** Claude executes `/compare`, **Then** it reads the file to populate the Metrics Comparison table.

---

### Edge Cases

- What happens when the jobs API returns an error for a ticket? The workflow logs a warning and sets that ticket's telemetry to empty/N/A values.
- What happens when the context file cannot be written (permissions issue)? The workflow fails with a clear error message, and job status updates to FAILED.
- What happens if the same comparison is run twice in quick succession? Each run generates its own context file and report (timestamps ensure uniqueness).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Workflow MUST query the jobs API for each ticket referenced in a `/compare` command before executing Claude.
- **FR-002**: Workflow MUST aggregate job telemetry data (inputTokens, outputTokens, costUsd, durationMs) for each ticket.
- **FR-003**: Workflow MUST write aggregated telemetry to `specs/$BRANCH/.telemetry-context.json` in the ticket's spec directory.
- **FR-004**: The `/compare` command MUST read `.telemetry-context.json` when generating comparison reports.
- **FR-005**: Comparison reports MUST include a Metrics Comparison table with columns: Ticket, Lines, Files, Tests, Cost, Duration.
- **FR-006**: The Efficiency criterion (10% weight) MUST use actual cost data when calculating ticket rankings.
- **FR-007**: System MUST display "N/A" for metrics when telemetry data is unavailable for a ticket.
- **FR-008**: Telemetry context file MUST follow the `TicketTelemetry` type structure from `lib/types/comparison.ts`.

### Key Entities *(include if feature involves data)*

- **TelemetryContextFile**: JSON file containing aggregated telemetry keyed by ticket key, written by workflow, read by compare command.
- **TicketTelemetry**: Existing type representing aggregated token, cost, and duration metrics for a single ticket.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Comparison reports include Cost and Duration columns in the Metrics Comparison table for all evaluated tickets.
- **SC-002**: The Efficiency criterion score reflects actual cost differences between tickets (lower cost improves score).
- **SC-003**: Comparisons involving tickets without telemetry display gracefully with "N/A" values and do not fail.
- **SC-004**: Users can make data-driven decisions about which ticket implementation is more cost-effective based on comparison metrics.
