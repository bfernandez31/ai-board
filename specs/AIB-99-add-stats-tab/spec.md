# Feature Specification: Add Stats Tab to Ticket Detail Modal

**Feature Branch**: `AIB-99-add-stats-tab`
**Created**: 2025-12-06
**Status**: Draft
**Input**: User description: "Add a fourth tab 'Stats' to the ticket detail modal that displays aggregated telemetry metrics from all workflow jobs associated with the ticket"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Whether to show the Stats tab when ticket has no jobs
- **Policy Applied**: AUTO (resolved to PRAGMATIC based on internal feature context)
- **Confidence**: High (score: 0.9) - Clear UI/UX pattern for empty states
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Hiding tab when no jobs exist reduces visual noise vs. showing empty state which maintains consistent navigation
  2. Hiding is simpler to implement and aligns with Files tab pattern (shows badge count)
- **Reviewer Notes**: Confirm hiding tab matches user expectations; some users may prefer always-visible tab with empty state

---

- **Decision**: How to aggregate and display tools usage data
- **Policy Applied**: AUTO (resolved to PRAGMATIC based on straightforward aggregation)
- **Confidence**: High (score: 0.8) - Standard aggregation pattern
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Simple count aggregation is fast but loses per-job granularity
  2. Frequency-sorted display provides quick insights into most-used tools
- **Reviewer Notes**: Tools are stored as String[] in Job model; aggregate counts across all jobs and display sorted by frequency

---

- **Decision**: Format and calculation for cache efficiency metric
- **Policy Applied**: AUTO (resolved to CONSERVATIVE for metrics accuracy)
- **Confidence**: High (score: 0.85) - Standard cache hit rate calculation
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Using cacheReadTokens / (inputTokens + cacheReadTokens) as standard cache efficiency formula
  2. Show 0% when no input tokens exist to avoid division errors
- **Reviewer Notes**: Verify formula matches analytics dashboard calculation for consistency

---

- **Decision**: Whether to include E2E test or unit test
- **Policy Applied**: AUTO (resolved to CONSERVATIVE for testing requirements)
- **Confidence**: High (score: 0.9) - User explicitly requested tests, codebase uses Playwright for E2E
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. E2E test provides full integration coverage but requires test data setup
  2. Aligns with existing test patterns in codebase (Playwright E2E)
- **Reviewer Notes**: Test must use [e2e] prefix for project/ticket data as per CLAUDE.md guidelines

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Aggregated Job Statistics (Priority: P1)

As a project manager or developer, I want to see aggregated statistics for all workflow jobs on a ticket so I can understand the total resources consumed and track workflow efficiency.

**Why this priority**: Core functionality that provides immediate value - users need visibility into accumulated costs and resource usage per ticket.

**Independent Test**: Can be fully tested by opening any ticket with completed jobs and viewing the Stats tab to see summary metrics.

**Acceptance Scenarios**:

1. **Given** a ticket with 3 completed jobs (costs: $0.50, $0.75, $0.25), **When** I open the Stats tab, **Then** I see total cost displayed as "$1.50"
2. **Given** a ticket with jobs totaling 120,000ms duration, **When** I open the Stats tab, **Then** I see duration displayed as "2m 0s"
3. **Given** a ticket with 50,000 input tokens and 20,000 cache read tokens, **When** I open the Stats tab, **Then** I see cache efficiency displayed as "28.6%"
4. **Given** a ticket with jobs having combined 100,000 input and 25,000 output tokens, **When** I open the Stats tab, **Then** I see total tokens displayed as "125,000"

---

### User Story 2 - Review Jobs Timeline (Priority: P1)

As a developer, I want to see a chronological list of all jobs with their individual metrics so I can identify which workflow stages consumed the most resources.

**Why this priority**: Essential for debugging and understanding per-stage resource consumption.

**Independent Test**: Can be tested by opening a ticket with multiple jobs and verifying each job appears with correct details.

**Acceptance Scenarios**:

1. **Given** a ticket with 4 jobs, **When** I open the Stats tab, **Then** I see all 4 jobs listed in chronological order (oldest first)
2. **Given** a job with command "implement", status COMPLETED, duration 45000ms, cost $0.32, **When** I view the jobs timeline, **Then** I see this job row showing "implement", success icon, "45s", "$0.32", and the model name
3. **Given** a job row in the timeline, **When** I click/expand it, **Then** I see token breakdown showing input tokens, output tokens, cache read tokens, and cache creation tokens

---

### User Story 3 - Analyze Tool Usage (Priority: P2)

As a developer, I want to see which tools were used most frequently across all jobs so I can understand workflow patterns and identify optimization opportunities.

**Why this priority**: Secondary insight that adds value but not essential for basic statistics visibility.

**Independent Test**: Can be tested by opening a ticket with jobs that used various tools and verifying aggregated counts.

**Acceptance Scenarios**:

1. **Given** jobs with toolsUsed arrays ["Edit", "Read", "Bash"], ["Edit", "Edit", "Read"], **When** I view the tools usage section, **Then** I see "Edit (3), Read (2), Bash (1)"
2. **Given** jobs with tools used, **When** I view tools usage, **Then** tools are sorted by frequency in descending order
3. **Given** no jobs have tools recorded, **When** I view tools usage, **Then** I see an appropriate empty state message

---

### User Story 4 - Real-Time Statistics Updates (Priority: P2)

As a user monitoring an active workflow, I want the Stats tab to update automatically as jobs complete so I can see real-time progress.

**Why this priority**: Enhances UX for active monitoring but not blocking for core functionality.

**Independent Test**: Can be tested by triggering a workflow and observing Stats tab updates during job completion.

**Acceptance Scenarios**:

1. **Given** a ticket with a RUNNING job, **When** the job completes, **Then** the Stats tab metrics update within 2 seconds without manual refresh
2. **Given** the Stats tab is open, **When** a new job starts on the ticket, **Then** the job appears in the timeline automatically

---

### Edge Cases

- What happens when all jobs have null/undefined telemetry fields? Display "N/A" or "-" for individual metrics; show 0 for totals
- What happens when a ticket has exactly one job? Display all sections normally with that job's data
- What happens when cache efficiency calculation would result in division by zero? Display "0%" when input tokens are 0
- What happens with very large numbers (millions of tokens)? Format with appropriate abbreviations (e.g., 1.2M)
- What happens when job.toolsUsed is an empty array? Show "No tools recorded" in tools section

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Stats" tab as the fourth tab in the ticket detail modal (after Details, Conversation, Files)
- **FR-002**: Stats tab MUST only be visible when the ticket has at least one associated job
- **FR-003**: System MUST display summary cards showing: total cost (formatted as $X.XX), total duration (formatted as Xm Xs), total tokens (input + output), and cache efficiency (percentage)
- **FR-004**: System MUST display a jobs timeline showing all jobs in chronological order
- **FR-005**: Each job row in the timeline MUST display: stage/command, status icon, duration, cost, and model used
- **FR-006**: Job rows MUST be expandable to reveal token breakdown (input, output, cache read, cache creation tokens)
- **FR-007**: System MUST display aggregated tool usage counts sorted by frequency descending
- **FR-008**: System MUST update displayed statistics automatically when job data changes (via existing 2-second polling)
- **FR-009**: System MUST show appropriate empty state message for tools section when no tools were recorded
- **FR-010**: System MUST handle null/undefined telemetry values gracefully, displaying appropriate fallback values

### Key Entities *(include if feature involves data)*

- **Job**: Existing entity containing telemetry data (costUsd, durationMs, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, toolsUsed, model, status, command)
- **Ticket**: Parent entity that has a one-to-many relationship with Jobs

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view total job costs for any ticket in under 1 second after opening the modal
- **SC-002**: Statistics display updates within 2 seconds of job status changes (matching existing polling interval)
- **SC-003**: All telemetry metrics are accurately calculated and match the sum of individual job values
- **SC-004**: 100% of tickets with jobs display the Stats tab; 100% of tickets without jobs hide the Stats tab
- **SC-005**: E2E test passes validating Stats tab displays correctly with expected data
- **SC-006**: Users can expand any job row to see detailed token breakdown
