# Feature Specification: Project Activity Feed

**Feature Branch**: `AIB-177-project-activity-feed`
**Created**: 2026-01-22
**Status**: Draft
**Input**: User description: "Add a project-level activity feed page that displays a unified timeline of all events happening across the project"

## Auto-Resolved Decisions

- **Decision**: Event type scope - which events to include in the activity feed
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) - Feature description explicitly lists all 9 event types with examples
- **Fallback Triggered?**: No - explicit enumeration in requirements
- **Trade-offs**:
  1. Comprehensive event coverage provides complete project visibility
  2. More data sources to query may impact initial load performance
- **Reviewer Notes**: Event types match existing data model (tickets, jobs, comments). PR created and preview deployed events require deriving from job completions.

---

- **Decision**: Ticket deletion tracking mechanism
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) - Deletion events need to be derived since tickets are hard-deleted
- **Fallback Triggered?**: Yes - no deletion audit trail exists in current schema
- **Trade-offs**:
  1. Cannot show deleted ticket events without audit mechanism or soft deletes
  2. Scope limited to events from existing data sources only
- **Reviewer Notes**: "Ticket deleted" events cannot be displayed with current schema (no deletedAt field on Ticket). Recommend excluding from initial scope or adding audit logging in future.

---

- **Decision**: Actor identification for system-triggered events
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) - AI-BOARD is already identified as actor for comments and job triggers in existing patterns
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. System events show "AI-BOARD" as actor for consistency
  2. Some events (stage changes) may not have a clear actor
- **Reviewer Notes**: Stage changes and ticket creation show the user who triggered the action (from ticket.updatedAt context). AI-BOARD jobs show "AI-BOARD" as actor.

---

- **Decision**: Ticket reference navigation behavior
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) - Existing pattern: clicking ticket references opens ticket modal on board page
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent with existing navigation patterns
  2. User navigates away from activity feed to view ticket details
- **Reviewer Notes**: Navigation pattern should redirect to board with modal open for active tickets, or show "Ticket closed" indicator for shipped/closed tickets.

## User Scenarios & Testing

### User Story 1 - View Recent Project Activity (Priority: P1)

A project owner or member wants to see a quick overview of what has happened across all tickets in the project. They navigate to the Activity page and see a chronological list of recent events including ticket creation, stage changes, comments, and job completions.

**Why this priority**: Core value proposition - users can quickly catch up on project status without opening each ticket individually.

**Independent Test**: Can be fully tested by navigating to `/projects/{id}/activity` and verifying events display with correct formatting, ordering, and actor information.

**Acceptance Scenarios**:

1. **Given** a project with multiple tickets that have jobs and comments, **When** the user navigates to `/projects/{projectId}/activity`, **Then** they see a list of events sorted newest-first with icon, actor avatar, actor name, action text, ticket reference, and relative timestamp for each event.

2. **Given** the activity feed is displayed, **When** new activity occurs on a ticket, **Then** the feed automatically updates within 15 seconds to show the new event at the top.

3. **Given** the activity feed shows a ticket reference, **When** the user clicks the ticket reference, **Then** they are redirected to the board page with that ticket's modal open.

---

### User Story 2 - Load Historical Activity (Priority: P2)

A user returns after an extended absence and wants to review what happened over the past few weeks. They scroll through the initial 50 events and click "Load more" to see older activity within the 30-day window.

**Why this priority**: Enables catch-up functionality for users who haven't checked the project recently.

**Independent Test**: Can be tested by creating >50 events, loading the page, verifying 50 initial events display, then clicking "Load more" and verifying additional events appear.

**Acceptance Scenarios**:

1. **Given** a project with more than 50 events in the last 30 days, **When** the user views the activity page, **Then** they see the 50 most recent events with a "Load more" button at the bottom.

2. **Given** the "Load more" button is visible, **When** the user clicks it, **Then** the next batch of events loads and appends to the list (without replacing existing events).

3. **Given** all events within the 30-day window have been loaded, **When** there are no more events to load, **Then** the "Load more" button is no longer displayed.

---

### User Story 3 - Mobile Activity Review (Priority: P3)

A user checks project status from their mobile device. The activity feed displays in a compact format with touch-friendly tap targets, and they can easily return to the board.

**Why this priority**: Ensures the feature is usable across devices, maintaining parity with other project pages.

**Independent Test**: Can be tested on mobile viewport by verifying compact layout renders correctly and navigation elements are accessible.

**Acceptance Scenarios**:

1. **Given** a user on a mobile device, **When** they navigate to the activity page, **Then** they see a compact list layout with appropriately sized tap targets (minimum 44x44 px touch areas).

2. **Given** a user on any device viewing the activity page, **When** they want to return to the board, **Then** they can click/tap the "Back to Board" button in the header.

---

### Edge Cases

- What happens when a project has no activity (new project)? Display an empty state message: "No activity yet. Events will appear here as work progresses."
- What happens when a ticket referenced in the feed was deleted? Show the event but disable the ticket reference link (display as plain text).
- What happens when an event's actor user was deleted? Display "[Deleted user]" as actor name with default avatar.
- How does the feed handle events from AI-BOARD? AI-BOARD appears with system avatar and "AI-BOARD" as actor name for comments and job triggers.
- What happens when polling fails? Silently retry on next interval; do not show error to user for transient failures.
- **What happens when new events arrive during polling while user has paginated?** Track pagination state explicitly with a boolean flag (`hasPaginated`) rather than inferring from event count. Merge new first-page events while preserving paginated events correctly.
- **What happens when a pagination cursor references an event that no longer exists (expired cursor)?** Return an explicit `cursorExpired: true` flag in the API response instead of silently restarting from the beginning. The frontend should detect this and notify the user that their position was lost.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a project activity feed at route `/projects/{projectId}/activity`
- **FR-002**: System MUST verify user authorization (project owner or member) before displaying activity
- **FR-003**: System MUST display events in reverse chronological order (newest first)
- **FR-004**: System MUST show each event with: icon (by event type), actor avatar, actor name, action text, ticket reference (where applicable), and relative timestamp
- **FR-005**: System MUST display relative timestamps (e.g., "2 hours ago") with absolute timestamp shown on hover
- **FR-006**: System MUST refresh the activity feed automatically every 15 seconds
- **FR-007**: System MUST limit displayed events to the last 30 days
- **FR-008**: System MUST load 50 events initially and provide "Load more" pagination for additional events
- **FR-009**: System MUST navigate users to the board with ticket modal open when they click a ticket reference
- **FR-010**: System MUST include a "Back to Board" button in the page header
- **FR-011**: System MUST add an "Activity" navigation link in the project header (next to Analytics icon)

### Event Types

- **FR-012**: System MUST display "Ticket created" events showing creator name and ticket title
- **FR-013**: System MUST display "Stage changed" events showing ticket key and stage transition (e.g., "PLAN to BUILD")
- **FR-014**: System MUST display "Comment posted" events with comment preview (truncated if necessary)
- **FR-015**: System MUST display "Job started" events showing ticket and job command (e.g., "specify", "implement")
- **FR-016**: System MUST display "Job completed" events showing ticket and job command
- **FR-017**: System MUST display "Job failed" events showing ticket and job command
- **FR-018**: System MUST display "PR created" events derived from verify job completion
- **FR-019**: System MUST display "Preview deployed" events derived from deploy-preview job completion

### Data Derivation

- **FR-020**: System MUST derive activity from existing data (jobs, comments, tickets) without new database tables
- **FR-021**: System MUST identify AI-BOARD as the actor for AI-generated comments and workflow-triggered jobs
- **FR-022**: System MUST query and combine jobs, comments, and ticket events into a unified timeline

### Pagination & Polling Robustness

- **FR-025**: System MUST track pagination state explicitly using a boolean flag, NOT by comparing event counts (which can change due to new events arriving)
- **FR-026**: System MUST return `cursorExpired: true` in the API response when a pagination cursor cannot be found (event deleted or moved outside 30-day window)
- **FR-027**: System MUST display a user-friendly notification when cursor expires, explaining that pagination position was lost and events will reload from the beginning

### Responsive Design

- **FR-023**: System MUST display a full-width list with comfortable spacing on desktop viewports
- **FR-024**: System MUST display a compact list with touch-friendly tap targets on mobile viewports

### Key Entities

- **ActivityEvent**: Virtual entity representing a unified event in the feed. Contains event type, timestamp, actor info, ticket reference, and type-specific details. Derived from jobs, comments, and ticket records - not persisted.
- **Actor**: The user or system (AI-BOARD) that triggered the event. For human users: id, name, avatar. For AI-BOARD: system identifier with designated avatar.
- **TicketReference**: Lightweight reference to a ticket (ticketKey, title) enabling navigation to the ticket modal.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can view project activity within 2 seconds of page load (initial 50 events)
- **SC-002**: Activity feed updates display new events within 15 seconds of occurrence
- **SC-003**: Users can navigate from activity event to ticket modal within 1 click
- **SC-004**: "Load more" fetches additional events within 1 second
- **SC-005**: Activity page is fully usable on viewports from 320px to 2560px wide
- **SC-006**: All event types render correctly with appropriate icons, actors, and action text
- **SC-007**: 30-day activity history is accessible via pagination
- **SC-008**: Unauthorized users (non-members) receive appropriate access denied response

## Assumptions

- Ticket deletion events are out of scope for initial release (no audit trail exists in current schema)
- PR creation events are derived from successful `verify` job completions
- Preview deployment events are derived from successful `deploy-preview` job completions
- Stage change events can be derived from ticket records (tracking createdAt/updatedAt and stage changes over time via job completions)
- The existing `formatDistanceToNow` utility will be reused for relative timestamps
- The existing avatar component pattern will be reused for actor display

## Out of Scope

- Real-time WebSocket updates (polling only)
- Filtering by event type or actor (future enhancement)
- Cross-project activity feed
- Activity export or email digest
- Ticket deletion event tracking (requires schema changes)
