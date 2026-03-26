# Feature Specification: Persist Structured Decision Points in Comparison Data

**Feature Branch**: `AIB-353-persist-structured-decision`
**Created**: 2026-03-26
**Status**: Draft
**Input**: User description: "Persist structured decision points in comparison data"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Whether to add a new field to the existing report JSON schema or restructure the existing `alignment.matchingRequirements` field
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Medium (score 3) — data integrity signals present ("persist", "structured"), no conflicting signals
- **Fallback Triggered?**: Yes — medium confidence promoted to CONSERVATIVE to ensure backward compatibility is handled safely
- **Trade-offs**:
  1. Adding a new optional field preserves full backward compatibility but slightly increases payload size
  2. Restructuring existing fields would be cleaner but risks breaking existing comparisons
- **Reviewer Notes**: Verify that existing comparisons (without the new `decisionPoints` field in the report) continue to render correctly with the current fallback logic

---

- **Decision**: Maximum number of structured decision points to persist per comparison
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — the AI already generates 3-7 decision points per comparison; capping at the existing database constraint (no cap in schema) is safest
- **Trade-offs**:
  1. No artificial cap allows full fidelity from AI analysis
  2. Very large numbers could impact payload size and rendering performance
- **Reviewer Notes**: The existing UI already handles variable-length decision point lists via accordion. Current AI behavior (3-7 points) is reasonable. Consider adding a soft display limit in the UI if future comparisons exceed ~10 points.

---

- **Decision**: How to handle the per-decision-point verdict when the AI identifies a different winner per decision point
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — the database schema already supports per-point `verdictTicketId`, so enabling distinct winners per point is the intended design
- **Trade-offs**:
  1. Per-point winners give more nuanced comparison results
  2. May initially confuse users who expect a single winner across all points
- **Reviewer Notes**: The UI already renders `verdictTicketId` per decision point — this change simply populates it with accurate data instead of duplicating the global winner.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Distinct Decision Points in Comparison Dialog (Priority: P1)

A user opens the comparison dialog for a completed ticket comparison and sees each decision point with its own unique title, rationale, verdict winner, and per-ticket approach descriptions that reflect the actual AI analysis.

**Why this priority**: This is the core user-facing outcome — without distinct decision point content, the comparison dialog provides misleading repeated information.

**Independent Test**: Can be tested by creating a comparison with the new structured data and verifying each accordion item displays different content.

**Acceptance Scenarios**:

1. **Given** a new comparison has been generated with structured decision points, **When** the user opens the comparison dialog, **Then** each decision point accordion shows a unique title, rationale, verdict, and per-ticket approach summaries that differ from other decision points.
2. **Given** a comparison has 5 decision points with different winners, **When** the user expands each accordion item, **Then** each decision point shows the correct winning ticket for that specific architectural decision.
3. **Given** a comparison where one decision point has ticket A winning and another has ticket B winning, **When** the user views both points, **Then** the verdict badges correctly reflect the per-point winners.

---

### User Story 2 - Structured Decision Point Data in JSON Payload (Priority: P1)

The AI comparison command generates a JSON payload that includes per-decision-point structured data (title, verdict, rationale, and per-ticket approach descriptions), and this data is persisted accurately to the database.

**Why this priority**: This is the data pipeline that enables User Story 1 — without structured data in the payload, the UI cannot display distinct content.

**Independent Test**: Can be tested by generating a comparison JSON payload and verifying the `decisionPoints` array contains distinct entries with all required fields.

**Acceptance Scenarios**:

1. **Given** the AI comparison command is executed, **When** it generates the JSON payload, **Then** the payload includes a `decisionPoints` array where each entry has a unique title, verdict ticket key, rationale, and per-ticket approach summaries.
2. **Given** a JSON payload with structured decision points is submitted to the persistence API, **When** the system processes it, **Then** each decision point is persisted with its own distinct `verdictSummary`, `rationale`, `verdictTicketId`, and `participantApproaches`.
3. **Given** the AI identifies 5 distinct architectural decisions during comparison, **When** the JSON payload is generated, **Then** all 5 appear as separate entries in the `decisionPoints` array with content matching the markdown report.

---

### User Story 3 - Backward Compatibility for Existing Comparisons (Priority: P2)

Existing comparisons that were created before this change (without structured decision point data in the report) continue to display in the comparison dialog using the current fallback behavior.

**Why this priority**: Prevents regression for all historical comparison data while enabling the new behavior for future comparisons.

**Independent Test**: Can be tested by loading an existing comparison record (without the new field) and verifying the UI renders without errors using the fallback logic.

**Acceptance Scenarios**:

1. **Given** an existing comparison was persisted before this change (no `decisionPoints` in the report JSON), **When** the user opens its comparison dialog, **Then** decision points display with the current fallback content (global recommendation and generic approach summaries).
2. **Given** a new comparison payload omits the optional `decisionPoints` field, **When** it is submitted to the persistence API, **Then** the system falls back to deriving decision points from `alignment.matchingRequirements` as it does today.

---

### User Story 4 - Compare Command Template Guides AI Output (Priority: P2)

The comparison command template instructs the AI to include structured decision points in the JSON output, ensuring the AI produces the data needed for persistence.

**Why this priority**: Without updated instructions, the AI will continue generating JSON without structured decision points, and the new persistence logic will never receive the data it needs.

**Independent Test**: Can be tested by reviewing the command template for the `decisionPoints` field specification and verifying a sample AI output includes it.

**Acceptance Scenarios**:

1. **Given** the compare command template has been updated, **When** the AI generates a comparison, **Then** the JSON output includes a `decisionPoints` array that matches the decision points described in the markdown report.
2. **Given** the template specifies the `decisionPoints` schema, **When** the AI processes a comparison of 2+ tickets, **Then** each decision point entry includes `title`, `verdictTicketKey`, `verdictSummary`, `rationale`, and an `approaches` array with per-ticket `ticketKey` and `summary` fields.

### Edge Cases

- What happens when the AI generates a decision point where no clear winner exists (tie)? The `verdictTicketKey` should be set to `null`, and the system should handle this gracefully in both persistence and UI.
- What happens when the `decisionPoints` array is present but empty? The system should fall back to the existing `matchingRequirements`-based derivation.
- What happens when a decision point references a ticket key that isn't in the `participantTicketKeys` list? The persistence layer should skip that approach entry rather than failing.
- What happens when the AI produces decision points with duplicate titles? Each should still be persisted as a separate entry since they may have different verdicts and rationale.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The comparison JSON payload MUST support an optional `decisionPoints` array in the report, where each entry contains a title, verdict ticket key, verdict summary, rationale, and per-ticket approach descriptions.
- **FR-002**: The persistence layer MUST use structured decision point data from the report payload when the `decisionPoints` array is present and non-empty.
- **FR-003**: The persistence layer MUST fall back to the existing behavior (deriving decision points from `alignment.matchingRequirements` with global winner and generic approach summaries) when the `decisionPoints` array is absent or empty.
- **FR-004**: Each persisted decision point MUST have its own distinct `verdictTicketId`, `verdictSummary`, `rationale`, and `participantApproaches` values derived from the structured data.
- **FR-005**: The comparison command template MUST instruct the AI to include a `decisionPoints` array in the JSON output with the required schema.
- **FR-006**: Each decision point in the UI MUST display its own unique content (title, rationale, verdict, per-ticket approaches) rather than repeating global report-level content.
- **FR-007**: The system MUST gracefully handle decision points with a `null` verdict (no clear winner) in both persistence and display.
- **FR-008**: The system MUST validate that ticket keys referenced in decision point approaches exist in the comparison's participant list, skipping invalid references rather than failing.

### Key Entities *(include if feature involves data)*

- **Decision Point**: An architectural or implementation decision identified during AI comparison analysis. Each has a title describing the decision area, a verdict indicating which ticket's approach is preferred (or null for ties), a rationale explaining why, and per-ticket approach descriptions summarizing how each ticket addressed the decision.
- **Decision Point Approach**: A per-ticket summary within a decision point, describing how a specific ticket handled the architectural decision. Contains the ticket identifier and a descriptive summary of the approach taken.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Each decision point in the comparison dialog displays unique content — no two decision points share identical rationale or approach descriptions in comparisons generated after this change.
- **SC-002**: 100% of newly generated comparisons include structured decision point data in the persisted JSON payload.
- **SC-003**: All existing comparisons (created before this change) continue to display without errors or visual regression.
- **SC-004**: The comparison dialog accurately reflects per-decision-point verdicts — when the AI identifies different winners for different decisions, the UI shows the correct winner for each.
- **SC-005**: Users can understand implementation trade-offs between tickets at a glance, with each decision point providing actionable, distinct information about each ticket's approach.
