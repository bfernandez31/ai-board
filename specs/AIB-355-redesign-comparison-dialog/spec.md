# Feature Specification: Redesign Comparison Dialog as Mission Control Dashboard

**Feature Branch**: `AIB-355-redesign-comparison-dialog`
**Created**: 2026-03-26
**Status**: Draft
**Input**: User description: "Redesign the ticket comparison dialog so users can identify the winner immediately, compare all participants visually, read key metrics at a glance, spot compliance issues instantly, and review decision points with clear verdict cues."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: The dialog uses the existing ranking outcome as the source of truth for the hero winner, and any tied overall scores are broken by preserving the existing comparison order so the interface always presents one unambiguous winner
- **Policy Applied**: AUTO -> CONSERVATIVE (fallback)
- **Confidence**: Low (score 1) - neutral user-facing feature context without strong risk or speed signals
- **Fallback Triggered?**: Yes - AUTO confidence fell below 0.5, so the safer deterministic rule was selected
- **Trade-offs**:
  1. Users always see a single winner immediately, avoiding ambiguity in the hero presentation
  2. Tie outcomes may feel less nuanced than showing co-winners, but they preserve a stable, testable experience
- **Reviewer Notes**: Confirm the current comparison ranking order is the intended tie-breaker and should remain authoritative for this view

---

- **Decision**: When the dialog includes between two and six participants, all participants remain visible within the same comparison session; lower-priority detail areas may scroll horizontally, but no participant is hidden behind pagination or secondary drill-down navigation
- **Policy Applied**: AUTO -> CONSERVATIVE (fallback)
- **Confidence**: Low (score 1) - layout behavior was not fully specified beyond resilience at larger participant counts
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Keeping all participants visible protects comparison integrity and reduces the risk of missed outliers
  2. Dense layouts may require scrolling in detail-heavy sections, but that is preferable to splitting the comparison into multiple views
- **Reviewer Notes**: Validate that preserving all participants in one session remains preferable to compacting or collapsing lower-ranked entries on smaller screens

---

- **Decision**: Statuses that do not indicate a positive or negative outcome, including pending or unavailable enrichment states and missing compliance assessments, use a neutral visual treatment and explanatory text or tooltip content rather than borrowing winner, pass, or fail colors
- **Policy Applied**: AUTO -> CONSERVATIVE (fallback)
- **Confidence**: Low (score 1) - multiple valid display choices existed and the prompt only constrained correct tri-state handling
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Neutral treatment prevents users from misreading incomplete data as success or failure
  2. Additional explanatory cues slightly increase content density, but they reduce interpretation errors
- **Reviewer Notes**: Confirm the product team wants incomplete data to remain clearly distinct from scored outcomes throughout the dialog

---

- **Decision**: Hover-revealed and color-coded summaries must also remain understandable through non-hover interaction states so users can review compliance notes and decision summaries without relying on pointer-only behavior
- **Policy Applied**: AUTO -> CONSERVATIVE (fallback)
- **Confidence**: Low (score 1) - accessibility behavior was implied but not explicitly defined in the request
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. This preserves accessibility and auditability for keyboard and assistive-technology users
  2. It introduces slightly stricter acceptance expectations for interactive summaries and tooltips
- **Reviewer Notes**: Verify that the design should treat accessibility parity as a release requirement for all new visual cues in the dialog

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Identify the Best Candidate Immediately (Priority: P1)

A user opens the comparison dialog and can tell within moments which ticket performed best overall, why it won, and what its headline cost, duration, and quality outcomes were without scanning the rest of the dialog first.

**Why this priority**: The redesign exists primarily to make the winner and its rationale immediately understandable. If this outcome fails, the redesign does not solve the core problem.

**Independent Test**: Can be fully tested by opening a comparison with multiple participants and verifying that one winner is visually dominant, the recommendation summary is visible immediately, and the winner's headline metrics are readable without scrolling into detailed sections.

**Acceptance Scenarios**:

1. **Given** a completed comparison with at least two participants, **When** the user opens the dialog, **Then** the top section presents a single winning ticket as the primary focal point with its recommendation summary and overall score shown prominently
2. **Given** the winning participant has summary metadata, **When** the hero section renders, **Then** the generation context and source ticket information appear within the hero rather than in a separate standalone metadata block
3. **Given** the user needs a quick headline read, **When** they scan the hero section, **Then** they can see the winner's cost, duration, and quality values without opening additional panels

---

### User Story 2 - Compare All Participants Visually (Priority: P1)

A user can scan every participant in the comparison and understand relative standing, score strength, and key differences without reading dense tables line by line.

**Why this priority**: Fast visual comparison is the second core goal of the redesign and directly addresses the current flat, same-weight presentation.

**Independent Test**: Can be tested by opening comparisons with two, four, and six participants and confirming that all participants are visible, ranked, and visually differentiated in the same dialog session.

**Acceptance Scenarios**:

1. **Given** a comparison with multiple non-winning participants, **When** the user views the participant summary area, **Then** each non-winner appears as an individually scannable ranked card with its ticket identity, short rationale, and overall score
2. **Given** participants have differing score ranges, **When** the user scans the summary cards, **Then** higher and lower score bands are visually differentiated using consistent score-threshold treatments
3. **Given** the dialog includes up to six participants, **When** the user reviews the comparison, **Then** all participants remain available in the same dialog without layout breakage or hidden overflow that prevents understanding who is being compared

---

### User Story 3 - Read Relative Metrics Without Manual Calculation (Priority: P2)

A user can compare important execution metrics across participants through a single unified metrics section, allowing them to see winners, laggards, and spread without mentally computing which values are best or largest.

**Why this priority**: The redesign must reduce cognitive load in the most data-dense part of the dialog while preserving the detailed metrics users already rely on.

**Independent Test**: Can be tested by opening a comparison with varied metric values and verifying that the summary metric cards and detailed metric matrix both show relative positioning clearly for every participant.

**Acceptance Scenarios**:

1. **Given** participant metrics are available, **When** the user views the summary metric row, **Then** the winner's value is emphasized and the remaining participants' relative positions are visible for each headline metric
2. **Given** the user scrolls to the detailed metrics section, **When** they compare any metric row, **Then** all participant values appear within one unified matrix with a clear indication of each value's magnitude relative to the strongest value in that row
3. **Given** the quality score supports deeper inspection today, **When** the user selects a participant's quality score in the metrics matrix, **Then** they can still access the existing breakdown details without losing the new at-a-glance view

---

### User Story 4 - Spot Compliance and Decision Patterns Quickly (Priority: P2)

A user can identify which participants passed, failed, or lacked assessment on governance principles and can review major decision points with enough context to understand whether the winner's approach aligned with the final verdict.

**Why this priority**: Compliance and decision review are important trust-building parts of the dialog, but they are secondary to winner identification and metric comparison.

**Independent Test**: Can be tested by opening a comparison that contains mixed compliance outcomes and decision verdicts, then verifying that pattern recognition is possible before expanding any detailed content.

**Acceptance Scenarios**:

1. **Given** constitution compliance results vary by participant, **When** the user views the compliance section, **Then** they can distinguish pass, mixed, fail, and missing assessments through a consistent grid treatment and access explanatory notes on interaction
2. **Given** decision points include verdict summaries, **When** the user views the decision section, **Then** each decision point shows a visible verdict cue and concise summary before expansion
3. **Given** the dialog opens with decision data present, **When** the accordions render, **Then** the first decision point is expanded by default so the user has immediate context without extra clicks

### Edge Cases

- What happens when the comparison has only two participants? The same hierarchy applies, with one winner hero and one non-winner participant card; summary and detail sections still render without empty placeholders.
- What happens when the comparison has six participants with long titles or rationales? Ranking, ticket identity, and score remain visible, while supporting text may wrap or truncate in a way that preserves readability rather than breaking the layout.
- What happens when one or more participants are missing enrichment, compliance, or metric details? Neutral states and explanatory cues appear wherever data is pending or unavailable, and the missing data must not be mistaken for a pass, fail, or low score.
- What happens when a metric value is zero, identical across all participants, or absent for some entries? Relative comparison still renders in a stable way, and the presentation avoids misleading emphasis when no meaningful spread exists.
- What happens when the current winner differs from the leading participant in a single metric or decision point? The dialog continues to highlight the overall winner while preserving the per-metric and per-decision evidence that explains trade-offs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The comparison dialog MUST present exactly one winning participant as the primary hero section whenever comparison results include at least two ranked participants
- **FR-002**: The hero section MUST display the winning ticket identity, recommendation summary, key differentiators, overall score, and the winner's headline cost, duration, and quality values in the initial viewport of the dialog
- **FR-003**: The generation context that was previously shown in a separate metadata block MUST be absorbed into the hero section and the standalone metadata block MUST be removed
- **FR-004**: All non-winning participants MUST be shown in a ranked visual summary area directly below the hero, with each participant presented as a distinct card that includes ticket identity, relative standing, short rationale, and overall score
- **FR-005**: Score treatments across the hero and participant summaries MUST make score bands visually distinguishable so users can tell strong, moderate, and weak results at a glance
- **FR-006**: The dialog MUST provide four headline metric summaries for cost, duration, quality score, and files changed, with the winner's value emphasized and all participants' relative positions visible for each metric
- **FR-007**: The detailed metrics area MUST merge the prior implementation and operational views into one unified comparison matrix covering lines changed, files changed, test files changed, total tokens, input tokens, output tokens, duration, cost, job count, and quality score
- **FR-008**: Each detailed metric row MUST show the relative magnitude of every participant value so users can compare participants without manually calculating the spread
- **FR-009**: The first column in the detailed metrics area MUST remain identifiable while users review additional participant columns so row labels stay understandable during horizontal navigation
- **FR-010**: The quality score entry in the detailed metrics area MUST continue to expose its existing score breakdown on user interaction
- **FR-011**: The constitution compliance section MUST present principles as rows and participants as columns in a pattern-focused grid that visually distinguishes pass, mixed, fail, and missing assessments
- **FR-012**: Compliance cells MUST provide access to their assessment notes on interaction, and missing assessments MUST use a neutral treatment rather than a success or failure treatment
- **FR-013**: Decision points MUST display a verdict cue, title, and visible summary before expansion, and the first decision point MUST be expanded by default when decision data exists
- **FR-014**: Expanded decision content MUST show each participant's approach in a way that preserves which ticket the approach belongs to and whether it matches the winning outcome
- **FR-015**: Available, pending, and unavailable enrichment states MUST be represented consistently throughout the dialog so incomplete data is distinguishable from scored outcomes
- **FR-016**: The redesign MUST preserve the existing dialog shell plus current loading, error, empty, and history-sidebar behaviors
- **FR-017**: The redesigned dialog MUST remain understandable and usable for comparisons containing between two and six participants on supported screen sizes
- **FR-018**: All visual status treatments in the redesigned dialog MUST use the project's approved semantic design tokens rather than one-off color definitions

### Key Entities *(include if feature involves data)*

- **Comparison Result**: The complete comparison view for one source ticket, including winner selection, recommendation summary, generated context, participants, compliance outcomes, and decision points.
- **Comparison Participant**: A ranked ticket being compared, with identifying information, rationale, overall score, workflow context, quality indicators, and detailed metric values.
- **Metric Comparison Row**: A named measure that can be compared across all participants, including headline measures and detailed execution metrics.
- **Compliance Assessment**: The outcome for one governing principle against one participant, including status and supporting notes when available.
- **Decision Point**: A comparison checkpoint describing the issue considered, the verdict reached, its relationship to the overall winner, and each participant's approach summary.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In moderated usability review, at least 90% of participants can identify the overall winning ticket within 1 second of the dialog opening
- **SC-002**: In moderated usability review, at least 85% of participants can correctly identify the strongest and weakest participant for a sampled metric without reading every value in the row
- **SC-003**: 100% of comparisons containing between two and six participants render all compared tickets within the same dialog session without requiring a secondary view to access hidden participants
- **SC-004**: 100% of pending, unavailable, or missing data states are visually distinguishable from positive and negative outcomes in design and acceptance review
- **SC-005**: At least 90% of sampled users can identify whether a decision point supports the overall winner before expanding the accordion content

## Assumptions

- The existing comparison result already provides the ranking, recommendation summary, detailed metrics, quality breakdown, compliance assessments, and decision-point data needed for the redesign.
- The overall winner remains derived from the existing comparison outcome rather than from a new business rule introduced by this redesign.
- This effort changes only the comparison dialog presentation and interaction model; surrounding navigation, history behavior, and backend data contracts remain unchanged.
- Approved semantic design tokens already cover the status, neutral, and emphasis treatments needed for the redesign.
