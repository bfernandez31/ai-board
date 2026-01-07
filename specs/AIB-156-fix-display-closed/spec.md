# Feature Specification: Fix Display Closed Ticket Modal

**Feature Branch**: `AIB-156-fix-display-closed`
**Created**: 2026-01-07
**Status**: Draft
**Input**: User description: "When we search for a closed ticket, it is present in the dropdown, but when we click on it, the modal does not display. I think it's because the ticket is not present in the kanban. I think a call to the backend should be made to get the ticket details before showing the modal, right? Fix the issue and add some test"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Backend API fetch strategy for tickets not in kanban state
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: +4) - signals: data integrity requirement (+3), user interaction reliability (+1)
- **Fallback Triggered?**: No - clear consensus that fetching from backend ensures data consistency
- **Trade-offs**:
  1. Slight increase in API calls when opening closed tickets from search - minimal impact as this is an edge case
  2. Guarantees data freshness and eliminates race conditions between search and board state
- **Reviewer Notes**: Verify that the fetch-on-demand approach integrates smoothly with existing TanStack Query caching strategy. Ensure error states are handled gracefully.

---

- **Decision**: Test coverage approach - combination of integration and unit tests
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: +3) - testing requirement explicitly stated (+3)
- **Fallback Triggered?**: No - testing requirements are explicit in project guidelines
- **Trade-offs**:
  1. Integration tests ensure the full flow works correctly but take longer to run
  2. Component tests with RTL provide faster feedback for UI behavior
- **Reviewer Notes**: Per CLAUDE.md testing guidelines, prefer Vitest integration tests for API behavior and RTL component tests for user interactions. E2E only if browser-specific behavior is required.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Closed Ticket from Search (Priority: P1)

A user searches for a ticket that has been closed (moved to CLOSED stage). The ticket appears in the search dropdown with a "Closed" badge. When the user clicks on the search result, the ticket detail modal opens and displays the full ticket information in read-only mode.

**Why this priority**: This is the core bug being fixed. Users need to access historical ticket information after tickets are closed for reference, auditing, or follow-up work.

**Independent Test**: Can be fully tested by searching for a closed ticket and clicking on it - the modal should display with all ticket details visible.

**Acceptance Scenarios**:

1. **Given** a user has access to a project with at least one closed ticket, **When** they search for the closed ticket by title or key, **Then** the ticket appears in the search dropdown with a "Closed" badge indicating its status
2. **Given** a closed ticket appears in search results, **When** the user clicks on the search result, **Then** the ticket detail modal opens and displays the ticket information
3. **Given** a closed ticket modal is open, **When** the user views the modal, **Then** the ticket displays in read-only mode (comments disabled, stage transitions disabled)

---

### User Story 2 - Direct URL Access to Closed Ticket (Priority: P2)

A user navigates directly to a URL containing a closed ticket's key (e.g., shared link, bookmark). The system fetches the ticket from the backend and displays it in the modal, even if it's not present in the current kanban view.

**Why this priority**: Supports collaboration and external references to tickets. Users may share links to tickets that later get closed.

**Independent Test**: Can be tested by navigating directly to a URL with `?ticket=AIB-123&modal=open` where AIB-123 is a closed ticket.

**Acceptance Scenarios**:

1. **Given** a user navigates to a board URL with a closed ticket key in the query parameters, **When** the page loads, **Then** the ticket detail modal opens with the closed ticket's information
2. **Given** a user has a bookmarked URL to a ticket that was later closed, **When** they visit the bookmark, **Then** they can still view the ticket in read-only mode

---

### User Story 3 - Error Handling for Non-Existent Tickets (Priority: P3)

A user attempts to access a ticket that doesn't exist (deleted or invalid key). The system gracefully handles this by not opening the modal and optionally notifying the user.

**Why this priority**: Defensive programming to handle edge cases and prevent confusing behavior.

**Independent Test**: Can be tested by navigating to a URL with a non-existent ticket key.

**Acceptance Scenarios**:

1. **Given** a user searches for a ticket and the search returns no results, **When** viewing the search dropdown, **Then** an appropriate "no results" message is displayed
2. **Given** a user navigates to a URL with a non-existent ticket key, **When** the page attempts to open the modal, **Then** the modal does not open and no error is thrown

### Edge Cases

- What happens when a ticket is closed while a user has it open in the modal? The modal should remain open with current data until manually closed.
- How does the system handle network failures when fetching ticket details? Should show loading state, then handle error gracefully without breaking the board.
- What if the user doesn't have permission to view the ticket? Return appropriate authorization error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display closed tickets in search results with a visual indicator (badge/styling) showing their closed status
- **FR-002**: System MUST open the ticket detail modal when a user clicks on a closed ticket from search results
- **FR-003**: System MUST fetch ticket details from the backend when the ticket is not present in the kanban board state
- **FR-004**: System MUST display closed tickets in read-only mode (consistent with existing closed ticket behavior)
- **FR-005**: System MUST handle the case where a ticket key in the URL does not exist (no modal, no error thrown)
- **FR-006**: System MUST integrate the fix with existing caching to avoid unnecessary duplicate fetches

### Key Entities *(include if feature involves data)*

- **Ticket**: The primary entity being displayed. Key attributes: id, ticketKey, title, description, stage (including CLOSED), version
- **Search Result**: Lightweight representation returned by search API containing ticketKey, title, stage for display purposes

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully view closed tickets from search results 100% of the time (no modal display failures)
- **SC-002**: Time to display closed ticket modal is under 2 seconds on standard network conditions
- **SC-003**: All existing ticket modal functionality continues to work for non-closed tickets (no regression)
- **SC-004**: Test coverage includes integration tests for the ticket fetch flow and component tests for modal opening behavior
