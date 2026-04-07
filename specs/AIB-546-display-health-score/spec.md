# Feature Specification: Display Health Score Heart Indicator on Project Cards

**Feature Branch**: `AIB-546-display-health-score`
**Created**: 2026-04-07
**Status**: Draft
**Input**: User description: "Display health score heart indicator on project cards"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Heart icon implementation approach — use an SVG heart shape with the numeric score rendered as text inside, rather than an emoji or icon font glyph
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 3) — well-specified UI feature with no sensitive/compliance signals
- **Fallback Triggered?**: No — AUTO confidence >= 0.5, CONSERVATIVE selected as netScore >= 0
- **Trade-offs**:
  1. SVG approach provides precise control over sizing, color, and glow effects at the cost of slightly more markup
  2. Consistent rendering across all browsers and platforms
- **Reviewer Notes**: Verify that the SVG heart shape meets visual design expectations; consider whether the existing lucide-react Heart icon can serve as the base shape

---

- **Decision**: Popover trigger behavior — hover-only activation (no click handler on the heart), so the heart does not interfere with the project card's click-to-navigate behavior
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High — explicitly stated in the ticket description ("Informational only — no navigation or action buttons, no click behavior")
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Hover-only means mobile/touch users cannot access the popover without a long-press or similar gesture
  2. Keeps the interaction model simple and non-disruptive to existing card navigation
- **Reviewer Notes**: Consider whether touch devices need an alternative interaction (e.g., long-press) or if the health page remains the primary detailed view for mobile users

---

- **Decision**: Data loading strategy — extend the existing project list database query to include the HealthScore relation via Prisma eager loading, rather than creating a separate API endpoint or per-card fetching
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High — explicitly stated in the ticket ("No new API endpoint required — extend the existing project list response")
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Slightly larger project list response payload (adds ~7 nullable integer fields per project)
  2. Eliminates N+1 query problem and avoids per-card loading states
- **Reviewer Notes**: Ensure the additional HealthScore join does not meaningfully increase project list query time for users with many projects

---

- **Decision**: "No data" state visual treatment — greyed-out heart using muted/disabled color tokens with an em-dash inside instead of a zero score
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High — explicitly stated in the ticket description
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Clear visual distinction between "never scanned" and "scanned with score 0"
  2. Users cannot confuse absence of data with a poor score
- **Reviewer Notes**: Ensure the greyed-out state is visually distinct enough from the colored states at small sizes

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Health Score at a Glance on Project Cards (Priority: P1)

A user navigates to their project dashboard and immediately sees each project's overall health status via a colored heart indicator in the top-right corner of every project card. Projects that have been scanned display a numeric score (0-100) inside a color-coded heart. Projects that have never been scanned show a greyed-out heart with a dash inside. The user can quickly assess which projects need attention without clicking into any individual project.

**Why this priority**: This is the core value proposition — enabling at-a-glance health awareness across all projects from the dashboard.

**Independent Test**: Can be fully tested by navigating to the projects page and verifying that each card displays the correct heart color, score, and glow effect based on the project's stored health data.

**Acceptance Scenarios**:

1. **Given** a project with a global health score of 95, **When** the user views the project dashboard, **Then** the project card shows a green heart with "95" inside and a green glow effect
2. **Given** a project with a global health score of 75, **When** the user views the project dashboard, **Then** the project card shows a blue heart with "75" inside and a blue glow effect
3. **Given** a project with a global health score of 55, **When** the user views the project dashboard, **Then** the project card shows a yellow heart with "55" inside and a yellow glow effect
4. **Given** a project with a global health score of 30, **When** the user views the project dashboard, **Then** the project card shows a red heart with "30" inside and a red glow effect
5. **Given** a project that has never been scanned (no health score data), **When** the user views the project dashboard, **Then** the project card shows a greyed-out heart with a dash inside and no glow effect

---

### User Story 2 - View Health Sub-Scores via Hover Popover (Priority: P2)

A user hovers over a project card's heart indicator to see a compact breakdown of all 6 health sub-scores (Security, Compliance, Tests, Spec Sync, Quality Gate, Review Quality). Each sub-score displays its name, numeric value, and color based on the same score thresholds. Sub-scores that have not been scanned display a dash. The popover is informational only — it does not provide navigation or action buttons.

**Why this priority**: Provides deeper insight without leaving the dashboard, but depends on the heart indicator (P1) being in place first.

**Independent Test**: Can be tested by hovering over a heart indicator and verifying the popover displays the correct sub-score names, values, and colors.

**Acceptance Scenarios**:

1. **Given** a project with health sub-scores (Security: 92, Compliance: 78, Tests: null, Spec Sync: 65, Quality Gate: 88, Review Quality: 45), **When** the user hovers over the heart indicator, **Then** a popover appears showing all 6 sub-scores with appropriate colors (green, blue, dash, yellow, blue, red)
2. **Given** the popover is visible, **When** the user moves the mouse away from the heart, **Then** the popover dismisses
3. **Given** the popover is visible, **When** the user clicks elsewhere on the project card, **Then** the card navigates to the project board as usual (popover does not intercept clicks)
4. **Given** a project that has never been scanned, **When** the user hovers over the greyed-out heart, **Then** the popover shows all 6 sub-scores as dashes with muted styling

---

### User Story 3 - Health Data Loads Efficiently with Project List (Priority: P3)

When the project dashboard loads, health score data for all projects is included in the initial data fetch alongside other project information. There are no additional network requests per project card. The heart indicators render immediately with the rest of the card content.

**Why this priority**: Performance and data loading are foundational but less visible to users than the visual indicator itself.

**Independent Test**: Can be verified by monitoring network requests during dashboard load and confirming only one project list request includes health data for all projects.

**Acceptance Scenarios**:

1. **Given** a user with 10 projects, **When** the dashboard loads, **Then** only one network request fetches all project data including health scores (no per-card health requests)
2. **Given** the project list data has loaded, **When** project cards render, **Then** heart indicators appear without additional loading states or skeleton placeholders

---

### Edge Cases

- What happens when a project has a global score of exactly 0? Display a red heart with "0" inside (not the no-data state)
- What happens when a project has some sub-scores but not all? Display the global score (average of available sub-scores) in the heart; popover shows dashes for missing individual sub-scores
- What happens when the user has many projects (20+)? Hearts render as part of the card grid; no additional performance impact since data is eager-loaded
- What happens on narrow mobile screens? Heart remains positioned in the top-right corner of the card and does not overlap other card content; size may scale slightly but remains legible
- What happens if the heart is near the edge of the viewport? Popover repositions automatically (standard popover collision behavior) to remain fully visible

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each project card on the dashboard MUST display a heart-shaped health indicator in the top-right corner
- **FR-002**: The heart indicator MUST display the project's global health score (0-100) as a number inside the heart shape
- **FR-003**: The heart color MUST match the established score thresholds: green (90-100), blue (70-89), yellow (50-69), red (0-49)
- **FR-004**: The heart MUST have a subtle colored drop-shadow (glow effect) that matches its threshold color
- **FR-005**: When a project has no health score data (never scanned), the heart MUST appear greyed-out with a dash displayed inside
- **FR-006**: Hovering over the heart MUST display a popover showing all 6 sub-scores: Security, Compliance, Tests, Spec Sync, Quality Gate, and Review Quality
- **FR-007**: Each sub-score in the popover MUST display its name, numeric value (or dash if null), and color based on the same score thresholds
- **FR-008**: The popover MUST be informational only — no links, buttons, or navigation actions
- **FR-009**: The heart indicator and popover MUST NOT interfere with the existing project card click behavior (navigation to the project board)
- **FR-010**: Health score data MUST be loaded alongside project data in the existing project list query (eager loading via the project-to-health-score relationship)
- **FR-011**: The heart indicator MUST be visible and properly positioned on all screen sizes (mobile, tablet, desktop)
- **FR-012**: The heart indicator MUST NOT add a new navigation target — clicking the heart MUST NOT trigger any navigation

### Key Entities

- **HealthScore**: Stores the global aggregate score and 6 individual sub-scores per project. One-to-one relationship with Project. All scores are nullable integers (0-100), where null indicates the module has never been scanned.
- **Project**: Extended to include health score data in the project list response. No schema changes needed — only the query selection is expanded.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify the health status of any project within 2 seconds of viewing the dashboard, without clicking into individual projects
- **SC-002**: All 4 score threshold colors (green, blue, yellow, red) and the no-data state are visually distinguishable at the heart indicator's display size
- **SC-003**: The hover popover displays all 6 sub-scores within 200ms of hovering, with no visible loading delay
- **SC-004**: Dashboard page load time does not increase by more than 10% after adding health score data to the project list query
- **SC-005**: 100% of project cards display the correct health indicator state (colored score or greyed-out no-data) matching the stored health score data
- **SC-006**: The heart indicator and popover remain fully functional and properly positioned across viewport widths from 320px to 2560px

## Assumptions

- The existing HealthScore data model and score calculation logic remain unchanged
- The existing score threshold definitions (90/70/50 breakpoints) and color mappings are reused as-is
- The existing popover component is suitable for the hover popover behavior
- The project list database query can efficiently include the HealthScore relation without significant performance impact
- Touch device users can access detailed health information via the dedicated health page since hover popovers are not natively available on touch
