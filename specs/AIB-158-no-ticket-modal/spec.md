# Feature Specification: Fix Ticket Modal Display from URL Navigation

**Feature Branch**: `AIB-158-no-ticket-modal`
**Created**: 2026-01-07
**Status**: Draft
**Input**: User description: "No ticket modal show: modal ticket not working anymore from url /search"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Interpret "url /search" as the search functionality in the header rather than a dedicated `/search` page route
  - **Policy Applied**: AUTO
  - **Confidence**: 0.6 (Medium) - "search" keyword is neutral, context suggests existing feature behavior
  - **Fallback Triggered?**: No
  - **Trade-offs**:
    1. Scope limited to existing search behavior; won't create a new dedicated search page
    2. Faster resolution by fixing existing functionality vs building new infrastructure
  - **Reviewer Notes**: Verify with user if they expect a dedicated `/search` page; current implementation uses header search

- **Decision**: Fix the `/ticket/[key]` redirect to include `modal=open` parameter
  - **Policy Applied**: AUTO (detected internal tool context)
  - **Confidence**: 0.9 (High) - Clear bug pattern where redirect doesn't include required URL parameter
  - **Fallback Triggered?**: No
  - **Trade-offs**:
    1. Simple one-line fix with minimal risk
    2. Consistent with existing URL parameter contract for modal opening
  - **Reviewer Notes**: This is a regression - compare with how search component properly includes `modal=open`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Ticket Modal via Header Search (Priority: P1)

A user searches for a ticket using the search bar in the application header. When they click on a search result, the ticket modal opens displaying the ticket's details without requiring a full page reload.

**Why this priority**: Primary search-to-modal flow that users depend on for quick ticket access. Most common user journey for finding and viewing tickets.

**Independent Test**: Can be fully tested by typing a ticket key or title in the header search, clicking a result, and verifying the modal opens with correct ticket data.

**Acceptance Scenarios**:

1. **Given** a user is on any project page with the header search visible, **When** they search for an existing ticket and click on the result, **Then** the ticket modal opens with the correct ticket details
2. **Given** a user clicks a search result for a CLOSED ticket not on the board, **When** the modal opens, **Then** the ticket data is fetched and displayed correctly (AIB-156 behavior preserved)
3. **Given** a user opens the modal via search, **When** they close the modal, **Then** the URL parameters are cleaned up and the user remains on the same page

---

### User Story 2 - Open Ticket Modal via Direct URL (Priority: P1)

A user navigates directly to a ticket URL like `/ticket/ABC-123` (e.g., from a shared link or notification). The system redirects them to the project board with the ticket modal automatically opened.

**Why this priority**: Critical for shareable links and cross-referencing tickets. Users frequently share ticket URLs via Slack, email, or other tools.

**Independent Test**: Can be tested by navigating directly to `/ticket/ABC-123` and verifying the redirect lands on the board with the modal already open.

**Acceptance Scenarios**:

1. **Given** a user navigates to `/ticket/ABC-123` directly, **When** the page loads, **Then** they are redirected to `/projects/{projectId}/board?ticket=ABC-123&modal=open` and the modal opens automatically
2. **Given** a user navigates to `/ticket/ABC-123` for a CLOSED ticket, **When** the redirect occurs, **Then** the modal opens and displays the closed ticket correctly
3. **Given** an unauthenticated user navigates to a ticket URL, **When** the page loads, **Then** they are redirected to sign in first

---

### User Story 3 - Open Ticket Modal via Notification Link (Priority: P2)

A user clicks on a notification that mentions a ticket. The notification navigates them to the ticket modal with the conversation tab open.

**Why this priority**: Supports real-time collaboration by allowing users to quickly respond to mentions and comments.

**Independent Test**: Can be tested by clicking a notification item and verifying the modal opens on the correct tab.

**Acceptance Scenarios**:

1. **Given** a user clicks a notification for a ticket comment, **When** the navigation occurs, **Then** the ticket modal opens with the conversation tab active
2. **Given** a user clicks a notification for a closed ticket, **When** the navigation occurs, **Then** the ticket data is fetched and modal displays correctly

---

### Edge Cases

- What happens when the ticket key in the URL doesn't exist? → Show "Ticket not found" error page
- What happens when the user doesn't have access to the ticket's project? → Show "Access denied" error page
- What happens when the search returns no results? → Show empty state in dropdown, no modal action
- What happens on mobile (search hidden on mobile)? → User can still access tickets via direct URL

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST include both `ticket` and `modal=open` URL parameters when redirecting from `/ticket/[key]` page
- **FR-002**: System MUST open the ticket modal when URL contains `?ticket=ABC-123&modal=open` parameters
- **FR-003**: System MUST support opening modals for both active board tickets AND closed tickets (via API fetch)
- **FR-004**: System MUST clean up URL parameters after modal opens to prevent re-opening on page refresh
- **FR-005**: Search component MUST continue to pass both `ticket` and `modal=open` parameters when selecting a result

### Key Entities *(include if feature involves data)*

- **Ticket**: The ticket entity identified by ticketKey (e.g., "ABC-123")
- **URL Parameters**: Query parameters `ticket` (ticket key) and `modal` (state: "open")

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of ticket modal navigation paths (search, direct URL, notifications) successfully open the modal
- **SC-002**: Users can access ticket modals via direct URL `/ticket/ABC-123` without any additional clicks
- **SC-003**: Closed tickets accessible via search or direct URL display correctly in modal
- **SC-004**: URL parameter cleanup occurs within 100ms of modal opening to prevent duplicate opens
