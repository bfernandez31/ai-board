# Feature Specification: Comparisons Hub Page With Project List, Inline Detail, and VERIFY Launch

**Feature Branch**: `AIB-362-comparisons-hub-page`  
**Created**: 2026-03-27  
**Status**: Draft  
**Input**: User description: "Comparisons hub page with list, detail view, and launch from VERIFY"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Use a conservative default for unresolved UX details because the ticket is a general user-facing workflow request with no strong speed or internal-only signals.
- **Policy Applied**: AUTO
- **Confidence**: Low (score: +1 from neutral user-facing feature context; confidence 0.3)
- **Fallback Triggered?**: Yes — AUTO fell back to CONSERVATIVE because confidence was below 0.5.
- **Trade-offs**:
  1. This favors predictable browsing, clear empty states, and explicit permissions over lighter but less-defined interactions.
  2. The feature scope stays aligned with existing comparison behavior, which may reduce experimentation in the first release.
- **Reviewer Notes**: Confirm that the project-level navigation entry should ship with the first release even if broader navigation improvements are still in progress.

- **Decision**: Use page-by-page loading for large comparison histories rather than open-ended scrolling.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (chosen to preserve predictable navigation, sharable state, and clear loading boundaries)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Pagination makes large histories easier to scan and revisit, but adds one extra interaction compared with continuous scrolling.
  2. This reduces the risk of disorienting jumps when users switch between list and detail views.
- **Reviewer Notes**: Validate that page-based navigation matches product expectations for projects with heavy comparison usage.

- **Decision**: Show all current VERIFY-stage tickets as selectable candidates, including tickets whose quality score is unavailable, and block submission until at least two tickets are selected.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (supports completeness and avoids hiding valid candidates because of missing enrichment data)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users can compare all eligible work without waiting for every quality score to be present.
  2. Some rows may show a missing or unavailable score state, which is less polished but more accurate.
- **Reviewer Notes**: Confirm whether product wants unavailable quality scores displayed as blank, pending, or unavailable text in the final experience.

- **Decision**: Keep the existing ticket-level comparison entry point unchanged and treat the new page as an additional project-wide discovery and launch surface.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (explicitly required in the request)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. This avoids disruption for current users who launch comparisons from ticket detail.
  2. The product will temporarily support two entry points that must stay behaviorally consistent.
- **Reviewer Notes**: Planning should include checks that both entry points continue to show the same completed comparison records.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse project comparisons (Priority: P1)

As a project member, I can open a dedicated comparisons area for a project and review all saved comparisons in reverse chronological order so I no longer need to open individual tickets just to discover past comparison results.

**Why this priority**: Project-wide discovery is the primary gap identified in the problem statement. Without it, comparisons remain hard to find and reuse.

**Independent Test**: Can be fully tested by opening the project comparisons page for a project with saved comparisons and confirming the list shows the expected summary details in newest-first order.

**Acceptance Scenarios**:

1. **Given** a project with one or more saved comparisons, **When** a project member opens the comparisons page, **Then** the page shows comparisons in reverse chronological order with winner, participants, summary, generation date, and differentiator highlights.
2. **Given** a project with more comparisons than fit in one page, **When** a project member moves between pages, **Then** the page presents the next set of comparison summaries without losing the current sort order.
3. **Given** a project with no saved comparisons, **When** a project member opens the comparisons page, **Then** the page shows an empty state that explains there are no project comparisons yet and points users toward creating one.

---

### User Story 2 - Inspect a comparison inline (Priority: P2)

As a project member, I can select a comparison from the project list and review its full dashboard inline on the same page so I can compare alternatives without navigating through layered modals.

**Why this priority**: Discoverability only creates value if users can immediately inspect the saved analysis in a readable workspace.

**Independent Test**: Can be fully tested by selecting a saved comparison from the list and verifying the detailed dashboard appears inline while the list remains available for switching to another comparison.

**Acceptance Scenarios**:

1. **Given** a project comparison list with at least one item, **When** a project member selects a comparison, **Then** the page displays the full comparison dashboard inline on the same page.
2. **Given** the inline dashboard is open, **When** the project member selects a different comparison from the list, **Then** the detail area updates to the newly selected comparison without opening a modal.
3. **Given** a comparison record becomes unavailable or cannot be loaded, **When** the project member selects it, **Then** the page shows a clear error state without hiding the rest of the comparison list.

---

### User Story 3 - Launch a new comparison from VERIFY tickets (Priority: P3)

As a project member, I can start a new comparison from the dedicated page by choosing eligible VERIFY-stage tickets so I do not need to remember or type a comment command.

**Why this priority**: This removes the current command-only launch friction while keeping the workflow focused on tickets that are ready for evaluation.

**Independent Test**: Can be fully tested by opening the new comparison flow, selecting two or more VERIFY-stage tickets, confirming the request, and observing a pending state followed by the finished comparison appearing in the page history.

**Acceptance Scenarios**:

1. **Given** a project has two or more tickets in VERIFY, **When** a project member opens the new comparison flow, **Then** the page shows those eligible tickets with ticket key, title, and current quality score state.
2. **Given** fewer than two VERIFY-stage tickets are selected, **When** the project member attempts to start a comparison, **Then** the action is blocked and the page explains that at least two VERIFY-stage tickets are required.
3. **Given** a comparison has just been launched from the page, **When** the workflow is still running, **Then** the page shows a pending state for that request until a completed result can be viewed.
4. **Given** a project has no tickets in VERIFY, **When** a project member opens the new comparison flow, **Then** the page shows an empty state explaining that comparisons can only be started from VERIFY-stage tickets.

### Edge Cases

- What happens when a project member opens the comparisons page for a project that has saved comparisons but no current VERIFY-stage tickets? The page still lists historical comparisons and separately explains that no new comparison can be launched right now.
- How does the system handle a comparison whose saved summary fields are partially missing? The page shows all available summary data, preserves access to the record, and uses safe fallback labels instead of hiding the comparison.
- What happens when a comparison finishes after the page was opened? The page refreshes its visible status so the pending request can transition into a selectable saved comparison without requiring the user to leave the page.
- How does the system handle very long ticket titles or many participants? The list keeps each comparison scannable by preserving key identifiers and shortening overflow content without dropping the winner, participant keys, or summary meaning.
- What happens when a user can access the project but not a specific historical source ticket anymore? The saved comparison remains visible at the project level as long as the user still has access to the project and the comparison record itself.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a dedicated project-level comparisons page at `/projects/{projectId}/comparisons` for users who have access to that project.
- **FR-002**: The system MUST expose the comparisons page from project navigation so project members can reach it without opening a ticket first.
- **FR-003**: The comparisons page MUST list all saved comparisons for the project in reverse chronological order.
- **FR-004**: Each comparison summary in the list MUST display the winning ticket key, winning ticket title, participant ticket keys, generation date, a concise recommendation summary, and the key differentiators captured for that comparison.
- **FR-005**: The comparisons page MUST support paginated browsing when the project has more saved comparisons than fit in a single page.
- **FR-006**: Selecting a comparison from the list MUST display that comparison’s full dashboard inline on the page rather than inside a nested modal.
- **FR-007**: The inline detail view MUST include the same decision content already available in saved comparison dashboards, including the winning recommendation, participant breakdown, decision points, compliance findings, and unified metrics.
- **FR-008**: The system MUST allow project members to start a new comparison from the comparisons page using a dedicated action.
- **FR-009**: The new comparison flow MUST show all tickets currently in VERIFY stage for the project as eligible candidates.
- **FR-010**: Each eligible ticket in the new comparison flow MUST show its ticket key, title, and current quality score state so users can make an informed selection.
- **FR-011**: The system MUST require selection of at least two VERIFY-stage tickets before a new comparison can be submitted.
- **FR-012**: Submitting a new comparison from the page MUST trigger the same comparison workflow used by the existing comment-based comparison command.
- **FR-013**: After a new comparison is submitted, the comparisons page MUST show a pending state until the comparison is complete or fails.
- **FR-014**: When a newly launched comparison completes, the system MUST make the finished comparison visible from the project comparisons page without requiring users to discover it through a ticket modal.
- **FR-015**: If the project has no saved comparisons, the comparisons page MUST show an empty state explaining that no comparisons exist yet.
- **FR-016**: If the project has no VERIFY-stage tickets, the new comparison flow MUST show an empty state explaining that only VERIFY-stage tickets are eligible for comparison.
- **FR-017**: The existing comparison entry point from the ticket detail modal MUST continue to work independently and MUST continue to surface comparison history for that ticket.
- **FR-018**: The comparisons page MUST remain usable on mobile and desktop, presenting summaries and detail content in layouts that preserve readability and selection clarity at both sizes.
- **FR-019**: The comparisons page MUST show clear loading, empty, and error states for the comparison list, inline detail view, and comparison launch flow.
- **FR-020**: The comparisons page MUST only expose project comparison data and comparison launch actions to users who are authorized to access that project.

### Key Entities *(include if feature involves data)*

- **Project Comparison Summary**: A saved project-level record of a completed comparison, including when it was generated, which tickets participated, which ticket won, a short recommendation summary, and key differentiators used for list browsing.
- **Project Comparison Detail**: The complete saved comparison dashboard content for one comparison, including overall recommendation, ranked participants, decision points, compliance findings, and aggregate metrics.
- **VERIFY Comparison Candidate**: A project ticket currently in VERIFY stage that can be selected for a new comparison, including its ticket key, title, and current quality score state.
- **Comparison Launch Request**: A user-initiated request to compare two or more eligible VERIFY-stage tickets, including its pending, completed, or failed state as shown on the comparisons page.

## Dependencies & Assumptions

- Project navigation continues to provide a stable entry point for project-level views, and the comparisons page is added as one of those reachable destinations.
- Saved comparison records already contain enough structured summary and detail information to support both list browsing and inline review without changing the meaning of past comparisons.
- Comparison launch eligibility remains limited to tickets currently in VERIFY stage for the first release of this page.
- Users who can access a project are allowed to browse that project’s saved comparisons and start eligible comparisons within that project.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing or product review, project members can reach project-wide comparison history from project navigation in one navigation step after entering the project workspace.
- **SC-002**: For projects with saved comparisons, 95% of reviewed comparison records appear in newest-first order with the required summary fields present and readable in the list view.
- **SC-003**: In validation testing, 100% of successful comparison selections open the full comparison dashboard inline on the page without requiring a nested modal workflow.
- **SC-004**: In validation testing, 100% of eligible launch attempts with two or more VERIFY-stage tickets enter a visible pending state and resolve to a completed or failed outcome that is surfaced on the comparisons page.
- **SC-005**: In responsive review, the primary comparison browsing and launch tasks can be completed on both mobile and desktop without loss of required summary information or selection controls.
