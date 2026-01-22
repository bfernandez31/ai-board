# Feature Specification: Project Activity Feed

**Feature Branch**: `AIB-181-copy-of-project`
**Created**: 2026-01-22
**Status**: Draft
**Input**: User description: "Project Activity Feed - unified timeline of project events"

## Auto-Resolved Decisions

- **Decision**: Polling interval for activity updates
- **Policy Applied**: AUTO (resolved to CONSERVATIVE due to user-facing context)
- **Confidence**: Medium (score: +3, no conflicting signals)
- **Fallback Triggered?**: No - clear user-facing context signals
- **Trade-offs**:
  1. 15-second polling matches existing notification pattern, ensuring consistent UX
  2. Slight increase in API calls vs longer intervals, but acceptable for real-time feel
- **Reviewer Notes**: Verify 15-second interval doesn't create performance issues with large activity volumes

---

- **Decision**: Activity history retention period (30 days)
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: Medium (score: +3)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. 30-day limit keeps queries performant and data manageable
  2. Users cannot view historical activity beyond 30 days - acceptable for status tracking use case
- **Reviewer Notes**: Consider if audit/compliance requirements need longer retention in future

---

- **Decision**: Event aggregation from existing data (no new table)
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (explicitly stated in requirements)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Simpler data model, no schema migration required
  2. Query complexity increases to join multiple tables in unified timeline
- **Reviewer Notes**: Monitor query performance; consider denormalized activity table if performance degrades

---

- **Decision**: Ticket reference click behavior (opens modal on board)
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: Medium (score: +3)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Maintains context - user stays on activity page with modal overlay
  2. Requires navigation utility to handle cross-page modal opening
- **Reviewer Notes**: Verify modal opens correctly when navigating from activity page to board

---

- **Decision**: AI-BOARD as actor representation
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (explicitly stated in requirements)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Clear attribution of automated actions to AI-BOARD system actor
  2. Requires consistent handling of system user vs human users in display
- **Reviewer Notes**: Ensure AI-BOARD avatar and name are visually distinct from human users

## User Scenarios & Testing

### User Story 1 - View Recent Project Activity (Priority: P1)

As a project owner or member, I want to see a unified timeline of recent events across all tickets so I can quickly understand what's happening in the project without opening each ticket individually.

**Why this priority**: This is the core value proposition - providing visibility into project activity at a glance. Without this, the feature has no value.

**Independent Test**: Can be fully tested by navigating to the activity page and seeing a list of events. Delivers value by showing users what happened recently.

**Acceptance Scenarios**:

1. **Given** I am logged in and a member of a project, **When** I navigate to `/projects/{projectId}/activity`, **Then** I see a chronological list of events from the last 30 days (newest first) with icon, actor, action, ticket reference, and relative timestamp.

2. **Given** I am on the activity feed page, **When** I hover over a relative timestamp like "2 hours ago", **Then** I see the absolute timestamp (e.g., "Jan 22, 2026 at 3:45 PM").

3. **Given** events exist from various sources (jobs, comments, tickets), **When** I view the activity feed, **Then** all event types are displayed in a unified timeline ordered by timestamp.

---

### User Story 2 - Load More Historical Activity (Priority: P2)

As a project member, I want to load older activity events so I can review what happened further back in time within the 30-day window.

**Why this priority**: Extends the core viewing capability to historical data, enabling catch-up scenarios.

**Independent Test**: Can be tested by scrolling to the bottom and clicking "Load more" to see older events.

**Acceptance Scenarios**:

1. **Given** I am viewing the activity feed with 50 events displayed, **When** there are more events within the 30-day window and I click "Load more", **Then** additional events are appended to the list.

2. **Given** I have loaded all available events within the 30-day window, **When** I view the bottom of the feed, **Then** the "Load more" button is no longer shown or displays "No more activity".

3. **Given** I am scrolling through loaded events, **When** content is loading, **Then** I experience smooth scrolling without jarring UI changes.

---

### User Story 3 - Navigate to Ticket from Activity (Priority: P2)

As a project member, I want to click on a ticket reference in the activity feed so I can see more details about that specific ticket.

**Why this priority**: Enables drill-down from activity overview to specific ticket context.

**Independent Test**: Can be tested by clicking a ticket reference and verifying the ticket modal opens.

**Acceptance Scenarios**:

1. **Given** I am viewing the activity feed, **When** I click on a ticket reference (e.g., "ABC-42"), **Then** the ticket modal opens on the board showing that ticket's details.

2. **Given** I opened a ticket modal from the activity feed, **When** I close the modal, **Then** I return to the activity feed with my scroll position preserved.

---

### User Story 4 - Real-Time Activity Updates (Priority: P3)

As a project member, I want to see new activity appear automatically so I don't have to manually refresh the page.

**Why this priority**: Enhances the experience but the core value (viewing activity) is delivered without it.

**Independent Test**: Can be tested by having another user create activity and verifying it appears within 15 seconds.

**Acceptance Scenarios**:

1. **Given** I am viewing the activity feed, **When** a new event occurs in the project (e.g., new comment, job started), **Then** the new event appears at the top of the feed within 15 seconds.

2. **Given** I am viewing older events (scrolled down), **When** new events occur, **Then** they are added to the top without disrupting my current scroll position.

---

### User Story 5 - Access Activity Feed via Navigation (Priority: P3)

As a project member, I want to easily navigate to the activity feed from the project header so I can quickly check recent activity.

**Why this priority**: Navigation is necessary but supporting - the main value is the activity feed itself.

**Independent Test**: Can be tested by clicking the Activity icon in the header and verifying navigation to the activity page.

**Acceptance Scenarios**:

1. **Given** I am on any project page, **When** I click the "Activity" icon in the project header, **Then** I navigate to the activity feed page for that project.

2. **Given** I am on the activity feed page, **When** I click "Back to Board", **Then** I navigate back to the project board.

---

### Edge Cases

- What happens when a project has no activity in the last 30 days? Display an empty state with message "No activity in the last 30 days".
- What happens when a ticket is deleted but its activity events exist? Show event with "(deleted)" suffix on ticket reference, not clickable.
- What happens when a user who created activity no longer exists? Show "Unknown User" as actor name with default avatar.
- What happens when the activity feed is loaded on a very slow connection? Show loading spinner initially; show loading indicator at bottom when fetching more events.
- How does the system handle a user without project access trying to view activity? Return 403 Forbidden and redirect to home page.

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a dedicated activity feed page at route `/projects/{projectId}/activity`
- **FR-002**: System MUST restrict activity feed access to project owners and members only
- **FR-003**: System MUST display activity events in reverse chronological order (newest first)
- **FR-004**: System MUST include events for: ticket created, ticket stage changed, ticket deleted, comment posted, job started, job completed, job failed, PR created, preview deployed
- **FR-005**: System MUST derive activity from existing data (jobs, comments, ticket timestamps) without creating new database tables
- **FR-006**: System MUST display for each event: event-type icon, actor avatar, actor name, action text, ticket reference, relative timestamp
- **FR-007**: System MUST show AI-BOARD as the actor for comments and job triggers initiated by the system
- **FR-008**: System MUST provide relative timestamps (e.g., "2 hours ago") with absolute timestamp on hover
- **FR-009**: System MUST allow clicking ticket references to open the ticket modal on the board
- **FR-010**: System MUST limit activity history to the last 30 days
- **FR-011**: System MUST load 50 events initially with a "Load more" button for pagination
- **FR-012**: System MUST refresh activity every 15 seconds using polling (same pattern as notifications)
- **FR-013**: System MUST add an "Activity" link/icon in the project header navigation (next to Analytics icon)
- **FR-014**: System MUST provide a "Back to Board" button in the activity page header
- **FR-015**: System MUST provide responsive design - full-width list on desktop, compact list on mobile

### Key Entities

- **Activity Event**: A unified representation of a project event derived from jobs, comments, or ticket changes. Key attributes: event type, timestamp, actor (user or AI-BOARD), ticket reference, action description.
- **Actor**: The user or system (AI-BOARD) that initiated the event. Displays avatar, name.
- **Ticket Reference**: A clickable link to the source ticket (ticketKey format like "ABC-123").

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can view project activity within 2 seconds of page load (initial 50 events)
- **SC-002**: Activity feed updates with new events within 15 seconds of occurrence (polling interval)
- **SC-003**: Users can load additional historical events within 1 second per pagination request
- **SC-004**: Activity feed correctly displays all 9 defined event types with appropriate icons and formatting
- **SC-005**: Navigation to activity feed is accessible within 1 click from any project page (via header icon)
- **SC-006**: Activity feed is usable on both desktop and mobile viewports with appropriate layout adjustments
- **SC-007**: Clicking a ticket reference successfully opens the ticket modal within 500ms
