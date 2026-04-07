# Feature Specification: Display health score heart indicator on project cards

**Feature Branch**: `AIB-548-display-health-score`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "Display health score heart indicator on project cards"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Apply the ticket's explicit `AUTO` clarification policy to a dashboard card enhancement and keep the scope limited to read-only project health visibility on the project list.
- **Policy Applied**: AUTO
- **Confidence**: Low (score: +1, confidence: 0.3). Signals detected: neutral user-facing feature context only.
- **Fallback Triggered?**: Yes. AUTO fell back to CONSERVATIVE because confidence was below 0.5.
- **Trade-offs**:
  1. The spec avoids introducing extra actions, workflows, or deeper drill-down from the indicator so the change stays narrowly scoped and predictable.
  2. The fallback preserves clarity around accessibility, empty states, and interaction safety even though this is a lightweight UI enhancement.
- **Reviewer Notes**: Confirm that the heart indicator remains informational only and does not weaken existing project-card navigation, hover behavior, or accessibility expectations.

- **Decision**: Treat projects with no completed health scan history as a distinct no-data state instead of estimating or suppressing the indicator.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium. The request explicitly defines a grey heart with "—", and preserving that state avoids misleading health signals.
- **Fallback Triggered?**: No.
- **Trade-offs**:
  1. Users can distinguish between "poor health" and "no health data," reducing misinterpretation.
  2. Some cards will show less visually prominent content, but the state remains honest and easier to trust.
- **Reviewer Notes**: Validate that the no-data presentation is visually clear and still consistent with the rest of the project card hierarchy.

- **Decision**: Use the existing six health dimensions already shown on the project health experience as the popover breakdown, with no additional metrics or card-level actions.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium. The user named the six sub-scores and requested informational hover content only.
- **Fallback Triggered?**: No.
- **Trade-offs**:
  1. Reusing the established health dimensions keeps the summary familiar and avoids expanding the health model on the dashboard.
  2. The popover stays compact, but it intentionally does not provide remediation or navigation shortcuts.
- **Reviewer Notes**: Confirm the displayed sub-score names match the canonical health labels used elsewhere in the product.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan project health from the project list (Priority: P1)

A project owner or member reviewing the dashboard can understand each project's overall health without opening the dedicated health view.

**Why this priority**: The primary problem is lack of at-a-glance health visibility on the project list. Solving that directly reduces navigation overhead for every project review session.

**Independent Test**: Can be fully tested by loading the project list with projects across multiple score bands and confirming each card shows the correct heart indicator state and score without opening another page.

**Acceptance Scenarios**:

1. **Given** a project with a global health score in the Excellent, Good, Fair, or Poor range, **When** the project list is displayed, **Then** that project's card shows a heart indicator in the top-right area with the numeric score inside and the visual styling that matches the corresponding score band.
2. **Given** multiple projects with different global health scores, **When** the project list is displayed, **Then** each project card shows the correct score independently without requiring the user to open the project first.

---

### User Story 2 - Understand the reason behind a health score (Priority: P2)

A project owner or member can inspect the six health sub-scores from the project list so they can understand what drives the overall score before deciding whether to look deeper.

**Why this priority**: The popover adds decision-making context, but the global score itself delivers the core value first.

**Independent Test**: Can be fully tested by hovering or focusing the heart indicator on a project card and confirming the informational summary shows all six sub-scores with the correct values and no additional actions.

**Acceptance Scenarios**:

1. **Given** a project with available health details, **When** the user hovers over or otherwise reveals the indicator details, **Then** a compact informational popover shows Security, Compliance, Tests, Spec Sync, Quality Gate, and Review Quality with each sub-score's value and matching score-band styling.
2. **Given** a project where one or more sub-scores have no available data, **When** the user reveals the indicator details, **Then** the affected sub-scores display "—" instead of an estimated value.
3. **Given** the user reveals the indicator details, **When** the popover is visible, **Then** it does not show navigation links, buttons, or actions.

---

### User Story 3 - Preserve existing project-card interactions (Priority: P3)

A project owner or member can continue using the project list exactly as before, with the new health indicator adding information without blocking navigation or reducing responsiveness across device sizes.

**Why this priority**: The feature must not damage the existing project-list experience or create accidental interaction regressions.

**Independent Test**: Can be fully tested by using the project list on mobile and desktop layouts, interacting with cards and existing card controls, and confirming the indicator does not create a new click target or break card navigation.

**Acceptance Scenarios**:

1. **Given** a project card with a visible heart indicator, **When** the user clicks the card outside existing interactive controls, **Then** the user is still taken to the project board.
2. **Given** the heart indicator is shown on a project card, **When** the user interacts with the card on supported screen sizes, **Then** the heart remains visible, positioned consistently, and does not overlap essential project information.
3. **Given** the project list is loaded, **When** health indicators are displayed for all visible cards, **Then** the list does not perform separate follow-up retrievals per project card just to render indicator content.

### Edge Cases

- What happens when a project has never had any completed health scan data? The card shows a muted heart with "—" and the informational summary shows "—" for any unavailable sub-scores.
- What happens when the project has a global health score but some sub-scores are missing? The overall score still displays while missing sub-scores remain explicitly blank in the informational summary.
- What happens when project names, repository text, or latest shipped ticket text are long? The heart indicator remains visible and does not cause project card content to overlap or become unreadable.
- What happens when the project list contains many cards with mixed health states? Each card renders its own indicator state consistently without degrading the usability of the list.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST show a heart-shaped health indicator on every project card in the project list.
- **FR-002**: The system MUST position the health indicator so it is visible in the upper-right area of the project card without obscuring the card's existing core information.
- **FR-003**: The system MUST display the project's current global health score as a whole number from 0 to 100 inside the heart indicator whenever health data exists.
- **FR-004**: The system MUST apply the same four score bands already used by the health experience to the project-card heart indicator: Excellent for scores 90-100, Good for scores 70-89, Fair for scores 50-69, and Poor for scores 0-49.
- **FR-005**: The system MUST visually distinguish each score band using a corresponding color treatment and a subtle matching glow so users can recognize health status at a glance.
- **FR-006**: The system MUST display a muted no-data heart state with "—" inside when a project has no completed health score yet.
- **FR-007**: The system MUST provide an informational summary for the heart indicator that lists Security, Compliance, Tests, Spec Sync, Quality Gate, and Review Quality.
- **FR-008**: The system MUST show each sub-score in the informational summary using its available value and the same score-band styling rules as the global health score.
- **FR-009**: The system MUST display "—" for any sub-score that has no available value.
- **FR-010**: The informational summary MUST be read-only and MUST NOT introduce navigation targets, buttons, or workflow actions.
- **FR-011**: The system MUST preserve existing project-card navigation and other card-level interactions when the health indicator and its informational summary are present.
- **FR-012**: The system MUST make the health indicator data available as part of the project list's initial project data so that rendering the indicator does not depend on separate per-card retrievals.
- **FR-013**: The system MUST keep the heart indicator visible and correctly placed across supported project-list screen sizes.
- **FR-014**: The system MUST ensure the health indicator and informational summary remain understandable for users relying on non-visual cues, including a text alternative for the score state and no-data state.

### Key Entities *(include if feature involves data)*

- **Project Summary Card**: The dashboard representation of a project, including existing project metadata and the added read-only health summary indicator.
- **Project Health Summary**: The project's global health score, score band, score availability state, and the six named sub-scores shown from the project list.
- **Health Sub-score**: One of the six health dimensions displayed in the informational summary, including a name, an optional numeric value, and its current score band or no-data state.

### Assumptions & Dependencies

- The project list already has a trusted source of project health data that can be extended to include the global score and six sub-scores in the initial project list data delivered to users.
- The score-band definitions and six health dimensions used on the dedicated health experience remain the canonical source for this feature.
- Existing project-card interactions, including navigation to the board and any current inline controls, remain unchanged unless explicitly stated in this specification.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of project cards with available health data display the correct global score and matching score-band state from the project list view.
- **SC-002**: In acceptance testing, 100% of projects with no health data display the no-data heart state instead of a numeric score or misleading score band.
- **SC-003**: In acceptance testing, users can reveal the six-sub-score informational summary for a project from the project list and correctly identify available versus missing sub-score values on the first attempt.
- **SC-004**: In regression testing across supported project-list layouts, the project card remains navigable and the health indicator stays visible without blocking existing interactions.
