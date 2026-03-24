# Feature Specification: Enrich Comparison Dialog with Operational Metrics and Quality Data

**Feature Branch**: `AIB-340-enrich-comparison-dialog`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "Enrich the ticket comparison dialog to display operational metrics (tokens consumed, duration, cost, AI model) and quality gate scores alongside the existing code metrics."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: AUTO policy resolved to CONSERVATIVE — feature is user-facing UI with no internal/speed signals
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 3 — three neutral feature context signals, zero conflicting buckets)
- **Fallback Triggered?**: No — netScore ≥ 0 with medium confidence meets threshold
- **Trade-offs**:
  1. More defensive formatting and edge-case handling increases scope slightly
  2. Ensures data integrity and graceful degradation for all metric states
- **Reviewer Notes**: Verify that CONSERVATIVE stance on formatting/fallbacks aligns with team velocity expectations

---

- **Decision**: Aggregation strategy — operational metrics are summed across ALL completed jobs for a ticket (not just the latest job)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — the ticket description explicitly states "aggregated across all jobs for the ticket"
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Summing all completed jobs provides a complete cost/token picture but may penalize tickets with retried jobs
  2. Users see total investment per ticket, which is the most honest comparison
- **Reviewer Notes**: Confirm that excluding failed/cancelled jobs from aggregation is acceptable. Recommendation: include only COMPLETED jobs to avoid skewing metrics.

---

- **Decision**: Quality score breakdown dimensions and weights are sourced from the existing `qualityScoreDetails` JSON stored on jobs
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — the data model already stores dimension sub-scores, weights, and threshold labels
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Relies on existing data structure; no new data collection needed
  2. Breakdown is only available for FULL workflow tickets that completed VERIFY stage
- **Reviewer Notes**: Ensure `qualityScoreDetails` JSON structure is stable and consistently populated

---

- **Decision**: Section ordering places Operational Metrics between Implementation Metrics and Decision Points
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — explicitly specified in the feature description (FR-5)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Logical flow: code metrics → operational metrics → qualitative analysis
  2. Existing users will see a new section between familiar sections
- **Reviewer Notes**: None — ordering is explicitly defined

---

- **Decision**: Primary AI model determination — use the model from the job with the highest token consumption
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium — the description says "primary AI model used must be identifiable" without specifying derivation method
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Highest-token job likely represents the main implementation work
  2. If multiple models were used across jobs, only one is shown
- **Reviewer Notes**: Validate that selecting by highest token count correctly identifies the primary model in practice

---

- **Decision**: Tied best values — when multiple tickets share the same best value for a metric, all receive the "Best value" indicator
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium — description does not specify tie-breaking behavior
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Inclusive approach avoids arbitrary winner selection
  2. Multiple badges per row may reduce visual impact
- **Reviewer Notes**: Confirm tied-value behavior matches user expectations

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compare Operational Efficiency of Competing Implementations (Priority: P1)

A project owner has two or more tickets implementing the same feature with different approaches. They open the comparison dialog and scroll to the Operational Metrics section to see which implementation consumed fewer tokens, took less time, and cost less. The best value in each row is highlighted, letting them quickly identify the most efficient implementation.

**Why this priority**: This is the core value of the feature — surfacing cost/efficiency data that currently exists but is hidden from users.

**Independent Test**: Can be fully tested by creating a comparison between two tickets that have completed jobs with telemetry data, then verifying the Operational Metrics section renders with correct aggregated values and best-value highlighting.

**Acceptance Scenarios**:

1. **Given** a comparison with 2+ tickets that have completed jobs with telemetry data, **When** the user views the comparison dialog, **Then** the Operational Metrics section displays a grid with rows for total tokens, input tokens, output tokens, duration, cost, job count, and quality score.
2. **Given** a comparison with 3 tickets, **When** one ticket has the lowest cost, **Then** the cost row shows a "Best value" badge on that ticket's cell.
3. **Given** a comparison where one ticket has no completed jobs, **When** the user views operational metrics, **Then** that ticket's column shows "N/A" for all metric rows.
4. **Given** a comparison where one ticket has a job in progress, **When** the user views operational metrics, **Then** that ticket's column shows a "Pending" indicator for metrics not yet available.

---

### User Story 2 - View Execution Context on Ranking Cards (Priority: P1)

A user opens the comparison dialog and sees the ranking section. Each participant card now displays compact badges showing the workflow type (FULL, QUICK, CLEAN), the AI agent used, and the quality score with its label. This context helps the user understand each implementation's profile without scrolling to other sections.

**Why this priority**: Enriching ranking cards provides immediate context at the most prominent section of the dialog, requiring minimal UI changes with high information value.

**Independent Test**: Can be tested by viewing a comparison where participants have different workflow types and agents, verifying badges appear correctly.

**Acceptance Scenarios**:

1. **Given** a comparison with a FULL workflow ticket and a QUICK workflow ticket, **When** the user views the ranking section, **Then** each card shows a workflow type badge.
2. **Given** a participant whose ticket was built by the Claude agent, **When** the user views that ranking card, **Then** an agent badge shows "Claude".
3. **Given** a participant with no agent information, **When** the user views that ranking card, **Then** no agent badge is displayed.
4. **Given** a FULL workflow ticket with a quality score of 87, **When** the user views its ranking card, **Then** a quality badge shows "87 Good" (or appropriate threshold label).
5. **Given** a QUICK workflow ticket with no quality score, **When** the user views its ranking card, **Then** no quality badge is displayed.

---

### User Story 3 - Drill into Quality Score Breakdown (Priority: P2)

A user sees a quality score in the Operational Metrics grid and wants to understand what drove the score. They click the quality score value, and a popover appears showing the 5 evaluated dimensions with individual scores, visual progress bars, weights, and the overall score with threshold label.

**Why this priority**: Provides deeper insight but is secondary to displaying the metrics themselves. Only applies to FULL workflow tickets that passed VERIFY.

**Independent Test**: Can be tested by clicking a quality score cell for a FULL workflow ticket that has quality score details populated, then verifying the popover content matches stored data.

**Acceptance Scenarios**:

1. **Given** a FULL workflow ticket with a completed verify job and quality score details, **When** the user clicks the quality score in the operational metrics grid, **Then** a popover appears showing 5 dimension scores with progress bars.
2. **Given** the popover is open, **When** the user reads the content, **Then** each dimension shows its name, score, weight, and a visual progress bar proportional to the score.
3. **Given** a QUICK workflow ticket, **When** the user views its quality cell, **Then** the quality score shows "N/A" and is not clickable.
4. **Given** the popover is open, **When** the user clicks outside the popover, **Then** the popover closes.

---

### User Story 4 - Compare Up to 6 Tickets with Horizontal Scrolling (Priority: P2)

A user compares 5 or 6 tickets. The Operational Metrics grid remains readable: the metric labels column stays fixed on the left while ticket columns scroll horizontally. On mobile, native horizontal scroll works smoothly.

**Why this priority**: Ensures the feature scales to the maximum supported comparison size without usability degradation.

**Independent Test**: Can be tested by creating a comparison with 6 tickets and verifying horizontal scroll behavior with the fixed label column.

**Acceptance Scenarios**:

1. **Given** a comparison with 6 tickets, **When** the user views the Operational Metrics section, **Then** the metric label column stays fixed and ticket columns are horizontally scrollable.
2. **Given** a comparison with 6 tickets on a mobile device, **When** the user swipes horizontally on the metrics grid, **Then** the columns scroll smoothly with native scroll behavior.
3. **Given** a comparison with 2 tickets, **When** the user views the Operational Metrics section, **Then** no horizontal scroll is needed and all columns are visible.

---

### Edge Cases

- What happens when all tickets in a comparison have no telemetry data? The Operational Metrics section displays with all cells showing "N/A" — the section is still visible but clearly indicates no data is available.
- What happens when a ticket has multiple jobs with different AI models? The primary model is determined by the job with the highest total token consumption.
- What happens when a quality score exists but the breakdown details are null? The quality score displays as a number but is not clickable (no breakdown popover available).
- What happens when all tickets have the same value for a metric? All tied tickets receive the "Best value" badge.
- What happens when cost data is zero? Display "$0.00" — zero is a valid value, not treated as missing.
- What happens when a ticket has only failed/cancelled jobs? Show "N/A" since no completed job data is available for aggregation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display workflow type (FULL, QUICK, CLEAN) as a badge on each participant's ranking card.
- **FR-002**: System MUST display the AI agent name as a badge on each ranking card when agent information is available. When not available, no badge is shown.
- **FR-003**: System MUST display the quality score with its threshold label (e.g., "87 Good") as a badge on each ranking card when a score exists. When no score exists, no badge is shown.
- **FR-004**: System MUST display an Operational Metrics section as a comparison grid with metric labels as rows and tickets as columns.
- **FR-005**: The Operational Metrics grid MUST include rows for: total tokens, input tokens, output tokens, duration, cost, job count, and quality score.
- **FR-006**: System MUST aggregate operational metrics across all completed jobs for each ticket (sum for tokens, duration, cost; count for job count).
- **FR-007**: System MUST identify and highlight the best value per metric row with a visual "Best value" indicator. Best = lowest for tokens, duration, cost, job count; best = highest for quality score.
- **FR-008**: Each column header in the Operational Metrics grid MUST show the ticket key, workflow type, and agent.
- **FR-009**: System MUST show a "Pending" state for metrics when a ticket has jobs in progress but no completed telemetry data.
- **FR-010**: System MUST show "N/A" for metrics when a ticket has no jobs or when data will never be available.
- **FR-011**: System MUST display the primary AI model used for each ticket, determined by the job with the highest total token consumption.
- **FR-012**: Clicking a quality score in the Operational Metrics grid MUST open a popover showing the 5 quality dimensions (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync) with individual scores, visual progress bars, weights, and the overall score with threshold label.
- **FR-013**: Quality score breakdown popover MUST only be available for FULL workflow tickets that have passed the VERIFY stage and have populated quality score details.
- **FR-014**: The Operational Metrics grid MUST support 2 to 6 compared tickets with horizontal scrolling when columns exceed viewport width.
- **FR-015**: The metric labels column MUST remain fixed (sticky) during horizontal scrolling.
- **FR-016**: The comparison dialog MUST display sections in this order: Ranking, Implementation Metrics, Operational Metrics, Decision Points, Compliance Grid.

### Key Entities *(include if feature involves data)*

- **Operational Metrics (derived, not persisted)**: Aggregated view of job telemetry for a ticket — total tokens (input + output), duration, cost, job count, and primary model. Derived from existing Job records at query time.
- **Quality Score Breakdown (existing)**: Stored as JSON on Job records — contains 5 dimension scores, their weights, and the overall threshold label. Read-only for this feature.
- **ComparisonEnrichmentValue (existing)**: Tri-state wrapper (available/pending/unavailable) used for telemetry and quality data that may not yet be available.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view operational efficiency data (tokens, cost, duration) for all compared tickets within the comparison dialog without navigating to any other page.
- **SC-002**: The best-performing ticket per metric is identifiable within 2 seconds of viewing the Operational Metrics section.
- **SC-003**: Users can access quality score dimension breakdowns for eligible tickets via a single click.
- **SC-004**: The comparison dialog remains usable and readable with up to 6 compared tickets, with no content truncation or overlapping elements.
- **SC-005**: All operational metric values match the aggregated job data for each ticket with 100% accuracy.
- **SC-006**: Pending and unavailable states are clearly distinguishable from actual zero values or scores.

## Assumptions

- The existing telemetry enrichment types already support the data structure needed for operational metrics display.
- The quality score details JSON field on Job records consistently contains the 5 dimension scores, weights, and threshold label for all completed verify jobs.
- The comparison API already enriches participant data with telemetry and quality information — the primary changes are in the UI layer with supporting API extensions for aggregation.
- Aggregation across multiple jobs (summing tokens, cost, duration) will be performed at the API/service layer and returned to the client as pre-computed values.
- "Completed jobs" for aggregation purposes means jobs with COMPLETED status — failed or cancelled jobs are excluded.
