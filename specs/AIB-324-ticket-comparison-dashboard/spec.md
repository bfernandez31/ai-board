# Feature Specification: Ticket Comparison Dashboard

**Feature Branch**: `AIB-324-ticket-comparison-dashboard`
**Created**: 2026-03-20
**Status**: Draft
**Input**: User description: "Ticket Comparison Dashboard - Visual comparison view with DB storage"

## Auto-Resolved Decisions

- **Decision**: Data storage approach — dedicated database entities for comparisons vs. extending existing Job model
- **Policy Applied**: CONSERVATIVE (via AUTO, netScore=6, High confidence)
- **Confidence**: High (0.9) — compliance-related keywords ("constitution compliance evaluation") push toward quality-first approach
- **Fallback Triggered?**: No — AUTO resolved to CONSERVATIVE with high confidence
- **Trade-offs**:
  1. Dedicated entities add schema complexity but provide clean separation of concerns and queryable structured data
  2. Slightly more migration effort upfront, but avoids polluting existing models with comparison-specific fields
- **Reviewer Notes**: Verify that the new entities align with existing Prisma conventions (soft deletes, foreign keys, timestamps)

---

- **Decision**: UI access pattern — conditional tab on ticket detail modal vs. standalone comparison page
- **Policy Applied**: CONSERVATIVE (via AUTO)
- **Confidence**: High (0.9) — follows established pattern (Stats tab is already conditionally shown when jobs exist)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Adding a conditional "Comparisons" tab keeps the UI consistent with existing patterns (Stats tab)
  2. No dedicated comparison page needed at this stage; the tab provides sufficient depth
- **Reviewer Notes**: The tab grid may need to accommodate 5 columns (Details, Comments, Files, Stats, Comparisons) when both Stats and Comparisons are available

---

- **Decision**: Handling missing quality scores and telemetry at comparison time
- **Policy Applied**: CONSERVATIVE (via AUTO)
- **Confidence**: High (0.9) — explicit constraint in feature description; graceful degradation is a standard UX pattern
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Showing "Pending" or "N/A" states prevents broken layouts but may reduce visual impact of comparisons run early
  2. No additional polling needed — data populates on next view once available
- **Reviewer Notes**: Ensure the enriched API response clearly distinguishes "not yet available" from "not applicable"

---

- **Decision**: Backward compatibility with existing file-based comparison reports
- **Policy Applied**: CONSERVATIVE (via AUTO)
- **Confidence**: High (0.9) — explicitly stated in constraints ("continue generating the markdown file as before")
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Dual storage (file + DB) adds redundancy but ensures zero disruption for existing workflows
  2. Markdown file serves as human-readable backup; DB enables structured querying and rich UI
- **Reviewer Notes**: The markdown report generation must remain untouched; DB save is additive

---

- **Decision**: Comparison linkage model — all compared tickets linked bidirectionally vs. only source ticket
- **Policy Applied**: CONSERVATIVE (via AUTO)
- **Confidence**: High (0.9) — feature description explicitly requires "accessible from any of them"
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Bidirectional linking (all tickets in a comparison linked to the comparison record) enables discovery from any participant
  2. Slightly more join table entries, but essential for the stated requirement
- **Reviewer Notes**: The existing API only returns comparisons where a ticket is the "source" — the new model must support lookups where a ticket is any participant

## User Scenarios & Testing

### User Story 1 - View Comparison Results from Any Participating Ticket (Priority: P1)

A project owner runs a `/compare` command on a ticket's branch referencing 2-3 other tickets. After the comparison completes, they navigate to any of the compared tickets and see a "Comparisons" section showing the comparison they participated in. They click into it and see a rich visual breakdown: ranking with scores, code metrics bars, decision points, and constitution compliance grid. The winner is clearly highlighted.

**Why this priority**: This is the core value proposition — replacing raw markdown with a rich visual experience accessible from any compared ticket.

**Independent Test**: Can be tested by creating a comparison via API, then navigating to each participating ticket and verifying the comparison view renders with all sections.

**Acceptance Scenarios**:

1. **Given** a comparison has been saved with 3 tickets, **When** a user views any of the 3 tickets, **Then** they see the comparison listed in a "Comparisons" section/tab
2. **Given** a comparison exists with ranking data, **When** a user opens the comparison view, **Then** the winner is visually highlighted with score, agent, workflow type, and key differentiators
3. **Given** a comparison includes code metrics (lines added/removed, source files, test files, test ratio), **When** a user views the metrics section, **Then** visual indicators compare all tickets and the best value per metric is highlighted
4. **Given** a comparison includes decision points, **When** a user views the decision points section, **Then** each decision shows what approach each ticket took and which was judged best, in collapsible sections
5. **Given** a comparison includes constitution compliance data, **When** a user views the compliance section, **Then** a grid shows compliance per principle per ticket

---

### User Story 2 - Store Comparison Data via API (Priority: P1)

When the `/compare` command completes its analysis, it saves the structured comparison data to the database via an API call (following the same pattern as quality score reporting). The data includes which tickets were compared, code metrics per ticket, implementation choices analysis, constitution compliance evaluation, final ranking with scores, and a recommendation. The markdown file is still generated for backward compatibility.

**Why this priority**: Without DB storage, the visual dashboard has no data source. This is the foundational data layer.

**Independent Test**: Can be tested by calling the save comparison API endpoint with structured data and verifying it persists correctly and is retrievable.

**Acceptance Scenarios**:

1. **Given** a `/compare` command has completed analysis, **When** it calls the save comparison API, **Then** the comparison record is persisted with all structured fields (tickets, metrics, decisions, compliance, ranking, recommendation)
2. **Given** a comparison is saved, **When** the enriched comparison API is called, **Then** it returns comparison data plus ticket metadata, telemetry, and quality scores from existing tables
3. **Given** a comparison is saved, **When** the markdown report is checked on the branch, **Then** it still exists as before (backward compatible)
4. **Given** invalid or incomplete comparison data is submitted, **When** the save API is called, **Then** it returns appropriate validation errors

---

### User Story 3 - Enriched Comparison View with Aggregated Data (Priority: P2)

A user opens a comparison and sees not just the comparison-specific data but also ticket metadata (title, stage, workflow type, agent), telemetry (cost, duration, tokens), and quality scores — all aggregated from existing tables. Missing data (e.g., quality score not yet available) is shown gracefully as "Pending" rather than breaking the view.

**Why this priority**: Enrichment transforms raw comparison data into a complete decision-making view. Depends on P1 storage being in place.

**Independent Test**: Can be tested by creating a comparison where one ticket has quality scores and another doesn't, then verifying the view renders both states correctly.

**Acceptance Scenarios**:

1. **Given** a comparison exists and all tickets have quality scores, **When** the enriched view loads, **Then** quality scores appear alongside comparison metrics
2. **Given** a comparison exists and one ticket lacks a quality score, **When** the enriched view loads, **Then** that ticket shows "Pending" for quality score without layout breakage
3. **Given** a comparison exists and one ticket lacks telemetry data, **When** the enriched view loads, **Then** that ticket shows "N/A" for missing telemetry fields

---

### User Story 4 - Multiple Comparisons per Ticket (Priority: P3)

A ticket may participate in multiple comparisons over time (e.g., compared against different groups of tickets). The user sees all comparisons a ticket participated in, listed by date, and can navigate to any of them.

**Why this priority**: This handles the multi-comparison scenario and is additive to the core single-comparison experience.

**Independent Test**: Can be tested by saving two comparisons that both include the same ticket, then verifying both appear in that ticket's comparisons list.

**Acceptance Scenarios**:

1. **Given** a ticket has participated in 3 different comparisons, **When** the user views that ticket's comparisons, **Then** all 3 are listed ordered by most recent first
2. **Given** a ticket has no comparisons, **When** the user views that ticket, **Then** no "Comparisons" tab/section appears

---

### Edge Cases

- What happens when a compared ticket is deleted? The comparison record remains but shows the ticket as unavailable.
- What happens when a comparison references a ticket the current user cannot access? The comparison is visible but the inaccessible ticket's details are limited to what was captured at comparison time (metrics, score) without linking to the ticket.
- What happens when the `/compare` command fails midway through saving? The markdown file and DB save are independent; partial failure of the DB save does not block markdown generation. The API handles idempotent retries.
- What happens when the same set of tickets is compared again? A new comparison record is created (comparisons are point-in-time snapshots, not updatable).

## Requirements

### Functional Requirements

- **FR-001**: System MUST store structured comparison data in the database when a `/compare` command completes, including: participating ticket references, code metrics per ticket, implementation choices analysis, constitution compliance evaluation, ranking with scores, and recommendation
- **FR-002**: System MUST link all participating tickets to the comparison record bidirectionally, so the comparison is discoverable from any participating ticket (not just the source)
- **FR-003**: System MUST provide an API endpoint that returns the full comparison view: comparison-specific data enriched with ticket metadata, telemetry, and quality scores aggregated from existing tables
- **FR-004**: System MUST display a "Comparisons" section on any ticket that has participated in at least one comparison, listing all comparisons ordered by most recent first
- **FR-005**: System MUST render a visual comparison view with four sections: ranking (with winner highlighted), metrics comparison (with visual indicators and best-value highlighting), decision points (collapsible), and constitution compliance grid
- **FR-006**: System MUST handle missing data gracefully — quality scores not yet available show as "Pending", missing telemetry shows as "N/A", without layout breakage or errors
- **FR-007**: System MUST continue generating the markdown comparison report file on the branch as before (backward compatibility)
- **FR-008**: System MUST validate comparison data on save, rejecting malformed or incomplete payloads with appropriate error responses
- **FR-009**: System MUST enforce project-level access control on comparison endpoints — only project owners and members can view comparisons
- **FR-010**: System MUST support multiple comparisons per ticket (a ticket can appear in different comparison groups over time)

### Key Entities

- **Comparison**: Represents a single comparison event. Key attributes: timestamp, source ticket (which ran the command), recommendation text, overall notes. One comparison links to many tickets.
- **ComparisonEntry**: Represents one ticket's data within a comparison. Key attributes: reference to the ticket, rank/position, score, key differentiators, code metrics (lines added, lines removed, source file count, test file count, test ratio), constitution compliance data (per-principle pass/fail with notes), and whether this entry is the winner.
- **ComparisonDecisionPoint**: Represents one implementation choice analyzed across tickets. Key attributes: decision topic, verdict, and per-ticket approach descriptions with assessment.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can view a fully rendered comparison dashboard within 2 seconds of navigating to a comparison from any participating ticket
- **SC-002**: 100% of comparisons generated by `/compare` are persisted in the database and accessible from all participating tickets
- **SC-003**: Comparisons with missing quality scores or telemetry render without errors, showing appropriate placeholder states
- **SC-004**: The existing markdown report generation continues to work unchanged for all comparisons
- **SC-005**: Users can identify the winning ticket and understand why it won within 10 seconds of viewing the comparison (ranking section provides score, agent, workflow type, and key differentiators)
- **SC-006**: All comparison API endpoints enforce project access control, returning appropriate errors for unauthorized requests
