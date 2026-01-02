# Feature Specification: Ticket Comparison

**Feature Branch**: `AIB-123-ticket-comparison-compare`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: Compare 1-5 tickets to analyze implementations, specs, costs, and constitution compliance

## Auto-Resolved Decisions

- **Decision**: Ticket reference syntax uses `#TICKET-KEY` format (e.g., `#AIB-124`) rather than ticket IDs or URLs
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) - Matches existing mention parsing patterns and is user-friendly
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Requires parsing ticket keys from comment text, adding complexity
  2. More intuitive for users than numeric IDs
- **Reviewer Notes**: Validate that ticket key regex doesn't conflict with other `#` prefixed patterns in comments

---

- **Decision**: Comparison reports stored in `specs/{branch}/comparisons/` directory with timestamp-based filenames
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) - Follows existing documentation pattern (`specs/{branch}/spec.md`, etc.)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Preserves history by using unique timestamped filenames
  2. May accumulate files over time (acceptable for audit trail)
- **Reviewer Notes**: Consider cleanup policy for old comparison files during cleanup workflow

---

- **Decision**: Feature alignment threshold of 30% determines whether full comparison or cost-only comparison is shown
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) - 30% is a reasonable threshold to detect unrelated tickets
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. May miss nuanced relationships between tickets with different approaches to same problem
  2. Prevents misleading comparisons of unrelated features
- **Reviewer Notes**: Consider making threshold configurable in future iterations

---

- **Decision**: Constitution compliance scoring uses checklist-based approach against `.specify/memory/constitution.md` principles
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) - Constitution already defines non-negotiable rules as checklist items
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Binary pass/fail for each principle may oversimplify nuanced compliance
  2. Provides objective, consistent scoring across comparisons
- **Reviewer Notes**: Ensure all constitution sections have testable criteria

---

- **Decision**: The "Compare" button in ticket detail only appears when at least one comparison report exists for that ticket
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) - Follows existing pattern where doc buttons appear only after relevant job completes
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users must trigger comparison via comment first before viewing
  2. Avoids empty state in UI
- **Reviewer Notes**: Consider tooltip explaining how to create a comparison if button is not visible

## User Scenarios & Testing

### User Story 1 - Compare Variant Implementations (Priority: P1)

A project owner wants to evaluate multiple implementations of the same feature to determine which approach is best suited for production.

**Why this priority**: Core value proposition - enables data-driven decision making when testing feature variants

**Independent Test**: Can be fully tested by posting a `/compare` comment and receiving a comparison report that includes all specified dimensions

**Acceptance Scenarios**:

1. **Given** a ticket in SPECIFY, PLAN, BUILD, or VERIFY stage with at least 2 other tickets in the same project, **When** the user posts a comment `@ai-board /compare #AIB-124 #AIB-125`, **Then** the system creates a comparison report analyzing all specified tickets

2. **Given** a valid `/compare` command with ticket references, **When** the comparison completes, **Then** the user receives a comment response with a direct link to view the comparison report

3. **Given** a comparison report exists for a ticket, **When** the user opens the ticket detail modal, **Then** a "Compare" button appears in the Files section that opens the comparison viewer

---

### User Story 2 - Cost Analysis (Priority: P1)

A project owner wants to understand the cost implications of different implementation approaches before selecting one for production.

**Why this priority**: Cost visibility is a key factor in implementation decisions

**Independent Test**: Can be tested by triggering comparison on tickets with job telemetry and verifying cost table in report

**Acceptance Scenarios**:

1. **Given** tickets with completed jobs containing telemetry data (inputTokens, outputTokens, costUsd, durationMs), **When** a comparison is run, **Then** the report includes a cost comparison table with token counts, USD cost, and duration for each ticket

2. **Given** a ticket with no telemetry data, **When** included in a comparison, **Then** the cost section for that ticket shows "N/A" with explanation

---

### User Story 3 - Constitution Compliance Check (Priority: P2)

A project owner wants to verify that implementation approaches follow the project's constitution principles (SOLID, security, testing).

**Why this priority**: Ensures code quality standards are maintained across variants

**Independent Test**: Can be tested by comparing tickets and verifying compliance scores against constitution principles

**Acceptance Scenarios**:

1. **Given** tickets with implementation code, **When** a comparison is run, **Then** the report includes a constitution compliance section scoring each ticket against `.specify/memory/constitution.md` principles

2. **Given** a ticket violates a constitution principle, **When** included in a comparison, **Then** the specific violation is noted with reference to the principle

---

### User Story 4 - Handle Missing Tickets (Priority: P2)

The system gracefully handles edge cases where referenced tickets cannot be found or have merged branches.

**Why this priority**: Production robustness - users may reference old or invalid tickets

**Independent Test**: Can be tested by referencing non-existent ticket keys and verifying error handling

**Acceptance Scenarios**:

1. **Given** a `/compare` command with a non-existent ticket key, **When** the standard lookup fails, **Then** the system searches for branches matching pattern `*-{ticketKey}-*` before failing

2. **Given** a ticket whose branch has been merged and deleted, **When** included in a comparison, **Then** the system finds the merge commit via `git log --merges` on main and analyzes from there

3. **Given** all referenced tickets cannot be found, **When** the comparison is attempted, **Then** the user receives an error message listing which tickets could not be found

---

### User Story 5 - View Comparison History (Priority: P3)

A project owner wants to view previous comparison reports for a ticket to track decision evolution.

**Why this priority**: Audit trail and historical context

**Independent Test**: Can be tested by creating multiple comparisons and viewing the history list

**Acceptance Scenarios**:

1. **Given** a ticket with multiple comparison reports, **When** the user clicks the "Compare" button, **Then** the viewer shows the most recent comparison with option to view history

2. **Given** a comparison history exists, **When** the user selects a historical report, **Then** the full report content is displayed

---

### Edge Cases

- What happens when user provides more than 5 ticket references? System limits to first 5 with warning message
- What happens when referenced tickets are from different projects? System rejects with error explaining same-project requirement
- What happens when feature alignment is below 30%? System shows warning and generates cost-only comparison
- How does system handle circular references (comparing ticket to itself)? System excludes reference ticket from comparison targets

## Requirements

### Functional Requirements

- **FR-001**: System MUST detect `/compare` command in comments mentioning `@ai-board`
- **FR-002**: System MUST parse `#TICKET-KEY` references from the comment text (e.g., `#AIB-124`, `#AIB-125`)
- **FR-003**: System MUST validate that referenced tickets exist and belong to the same project
- **FR-004**: System MUST limit comparison to 1-5 tickets (excluding the reference ticket where comment was posted)
- **FR-005**: System MUST calculate feature alignment score (0-100%) by analyzing spec overlap between tickets
- **FR-006**: System MUST warn when feature alignment is below 30% and generate cost-only comparison
- **FR-007**: System MUST analyze implementation metrics: lines changed, files changed, test coverage percentage
- **FR-008**: System MUST score constitution compliance against `.specify/memory/constitution.md` principles
- **FR-009**: System MUST extract and display job telemetry (input tokens, output tokens, cache tokens, USD cost, duration)
- **FR-010**: System MUST generate comparison report file at `specs/{branch}/comparisons/{timestamp}-vs-{keys}.md`
- **FR-011**: System MUST post comment response with link to view the comparison report
- **FR-012**: System MUST display "Compare" button in ticket detail when comparison reports exist
- **FR-013**: System MUST support viewing comparison reports through DocumentationViewer component
- **FR-014**: System MUST handle missing tickets by searching branch patterns before failing
- **FR-015**: System MUST handle merged/deleted branches by finding merge commits on main

### Key Entities

- **Comparison Report**: Generated analysis document containing executive summary, feature alignment matrix, implementation diff analysis, constitution compliance scores, cost comparison table, and recommendation
- **Ticket Reference**: Parsed `#TICKET-KEY` from comment, validated against project scope
- **Feature Alignment Score**: Percentage (0-100%) measuring spec overlap between compared tickets
- **Constitution Compliance Score**: Per-principle pass/fail assessment with overall score

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can trigger a ticket comparison within 30 seconds via comment command
- **SC-002**: Comparison reports are generated and linked in response comment within 5 minutes
- **SC-003**: 100% of comparison reports include all required sections (executive summary, alignment, implementation, compliance, cost, recommendation)
- **SC-004**: Feature alignment calculation produces consistent scores (same inputs yield same output)
- **SC-005**: Users can view comparison reports through the existing documentation viewer interface
- **SC-006**: Edge cases (missing tickets, merged branches, unrelated features) are handled gracefully with clear user messaging
- **SC-007**: All comparison operations respect existing authentication and authorization controls
