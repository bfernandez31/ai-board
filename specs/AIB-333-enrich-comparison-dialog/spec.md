# Feature Specification: Enrich Comparison Dialog with Operational Metrics and Quality Data

**Feature Branch**: `AIB-333-enrich-comparison-dialog`
**Created**: 2026-03-21
**Status**: Draft
**Input**: User description: "Enrich comparison dialog with operational metrics and quality data"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Whether to include cache token metrics (cacheReadTokens, cacheCreationTokens) in the operational metrics grid
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score: 0.3 — no strong signal keywords detected; absScore=1)
- **Fallback Triggered?**: Yes — AUTO detected low confidence (0.3 < 0.5), promoted to CONSERVATIVE
- **Trade-offs**:
  1. Excluding cache tokens keeps the grid focused on the 7 metrics explicitly requested, avoiding information overload
  2. Cache tokens can be added later if users request more granular cost analysis
- **Reviewer Notes**: If cache token visibility becomes a user request, a follow-up ticket can add these as optional expandable rows

---

- **Decision**: How to determine "primary AI model" when a ticket has multiple jobs potentially using different models
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score: 0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Showing the most frequently used model across jobs provides a clear single identifier per ticket
  2. If a ticket used multiple models, the secondary models are not surfaced — but this is an edge case
- **Reviewer Notes**: Validate that most tickets use a single model across all jobs; if multi-model usage is common, consider showing a comma-separated list

---

- **Decision**: Whether to reuse existing quality score display patterns (QualityScoreBadge, QualityScoreSection) or create new components for the popover
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score: 0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Reusing existing quality score visual patterns ensures consistency across the application
  2. The popover context may require adapted layouts but should maintain the same information hierarchy
- **Reviewer Notes**: Verify that existing quality score components can be composed within a popover without layout issues

---

- **Decision**: Whether the quality score popover should show all 5 dimensions including Spec Sync (0% weight) or only the 4 scoring dimensions
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score: 0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Showing all 5 dimensions (including Spec Sync at 0%) provides complete transparency and matches the existing quality score section behavior
  2. Users may question why a 0%-weight dimension is shown, but the weight column makes this self-explanatory
- **Reviewer Notes**: Confirm that Spec Sync at 0% weight is still evaluated and stored; if it is never populated, omit it from the popover

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Execution Context on Ranking Cards (Priority: P1)

A user opens the comparison dialog to evaluate competing implementations. Each ranking card now shows compact badges indicating the workflow type (FULL, QUICK, CLEAN), the agent used (e.g., Claude), and the quality score with its threshold label (e.g., "87 Good"). This gives an immediate at-a-glance sense of how each implementation was produced and its quality outcome, without needing to scroll to additional sections.

**Why this priority**: The ranking section is the first thing users see in the comparison dialog. Enriching it with contextual badges provides immediate value with minimal UI disruption and sets the foundation for the deeper operational metrics section.

**Independent Test**: Can be fully tested by opening a comparison dialog with 2+ tickets that have different workflow types and quality scores, verifying badges render correctly and display accurate data.

**Acceptance Scenarios**:

1. **Given** a comparison with participants of different workflow types, **When** the user views the ranking section, **Then** each card displays a badge showing the participant's workflow type (FULL, QUICK, or CLEAN)
2. **Given** a comparison participant with a known agent value, **When** the user views its ranking card, **Then** an agent badge is visible showing the agent name
3. **Given** a comparison participant with no agent value, **When** the user views its ranking card, **Then** no agent badge is displayed (graceful absence, not "N/A")
4. **Given** a comparison participant with a quality score, **When** the user views its ranking card, **Then** a quality badge shows the numeric score and threshold label (e.g., "87 Good")
5. **Given** a comparison participant without a quality score (e.g., QUICK workflow), **When** the user views its ranking card, **Then** no quality badge is displayed

---

### User Story 2 - Compare Operational Metrics Across Tickets (Priority: P1)

A user wants to understand the cost-efficiency and resource consumption differences between implementations. They scroll to the new "Operational Metrics" section which displays a comparison table with tickets as columns and metrics as rows: total tokens, input tokens, output tokens, duration, cost, job count, and quality score. The best value in each row is highlighted with a visual indicator. Column headers show each ticket's key, workflow type, and agent.

**Why this priority**: This is the core new capability of the feature — surfacing operational data that already exists in the database but is not currently visible in the comparison UI.

**Independent Test**: Can be fully tested by creating a comparison between tickets that have completed jobs with telemetry data, verifying the grid renders all 7 metric rows with correct aggregated values and best-value highlighting.

**Acceptance Scenarios**:

1. **Given** a comparison between 2+ tickets with completed jobs, **When** the user views the Operational Metrics section, **Then** a table displays with one column per ticket and rows for: Total tokens, Input tokens, Output tokens, Duration, Cost, Job count, Quality
2. **Given** metric values across participants, **When** the user views any metric row, **Then** the best value (lowest for cost/tokens/duration/job count, highest for quality) is visually highlighted with a "Best" indicator
3. **Given** a ticket with multiple completed jobs, **When** the user views its column, **Then** token, cost, and duration values are aggregated (summed) across all jobs for that ticket
4. **Given** a ticket whose jobs are still in progress, **When** the user views its column, **Then** metrics show a "Pending" state indicator instead of numeric values
5. **Given** a ticket with no jobs (or no telemetry data), **When** the user views its column, **Then** metrics show "N/A" instead of numeric values
6. **Given** the table columns, **When** the user views column headers, **Then** each header shows the ticket key, workflow type badge, and agent (when available)
7. **Given** a ticket with completed jobs, **When** the user views the model information, **Then** the primary AI model used is identifiable in the column header or as a sub-label

---

### User Story 3 - View Quality Score Breakdown (Priority: P2)

A user sees a quality score in the operational metrics grid and wants to understand how it was calculated. They click the quality score value, and a popover appears showing the 5 evaluated dimensions (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync), each with its individual score, a visual progress bar, and its weight in the overall calculation. The overall score with its threshold label is also shown.

**Why this priority**: Quality score breakdown provides deeper insight but is secondary to the base metrics display. It only applies to FULL workflow tickets that have passed VERIFY, making it a narrower use case.

**Independent Test**: Can be fully tested by clicking a quality score for a FULL workflow ticket that has passed VERIFY, verifying the popover displays all 5 dimensions with correct scores, weights, and progress bars.

**Acceptance Scenarios**:

1. **Given** a FULL workflow ticket that has passed VERIFY and has a quality score, **When** the user clicks the quality score in the grid, **Then** a popover appears with the 5 dimension breakdown
2. **Given** the quality score popover is open, **When** the user views a dimension row, **Then** it shows the dimension name, numeric score, a visual progress bar representing the score, and the dimension's weight percentage
3. **Given** the quality score popover is open, **When** the user views the overall section, **Then** it shows the overall quality score with its threshold label (Excellent/Good/Fair/Poor)
4. **Given** a non-FULL workflow ticket or one that hasn't passed VERIFY, **When** the user views its quality score cell, **Then** the score is not clickable and no popover trigger is present
5. **Given** the quality score popover is open, **When** the user clicks outside the popover or presses Escape, **Then** the popover closes

---

### User Story 4 - Compare Up to 6 Tickets with Readable Layout (Priority: P2)

A user compares 6 ticket implementations simultaneously. The operational metrics table uses horizontal scrolling to accommodate all columns while keeping the metric labels column fixed on the left. The layout remains functional and readable without content truncation, including on mobile devices using native horizontal scroll.

**Why this priority**: Supporting 6 tickets is important for scalability but is secondary to core functionality. Most comparisons involve 2-3 tickets.

**Independent Test**: Can be fully tested by creating a comparison with 6 tickets and verifying horizontal scroll behavior, fixed label column, and no content truncation at various viewport widths.

**Acceptance Scenarios**:

1. **Given** a comparison with 6 participants, **When** the user views the Operational Metrics grid, **Then** all 6 ticket columns are accessible via horizontal scrolling
2. **Given** a comparison with more columns than viewport width allows, **When** the user scrolls horizontally, **Then** the metric labels column (first column) remains fixed/sticky on the left
3. **Given** any number of participants (2-6), **When** the user views the grid, **Then** no content is truncated or visually crushed — all values are fully readable
4. **Given** a mobile viewport, **When** the user views the Operational Metrics grid, **Then** native horizontal scrolling works to access all columns

---

### User Story 5 - Correct Section Ordering (Priority: P3)

A user opens the comparison dialog and sees sections in a logical progression: Ranking (with enriched badges) first, then Implementation Metrics (code changes), then the new Operational Metrics, then Decision Points, and finally Compliance Grid. This ordering presents context and outcomes before analysis details.

**Why this priority**: Section ordering is a layout concern that improves information flow but does not add new functionality.

**Independent Test**: Can be tested by opening any comparison dialog and verifying the 5 sections appear in the specified order.

**Acceptance Scenarios**:

1. **Given** a comparison dialog is opened, **When** the user scrolls through the content, **Then** sections appear in order: Ranking, Implementation Metrics, Operational Metrics, Decision Points, Compliance Grid

---

### Edge Cases

- What happens when all participants have identical metric values for a row? The "Best" indicator should apply to all tied participants or be omitted entirely for that row.
- How does the grid handle a comparison where no participant has any telemetry data? The Operational Metrics section should still render with "N/A" in all cells rather than being hidden.
- What happens when a quality score is exactly on a threshold boundary (e.g., 70)? The threshold label should use the same logic as the existing quality score system (70 = "Good").
- What happens when a participant's jobs have mixed states (some completed, some in progress)? Show aggregated data from completed jobs with a "Partial" indicator.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display workflow type (FULL, QUICK, CLEAN) as a compact badge on each participant's ranking card
- **FR-002**: System MUST display the agent name as a badge on ranking cards when an agent value is available for the participant
- **FR-003**: System MUST display the quality score with its threshold label (Excellent/Good/Fair/Poor) as a badge on ranking cards when a quality score exists
- **FR-004**: System MUST render an "Operational Metrics" section in the comparison dialog containing a table with tickets as columns and the following metric rows: Total tokens, Input tokens, Output tokens, Duration, Cost, Job count, Quality score
- **FR-005**: System MUST aggregate metric values across all jobs for each ticket (sum for tokens/cost/duration, count for jobs, latest for quality)
- **FR-006**: System MUST visually highlight the best value in each metric row (lowest for tokens/cost/duration/job count, highest for quality)
- **FR-007**: System MUST show a "Pending" state for metrics when a ticket's jobs are still in progress
- **FR-008**: System MUST show "N/A" for metrics when a ticket has no jobs or no telemetry data
- **FR-009**: System MUST display the primary AI model used per ticket in the column header area
- **FR-010**: System MUST show a quality score breakdown popover when clicking a quality score in the grid, containing all 5 evaluated dimensions with individual scores, progress bars, and weights
- **FR-011**: The quality score popover MUST only be available for FULL workflow tickets that have passed the VERIFY stage
- **FR-012**: The Operational Metrics grid MUST support horizontal scrolling with a fixed/sticky metric labels column when displaying more columns than the viewport width allows
- **FR-013**: The grid MUST support 2 to 6 participant tickets without content truncation
- **FR-014**: The comparison dialog sections MUST appear in this order: Ranking, Implementation Metrics, Operational Metrics, Decision Points, Compliance Grid
- **FR-015**: Column headers in the Operational Metrics grid MUST show the ticket key, workflow type, and agent

### Key Entities *(include if feature involves data)*

- **ComparisonParticipantDetail**: Extended with operational context — already includes `workflowType`, `agent`, `quality`, and `telemetry` fields that carry enrichment state (available/pending/unavailable)
- **ComparisonTelemetryEnrichment**: Existing structure carrying inputTokens, outputTokens, durationMs, costUsd — each with a state indicator. Will need extension for total tokens (computed) and job count
- **QualityScoreDetails**: Existing JSON structure stored in Job.qualityScoreDetails containing dimension sub-scores, weights, and threshold label — consumed by the popover display

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify the workflow type, agent, and quality score of each participant within 2 seconds of opening the comparison dialog (badges visible without scrolling)
- **SC-002**: Users can compare operational costs and token usage across all participants in a single view without navigating away from the comparison dialog
- **SC-003**: Users can determine which implementation was most efficient (lowest cost, fewest tokens, shortest duration) at a glance via best-value highlighting
- **SC-004**: Users can view quality score dimension breakdown within 1 click from the comparison dialog
- **SC-005**: The comparison dialog remains fully functional and readable with 6 participants across desktop and mobile viewports
- **SC-006**: All operational metric values accurately reflect aggregated data from all jobs associated with each ticket

## Assumptions

- Job telemetry fields (inputTokens, outputTokens, costUsd, durationMs, model) are reliably populated for completed jobs
- The `qualityScoreDetails` JSON field follows the established `QualityScoreDetails` structure with dimensions, weights, and threshold
- Most tickets use a single AI model across all their jobs; multi-model edge cases show the most frequently used model
- The existing `ComparisonParticipantDetail` type already carries `workflowType`, `agent`, `quality`, and `telemetry` — no new API endpoints are needed, only UI changes and possible data enrichment extensions
- "Total tokens" is a computed value (inputTokens + outputTokens) displayed for convenience, not a separately stored field
