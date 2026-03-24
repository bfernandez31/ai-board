# Feature Specification: Enrich Comparison Dialog with Operational Metrics and Quality Data

**Feature Branch**: `AIB-339-enrich-comparison-dialog`  
**Created**: 2026-03-24  
**Status**: Draft  
**Input**: User description: "Enrich the ticket comparison dialog to display operational metrics (tokens consumed, duration, cost, AI model) and quality gate scores alongside the existing code metrics so users can quickly compare the efficiency and quality of each implementation at a glance."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: AUTO policy was evaluated for this user-facing comparison feature and defaulted to a conservative interpretation for unresolved details because the context only provided neutral product signals.
- **Policy Applied**: AUTO
- **Confidence**: Low, score `+1` (`+1` neutral feature context, no offsetting signals)
- **Fallback Triggered?**: Yes — AUTO fell back to CONSERVATIVE because confidence was below 0.5
- **Trade-offs**:
  1. Preserves clear empty-state and eligibility rules rather than leaving edge cases to implementation-time guesswork.
  2. Adds slightly more specification detail up front to reduce rework during planning and verification.
- **Reviewer Notes**: Confirm the feature is intended for the standard comparison dialog experience rather than an internal-only view.

- **Decision**: The "primary AI model" shown for each compared ticket will represent the model responsible for the largest share of that ticket's total token consumption across all included jobs; ties use the most recently completed contributing model.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium — the feature requires a single defensible comparison label and token share is the least ambiguous aggregate indicator
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Gives users a stable summary label even when multiple models contributed to the same ticket.
  2. May hide less-used secondary models in the main grid, so detailed telemetry review remains outside this dialog.
- **Reviewer Notes**: Validate that token share is the preferred business rule for "primary" before implementation.

- **Decision**: Missing operational and quality data will use distinct states: `Pending` when related work exists but required data is not finalized yet, `N/A` when the ticket has no applicable job or no eligible quality result, and no score-breakdown interaction for ineligible tickets.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium — separate states reduce misinterpretation and preserve data integrity in comparisons
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Improves trust by distinguishing incomplete data from permanently unavailable data.
  2. Introduces one more state users must understand, so labels must remain concise and consistent.
- **Reviewer Notes**: Confirm product language for `Pending` and `N/A` matches existing comparison and job-status terminology.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compare implementation efficiency at a glance (Priority: P1)

As a user reviewing multiple implementation candidates, I want the comparison dialog to show operational metrics beside existing code metrics so I can quickly identify which option delivered the best outcome with the least effort and cost.

**Why this priority**: This is the core value of the feature and directly addresses the current visibility gap for operational performance data.

**Independent Test**: Can be fully tested by opening a comparison with multiple completed tickets and confirming the dialog shows a readable operational metrics section with the correct best-value emphasis for each metric.

**Acceptance Scenarios**:

1. **Given** a comparison dialog with 2 to 6 tickets that have completed jobs with telemetry, **When** the dialog opens, **Then** the ranking section is shown first and the operational metrics section appears after implementation metrics.
2. **Given** a comparison dialog with multiple tickets that have different operational values, **When** the operational metrics grid is displayed, **Then** each metric row shows all compared tickets side by side and clearly marks the best value according to that metric's comparison rule.
3. **Given** a ticket with jobs completed under multiple AI models, **When** the operational metrics column header is displayed, **Then** it shows the ticket key, workflow type, agent when available, and the primary AI model derived from that ticket's aggregated job history.

---

### User Story 2 - Understand quality results without leaving the dialog (Priority: P2)

As a user comparing implementation quality, I want to inspect a quality score breakdown directly from the comparison dialog so I can understand why one ticket scored better than another without navigating away.

**Why this priority**: Quality comparison is a major decision input, but it is secondary to surfacing the summary metrics themselves.

**Independent Test**: Can be fully tested by opening a comparison that includes an eligible FULL-workflow ticket with a completed quality result and verifying that the breakdown opens inline with all expected dimension data.

**Acceptance Scenarios**:

1. **Given** a FULL workflow ticket that has passed VERIFY and has a quality result, **When** the user selects that ticket's quality score in the operational metrics grid, **Then** a detail overlay opens in place and shows the overall score, threshold label, five evaluated dimensions, each dimension's score, and each dimension's weight.
2. **Given** a compared ticket that is not eligible for quality breakdown because it is not a FULL workflow ticket or has not passed VERIFY, **When** the user views the grid, **Then** the score-breakdown interaction is not offered for that ticket.

---

### User Story 3 - Compare larger sets of tickets on any device (Priority: P3)

As a user comparing several tickets at once, I want the dialog to remain readable on desktop and mobile so I can review up to six candidates without losing context.

**Why this priority**: Larger comparisons are valuable, but they build on the core metrics and quality behavior already being present.

**Independent Test**: Can be fully tested by opening a six-ticket comparison on desktop and mobile-sized viewports and confirming the label column remains visible while the ticket columns scroll horizontally without crushing content.

**Acceptance Scenarios**:

1. **Given** a comparison dialog with six tickets, **When** the user reviews the operational metrics section, **Then** the metric label column remains visible while ticket columns can be scrolled horizontally.
2. **Given** a mobile viewport, **When** the user scrolls through the operational metrics section, **Then** horizontal scrolling works natively and the content remains legible without overlapping or truncating critical values.

### Edge Cases

- A compared ticket has at least one related job still running or still awaiting telemetry finalization; operational metrics show `Pending` for affected values until the ticket's aggregate can be finalized.
- A compared ticket has no related jobs or no eligible quality result; the relevant metric cells show `N/A` and do not imply a better or worse rank.
- Two or more tickets tie for the best value in a metric row; each tied ticket is marked as a best value.
- A ticket includes jobs from multiple agents or AI models; the comparison still uses aggregated totals and identifies one primary model using the defined summary rule.
- A quality score exists without one or more dimension details; the summary score may still be shown, but the detailed breakdown is only offered when all five dimension scores and weights are available.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The comparison dialog MUST present sections in this order: Ranking, Implementation Metrics, Operational Metrics, Decision Points, Compliance Grid.
- **FR-002**: Each ranking card MUST display the ticket's workflow type at all times.
- **FR-003**: Each ranking card MUST display the agent used for the ticket when that information is available.
- **FR-004**: Each ranking card MUST display the ticket's quality score and associated threshold label when a quality result exists.
- **FR-005**: The dialog MUST include an Operational Metrics section that compares all selected tickets in a grid where rows are metrics and columns are compared tickets.
- **FR-006**: The Operational Metrics section MUST include these rows for every comparison: total tokens, input tokens, output tokens, duration, cost, job count, and quality.
- **FR-007**: Operational metric values MUST be aggregated across all jobs associated with each compared ticket rather than showing only the latest job.
- **FR-008**: Each compared ticket column header in the Operational Metrics section MUST show the ticket key, workflow type, agent when available, and the ticket's primary AI model when operational telemetry exists.
- **FR-009**: The primary AI model shown for a ticket MUST be the model responsible for the largest share of that ticket's total token consumption across included jobs; if multiple models tie, the most recently completed contributing model MUST be shown.
- **FR-010**: The Operational Metrics section MUST visually identify the best value in each metric row using these rules: lowest total tokens, lowest input tokens, lowest output tokens, lowest duration, lowest cost, lowest job count, and highest quality score.
- **FR-011**: If two or more tickets share the best value for a metric, all tied tickets MUST be identified as best for that row.
- **FR-012**: If a compared ticket has related work in progress or incomplete telemetry needed for an aggregate metric, the affected metric cell MUST show `Pending`.
- **FR-013**: If a compared ticket has no applicable job data for an operational metric or no eligible quality result, the affected metric cell MUST show `N/A`.
- **FR-014**: Quality score breakdown details MUST be available only for FULL workflow tickets that have passed VERIFY and have a complete quality result with all five evaluated dimensions.
- **FR-015**: Selecting an eligible quality score MUST open an in-context detail view without navigating away from the comparison dialog.
- **FR-016**: The quality score detail view MUST show the overall quality score, threshold label, the five evaluated dimensions (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync), each dimension's score, and each dimension's weight.
- **FR-017**: The comparison dialog MUST remain readable and functional when comparing any number of tickets from 2 through 6.
- **FR-018**: For comparisons wider than the available viewport, the operational metrics section MUST support horizontal scrolling while keeping the metric-label column visible.
- **FR-019**: On mobile-sized viewports, the operational metrics section MUST support native horizontal scrolling without obscuring critical labels or values.
- **FR-020**: Existing implementation metrics, decision points, compliance content, and ranking order MUST remain available in the comparison dialog after this feature is introduced.

### Assumptions & Dependencies

- The comparison dialog already receives or can access the set of tickets selected for comparison.
- Job telemetry and quality gate results already exist as trusted source data for at least some tickets.
- Quality threshold labels are part of the stored quality result whenever a quality score is available for display.
- Ranking logic is unchanged by this feature; the work enriches presentation and comparison detail only.

### Key Entities *(include if feature involves data)*

- **Compared Ticket Summary**: A single ticket as presented in the comparison dialog, including its ticket key, workflow type, agent, ranking position, and summarized model identity.
- **Operational Metric Aggregate**: The rolled-up values for one ticket across all related jobs, including token counts, duration, cost, and job count, plus the display state for missing or pending values.
- **Quality Result Summary**: The ticket-level quality outcome including overall score, threshold label, eligibility for detailed review, and the five weighted scoring dimensions when available.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability validation with representative comparison data, users can identify the best-performing ticket for cost, duration, and quality within 30 seconds for at least 90% of comparison tasks.
- **SC-002**: For comparisons containing 2 to 6 tickets, 100% of required operational metric rows are visible and usable without hiding the metric label column.
- **SC-003**: In verification using seeded comparison scenarios, 100% of eligible FULL workflow tickets expose the quality score breakdown inline and 0 ineligible tickets offer that interaction.
- **SC-004**: In mobile and desktop review scenarios, at least 95% of tested comparisons remain readable without critical value truncation or overlapping content.
