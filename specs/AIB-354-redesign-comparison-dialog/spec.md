# Feature Specification: Redesign Comparison Dialog as Mission Control Dashboard

**Feature Branch**: `AIB-354-redesign-comparison-dialog`
**Created**: 2026-03-26
**Status**: Draft
**Input**: User description: "Redesign comparison dialog as Mission Control dashboard"

## Auto-Resolved Decisions

### Decision 1: Score ring color thresholds

- **Decision**: Score rings use four color tiers: green (>=85), blue (70-84), yellow (50-69), red (<50). These thresholds are consistent with the existing `ScoreThreshold` levels already in the codebase (Excellent 90+, Good 70-89, Fair 50-69, Poor 0-49) but adjusted per the ticket description to shift the green boundary to 85 instead of 90.
- **Policy Applied**: AUTO (resolved as CONSERVATIVE via fallback)
- **Confidence**: Low (score: 1) — only neutral UI signals detected, no sensitive or speed keywords
- **Fallback Triggered?**: Yes — confidence 0.3 < 0.5 threshold, AUTO promoted to CONSERVATIVE
- **Trade-offs**:
  1. Using ticket-specified thresholds (85/70/50) instead of existing code thresholds (90/70/50) creates a minor inconsistency with other quality-score displays
  2. The deviation is small (5 points on green boundary) and localized to the comparison dashboard
- **Reviewer Notes**: Verify whether the 85+ green threshold is intentional or if the existing 90+ should be preserved for consistency across the product

### Decision 2: Metrics table "best value" direction

- **Decision**: For metrics where lower is better (cost, duration, tokens, lines changed, files changed, job count), the lowest value is highlighted as best. For quality score, the highest is best. This matches the existing best-value logic already implemented in the comparison components.
- **Policy Applied**: AUTO (resolved as CONSERVATIVE via fallback)
- **Confidence**: Low (score: 1) — fallback to CONSERVATIVE
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. No change from current behavior, preserves user expectations
  2. None
- **Reviewer Notes**: Existing best-value logic is the source of truth — no new interpretation needed

### Decision 3: Animated score gauge behavior

- **Decision**: The circular SVG score gauge animates once on mount (initial render) using a stroke-dashoffset transition. No re-animation on tab switches or data refreshes to avoid motion fatigue and accessibility concerns.
- **Policy Applied**: AUTO (resolved as CONSERVATIVE via fallback)
- **Confidence**: Low (score: 1) — fallback to CONSERVATIVE
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Single mount animation is subtle but effective for drawing attention
  2. Users with reduced-motion preferences should see no animation (respect `prefers-reduced-motion`)
- **Reviewer Notes**: Ensure the animation respects the `prefers-reduced-motion` media query

### Decision 4: Compliance heatmap tooltip trigger

- **Decision**: Hover triggers the tooltip on desktop; on touch devices, tap triggers the tooltip. The tooltip shows the assessment notes text for that cell. Missing assessments show a neutral muted background with no tooltip.
- **Policy Applied**: AUTO (resolved as CONSERVATIVE via fallback)
- **Confidence**: Low (score: 1) — fallback to CONSERVATIVE
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Tooltips hide information behind interaction, but the heatmap's primary value is pattern recognition via color
  2. Touch-friendly tap behavior maintains mobile usability
- **Reviewer Notes**: Verify tooltip behavior on mobile viewport within the dialog

### Decision 5: Decision point accordion default state

- **Decision**: The first decision point accordion is open by default; all others are collapsed. This matches the ticket description explicitly.
- **Policy Applied**: AUTO (resolved as CONSERVATIVE via fallback)
- **Confidence**: Low (score: 1) — fallback to CONSERVATIVE
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Showing one open accordion gives immediate value without overwhelming the view
  2. None
- **Reviewer Notes**: None — explicit in ticket requirements

## User Scenarios & Testing

### User Story 1 - Instant Winner Identification (Priority: P1)

A user opens the comparison dialog and immediately sees who won. The hero card at the top prominently displays the winning ticket key, the recommendation summary, key differentiator tags, and a large animated circular score gauge. Metadata (generation date, source ticket) appears as small muted text within the hero card, eliminating the standalone metadata block. Three stat pills show the winner's cost, duration, and quality score.

**Why this priority**: The primary purpose of a comparison dashboard is answering "who won and why" — this must be visible within one second of opening the dialog.

**Independent Test**: Can be tested by opening any comparison with a known winner and verifying the hero card renders with correct winner data, animated gauge, and stat pills.

**Acceptance Scenarios**:

1. **Given** a comparison with a declared winner, **When** the user opens the comparison dialog, **Then** the hero card displays the winning ticket key in large text, the recommendation summary, key differentiator tags as badges, and a circular score gauge showing the winner's overall score percentage.
2. **Given** a comparison with a declared winner, **When** the hero card renders, **Then** the generation date and source ticket key appear as small muted text within the hero card (no standalone metadata block exists).
3. **Given** a comparison with a declared winner, **When** the hero card renders, **Then** three stat pills at the bottom display the winner's cost, duration, and quality score values.
4. **Given** a comparison with a declared winner, **When** the dialog first opens, **Then** the circular score gauge animates from 0 to the winner's score percentage over a brief transition.
5. **Given** a user with `prefers-reduced-motion` enabled, **When** the dialog opens, **Then** the score gauge displays at its final state without animation.

---

### User Story 2 - Visual Participant Scanning (Priority: P1)

Below the hero card, the user sees all non-winner participants in a responsive horizontal card grid. Each card shows the participant's rank, ticket key, title, workflow/agent/quality badges, rationale text, and a mini SVG score ring color-coded by threshold.

**Why this priority**: After identifying the winner, the next question is "how did the others compare?" — the participant grid provides this at a glance.

**Independent Test**: Can be tested with a comparison containing 3+ participants; verify non-winner cards appear in a grid with correct data and color-coded score rings.

**Acceptance Scenarios**:

1. **Given** a comparison with 4 participants, **When** the dialog renders, **Then** 3 non-winner participant cards appear in a horizontal grid below the hero card.
2. **Given** a participant with score 90, **When** their card renders, **Then** the mini score ring uses the green color token.
3. **Given** a participant with score 75, **When** their card renders, **Then** the mini score ring uses the blue color token.
4. **Given** a participant with score 55, **When** their card renders, **Then** the mini score ring uses the yellow color token.
5. **Given** a participant with score 30, **When** their card renders, **Then** the mini score ring uses the red color token.
6. **Given** a comparison with 2 participants, **When** the dialog renders, **Then** only 1 non-winner card appears and the layout does not break.
7. **Given** a comparison with 6 participants, **When** the dialog renders, **Then** 5 non-winner cards appear in the grid and the layout wraps responsively without overflow.

---

### User Story 3 - Key Metrics at a Glance (Priority: P2)

The user sees a row of four stat cards (Cost, Duration, Quality Score, Files Changed) showing the winner's values prominently. Beneath each stat card, a micro-bar visualizes where all participants fall on a relative horizontal scale.

**Why this priority**: Stat cards provide a quick numeric summary without requiring the user to read the full metrics table.

**Independent Test**: Can be tested with a comparison containing 3+ participants with available telemetry data; verify stat card values match the winner and micro-bars show relative positions.

**Acceptance Scenarios**:

1. **Given** a comparison with all telemetry available, **When** the stat cards render, **Then** four cards display Cost, Duration, Quality Score, and Files Changed with the winner's values.
2. **Given** a comparison with 4 participants, **When** a stat card's micro-bar renders, **Then** it shows 4 markers positioned proportionally along a horizontal scale.
3. **Given** a participant with pending telemetry, **When** the stat cards render, **Then** the affected stat card shows a pending indicator and the micro-bar omits that participant's marker.
4. **Given** a participant with unavailable telemetry, **When** the stat cards render, **Then** the micro-bar omits that participant's marker and the card still displays available data.

---

### User Story 4 - Unified Metrics Comparison Table (Priority: P2)

The user sees a single unified table replacing the current two separate tables (Implementation Metrics + Operational Metrics). Each numeric cell has a proportional inline bar behind the text. The best value bar uses the primary color; others use muted. The first column is sticky for horizontal scrolling with many participants.

**Why this priority**: A unified table reduces cognitive load and inline bars make relative comparison instant.

**Independent Test**: Can be tested by opening a comparison and verifying all 9 metric rows appear in a single table with proportional bars and sticky first column.

**Acceptance Scenarios**:

1. **Given** a comparison with available metrics, **When** the metrics table renders, **Then** a single table displays rows for: Lines Changed, Files Changed, Test Files Changed, Total Tokens, Input Tokens, Output Tokens, Duration, Cost, and Job Count.
2. **Given** a metric row where participant A has the best value, **When** the row renders, **Then** participant A's cell bar uses the primary color and other cells use muted color.
3. **Given** a metric row where the maximum value is 1000 and a participant has value 500, **When** the cell renders, **Then** the inline bar width is 50% of the cell width.
4. **Given** a comparison with 6 participants, **When** the user scrolls the table horizontally, **Then** the first column (metric names) remains sticky/fixed.
5. **Given** a participant's quality score cell, **When** the user clicks it, **Then** the existing quality breakdown popover appears with dimension details.
6. **Given** a participant with pending telemetry for a metric, **When** the cell renders, **Then** it shows a pending state indicator instead of a bar.
7. **Given** a participant with unavailable telemetry for a metric, **When** the cell renders, **Then** it shows a dash or "N/A" without a bar.

---

### User Story 5 - Compliance Heatmap (Priority: P3)

The constitution compliance section displays as a colored heatmap grid with principles as rows and participants as columns. Cells are colored by status (green for pass, yellow for mixed, red for fail) with no text. Hovering shows assessment notes in a tooltip.

**Why this priority**: Visual pattern recognition is faster than reading status text — a heatmap lets users spot compliance issues instantly.

**Independent Test**: Can be tested with a comparison that has compliance data; verify cell colors match statuses and hover tooltips show notes.

**Acceptance Scenarios**:

1. **Given** a compliance row with a "pass" assessment for a participant, **When** the heatmap renders, **Then** that cell uses a green background color token.
2. **Given** a compliance row with a "mixed" assessment, **When** the heatmap renders, **Then** that cell uses a yellow background color token.
3. **Given** a compliance row with a "fail" assessment, **When** the heatmap renders, **Then** that cell uses a red background color token.
4. **Given** a compliance cell with notes, **When** the user hovers over the cell (desktop) or taps (mobile), **Then** a tooltip displays the assessment notes text.
5. **Given** a compliance row where a participant has no assessment, **When** the heatmap renders, **Then** that cell shows a neutral muted background with no tooltip.
6. **Given** a comparison with no compliance data (enrichment unavailable), **When** the dialog renders, **Then** the compliance section shows the appropriate unavailable state.

---

### User Story 6 - Decision Point Visual Cues (Priority: P3)

Decision point accordions display a colored verdict dot next to each title (green when verdict matches the winner, yellow for another participant, neutral when no verdict). The verdict summary is visible without expanding. The first accordion is open by default.

**Why this priority**: Visual cues on decision points reduce the need to expand every accordion to understand the verdict pattern.

**Independent Test**: Can be tested with a comparison containing decision points with various verdict states; verify dot colors and accordion behavior.

**Acceptance Scenarios**:

1. **Given** a decision point whose verdict matches the winner, **When** the accordion renders, **Then** a green dot appears to the left of the title.
2. **Given** a decision point whose verdict matches a non-winner participant, **When** the accordion renders, **Then** a yellow dot appears to the left of the title.
3. **Given** a decision point with no verdict (null verdictTicketId), **When** the accordion renders, **Then** a neutral/muted dot appears to the left of the title.
4. **Given** the decision points section renders, **When** the dialog opens, **Then** the first accordion is expanded by default and all others are collapsed.
5. **Given** an expanded decision point, **When** the user views the content, **Then** participant approaches display with ticket key pills/badges alongside the approach summary text.
6. **Given** any decision point accordion (expanded or collapsed), **When** the user views the trigger area, **Then** the verdict summary text is visible without expanding.

---

### Edge Cases

- What happens when a comparison has exactly 2 participants? The hero card shows the winner; the participant grid shows 1 non-winner card without layout issues.
- What happens when a comparison has 6 participants? The participant grid wraps responsively. The unified metrics table scrolls horizontally with a sticky first column.
- What happens when all enrichment data is pending? Stat cards show pending indicators. The metrics table shows pending states. The compliance heatmap shows pending state. Score gauges show an empty/zero state.
- What happens when all enrichment data is unavailable? Stat cards show "N/A" values. Micro-bars and inline bars are hidden. The compliance section shows the unavailable state.
- What happens when the winner's score is 0? The score gauge renders at 0% with the red color token. Stat pills still display values.
- What happens when some participants have metrics but others don't? The metrics table shows data for available participants and "N/A" for unavailable ones. Proportional bars only consider available values for max calculation.

## Requirements

### Functional Requirements

- **FR-001**: The dialog MUST display a hero card at the top containing the winning ticket key, recommendation summary, key differentiator tags, circular score gauge, generation date, and source ticket key.
- **FR-002**: The hero card MUST include an animated circular SVG score gauge that transitions from 0 to the winner's score percentage on initial mount, respecting `prefers-reduced-motion`.
- **FR-003**: The hero card MUST display three stat pills showing the winner's Cost, Duration, and Quality Score values.
- **FR-004**: The standalone metadata block (Generated / Source / Winner) MUST be removed — its content is absorbed into the hero card.
- **FR-005**: Non-winner participants MUST appear in a responsive horizontal card grid below the hero card, each showing rank, ticket key, title, workflow/agent/quality badges, rationale, and a mini SVG score ring.
- **FR-006**: Score rings (both hero gauge and mini rings) MUST be color-coded by threshold: green (>=85), blue (70-84), yellow (50-69), red (<50).
- **FR-007**: The dialog MUST display four stat cards (Cost, Duration, Quality Score, Files Changed) showing the winner's values, each with a micro-bar showing all participants' relative positions.
- **FR-008**: Implementation and Operational metrics MUST be merged into a single unified table with rows for Lines Changed, Files Changed, Test Files Changed, Total Tokens, Input Tokens, Output Tokens, Duration, Cost, and Job Count.
- **FR-009**: Each numeric cell in the unified metrics table MUST display a proportional inline bar (width = value / max value for that row), with the best value using primary color and others using muted color.
- **FR-010**: The unified metrics table MUST have a sticky first column for metric names to support horizontal scrolling with up to 6 participants.
- **FR-011**: The Quality Score cell MUST remain clickable with the existing breakdown popover.
- **FR-012**: The Constitution Compliance section MUST render as a colored heatmap grid (principles as rows, participants as columns) with green (pass), yellow (mixed), and red (fail) cell backgrounds.
- **FR-013**: Compliance heatmap cells MUST show no text; hovering (desktop) or tapping (mobile) MUST show assessment notes in a tooltip. Missing assessments MUST show a neutral muted background.
- **FR-014**: Decision point accordions MUST display a colored verdict dot to the left of each title: green when the verdict matches the winner, yellow for another participant, neutral when no verdict.
- **FR-015**: Decision point verdict summaries MUST be visible without expanding the accordion.
- **FR-016**: The first decision point accordion MUST be open by default; others collapsed.
- **FR-017**: Expanded decision point content MUST show participant approaches with ticket key pills/badges.
- **FR-018**: All three enrichment states (available, pending, unavailable) MUST be handled correctly across all sections — stat cards, metrics table, compliance heatmap, and score gauges.
- **FR-019**: The dialog layout MUST support 2 to 6 participants without breakage.
- **FR-020**: All colors MUST use Tailwind semantic tokens or CSS variable tokens — no hardcoded hex or rgb values.
- **FR-021**: The history sidebar, dialog shell, and loading/error/empty states MUST remain unchanged.
- **FR-022**: No API changes or database schema changes — this is a UI-only redesign using existing ComparisonDetail data.

### Key Entities

- **ComparisonDetail**: The root data object containing comparison metadata, participants, decision points, and compliance rows. No changes to its structure.
- **ComparisonParticipantDetail**: Each participant's data including ticket info, rank, score, telemetry (cost/duration/tokens), implementation metrics, and quality breakdown. No changes to its structure.
- **ComparisonDecisionPoint**: A structured evaluation with title, verdict, rationale, and participant approaches. Used to render accordion items with verdict dots.
- **ComparisonComplianceRow**: A principle-level row with per-participant status assessments (pass/mixed/fail) and notes. Used to render heatmap cells.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can identify the comparison winner within 1 second of the dialog opening (hero card with large ticket key and score gauge is the first visible element).
- **SC-002**: Users can determine relative participant performance without reading any text (score rings, stat micro-bars, and inline metric bars provide visual comparison).
- **SC-003**: Users can spot compliance issues across all participants in under 3 seconds (heatmap grid enables pattern recognition via color).
- **SC-004**: Users can understand decision point verdicts without expanding any accordion (verdict dots and visible summaries convey outcome at a glance).
- **SC-005**: The dialog renders correctly with any number of participants from 2 to 6 without layout overflow, clipping, or breakage.
- **SC-006**: All interactive elements (score gauge, tooltips, popovers, accordions) remain accessible with keyboard navigation and screen readers.
- **SC-007**: The visual redesign maintains full data parity — every data point visible in the current dialog remains accessible in the new design.
- **SC-008**: Page load performance does not regress — the redesigned dialog renders within the same time budget as the current implementation.

## Assumptions

- The existing ComparisonDetail data structure provides all necessary data for the redesigned UI. No new fields or API changes are needed.
- The circular SVG score gauge is a new component built from scratch (no existing gauge component in the codebase).
- The existing quality breakdown popover component can be reused without modification.
- The dialog width is sufficient to display heatmap columns for up to 6 participants; beyond 6 is out of scope.
- Color tokens for the score thresholds (green, blue, yellow, red) and compliance states (green, yellow, red) are available or can be derived from existing Tailwind semantic tokens without adding new CSS variables.
