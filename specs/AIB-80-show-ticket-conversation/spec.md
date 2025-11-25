# Feature Specification: Notification Click Navigation to Ticket Conversation Tab

**Feature Branch**: `AIB-80-show-ticket-conversation`
**Created**: 2025-11-25
**Status**: Draft
**Input**: User description: "show ticket conversation section on notification"

## Auto-Resolved Decisions

- **Decision**: Navigation behavior for same-project vs cross-project notifications
- **Policy Applied**: AUTO → PRAGMATIC (confidence: 0.7)
- **Confidence**: Medium (score: -1). Feature context emphasizes user workflow efficiency (neutral +1) with implicit speed/simplicity expectations (-2). No conflicting signals detected.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Scope**: Chose simpler same-window navigation for same-project to avoid window management complexity
  2. **Timeline**: Cross-project opens in new tab for better context separation without complex state management
- **Reviewer Notes**: Validate that same-project navigation doesn't disrupt user's current board view. Consider whether users prefer preserving board state vs immediate context switch.

---

- **Decision**: Target tab when opening ticket modal from notification
- **Policy Applied**: AUTO → PRAGMATIC (confidence: 0.8)
- **Confidence**: High (score: -2). User explicitly requested "conversation tab selected" which is a clear directive.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **UX**: Direct navigation to conversation tab reduces user clicks
  2. **Consistency**: May deviate from default "details" tab, but matches user intent
- **Reviewer Notes**: Ensure tab navigation is smooth and comment scrolling works correctly after tab switch.

---

- **Decision**: Scroll behavior after navigation to conversation tab
- **Policy Applied**: AUTO → PRAGMATIC (confidence: 0.6)
- **Confidence**: Medium (score: -1). Existing code shows `#comment-{id}` anchor pattern suggesting scroll intent.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **UX**: Auto-scroll to mentioned comment provides immediate context
  2. **Implementation**: Leverages existing anchor pattern in notification data
- **Reviewer Notes**: Verify scroll timing works correctly after tab switch and timeline render.

## User Scenarios & Testing

### User Story 1 - Same-Project Notification Click (Priority: P1)

When a user receives a notification about a mention in a ticket that belongs to the same project they are currently viewing, clicking the notification should navigate them directly to that ticket's conversation tab, scrolled to the relevant comment.

**Why this priority**: This is the most common use case and provides the core value of the feature - immediate access to the conversation context where the user was mentioned.

**Independent Test**: Can be fully tested by creating a mention notification within the same project, clicking it, and verifying the ticket modal opens with the conversation tab active and scrolled to the comment.

**Acceptance Scenarios**:

1. **Given** user is viewing Project A board and has unread notification for ticket in Project A, **When** user clicks the notification, **Then** ticket modal opens with conversation tab selected and scrolls to mentioned comment
2. **Given** user clicks a notification for same-project ticket, **When** modal opens, **Then** user remains on the same browser tab/window
3. **Given** notification contains comment ID reference, **When** conversation tab loads, **Then** timeline scrolls to show the specific comment where user was mentioned

---

### User Story 2 - Cross-Project Notification Click (Priority: P2)

When a user receives a notification about a mention in a ticket that belongs to a different project than the one they are currently viewing, clicking the notification should open the target project's board with the ticket modal in a new browser tab, with the conversation tab selected.

**Why this priority**: Supports multi-project workflows without disrupting the user's current context. Less frequent than same-project navigation but essential for users managing multiple projects.

**Independent Test**: Can be fully tested by creating a mention notification in Project B while viewing Project A, clicking it, and verifying a new tab opens showing Project B's board with the ticket modal on conversation tab.

**Acceptance Scenarios**:

1. **Given** user is viewing Project A board and has notification for ticket in Project B, **When** user clicks the notification, **Then** new browser tab opens showing Project B board
2. **Given** cross-project notification click opens new tab, **When** Project B board loads, **Then** ticket modal automatically opens with conversation tab selected
3. **Given** user opens cross-project notification in new tab, **When** ticket modal opens, **Then** timeline scrolls to the mentioned comment
4. **Given** user clicks cross-project notification, **When** new tab opens, **Then** original tab remains on Project A board unchanged

---

### User Story 3 - Notification Mark as Read (Priority: P3)

When a user clicks any notification (same-project or cross-project), the notification should be marked as read before navigation occurs, ensuring the unread count and visual indicators update immediately.

**Why this priority**: Improves notification management UX and prevents confusion about which mentions have been addressed. Supports both priority flows.

**Independent Test**: Can be fully tested by verifying that clicking any notification immediately marks it as read (visually and in database) before the navigation completes.

**Acceptance Scenarios**:

1. **Given** user has unread notification, **When** user clicks notification, **Then** notification marked as read before modal opens
2. **Given** notification is marked as read on click, **When** user returns to notification dropdown, **Then** unread indicator removed and unread count decremented
3. **Given** same-project navigation occurs, **When** ticket modal opens, **Then** notification already shows as read in header dropdown

---

### Edge Cases

- What happens when notification references a deleted ticket? System should show error message instead of attempting navigation.
- What happens when user lacks access to the target project? System should show "Access Denied" message instead of navigation.
- What happens when comment has been deleted but notification still exists? Modal should open to conversation tab but show "Comment not found" indicator.
- What happens when user clicks notification while modal is already open for different ticket? System should close current modal and open new ticket modal with conversation tab.
- What happens when cross-project navigation opens but ticket modal fails to auto-open? User should still see the project board and can manually open ticket from board.
- What happens when multiple notifications are clicked rapidly? Each click should be queued and processed sequentially to avoid race conditions.

## Requirements

### Functional Requirements

- **FR-001**: System MUST detect whether notification's project matches user's current project context
- **FR-002**: System MUST navigate to ticket modal within same browser tab when notification project matches current project
- **FR-003**: System MUST open new browser tab with target project board when notification project differs from current project
- **FR-004**: System MUST automatically open ticket modal with conversation tab selected after navigation (both same-project and cross-project)
- **FR-005**: System MUST scroll conversation timeline to the specific comment mentioned in notification
- **FR-006**: System MUST mark notification as read before initiating navigation
- **FR-007**: System MUST preserve current board state when navigating to same-project ticket
- **FR-008**: System MUST handle deleted tickets gracefully with error messaging
- **FR-009**: System MUST handle insufficient permissions with appropriate error messaging
- **FR-010**: System MUST update unread count and visual indicators immediately after marking notification as read

### Key Entities

- **Notification**: Contains commentId, ticketKey, ticketId, projectId, read status, and actor information
- **Ticket Modal State**: Controls which tab is active (details, comments, files) and manages scroll position
- **Navigation Context**: Current project ID, target project ID, browser tab/window management
- **Comment Reference**: ID and position within conversation timeline for scroll targeting

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can access mentioned comments in under 2 clicks from notification dropdown (1 click on notification)
- **SC-002**: Same-project notifications navigate without page reload or board state loss
- **SC-003**: Cross-project notifications open in new tab 100% of the time when projects differ
- **SC-004**: Conversation tab is selected automatically in 100% of notification clicks
- **SC-005**: Mentioned comment is visible in viewport within 1 second of modal opening
- **SC-006**: Notification marked as read before modal opens in 100% of cases (no race conditions)
- **SC-007**: Unread count updates immediately (within 200ms) after notification click
- **SC-008**: Zero user confusion about which project/ticket they've navigated to
