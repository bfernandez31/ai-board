# Feature Specification: Comparisons Hub Page

**Feature Branch**: `AIB-358-comparisons-hub-page`
**Created**: 2026-03-27
**Status**: Draft
**Input**: User description: "Comparisons hub page with list, detail view, and launch from VERIFY"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Pagination strategy — use cursor-based pagination with "Load More" button instead of infinite scroll
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 3 / 0.6)
- **Fallback Triggered?**: No — CONSERVATIVE was the natural recommendation for netScore >= 0 at medium confidence
- **Trade-offs**:
  1. Pagination is more predictable and accessible; infinite scroll can cause issues with browser back navigation and screen readers
  2. Slightly more user effort (clicking "Load More") vs. automatic loading on scroll
- **Reviewer Notes**: If analytics later show users frequently have 50+ comparisons, consider adding infinite scroll as an enhancement

---

- **Decision**: Navigation placement — add "Comparisons" as a new sidebar navigation item alongside Board, Activity, Analytics
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 5 / 0.9) — sidebar navigation already exists and is the established pattern
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent with existing navigation patterns; no temporary workaround needed
  2. Adds one more item to the sidebar, but the icon rail pattern supports additional items well
- **Reviewer Notes**: Sidebar already has Board, Activity, Analytics, Settings — Comparisons fits naturally in the "views" group

---

- **Decision**: Detail view display — expand comparison dashboard inline on the comparisons page (not a separate route or modal)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 5 / 0.9) — explicitly stated in requirements
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Inline display avoids modal-in-modal issues and provides better reading experience for detailed comparison data
  2. Page may become long when a comparison is expanded; mitigated by collapsing the list or scrolling to the detail section
- **Reviewer Notes**: Ensure the inline detail view reuses existing ComparisonViewer sub-components without duplicating logic

---

- **Decision**: Comparison launch mechanism — reuse the existing workflow dispatch mechanism (same as @ai-board /compare) triggered from a selection UI
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 5 / 0.9) — requirements explicitly state reuse of existing mechanism
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent behavior whether comparison is launched from comment or from the hub page
  2. Users get a visual selection experience instead of typing ticket keys in a comment
- **Reviewer Notes**: Verify that the workflow dispatch path works identically when triggered from the UI vs. from a comment command

---

- **Decision**: Number of VERIFY-stage tickets required for comparison — minimum of 2 tickets must be selected
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 5 / 0.9) — comparison inherently requires at least 2 items
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Enforcing minimum 2 is the natural lower bound for meaningful comparison
  2. No upper limit enforced at the UI level; the comparison workflow handles any count
- **Reviewer Notes**: The "Compare" button should remain disabled until 2+ tickets are checked

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse All Project Comparisons (Priority: P1)

A project manager wants to review all past comparisons across a project to understand which implementations were recommended and why, without having to open each individual ticket.

**Why this priority**: This is the core value proposition of the hub page — surfacing all comparisons in one place. Without this, the page has no purpose.

**Independent Test**: Can be fully tested by navigating to the comparisons page and verifying the list renders with correct summary data for each comparison.

**Acceptance Scenarios**:

1. **Given** a project with 5 existing comparisons, **When** the user navigates to the Comparisons page from the sidebar, **Then** all 5 comparisons are listed in reverse chronological order showing winner ticket key/title, participants, overall score, recommendation summary, generation date, and key differentiator badges.
2. **Given** a project with no comparisons, **When** the user navigates to the Comparisons page, **Then** an empty state is displayed explaining that no comparisons exist yet and suggesting how to create one.
3. **Given** a project with 25+ comparisons, **When** the user views the list, **Then** the first page of results loads and a "Load More" button appears to fetch additional comparisons.

---

### User Story 2 - View Comparison Detail Inline (Priority: P1)

A tech lead wants to drill into a specific comparison to see the full dashboard — decision points, compliance heatmap, metrics, and participant details — directly on the comparisons page without opening a separate modal.

**Why this priority**: Viewing detail is equally critical to listing; the list is only useful if users can inspect results. Inline display is a key differentiator from the existing modal-based experience.

**Independent Test**: Can be tested by clicking on a comparison in the list and verifying the full dashboard (hero card, participant grid, stat cards, unified metrics, decision points, compliance heatmap) renders inline below or alongside the list.

**Acceptance Scenarios**:

1. **Given** the comparisons list is displayed, **When** the user clicks on a comparison entry, **Then** the full comparison dashboard expands inline showing the hero card, participant grid, stat cards, unified metrics, decision points, and compliance heatmap.
2. **Given** a comparison detail is expanded, **When** the user clicks on a different comparison in the list, **Then** the previous detail collapses and the newly selected comparison's detail expands.
3. **Given** a comparison detail is expanded, **When** the user clicks the same comparison entry again or a close/collapse control, **Then** the detail collapses back to the list-only view.

---

### User Story 3 - Launch New Comparison from Hub (Priority: P2)

A project manager wants to quickly compare tickets in the VERIFY stage without leaving the comparisons page or typing a comment command.

**Why this priority**: While valuable, this builds on top of the list/detail functionality and provides a convenience shortcut for an existing capability.

**Independent Test**: Can be tested by clicking "New Comparison," selecting 2+ VERIFY-stage tickets, confirming, and verifying that the comparison workflow is triggered.

**Acceptance Scenarios**:

1. **Given** the user is on the Comparisons page and there are 3 tickets in VERIFY stage, **When** the user clicks "New Comparison," **Then** a selection UI appears showing all 3 VERIFY-stage tickets with their ticket key, title, and quality score, each with a checkbox.
2. **Given** the selection UI is open with 2 tickets checked, **When** the user clicks "Compare," **Then** the comparison workflow is triggered and a pending/loading state is shown on the page.
3. **Given** the selection UI is open with only 1 ticket checked, **When** the user looks at the "Compare" button, **Then** the button is disabled with a tooltip indicating that at least 2 tickets must be selected.
4. **Given** no tickets are currently in VERIFY stage, **When** the user clicks "New Comparison," **Then** an empty state is displayed explaining that comparison requires tickets in the VERIFY stage.
5. **Given** a comparison has been launched and is pending, **When** the comparison completes, **Then** the pending state is replaced with the new comparison entry in the list.

---

### User Story 4 - Navigate to Comparisons via Sidebar (Priority: P2)

A user wants to access the Comparisons page from any view within a project using the existing sidebar navigation.

**Why this priority**: Navigation is essential for discoverability but depends on the page content being available first.

**Independent Test**: Can be tested by clicking the Comparisons icon in the sidebar from any project view and verifying navigation to the correct page.

**Acceptance Scenarios**:

1. **Given** the user is on the Board view of a project, **When** the user clicks the Comparisons icon in the sidebar, **Then** the browser navigates to `/projects/{projectId}/comparisons` and the Comparisons page loads.
2. **Given** the user is on the Comparisons page, **When** the user looks at the sidebar, **Then** the Comparisons icon is highlighted as the active view.

---

### User Story 5 - Responsive Layout (Priority: P3)

A user accesses the Comparisons page from a mobile device or narrow browser window and expects a usable layout.

**Why this priority**: Responsive design improves accessibility but is secondary to core functionality.

**Independent Test**: Can be tested by resizing the browser to mobile width and verifying the comparison list displays as cards and the detail view remains readable.

**Acceptance Scenarios**:

1. **Given** the user views the Comparisons page on a narrow viewport (< 768px), **When** the list renders, **Then** comparisons are displayed as stacked cards rather than a wide grid/table layout.
2. **Given** the user expands a comparison detail on a narrow viewport, **When** the dashboard renders, **Then** all sub-components (hero card, metrics, decision points, heatmap) stack vertically and remain readable.

### Edge Cases

- What happens when a comparison is launched but the workflow fails? The pending state should update to show an error with a retry option or guidance.
- What happens when a ticket moves out of VERIFY stage while the user is in the selection UI? The selection UI should reflect current state when the "Compare" button is clicked; stale selections should be revalidated.
- What happens when the user has no access to the project? Standard authorization patterns apply — the page returns an appropriate access-denied response.
- What happens when a comparison references tickets that have since been deleted? The comparison list entry should still render with available data; missing ticket data should show a fallback placeholder.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated Comparisons page at the project level accessible via sidebar navigation
- **FR-002**: System MUST list all comparisons for a project in reverse chronological order, displaying winner ticket key/title, participant ticket keys, overall score, recommendation summary (1-2 lines), generation date, and key differentiator badges
- **FR-003**: System MUST support paginated loading of comparisons with a "Load More" mechanism for projects with many comparisons
- **FR-004**: Users MUST be able to click on a comparison entry to expand the full comparison dashboard inline on the page
- **FR-005**: The inline comparison dashboard MUST reuse existing comparison sub-components: hero card, participant grid, stat cards, unified metrics, decision points, and compliance heatmap
- **FR-006**: System MUST provide a "New Comparison" button that opens a ticket selection interface
- **FR-007**: The ticket selection interface MUST show all tickets currently in VERIFY stage with their ticket key, title, and quality score
- **FR-008**: Users MUST be able to select 2 or more VERIFY-stage tickets via checkboxes and trigger the comparison workflow
- **FR-009**: The "Compare" action MUST be disabled until at least 2 tickets are selected
- **FR-010**: System MUST display a pending/loading state after a comparison is launched until results are available
- **FR-011**: System MUST display an appropriate empty state when no comparisons exist for the project
- **FR-012**: System MUST display an appropriate empty state in the selection UI when no tickets are in VERIFY stage
- **FR-013**: The existing "Compare (N)" button in the ticket detail modal MUST continue to work independently and unchanged
- **FR-014**: The page layout MUST be responsive — card-based layout on mobile, grid/table layout on desktop

### Key Entities

- **Comparison**: A comparison record that captures the analysis of 2+ ticket implementations, including a winner, participants with scores, decision points, compliance assessments, and metrics. Already exists as `ComparisonRecord` in the data model.
- **Comparison Participant**: A ticket that was part of a comparison, with its rank, score, metrics snapshot, and compliance assessments. Already exists as `ComparisonParticipant`.
- **VERIFY-stage Ticket**: A ticket that has reached the verification stage and is eligible for comparison. Used for the "New Comparison" selection UI.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can access all project comparisons from the sidebar in under 2 clicks from any project view
- **SC-002**: The comparisons list page loads and displays the first set of results within 2 seconds
- **SC-003**: Users can view the full comparison dashboard for any listed comparison with a single click
- **SC-004**: Users can launch a new comparison from the hub page by selecting tickets and confirming, completing the selection in under 30 seconds
- **SC-005**: 100% of existing comparison sub-components are reused without duplication of rendering logic
- **SC-006**: The page is fully usable on viewports from 375px to 1920px wide
- **SC-007**: All empty states clearly communicate what action the user should take next
- **SC-008**: The existing ticket detail modal "Compare" button remains fully functional with no regression

## Assumptions

- The existing project-wide comparisons API endpoint provides sufficient data for the list view and supports pagination via limit/offset parameters.
- The existing comparison workflow dispatch mechanism can be triggered programmatically from the frontend using the same path as the @ai-board /compare command.
- The sidebar navigation component supports adding new items without structural changes.
- Quality scores are available on tickets in the VERIFY stage for display in the selection UI.
