# Feature Specification: AI-Board Comment Mention Notifications

**Feature Branch**: `AIB-79-notification-not-show`
**Created**: 2025-11-24
**Status**: Draft
**Input**: User description: "notification not show

when ai-board assistance add a comment there is no notification on the user mentioned"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Notification scope limited to user mentions only, excluding @ai-board self-mentions
- **Policy Applied**: AUTO
- **Confidence**: High (score: +3, based on security/integrity context and consistency with existing notification system)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Scope Impact**: Feature is narrowly scoped to fix missing notifications from AI-board comments, no broader notification enhancements
  2. **Quality Impact**: Maintains consistency with existing mention notification behavior where users don't receive self-mention notifications
- **Reviewer Notes**: Verify that AI-board-as-actor notifications don't create noise for users who expect only human interactions to trigger notifications

---

- **Decision**: Notification creation will reuse existing validation logic (project membership checks, exclude self-notifications)
- **Policy Applied**: AUTO
- **Confidence**: High (score: +2, based on reliability signal from reusing existing patterns)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Timeline Impact**: Faster implementation by reusing proven validation logic
  2. **Scope Impact**: No new validation rules needed, maintains consistency with regular comment notifications
- **Reviewer Notes**: Confirm that AI-board comments should follow identical access rules as human comments (project members only)

---

- **Decision**: Non-blocking notification creation approach (log errors but don't fail comment creation)
- **Policy Applied**: AUTO
- **Confidence**: High (score: +2, based on reliability signal and existing pattern in regular comments endpoint)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Quality Impact**: AI-board responses always posted even if notification system has transient failures
  2. **User Experience Impact**: Users might occasionally miss notifications during system issues, but AI-board functionality remains reliable
- **Reviewer Notes**: Monitor notification creation error logs to detect systemic issues

## User Scenarios & Testing *(mandatory)*

### User Story 1 - AI-Board Response Notification (Priority: P1)

When a user mentions another project member in their @ai-board request, and AI-board responds with a comment that mentions users, those mentioned users should receive notifications just like they would from a human comment.

**Why this priority**: Critical bug fix - users currently miss important mentions in AI-board responses, breaking core collaboration feature

**Independent Test**: Can be fully tested by creating a ticket, mentioning @ai-board with a request like "@ai-board please notify @[user-123:Alice] about this issue", verifying Alice receives notification when AI-board responds with a comment mentioning her

**Acceptance Scenarios**:

1. **Given** AI-board posts a comment mentioning a project member, **When** the comment is created via `/api/projects/{projectId}/tickets/{id}/comments/ai-board`, **Then** a notification is created for the mentioned user
2. **Given** AI-board posts a comment mentioning multiple project members, **When** the comment is created, **Then** all mentioned members receive notifications
3. **Given** AI-board posts a comment with no mentions, **When** the comment is created, **Then** no notifications are created (no errors logged)
4. **Given** AI-board posts a comment mentioning users, **When** notification creation fails, **Then** the comment is still successfully created and error is logged

---

### User Story 2 - Non-Member Mention Handling (Priority: P2)

AI-board comments should gracefully handle mentions of users who are not project members, maintaining consistency with how regular comments handle invalid mentions.

**Why this priority**: Important for data integrity - prevents orphaned notifications and maintains consistent behavior with existing system

**Independent Test**: Can be tested by having AI-board post a comment mentioning a non-member user ID, verifying no notification is created and no error is thrown

**Acceptance Scenarios**:

1. **Given** AI-board posts a comment mentioning a non-member user, **When** notifications are processed, **Then** no notification is created for that user (they are filtered out)
2. **Given** AI-board posts a comment mentioning both members and non-members, **When** notifications are processed, **Then** only valid project members receive notifications

---

### User Story 3 - Self-Mention Exclusion (Priority: P3)

If AI-board's comment mentions itself (@ai-board in the response), no notification should be created for the AI-board user account.

**Why this priority**: Low priority polish - prevents meaningless notifications to a bot account that doesn't consume them

**Independent Test**: Can be tested by having AI-board post a comment with "@ai-board" in the text, verifying no notification is created for AI-board user

**Acceptance Scenarios**:

1. **Given** AI-board posts a comment mentioning @ai-board, **When** notifications are processed, **Then** no notification is created for the AI-board user itself
2. **Given** AI-board posts a comment mentioning @ai-board and other users, **When** notifications are processed, **Then** notifications are created only for the other mentioned users, excluding AI-board

---

### Edge Cases

- What happens when AI-board posts a comment at the exact moment a user is removed from the project? (Notification creation fails gracefully, comment still posted)
- What happens when mentioned user's account is deleted between mention extraction and notification creation? (Filtered out during project membership validation)
- What happens when notification creation times out due to database issues? (Error logged, comment creation succeeds, user misses notification but system remains operational)
- What happens when AI-board mentions the same user multiple times in one comment? (Only one notification created due to deduplication in extractMentionUserIds)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extract user mentions from AI-board comment content using the existing mention parser
- **FR-002**: System MUST validate that mentioned users are project members (owner or member) before creating notifications
- **FR-003**: System MUST create notifications for each valid mentioned user when AI-board posts a comment
- **FR-004**: System MUST exclude the AI-board user itself from receiving notifications when mentioned in AI-board comments
- **FR-005**: System MUST use AI-board's user ID as the actor in notification records
- **FR-006**: System MUST handle notification creation failures gracefully without blocking comment creation
- **FR-007**: System MUST deduplicate mentions (same user mentioned multiple times receives one notification)
- **FR-008**: System MUST follow non-blocking pattern for notification creation (log errors, don't throw)

### Key Entities

- **Notification**: Represents a mention notification record
  - `recipientId`: User who receives the notification (mentioned user)
  - `actorId`: User who created the comment (AI-board user ID)
  - `commentId`: The AI-board comment containing the mention
  - `ticketId`: The ticket where the comment was posted
  - `read`, `readAt`: Read status tracking
  - `deletedAt`: Soft delete timestamp (30-day retention)

- **Comment (AI-board authored)**: Comment created by AI-board system user
  - Contains mention format: `@[userId:displayName]`
  - Created via workflow token authenticated endpoint
  - May contain zero or more user mentions

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When AI-board posts a comment with user mentions, 100% of mentioned project members receive notifications within 500ms
- **SC-002**: Notification creation failures do not prevent AI-board comments from being posted (0% comment failures due to notification issues)
- **SC-003**: Users see AI-board mention notifications in the notification bell/dropdown within 15 seconds (current polling interval)
- **SC-004**: Zero orphaned notifications created for non-member users mentioned in AI-board comments
- **SC-005**: Notification API endpoints show AI-board as the actor for these notifications (consistent attribution)

## Assumptions

- AI-board comment endpoint (`/api/projects/[projectId]/tickets/[id]/comments/ai-board`) is the only entry point for AI-board comments
- Existing `extractMentionUserIds()` function correctly parses mention format `@[userId:displayName]`
- Project membership validation logic (owner + members query) is accurate and performant
- Notification polling system (15-second interval) is already working and will pick up new notifications
- AI-board user account exists in database and has a stable user ID retrievable via `getAIBoardUserId()`

## Dependencies

- Existing notification system (`app/lib/db/notifications.ts`)
- Mention parser utility (`app/lib/utils/mention-parser.ts`)
- AI-board user ID utility (`app/lib/db/ai-board-user.ts`)
- Regular comment creation endpoint serves as reference implementation (`app/api/projects/[projectId]/tickets/[id]/comments/route.ts` lines 252-290)

## Out of Scope

- Creating notifications for AI-board workflow status changes
- Adding real-time websocket notifications
- Changing notification polling interval
- Modifying mention format or parser logic
- Creating notifications for AI-board mentions in regular user comments (already works)
- Email notifications for AI-board mentions
- Notification preferences or filtering options
