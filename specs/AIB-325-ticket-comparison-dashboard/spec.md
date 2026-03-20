# Feature Specification: Ticket Comparison Dashboard - Visual comparison view with persistent structured records

**Feature Branch**: `AIB-325-ticket-comparison-dashboard`  
**Created**: 2026-03-20  
**Status**: Draft  
**Input**: User description: "Ticket Comparison Dashboard - Visual comparison view with DB storage"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: `AUTO` policy was requested, but the feature description produced only weak, mostly neutral context signals, so the specification used a CONSERVATIVE fallback for unresolved product decisions.
- **Policy Applied**: AUTO
- **Confidence**: Low (score: +1 from neutral user-facing feature context; no strong speed, compliance, or sensitive-domain signals)
- **Fallback Triggered?**: Yes — AUTO must default to CONSERVATIVE when confidence is below 0.5.
- **Trade-offs**:
  1. Preserves stronger defaults around data integrity, access control, and graceful incomplete-data handling.
  2. May add modest scope around validation and history visibility that a PRAGMATIC pass could defer.
- **Reviewer Notes**: Confirm the fallback is appropriate for a feature that introduces persistent comparison records and cross-ticket visibility.

- **Decision**: Comparison records will persist only comparison-specific analysis and will reference existing ticket, telemetry, and quality information rather than duplicating source-of-truth data that already exists elsewhere.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (chosen to reduce data drift while still making comparisons queryable)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Keeps stored comparison data focused on information that cannot be rebuilt cheaply from current product surfaces.
  2. Requires the comparison view to combine stored comparison analysis with existing ticket metadata and operational metrics at read time.
- **Reviewer Notes**: Validate that the stored record boundaries are sufficient for auditing past comparison results without creating duplicate ownership of ticket/job data.

- **Decision**: Every ticket included in a comparison will be linked to that comparison so users can discover the same result from any participating ticket, and tickets may appear in multiple comparison groups over time.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (explicit in the request and necessary to eliminate branch-only discoverability)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Improves discoverability and avoids a single-source-ticket dead end.
  2. Requires comparison history surfaces to distinguish between multiple comparison contexts for the same ticket.
- **Reviewer Notes**: Confirm whether product copy should treat one ticket as the "source" for provenance while still exposing the record equally from all participants.

- **Decision**: Missing quality scores or telemetry will never block the comparison view; the view will show a clear pending or unavailable state and still render all other analysis.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (explicitly required and aligned with resilient dashboard behavior)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users can review partial comparison outcomes earlier in the workflow.
  2. Some comparisons will show mixed completeness, so the UI must make unavailable data obvious to avoid false precision.
- **Reviewer Notes**: Validate the user-facing labels for "pending" versus "not available" so readers understand whether more data may appear later.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review a comparison outcome from any participating ticket (Priority: P1)

A project member opens a ticket that participated in a comparison and can immediately see the comparison results, including ranking, rationale, implementation differences, and compliance findings, without opening raw markdown or switching branches.

**Why this priority**: The primary gap is accessibility. If users still need raw files or branch context, the feature has not solved the current problem.

**Independent Test**: Can be fully tested by opening a compared ticket with at least one saved comparison and confirming the complete comparison view is available from that ticket alone.

**Acceptance Scenarios**:

1. **Given** a ticket that participated in one comparison, **When** a project member opens that ticket, **Then** they can access a comparison section that shows the saved comparison result without requiring branch navigation or documentation browsing.
2. **Given** a comparison that includes several tickets, **When** the user views the comparison from any included ticket, **Then** they see the same ranking, recommendation, and analysis content for that comparison.
3. **Given** a user who does not have access to the project, **When** they attempt to access comparison data, **Then** the system denies access using the same project-level authorization rules as other ticket data.

---

### User Story 2 - Understand why one implementation ranked above another (Priority: P2)

A project member compares competing ticket implementations in a visual dashboard that explains the winner, shows comparative metrics, and breaks down decision points and constitution compliance in a format that is faster to interpret than markdown.

**Why this priority**: The ranking is only useful if the user can understand the reasons behind it and inspect the most important differentiators.

**Independent Test**: Can be fully tested by opening a saved comparison and verifying the ranking, metric comparison, decision-point analysis, and compliance breakdown are all visible and interpretable without reading the raw report file.

**Acceptance Scenarios**:

1. **Given** a saved comparison with a ranked outcome, **When** the user opens the visual comparison view, **Then** each participating ticket shows its rank, score, workflow type, agent, and concise explanation of why it placed where it did.
2. **Given** metrics are available for some or all tickets, **When** the user reviews the metrics section, **Then** they can compare values side by side and identify the strongest value for each metric.
3. **Given** the comparison includes implementation choice analysis, **When** the user expands a decision point, **Then** they can see each ticket's approach, the stated verdict, and the comparative rationale.
4. **Given** the comparison includes constitution evaluation, **When** the user reviews compliance, **Then** they can inspect each principle-by-ticket assessment in a consistent grid layout.

---

### User Story 3 - Preserve backward-compatible comparison generation and history (Priority: P3)

A user runs `/compare` and gets the same markdown artifact as today while also creating a structured comparison record that can be listed and revisited later from any participating ticket.

**Why this priority**: The new experience must not break existing workflows that depend on the markdown report, while adding durable comparison history for future access.

**Independent Test**: Can be fully tested by running `/compare`, confirming a markdown artifact is still created, and confirming a new comparison entry appears in the comparison history of all participating tickets.

**Acceptance Scenarios**:

1. **Given** a user runs `/compare` successfully, **When** the comparison completes, **Then** the existing markdown report is still generated and a structured comparison record is also created.
2. **Given** a ticket has participated in multiple comparisons over time, **When** the user opens that ticket's comparison section, **Then** they can see a list of distinct comparisons and choose which one to review.
3. **Given** comparison-specific data has been saved, **When** the frontend requests a comparison detail view, **Then** it receives the stored comparison analysis together with relevant ticket metadata and any available existing operational metrics in one response.

### Edge Cases

- A comparison includes tickets that have quality scores for only some participants; the dashboard still renders and marks the missing values as pending or unavailable.
- A comparison includes tickets with incomplete telemetry; metric sections remain readable and do not mislabel missing values as zero.
- A ticket participates in several comparisons with overlapping but not identical ticket groups; users can distinguish each comparison by date, participants, and outcome summary.
- A participating ticket is later closed, moved, or shipped; historical comparison records remain accessible to authorized users.
- A comparison record exists but one related ticket is no longer fully enriched with optional metrics; the dashboard still shows the preserved comparison outcome and clearly labels missing live enrichments.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST persist a structured comparison record each time `/compare` completes successfully.
- **FR-002**: The structured comparison record MUST capture the participating tickets, comparison-specific code metrics for each ticket, implementation choice analysis, constitution compliance evaluation, final ranking, winner, key differentiators, and overall recommendation.
- **FR-003**: The system MUST avoid duplicating ticket, telemetry, and quality information that already exists as the source of truth elsewhere; instead it MUST link the comparison record to existing tickets and enrich the comparison view from existing data when available.
- **FR-004**: The system MUST associate each saved comparison with every participating ticket so the same comparison can be discovered from any included ticket.
- **FR-005**: A ticket MUST be able to participate in multiple saved comparisons, and users MUST be able to distinguish those comparisons in a history list.
- **FR-006**: The system MUST provide a comparison detail response that returns the saved comparison analysis together with related ticket metadata and any available existing telemetry and quality information in a single request suitable for rendering the dashboard.
- **FR-007**: The comparison detail response MUST apply the same project access rules as other ticket data so only the project owner or members can read comparison data.
- **FR-008**: The ticket experience MUST expose a comparison entry point whenever the ticket has participated in one or more comparisons.
- **FR-009**: The comparison experience MUST present a ranking section that shows all participating tickets in order, highlights the winner, and explains why each ticket won or lost.
- **FR-010**: The comparison experience MUST present a metrics section that visually compares available code metrics and operational metrics across all participating tickets and highlights the strongest value for each metric where a best value is meaningful.
- **FR-011**: The comparison experience MUST present implementation decision points in collapsible sections so users can inspect each ticket's approach and the stated verdict.
- **FR-012**: The comparison experience MUST present constitution compliance in a per-principle, per-ticket comparison format.
- **FR-013**: The comparison experience MUST continue to render when quality scores, telemetry, or other optional enrichments are unavailable, and it MUST label those values as pending or unavailable instead of failing or showing misleading defaults.
- **FR-014**: Running `/compare` MUST continue to generate the markdown comparison report in addition to the new structured comparison record.
- **FR-015**: The markdown report and the structured comparison record MUST describe the same comparison outcome for a single `/compare` run so users do not encounter conflicting winners or recommendations.
- **FR-016**: The system MUST preserve comparison history for past runs so later comparison requests do not overwrite or hide prior comparison outcomes for the same ticket set.

### Key Entities *(include if feature involves data)*

- **Comparison Record**: A saved result of one `/compare` run containing the comparison-specific analysis, ranking outcome, recommendation, and provenance details needed to identify when and from which ticket context it was generated.
- **Comparison Participant**: A relationship between a comparison record and a ticket that marks the ticket as a participant and supports discovery of the same comparison from every included ticket.
- **Ticket Metric Snapshot**: The comparison-specific per-ticket measurements captured at comparison time, including code-change metrics and any other values that are not already available as durable source-of-truth data elsewhere.
- **Decision Point Evaluation**: A comparison artifact describing one implementation choice, each participant's approach, the selected verdict, and the rationale that differentiates the approaches.
- **Compliance Assessment**: A per-ticket, per-principle evaluation that records how each implementation aligned with constitution principles during that comparison run.

### Assumptions

- The comparison dashboard is a new, richer experience that coexists with the current markdown report rather than replacing documentation access.
- Existing ticket metadata, telemetry, and quality-score records remain authoritative and can be joined into the comparison detail response when present.
- Comparison history is read-only after creation for normal users; if data changes later in other systems, the comparison record still reflects the original analysis outcome while live enrichments may vary.
- "Best value" highlighting in metric comparisons uses the comparison's intended interpretation for each metric and suppresses highlights where no meaningful best value exists.

### Dependencies

- `/compare` continues to produce a successful analysis output that can be saved both as markdown and as a structured comparison record.
- Ticket metadata, job telemetry, and quality scores remain available through existing product data sources for enrichment when present.
- Ticket detail surfaces can accommodate one or more comparison entry points without removing existing ticket functionality.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing or product review, authorized users can open a saved comparison from any participating ticket and identify the winner and recommendation in under 30 seconds without opening raw markdown.
- **SC-002**: For successful `/compare` runs, 100% of participating tickets show the new comparison in their comparison history within the same saved result.
- **SC-003**: In acceptance testing, 100% of saved comparisons continue to render their dashboard even when one or more optional enrichments are unavailable.
- **SC-004**: In acceptance testing, users can distinguish between multiple comparison runs for the same ticket by date and participant set without ambiguity.
- **SC-005**: During regression validation, existing markdown comparison reports remain available for 100% of successful `/compare` runs after the new structured comparison feature is added.
