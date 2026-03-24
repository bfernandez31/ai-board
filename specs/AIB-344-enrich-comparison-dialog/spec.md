# Feature Specification: Enrich Comparison Dialog with Operational Metrics and Quality Data

**Feature Branch**: `AIB-344-enrich-comparison-dialog`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "Enrich the ticket comparison dialog to display operational metrics (tokens consumed, duration, cost, AI model) and quality gate scores alongside the existing code metrics."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: AUTO policy fell back to CONSERVATIVE due to low confidence (score 0.3)
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (absScore = 1, netScore = +1; only neutral feature context signal detected)
- **Fallback Triggered?**: Yes — absScore < 3 yields confidence 0.3 which is below the 0.5 threshold, triggering automatic CONSERVATIVE fallback
- **Trade-offs**:
  1. Slightly more thorough edge-case handling and validation requirements than a PRAGMATIC approach
  2. No meaningful timeline impact — the feature scope is well-defined in the ticket description
- **Reviewer Notes**: Feature is a read-only UI enrichment with no data mutation. CONSERVATIVE fallback adds rigor but the overall scope remains modest.

---

- **Decision**: Quality score breakdown popover restricted to FULL workflow tickets that passed VERIFY
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — explicitly stated in the feature description (FR-3)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users comparing QUICK or CLEAN workflow tickets will not see quality breakdowns, which may cause confusion
  2. Keeps the UI honest — only showing data that actually exists
- **Reviewer Notes**: Confirm that the existing `ComparisonEnrichmentValue` state machine (`available | pending | unavailable`) adequately covers this restriction.

---

- **Decision**: Operational metrics are aggregated across all jobs for a ticket, not just the latest job
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — explicitly stated in FR-2
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Aggregation gives the true total cost/effort picture but may obscure per-job efficiency
  2. No per-job drill-down is included in this feature scope
- **Reviewer Notes**: Validate that summing `inputTokens`, `outputTokens`, `costUsd`, and `durationMs` across all COMPLETED jobs for a ticket produces meaningful totals.

---

- **Decision**: Number formatting conventions for operational metrics
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) — not explicitly specified; using industry-standard formatting
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Tokens displayed with thousands separators (e.g., "12,450"); cost as USD with 2 decimal places (e.g., "$0.85"); duration in human-readable format (e.g., "2m 34s")
  2. Consistent formatting aids quick comparison but locale-specific formatting is deferred
- **Reviewer Notes**: Confirm these formatting choices match existing patterns in the codebase (e.g., how cost and duration are displayed elsewhere).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compare Operational Efficiency of Two Implementations (Priority: P1)

A project owner opens the comparison dialog for a ticket that has been compared against another implementation. They want to quickly see which implementation was more efficient in terms of token usage, execution time, and cost.

**Why this priority**: The operational metrics grid is the core new capability of this feature. Without it, the comparison dialog cannot answer "which implementation was cheaper/faster?"

**Independent Test**: Can be fully tested by opening a comparison dialog with two tickets that have completed jobs with telemetry data, and verifying the operational metrics grid displays all 7 metric rows with correct values and "Best value" highlighting.

**Acceptance Scenarios**:

1. **Given** a comparison with two tickets that both have completed jobs with telemetry data, **When** the user opens the comparison dialog, **Then** the Operational Metrics section appears between Implementation Metrics and Decision Points, showing all 7 metric rows with values for each ticket.
2. **Given** a comparison where Ticket A used fewer tokens than Ticket B, **When** the user views the Operational Metrics grid, **Then** Ticket A's token cells display a "Best value" indicator.
3. **Given** a comparison where Ticket A has a higher quality score than Ticket B, **When** the user views the Quality row, **Then** Ticket A's quality cell displays a "Best value" indicator (highest is best for quality).
4. **Given** a comparison with a ticket that has no completed jobs, **When** the user views the Operational Metrics grid, **Then** that ticket's column shows "N/A" for all metric rows.
5. **Given** a comparison with a ticket that has a job still in progress, **When** the user views the Operational Metrics grid, **Then** that ticket's column shows a "Pending" state for metrics not yet available.

---

### User Story 2 - See Execution Context on Ranking Cards (Priority: P2)

A project owner viewing the comparison ranking section wants to understand the context of each implementation — what workflow type was used, which AI agent ran the work, and the quality score — without scrolling to another section.

**Why this priority**: Enriching existing ranking cards with contextual badges provides immediate at-a-glance insight and enhances the existing UI without requiring a new section.

**Independent Test**: Can be fully tested by opening a comparison dialog and verifying each ranking card displays workflow type badge, agent badge (when available), and quality score badge (when available).

**Acceptance Scenarios**:

1. **Given** a comparison with a FULL workflow ticket, **When** the user views its ranking card, **Then** a "FULL" workflow badge is always visible.
2. **Given** a comparison with a ticket processed by the Claude agent, **When** the user views its ranking card, **Then** a "Claude" agent badge is visible.
3. **Given** a comparison with a ticket that has no agent information, **When** the user views its ranking card, **Then** no agent badge is displayed.
4. **Given** a comparison with a ticket that has a quality score of 87, **When** the user views its ranking card, **Then** a badge showing "87 Good" is visible.
5. **Given** a comparison with a QUICK workflow ticket (no quality score), **When** the user views its ranking card, **Then** no quality score badge is displayed.

---

### User Story 3 - Inspect Quality Score Breakdown (Priority: P3)

A project owner sees a quality score in the operational metrics grid and wants to understand what drove the score. They click on it to see a detailed breakdown of all 5 evaluation dimensions.

**Why this priority**: The breakdown popover adds depth to the quality comparison but is secondary — users first need the scores visible (P1/P2) before drilling down.

**Independent Test**: Can be fully tested by clicking a quality score cell in the operational metrics grid for a FULL workflow ticket that passed VERIFY, and verifying the popover shows all 5 dimensions with scores, progress bars, weights, and the overall score with threshold label.

**Acceptance Scenarios**:

1. **Given** a FULL workflow ticket that passed VERIFY with quality score details, **When** the user clicks its quality score in the grid, **Then** a popover appears showing all 5 dimensions (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync).
2. **Given** the quality breakdown popover is open, **When** the user inspects a dimension row, **Then** they see the dimension name, numeric score, a visual progress bar, and the dimension's weight in the overall score.
3. **Given** the quality breakdown popover is open, **When** the user looks at the footer, **Then** they see the overall score and its threshold label (Excellent/Good/Fair/Poor).
4. **Given** a QUICK workflow ticket, **When** the user views its quality score cell, **Then** the cell shows "N/A" and is not clickable.
5. **Given** the quality breakdown popover is open, **When** the user clicks outside the popover, **Then** the popover closes without navigating away.

---

### User Story 4 - Compare 6 Tickets with Horizontal Scroll (Priority: P4)

A project owner has compared 6 different implementations and opens the comparison dialog. The operational metrics grid must remain readable with all 6 columns visible via horizontal scrolling.

**Why this priority**: Supporting the maximum ticket count ensures the feature works at scale, but most comparisons involve 2-3 tickets.

**Independent Test**: Can be fully tested by opening a comparison with 6 participants and verifying the metric labels column stays fixed while the data columns scroll horizontally.

**Acceptance Scenarios**:

1. **Given** a comparison with 6 tickets, **When** the user views the Operational Metrics grid, **Then** the metric labels column (leftmost) remains fixed while data columns scroll horizontally.
2. **Given** a comparison with 6 tickets on a mobile device, **When** the user swipes horizontally on the grid, **Then** the data columns scroll smoothly with native touch scrolling.
3. **Given** a comparison with 2 tickets, **When** the user views the Operational Metrics grid, **Then** no horizontal scrollbar appears (content fits without scrolling).

---

### Edge Cases

- What happens when all tickets in a comparison have no telemetry data? The Operational Metrics section still renders with all cells showing "N/A" — the section is not hidden.
- What happens when a job has partial telemetry (e.g., tokens but no cost)? Each metric cell independently shows its value or "N/A" based on data availability.
- What happens when quality score details JSON is malformed? The quality cell shows the numeric score (from the integer field) but the breakdown popover is unavailable. No error is shown to the user.
- What happens when two tickets tie for best value on a metric? Both cells display the "Best value" indicator.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display workflow type (FULL, QUICK, CLEAN) as a compact badge on each participant's ranking card, always visible regardless of data availability.
- **FR-002**: System MUST display the AI agent name (e.g., Claude, Codex) as a compact badge on each participant's ranking card when agent data is available.
- **FR-003**: System MUST display the quality score with threshold label (e.g., "87 Good") as a compact badge on each participant's ranking card when a quality score exists.
- **FR-004**: System MUST render an "Operational Metrics" section in the comparison dialog, positioned between Implementation Metrics and Decision Points.
- **FR-005**: The Operational Metrics section MUST display a comparison grid with columns for each compared ticket and rows for: Total Tokens, Input Tokens, Output Tokens, Duration, Cost, Job Count, and Quality Score.
- **FR-006**: Each column header in the Operational Metrics grid MUST show the ticket key, workflow type, and agent name.
- **FR-007**: Metric values MUST be aggregated across all completed jobs for each ticket (not limited to the latest job).
- **FR-008**: The system MUST visually highlight the best value in each metric row with a "Best value" indicator. Best is lowest for tokens, duration, cost, and job count; best is highest for quality score.
- **FR-009**: When two or more tickets share the best value for a metric, all tied tickets MUST display the "Best value" indicator.
- **FR-010**: When a ticket has a job in progress, its metric cells MUST show a "Pending" state for unavailable metrics.
- **FR-011**: When a ticket has no jobs, its metric cells MUST show "N/A".
- **FR-012**: Users MUST be able to click a quality score cell to open a popover showing the 5-dimension breakdown (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync) with individual scores, progress bars, weights, and the overall score with threshold label.
- **FR-013**: The quality score breakdown popover MUST only be available for FULL workflow tickets that have passed the VERIFY stage with quality score details.
- **FR-014**: The Operational Metrics grid MUST support horizontal scrolling with a fixed metric labels column when displaying 2 to 6 compared tickets.
- **FR-015**: The Operational Metrics grid MUST be usable on mobile devices with native horizontal touch scrolling.
- **FR-016**: The comparison dialog sections MUST appear in this order: Ranking, Implementation Metrics, Operational Metrics, Decision Points, Compliance Grid.

### Key Entities

- **Operational Metrics**: Aggregated telemetry data per ticket — total tokens (input + output), duration, cost in USD, job count, and primary AI model. Derived from all completed jobs associated with a ticket.
- **Quality Score Breakdown**: The 5-dimension quality assessment (Compliance 40%, Bug Detection 30%, Code Comments 20%, Historical Context 10%, Spec Sync 0%) with individual scores, weights, and an overall score with threshold label. Stored as JSON on the job record.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify the most cost-efficient implementation within 5 seconds of opening the comparison dialog.
- **SC-002**: All 7 operational metric rows display correct aggregated values for each compared ticket when telemetry data is available.
- **SC-003**: Best-value highlighting correctly identifies the optimal value in every metric row, including ties.
- **SC-004**: Quality score breakdown popover displays all 5 dimensions with scores, progress bars, and weights within 1 second of clicking.
- **SC-005**: The comparison dialog remains fully functional and readable with 6 compared tickets on both desktop and mobile viewports.
- **SC-006**: Pending and N/A states accurately reflect data availability — no misleading values are shown.
