# Feature Specification: Enrich comparison dialog with operational metrics and quality data

**Feature Branch**: `AIB-338-enrich-comparison-dialog`  
**Created**: 2026-03-21  
**Status**: Draft  
**Input**: User description: "Enrich the ticket comparison dialog to display operational metrics (tokens consumed, duration, cost, AI model) and quality gate scores alongside the existing code metrics so users can compare implementation efficiency and quality at a glance."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: `AUTO` policy was requested, but the feature description contained only neutral product signals, so unresolved product decisions were specified using a CONSERVATIVE fallback.
- **Policy Applied**: AUTO
- **Confidence**: Low (score: +1 from general user-facing comparison UI context; no strong sensitive, compliance, scalability, or speed signals)
- **Fallback Triggered?**: Yes — AUTO must default to CONSERVATIVE when confidence is below 0.5.
- **Trade-offs**:
  1. Produces stricter, more explicit requirements for incomplete-data handling, comparison consistency, and eligibility rules.
  2. Adds some specification detail that a PRAGMATIC pass might have deferred to implementation.
- **Reviewer Notes**: Confirm the fallback is appropriate for a user-facing comparison surface that influences implementation decisions and quality interpretation.

- **Decision**: Operational metrics will be aggregated across all jobs associated with each compared ticket, while clearly distinguishing values that are still in progress from values that will never exist.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (explicitly requested and necessary to avoid misleading users with partial totals)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Gives users a fuller efficiency picture than showing only the latest job.
  2. Requires the comparison to communicate mixed job states clearly so partial activity is not mistaken for final totals.
- **Reviewer Notes**: Validate that aggregating all ticket jobs matches stakeholder intent for comparisons that span several workflow attempts.

- **Decision**: The primary AI model shown for a ticket will represent the model that contributed the largest share of the ticket's aggregated execution activity; if no single model is dominant, the UI will show that multiple models were used.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (required to make model labeling defensible when a ticket has multiple jobs)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prevents a misleading single-model label when execution history is mixed.
  2. Introduces a small amount of explanatory logic for tickets that switched models during execution.
- **Reviewer Notes**: Confirm whether stakeholders prefer a dominant-model label or an explicit "multiple models" label for mixed histories.

- **Decision**: Best-value highlighting will mark every tied best value for a metric, and it will be omitted when all visible values are unavailable.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (chosen to avoid inventing a winner where none exists)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Preserves fairness when two or more tickets perform equally well on the same metric.
  2. Reduces visual emphasis in sparse comparisons where most data is missing.
- **Reviewer Notes**: Confirm that highlighting all ties is preferable to showing no badge in a tie.

- **Decision**: Quality score breakdown details will be available only when the compared ticket is a FULL workflow ticket with a completed VERIFY outcome that produced quality details; otherwise the quality value remains non-interactive.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (explicitly requested and aligned with existing quality-gate semantics)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prevents users from opening empty or misleading detail views for tickets that were never fully evaluated.
  2. Creates a visibly different interaction pattern between fully verified tickets and all other ticket types.
- **Reviewer Notes**: Validate the user-facing explanation for non-interactive quality values so users understand why details are unavailable.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compare operational efficiency across candidate implementations (Priority: P1)

A project member opens the comparison dialog and can compare each ticket's execution cost, token usage, duration, job count, and quality side by side without leaving the dialog.

**Why this priority**: The feature's primary value is faster decision-making. If users still need to inspect jobs individually, the comparison dialog has not solved the problem.

**Independent Test**: Can be fully tested by opening a comparison containing at least two tickets with different job telemetry and confirming the operational metrics section shows aggregated values, best-value highlighting, and clear pending or unavailable states.

**Acceptance Scenarios**:

1. **Given** a comparison with completed job telemetry for multiple tickets, **When** the user opens the dialog, **Then** they see an Operational Metrics section that compares total tokens, input tokens, output tokens, duration, cost, job count, and quality for every ticket side by side.
2. **Given** at least one metric has a clear best value, **When** the grid renders, **Then** the ticket or tickets with the best value for that metric are visibly identified.
3. **Given** one compared ticket still has jobs in progress, **When** the user reviews the metrics grid, **Then** that ticket shows a pending state for values that are not final yet rather than showing zero or blank data.
4. **Given** one compared ticket has no applicable jobs for a metric, **When** the user reviews the same row, **Then** that value is labeled as not available rather than implying work is still running.

---

### User Story 2 - Understand ranking context without opening secondary views (Priority: P2)

A project member can interpret each ranked card more quickly because workflow type, agent, and available quality score context appear directly in the ranking section.

**Why this priority**: Ranking becomes much more useful when the user can immediately see what type of run produced the result and whether quality data exists.

**Independent Test**: Can be fully tested by opening a comparison with mixed workflow types and agents and confirming each ranking card displays the required contextual badges without removing existing ranking information.

**Acceptance Scenarios**:

1. **Given** a comparison includes tickets from different workflow types, **When** the ranking section renders, **Then** each participant card displays its workflow type badge.
2. **Given** agent information is available for a ticket, **When** the ranking card renders, **Then** the card shows the agent label alongside the existing ranking content.
3. **Given** a ticket has an available quality score and threshold label, **When** the ranking card renders, **Then** the card shows that score and label as compact context rather than requiring the user to inspect another section.

---

### User Story 3 - Inspect quality details in place (Priority: P3)

A project member can inspect the breakdown behind a quality score directly inside the comparison dialog without navigating away from the comparison.

**Why this priority**: This is a supporting workflow that helps users trust the summary score after they have already identified a ticket of interest.

**Independent Test**: Can be fully tested by opening a comparison that includes at least one FULL workflow ticket with completed VERIFY quality details and confirming the user can open an in-place detail view showing all scored dimensions, weights, and the threshold label.

**Acceptance Scenarios**:

1. **Given** a FULL workflow ticket has passed VERIFY and produced quality details, **When** the user selects that ticket's quality value in the operational metrics grid, **Then** an in-place detail view opens showing the overall score, threshold label, all five evaluated dimensions, each dimension's score, and each dimension's weight.
2. **Given** a compared ticket does not meet the eligibility conditions for quality detail inspection, **When** the user reviews the quality row, **Then** the value remains non-interactive and the dialog does not imply that deeper details are available.
3. **Given** the comparison includes between two and six tickets, **When** the user opens the dialog on desktop or mobile, **Then** the ranking and metrics remain readable through horizontal scrolling without crushing the ticket columns or hiding the metric label column.

### Edge Cases

- Two or more tickets tie for the best value on the same metric; each tied ticket is identified as best for that row.
- A ticket has mixed job history from multiple AI models; the comparison identifies a dominant model only when one model clearly represents most of the aggregated execution activity, otherwise it communicates that multiple models were used.
- A ticket has some completed jobs and some still-running jobs; final-only metrics are shown as pending until the relevant execution is complete.
- A comparison includes six tickets with long ticket titles or multiple badges; the layout stays navigable through horizontal scrolling rather than clipping or stacking content into unreadable columns.
- A quality score exists for a ticket but detailed dimension data does not; the comparison still shows the summary value and treats the detailed breakdown as unavailable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The comparison dialog MUST preserve the existing section order while inserting a new Operational Metrics section after Implementation Metrics and before Decision Points.
- **FR-002**: The ranking section MUST display each compared ticket's workflow type on every participant card.
- **FR-003**: The ranking section MUST display each compared ticket's agent when that information is available.
- **FR-004**: The ranking section MUST display each compared ticket's quality score and threshold label when a score exists.
- **FR-005**: The comparison dialog MUST include an Operational Metrics section that compares every selected ticket side by side using one column per ticket and one row per metric.
- **FR-006**: The Operational Metrics section MUST include rows for total tokens, input tokens, output tokens, duration, cost, job count, and quality.
- **FR-007**: The Operational Metrics section MUST aggregate each ticket's displayed operational values across all jobs associated with that ticket rather than only the latest job.
- **FR-008**: Each operational metric column header MUST identify the ticket key and also show the ticket's workflow type and agent context.
- **FR-009**: The comparison MUST identify the primary AI model used for each ticket and MUST indicate when no single model is dominant enough to represent the ticket on its own.
- **FR-010**: For each metric row with at least one available value, the comparison MUST visually identify the best value according to the metric's intended direction, using lowest as best for total tokens, input tokens, output tokens, duration, cost, and job count, and highest as best for quality.
- **FR-011**: When multiple tickets tie for the best value in a metric row, the comparison MUST identify all tied tickets as best for that row.
- **FR-012**: When a metric is not final because the relevant ticket execution is still in progress, the comparison MUST label that value as pending.
- **FR-013**: When a metric will not become available because no relevant job data exists for that ticket, the comparison MUST label that value as not available.
- **FR-014**: The quality value in the Operational Metrics section MUST open an in-place detail view only for FULL workflow tickets that have completed VERIFY with quality score details available.
- **FR-015**: The in-place quality detail view MUST show the overall quality score, threshold label, all five evaluated dimensions, each dimension's score, and each dimension's weight.
- **FR-016**: The comparison dialog MUST continue to show the quality summary value even when the detailed quality breakdown is unavailable, provided a summary score exists.
- **FR-017**: The Operational Metrics section MUST remain usable for comparisons containing two to six tickets, including horizontal scrolling behavior that preserves visibility of the metric label column while ticket columns scroll.
- **FR-018**: The comparison dialog MUST remain usable on mobile devices through native horizontal scrolling without truncating ticket content into unreadable columns.
- **FR-019**: The dialog MUST continue to render the existing Implementation Metrics, Decision Points, and Compliance Grid sections alongside the new enrichments without removing existing comparison information.
- **FR-020**: The comparison experience MUST avoid representing missing or pending values as zero, complete, or best-performing values.

### Key Entities *(include if feature involves data)*

- **Compared Ticket Summary**: The per-ticket information shown throughout the comparison dialog, including ranking context, workflow type, agent, AI model summary, and any available quality summary.
- **Operational Metric Aggregate**: The ticket-level summary of execution activity used for comparison, including token consumption, duration, cost, and job count derived from all relevant jobs for that ticket.
- **Quality Score Summary**: The overall quality result shown in ranking cards and the operational metrics grid, including the numeric score and threshold label.
- **Quality Dimension Breakdown**: The detailed quality evaluation for an eligible ticket, including the five scored dimensions and their weights.

### Assumptions

- The comparison dialog already has access to the selected ticket set and existing code-metric sections; this feature enriches that experience rather than redefining how comparisons are created.
- Aggregated operational metrics are based on all jobs associated with each compared ticket, regardless of whether the ticket reached the same final workflow stage.
- "Primary AI model" should help users interpret a ticket's execution history, not assert that every job used the same model.
- Existing authorization and ticket-access rules remain unchanged for viewing comparison details.

### Dependencies

- Ticket job telemetry remains available with enough fidelity to determine token usage, duration, cost, job count, and model attribution.
- Quality score summaries and detailed dimension results remain available for eligible FULL workflow tickets that completed VERIFY.
- The existing comparison dialog can accept an additional metrics section and enriched card metadata without removing current comparison content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, users can identify the lowest-cost and highest-quality ticket in a 2-to-6 ticket comparison within 30 seconds from opening the comparison dialog.
- **SC-002**: In regression testing, 100% of compared tickets with available telemetry show aggregated values for all supported operational metrics without requiring the user to inspect individual jobs.
- **SC-003**: In acceptance testing, 100% of pending or unavailable operational values are labeled distinctly enough that reviewers do not mistake them for completed zero values.
- **SC-004**: In acceptance testing, eligible FULL workflow tickets expose the in-place quality breakdown and ineligible tickets do not present a broken or misleading detail interaction.
- **SC-005**: In responsive validation, comparisons with up to six tickets remain readable and navigable on desktop and mobile without hiding the metric labels or collapsing ticket columns into unreadable content.
