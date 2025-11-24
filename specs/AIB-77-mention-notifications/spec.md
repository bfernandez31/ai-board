# Feature Specification: Mention Notifications

**Feature Branch**: `AIB-77-mention-notifications`
**Created**: 2025-11-24
**Status**: Draft
**Input**: User description: "Mention Notifications - Users are not notified when they are mentioned (@username) in ticket comments. This creates collaboration friction as team members must manually check tickets for responses or mentions."

## Auto-Resolved Decisions

### Decision 1: @mention Parsing Strategy

- **Decision**: How to detect and parse @mentions in comment text
- **Policy Applied**: AUTO → PRAGMATIC (confidence: 0.7)
- **Confidence**: Medium - Internal feature with established patterns (comment system already exists), speed favored
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Simple regex parsing (@word boundaries) is fast but won't handle edge cases like @user.name
  2. Keeps implementation straightforward, extensible later if needed
- **Reviewer Notes**: Verify regex pattern handles expected username formats in existing user table

### Decision 2: Notification Retention Period

- **Decision**: How long to retain read/unread notifications
- **Policy Applied**: AUTO → PRAGMATIC (confidence: 0.6)
- **Confidence**: Medium - No compliance keywords detected, internal collaboration tool
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. 30 days for all notifications (read/unread) balances storage with utility
  2. Older notifications automatically archived/deleted to prevent database bloat
- **Reviewer Notes**: Confirm 30-day retention aligns with typical user behavior patterns and project collaboration timelines

### Decision 3: Notification Polling vs Real-time

- **Decision**: Use polling (15s interval) vs WebSocket/SSE for real-time notifications
- **Policy Applied**: AUTO → PRAGMATIC (confidence: 0.6)
- **Confidence**: Medium - Description explicitly mentions "polling every 15 seconds for new notifications (similar to comments)"
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Polling aligns with existing comment polling pattern (consistency)
  2. Avoids WebSocket infrastructure complexity
  3. 15-second delay acceptable for mention notifications (not critical alerts)
- **Reviewer Notes**: None - requirement explicitly stated in description

### Decision 4: Full Notifications Page Priority

- **Decision**: Whether to implement full `/notifications` page in initial scope
- **Policy Applied**: AUTO → PRAGMATIC (confidence: 0.7)
- **Confidence**: Medium - Marked as "Optional" in description, focus on core notification bell
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. MVP focuses on notification bell + dropdown (covers 80% use case)
  2. Full page deferred as enhancement (users can manage via dropdown initially)
- **Reviewer Notes**: Validate that 5-notification dropdown is sufficient for typical mention frequency

### Decision 5: Comment Visibility on Navigation

- **Decision**: How to handle "navigates to ticket detail with comment visible"
- **Policy Applied**: AUTO → PRAGMATIC (confidence: 0.6)
- **Confidence**: Medium - Standard UX pattern for notification systems
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Direct link to ticket with comment ID in URL anchor (e.g., `/tickets/AIB-77#comment-123`)
  2. Browser native scroll-to-anchor handles visibility
  3. May need visual highlight on target comment (brief flash/border)
- **Reviewer Notes**: Verify comment anchors exist in current ticket detail implementation

## User Scenarios & Testing

### User Story 1 - Receive Notification When Mentioned (Priority: P1)

A project member posts a comment mentioning another team member. The mentioned user receives an immediate notification they can see and act on.

**Why this priority**: Core value proposition - ensures users know when they're mentioned without manual checking.

**Independent Test**: Create comment with @mention, verify notification appears in bell dropdown for mentioned user within 15 seconds.

**Acceptance Scenarios**:

1. **Given** User A is a project member, **When** User B posts a comment with "@UserA", **Then** User A sees unread count badge update and notification in dropdown
2. **Given** User A posts a comment, **When** comment includes "@UserA" (self-mention), **Then** no notification is created for User A
3. **Given** User B posts a comment with "@InvalidUser", **When** @InvalidUser is not a project member, **Then** no notification is created

---

### User Story 2 - View and Navigate to Mentioned Comments (Priority: P1)

A user views their notifications in the dropdown and clicks a notification to see the comment where they were mentioned.

**Why this priority**: Enables users to act on notifications - seeing mention without context is insufficient.

**Independent Test**: Click notification in dropdown, verify navigation to correct ticket with target comment visible.

**Acceptance Scenarios**:

1. **Given** User has unread notification for mention in ticket ABC-123, **When** user clicks notification bell, **Then** dropdown shows notification with actor name, avatar, "mentioned you in ABC-123", comment preview, and timestamp
2. **Given** User views notification in dropdown, **When** user clicks the notification, **Then** browser navigates to ticket detail page with mentioned comment visible and notification marked as read
3. **Given** User has 8 notifications, **When** user opens dropdown, **Then** 5 most recent notifications are displayed with "View all" link

---

### User Story 3 - Manage Notification Read Status (Priority: P2)

A user marks individual notifications as read or clears all notifications to maintain a clean notification list.

**Why this priority**: Supports notification hygiene - users need control over read/unread state.

**Independent Test**: Mark notification(s) as read, verify unread count updates and visual indicators change.

**Acceptance Scenarios**:

1. **Given** User has 3 unread notifications, **When** user clicks "Mark all as read", **Then** unread badge disappears and all notifications show as read (no blue dot/highlight)
2. **Given** User views notification in dropdown, **When** notification is clicked, **Then** notification is immediately marked as read (optimistic update) before navigation
3. **Given** User has 10+ unread notifications, **When** viewing notification bell, **Then** badge displays "9+" to indicate overflow

---

### User Story 4 - Continuous Notification Updates (Priority: P3)

While a user has the application open, they receive new notifications as other team members mention them in comments.

**Why this priority**: Enhances real-time collaboration feel within polling constraints.

**Independent Test**: With app open, create mention in separate session, verify notification appears within 15 seconds without manual refresh.

**Acceptance Scenarios**:

1. **Given** User has application open with notification dropdown closed, **When** another user mentions them in a new comment, **Then** notification bell badge updates within 15 seconds to reflect new unread count
2. **Given** User has notification dropdown open, **When** polling detects new notification, **Then** dropdown content updates to show new notification at top of list
3. **Given** User is mentioned 3 times in 10 seconds, **When** polling runs, **Then** all 3 notifications appear (not deduplicated)

---

### Edge Cases

- **Multiple mentions in one comment**: If comment contains "@UserA @UserB @UserA", create separate notifications for UserA and UserB (not duplicate for UserA)
- **Deleted comments**: If source comment is deleted after notification is created, notification still visible but clicking shows "Comment no longer available" message on ticket page
- **Deleted users**: If actor who created mention is deleted, notification shows "[Deleted User]" as actor name
- **Non-member mentions**: If @mentioned username doesn't match any project member, silently ignore (no notification, no error)
- **Comment edit with new mentions**: Editing comment to add new @mentions does NOT create new notifications (only on initial post)
- **Concurrent reads**: If user marks notification read on device A while viewing on device B, both devices sync read state within next polling interval
- **Notification overflow**: If user accumulates >100 unread notifications, oldest notifications remain in database but dropdown always shows most recent 5

## Requirements

### Functional Requirements

- **FR-001**: System MUST detect @mentions in comment text when comment is posted (format: @username with word boundaries)
- **FR-002**: System MUST create notification records for each valid project member mentioned (excluding self-mentions)
- **FR-003**: System MUST link notifications to source comment, ticket, and actor (user who posted comment)
- **FR-004**: System MUST display notification bell icon in application header visible on all pages
- **FR-005**: System MUST show unread notification count badge on bell icon (number for 1-9, "9+" for 10 or more)
- **FR-006**: System MUST display dropdown menu when bell icon is clicked, showing 5 most recent notifications
- **FR-007**: System MUST show notification details: actor name, avatar, action text ("mentioned you in [TICKET-KEY]"), comment preview (truncated to 80 characters), relative timestamp
- **FR-008**: System MUST visually distinguish unread notifications (blue dot or background highlight)
- **FR-009**: System MUST provide "Mark all as read" action in dropdown header
- **FR-010**: System MUST provide "View all" link in dropdown footer (even if full page is not implemented initially, link should be present)
- **FR-011**: System MUST mark notification as read when clicked, using optimistic update (immediate UI change)
- **FR-012**: System MUST navigate to ticket detail page with comment visible when notification is clicked
- **FR-013**: System MUST poll for new notifications every 15 seconds while user is authenticated
- **FR-014**: System MUST update notification bell badge and dropdown content when polling detects changes
- **FR-015**: System MUST retain notifications for 30 days (both read and unread) before automatic deletion
- **FR-016**: System MUST prevent notification creation for @mentions of non-project members
- **FR-017**: System MUST prevent notification creation for self-mentions (@own-username)
- **FR-018**: System MUST support relative timestamp display (e.g., "2 hours ago", "just now", "3 days ago")

### Key Entities

- **Notification**: Represents a mention event for a user
  - Attributes: recipient user, actor user, source comment, source ticket, creation timestamp, read status (boolean), read timestamp
  - Relationships: belongs to recipient user, references actor user, references comment, references ticket

- **Comment**: Existing entity, enhanced to trigger notification creation
  - New behavior: parse text for @mentions on creation, trigger notification service

- **User**: Existing entity
  - Relationships: receives notifications (as recipient), creates notifications (as actor)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users discover mentions within 30 seconds of posting (15s polling + interaction time)
- **SC-002**: 95% of notification clicks successfully navigate to correct comment location
- **SC-003**: Unread notification count accurately reflects user's unread state within 15 seconds of status change
- **SC-004**: Users can mark 10+ notifications as read in under 2 seconds (single "Mark all as read" action)
- **SC-005**: Notification dropdown loads and displays within 500ms of bell icon click
- **SC-006**: Zero notifications created for invalid mentions (non-members, self-mentions)
- **SC-007**: System handles 50 concurrent mention notifications (50 users mentioned in rapid succession) without notification loss
