# Feature Specification: Add Telemetry for Ticket Source on Compare

**Feature Branch**: `AIB-138-add-telemetry-for`
**Created**: 2026-01-04
**Status**: Draft
**Input**: User description: "On compare the telemetry do not include the ticket source, only the ticket as argument. Add the telemetry for the source too."

## Auto-Resolved Decisions

- **Decision**: Include source ticket telemetry alongside compared tickets in the same data structure
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: High (score: 0.85) - internal tooling feature with clear scope
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Slightly more data fetched per comparison (one additional ticket telemetry)
  2. Enables complete cost analysis between source and compared implementations
- **Reviewer Notes**: Verify that source ticket telemetry follows the same aggregation logic as compared tickets (only COMPLETED jobs)

---

- **Decision**: Modify existing fetch-telemetry.sh script rather than creating a separate endpoint
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: High (score: 0.9) - follows existing patterns, minimal code change
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Script modification keeps logic centralized in one place
  2. No API changes required
- **Reviewer Notes**: Ensure BRANCH environment variable correctly resolves to source ticket

## User Scenarios & Testing

### User Story 1 - Complete Telemetry in Comparison Report (Priority: P1)

A project owner runs a `/compare` command from a ticket and expects to see telemetry data for ALL tickets in the comparison - including the source ticket from which the comparison was triggered.

**Why this priority**: Core value of the feature - complete cost visibility enables accurate ROI analysis across implementation approaches.

**Independent Test**: Run `@ai-board /compare #KEY1` from a ticket with completed jobs. Verify the resulting `.telemetry-context.json` and comparison report include telemetry for the source ticket.

**Acceptance Scenarios**:

1. **Given** a ticket (AIB-138) with 3 completed jobs and telemetry data, **When** user runs `@ai-board /compare #AIB-130 #AIB-131`, **Then** the telemetry context file includes entries for AIB-138 (source), AIB-130, and AIB-131
2. **Given** a source ticket with no completed jobs, **When** user runs a compare command, **Then** the source ticket telemetry shows `hasData: false` with zero values
3. **Given** a comparison report is generated, **When** viewing the "Cost & Telemetry" section, **Then** the source ticket appears in the table with "(source)" label

---

### User Story 2 - Source Identification in Report (Priority: P2)

When viewing a comparison report, users can clearly identify which ticket was the source (the ticket from which the comparison was triggered) versus the compared tickets.

**Why this priority**: Clarity in reports helps users understand the comparison context.

**Independent Test**: Generate a comparison report and verify the source ticket is clearly labeled in the telemetry table and metrics sections.

**Acceptance Scenarios**:

1. **Given** a generated comparison report, **When** user views the telemetry section, **Then** the source ticket row includes "(source)" identifier
2. **Given** the comparison report markdown, **When** parsing the metrics table, **Then** the source ticket key can be distinguished from compared tickets

---

### Edge Cases

- What happens when the source ticket has no completed jobs? → Show `hasData: false` with zero values, still include in report
- How does the system handle self-comparison (source ticket also in compare list)? → Exclude duplicate, only show source once with "(source)" label
- What if source ticket branch cannot resolve to a ticket? → Use BRANCH env var to extract ticket key pattern and fetch telemetry by key

## Requirements

### Functional Requirements

- **FR-001**: System MUST fetch telemetry for the source ticket (current ticket running the compare) alongside compared tickets
- **FR-002**: System MUST include source ticket telemetry in `.telemetry-context.json` output file
- **FR-003**: Source ticket MUST be identifiable in the telemetry context (e.g., via metadata field or ordering)
- **FR-004**: System MUST extract source ticket key from the BRANCH environment variable (pattern: `{KEY}-{NUM}-{description}`)
- **FR-005**: System MUST use the same telemetry aggregation logic for source ticket as for compared tickets (COMPLETED jobs only)
- **FR-006**: Comparison report generator MUST display source ticket with "(source)" label in telemetry tables

### Key Entities

- **TelemetryContextFile**: JSON structure at `specs/$BRANCH/.telemetry-context.json` - extended to include source ticket data and optional `sourceTicket` metadata field
- **TicketTelemetry**: Existing structure for per-ticket telemetry - unchanged, reused for source ticket
- **Source Ticket**: The ticket from which `/compare` is triggered, identified by extracting ticket key from BRANCH environment variable

## Success Criteria

### Measurable Outcomes

- **SC-001**: All comparison reports include source ticket telemetry data (100% of new comparisons)
- **SC-002**: Source ticket is clearly identifiable in telemetry tables with "(source)" label
- **SC-003**: Zero breaking changes to existing comparison functionality
- **SC-004**: Users can see complete cost breakdown across all tickets in comparison including their source ticket
