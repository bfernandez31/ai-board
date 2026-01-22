# Feature Specification: Project Activity Feed

**Feature Branch**: `AIB-172-project-activity-feed`
**Created**: 2026-01-22
**Status**: Draft
**Ticket**: AIB-172

## Auto-Resolved Decisions

- **Decision**: Polling interval for activity feed updates
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: Medium (score: -3) - Internal project management context detected
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. 15-second polling provides near-real-time updates while keeping server load manageable
  2. Slightly delayed visibility (up to 15 seconds) for new events is acceptable for an activity feed
- **Reviewer Notes**: Polling interval matches existing notification pattern; consider WebSocket in future if real-time becomes critical

---

- **Decision**: Data retention period for activity display
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: Medium (score: -3) - Internal tool context
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. 30-day window keeps query performance optimal while showing relevant history
  2. Older activity beyond 30 days won't be accessible through this view
- **Reviewer Notes**: 30-day window explicitly specified in requirements; data remains in database for longer

---

- **Decision**: Navigation behavior for ticket references
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: Medium (score: -3)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Opening ticket modal on board maintains context without full page navigation
  2. Users may need to navigate to board first if they're deep-linking to activity
- **Reviewer Notes**: Follows existing ticket reference patterns in the application

---

- **Decision**: Event derivation approach (no new database table)
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: Medium (score: -3)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Simpler architecture - no schema migrations needed
  2. Query complexity increases; may need optimization for projects with high activity
- **Reviewer Notes**: Validates that existing data models (Job, Comment, Ticket) have sufficient timestamps for activity tracking

---

- **Decision**: AI-BOARD actor representation
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: Medium (score: -3)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent system actor identification across all AI-generated activities
  2. Need to identify which user ID or special identifier represents AI-BOARD in the system
- **Reviewer Notes**: AI-BOARD comments already exist; verify how the system user is currently represented

## User Scenarios & Testing

### User Story 1 - View Recent Project Activity (Priority: P1)

A project owner or team member navigates to the activity feed to see what has happened across all tickets in their project, displayed as a unified timeline showing the most recent events first.

**Why this priority**: Core value proposition - users need to see activity across all tickets in one place. Without this, the feature has no purpose.

**Independent Test**: Can be fully tested by navigating to `/projects/{projectId}/activity` and verifying events are displayed chronologically. Delivers immediate value by providing project visibility.

**Acceptance Scenarios**:

1. **Given** a user is a project owner or member, **When** they navigate to `/projects/{projectId}/activity`, **Then** they see a chronological list of events (newest first) from the last 30 days
2. **Given** the activity feed is displayed, **When** viewing an event, **Then** they see the event icon, actor avatar, actor name, action text, ticket reference, and relative timestamp
3. **Given** an event has a relative timestamp shown, **When** hovering over the timestamp, **Then** the absolute timestamp is displayed in a tooltip
4. **Given** a user is not a project owner or member, **When** they try to access the activity page, **Then** they are denied access (redirect to unauthorized)

---

### User Story 2 - Navigate from Activity to Ticket (Priority: P2)

Users can click on ticket references in activity events to quickly access the full ticket details without leaving the project context.

**Why this priority**: Navigation between activity and tickets is essential for the feed to be actionable. Users need to dig deeper into events they see.

**Independent Test**: Can be tested by clicking a ticket reference and verifying the ticket modal opens. Delivers value by enabling quick drill-down into specific events.

**Acceptance Scenarios**:

1. **Given** an activity event shows a ticket reference (e.g., "ABC-42"), **When** the user clicks on the ticket reference, **Then** the ticket detail modal opens on the board view
2. **Given** the ticket modal is opened from activity, **When** viewing the modal, **Then** the user can see all ticket details, comments, and files

---

### User Story 3 - See Real-Time Activity Updates (Priority: P3)

The activity feed automatically refreshes to show new events without requiring manual page refresh, keeping users informed of ongoing project activity.

**Why this priority**: Real-time updates make the feed useful for monitoring active work. However, users can manually refresh if needed, making this lower priority than viewing and navigation.

**Independent Test**: Can be tested by creating new activity (e.g., posting a comment) and verifying it appears within 15 seconds without page refresh.

**Acceptance Scenarios**:

1. **Given** the activity feed is displayed, **When** new activity occurs in the project, **Then** the new event appears in the feed within 15 seconds
2. **Given** the feed is polling, **When** events are added, **Then** they appear at the top of the list (newest first) without disrupting the user's scroll position

---

### User Story 4 - Load Older Activity (Priority: P4)

Users can view more historical activity beyond the initial 50 events through pagination, allowing them to catch up on extended periods of absence.

**Why this priority**: Pagination is important for comprehensive catch-up but most users will see what they need in the initial load. This extends utility for power users.

**Independent Test**: Can be tested by scrolling to end of feed and clicking "Load more" to verify additional events load.

**Acceptance Scenarios**:

1. **Given** there are more than 50 events in the 30-day window, **When** the user scrolls to the bottom and clicks "Load more", **Then** the next batch of 50 events loads and appends to the list
2. **Given** all events within 30 days have been loaded, **When** viewing the feed, **Then** the "Load more" button is hidden or disabled
3. **Given** there are fewer than 50 events total, **When** viewing the feed, **Then** no "Load more" button is displayed

---

### User Story 5 - Navigate to Activity from Header (Priority: P5)

Users can quickly access the activity feed from any project page through a navigation link in the project header.

**Why this priority**: Navigation entry point is necessary but lower priority since the URL can be accessed directly. Enables discoverability.

**Independent Test**: Can be tested by clicking the Activity link in the header and verifying navigation to the activity page.

**Acceptance Scenarios**:

1. **Given** a user is on any project page (board, analytics, settings), **When** they click the "Activity" link in the project header, **Then** they are navigated to `/projects/{projectId}/activity`
2. **Given** a user is on the activity page, **When** they click "Back to Board", **Then** they are navigated to `/projects/{projectId}/board`

---

### Edge Cases

- What happens when a project has no activity in the last 30 days? → Display empty state message "No recent activity"
- What happens when a ticket referenced in activity has been deleted? → Show "ABC-42 (deleted)" with reference non-clickable
- How does the system handle events for tickets the user cannot access? → Activity only shows events from tickets in the current project (authorization at project level)
- What happens if the actor user has been deleted? → Show "Deleted user" with default avatar
- How are rapid successive events handled? → Each event is shown individually; no batching or grouping

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a project activity feed at route `/projects/{projectId}/activity`
- **FR-002**: System MUST restrict access to project owners and members only
- **FR-003**: System MUST display the following event types:
  - Ticket created (derived from ticket.createdAt)
  - Ticket stage changed (derived from ticket.updatedAt when stage changes)
  - Ticket deleted (soft delete indicator if available, or exclusion from queries)
  - Comment posted (derived from comment.createdAt)
  - Job started (derived from job.startedAt, status = RUNNING)
  - Job completed (derived from job.completedAt, status = COMPLETED)
  - Job failed (derived from job.completedAt, status = FAILED)
  - PR created (derived from job with command containing PR-related activity)
  - Preview deployed (derived from ticket.previewUrl being set)
- **FR-004**: System MUST display events in chronological order (newest first)
- **FR-005**: Each event MUST display: event icon, actor avatar, actor name, action text, ticket reference, relative timestamp
- **FR-006**: Relative timestamps MUST show absolute timestamp on hover (tooltip)
- **FR-007**: System MUST identify AI-BOARD as the actor for AI-generated comments and workflow-triggered jobs
- **FR-008**: Clicking a ticket reference MUST open the ticket detail modal on the board view
- **FR-009**: System MUST show activity from the last 30 days only
- **FR-010**: System MUST initially load 50 events
- **FR-011**: System MUST provide "Load more" pagination for additional events within the 30-day window
- **FR-012**: System MUST poll for new events every 15 seconds
- **FR-013**: System MUST add "Activity" navigation link in project header (next to Analytics icon)
- **FR-014**: System MUST display responsive layouts (desktop: full-width with spacing; mobile: compact with touch targets)
- **FR-015**: Activity page MUST include "Back to Board" button in header

### Key Entities

- **ActivityEvent**: Virtual entity derived from existing data (jobs, comments, tickets). Attributes: type, timestamp, actor (user or AI-BOARD), ticketReference, actionText, icon
- **Actor**: User entity (id, name, email, image) or system actor (AI-BOARD with distinctive identifier/avatar)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can view the activity feed and see all events within 30 days displayed correctly
- **SC-002**: New events appear in the feed within 15 seconds of occurring
- **SC-003**: Users can load the full 30-day history through pagination
- **SC-004**: Activity page loads within acceptable time (initial 50 events render promptly)
- **SC-005**: Mobile and desktop layouts render appropriately based on viewport
- **SC-006**: 100% of navigation paths work correctly (header link, back to board, ticket references)
- **SC-007**: Unauthorized users cannot access project activity pages

## Testing Requirements

### Unit Tests

- Test activity event type mapping from source data (job → job events, comment → comment events)
- Test relative timestamp formatting logic
- Test actor identification (user vs AI-BOARD)
- Test pagination logic (determining if more events available)

### Component Tests (RTL)

- Test activity feed component renders events correctly
- Test event click interactions (ticket reference opens modal)
- Test "Load more" button visibility and click handling
- Test empty state display when no activity
- Test responsive layout switching

### Integration Tests

- Test activity API endpoint returns correct event data structure
- Test activity API authorization (owner/member access, denial for non-members)
- Test activity API pagination (offset, limit parameters)
- Test activity API date filtering (30-day window)

### E2E Tests

- Test full navigation flow: header → activity → ticket modal → back to board
- Test polling behavior updates feed with new events
- Test mobile responsive layout interactions
