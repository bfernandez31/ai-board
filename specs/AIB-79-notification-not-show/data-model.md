# Phase 1: Data Model

**Feature**: AI-Board Comment Mention Notifications
**Date**: 2025-11-24

## Entities Overview

This feature does not introduce new entities. It extends the usage of existing entities to support AI-board-authored notifications.

---

## Entity 1: Notification (Existing)

### Purpose
Represents a mention notification record linking a recipient user to a comment where they were mentioned. Tracks read/unread status and supports soft deletion for audit trails.

### Schema (No Changes Required)

```prisma
model Notification {
  id          Int       @id @default(autoincrement())
  recipientId String    // User receiving the notification
  actorId     String    // User who created the mention (AI-board in this feature)
  commentId   Int       // Source comment
  ticketId    Int       // Source ticket (for navigation)
  read        Boolean   @default(false)
  readAt      DateTime?
  createdAt   DateTime  @default(now())
  deletedAt   DateTime? // Soft delete for 30-day retention policy

  recipient User    @relation("NotificationRecipient", fields: [recipientId], references: [id], onDelete: Cascade)
  actor     User    @relation("NotificationActor", fields: [actorId], references: [id], onDelete: Cascade)
  comment   Comment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  ticket    Ticket  @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([recipientId, createdAt]) // List notifications for user
  @@index([recipientId, read])      // Count unread notifications
  @@index([createdAt])              // Cleanup job (30-day retention)
}
```

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | Int | Primary Key, Auto-increment | Unique notification identifier |
| `recipientId` | String | Foreign Key (User), Not Null, Indexed | User receiving the notification (mentioned user) |
| `actorId` | String | Foreign Key (User), Not Null | User who created the comment (AI-board in this feature) |
| `commentId` | Int | Foreign Key (Comment), Not Null | Source comment containing the mention |
| `ticketId` | Int | Foreign Key (Ticket), Not Null | Source ticket for navigation context |
| `read` | Boolean | Default: false | Whether notification has been marked as read |
| `readAt` | DateTime | Nullable | Timestamp when notification was marked as read |
| `createdAt` | DateTime | Default: now() | Notification creation timestamp |
| `deletedAt` | DateTime | Nullable | Soft delete timestamp (30-day retention policy) |

### Relationships

- **Belongs to `User` (as recipient)**: Many-to-one via `recipientId`
- **Belongs to `User` (as actor)**: Many-to-one via `actorId`
- **Belongs to `Comment`**: Many-to-one via `commentId`
- **Belongs to `Ticket`**: Many-to-one via `ticketId`

### Validation Rules

**Database Constraints** (enforced by schema):
- `recipientId` must reference valid User (foreign key constraint)
- `actorId` must reference valid User (foreign key constraint)
- `commentId` must reference valid Comment (foreign key constraint)
- `ticketId` must reference valid Ticket (foreign key constraint)
- `read` defaults to `false` on creation

**Application-Level Validation** (enforced by API logic):
- Recipient must be a project member (owner or member)
- Actor must not equal recipient (no self-notifications)
- Comment must exist and belong to the ticket
- Ticket must belong to the project

### State Transitions

```
[Created: read=false, readAt=null]
       ↓
[Mark as Read: PATCH /api/notifications/:id/read]
       ↓
[Read: read=true, readAt=<timestamp>]
       ↓
[Soft Delete: DELETE /api/notifications/:id]
       ↓
[Deleted: deletedAt=<timestamp>]
```

**Transition Rules**:
1. Notifications are immutable after creation (except `read`, `readAt`, `deletedAt`)
2. Cannot unmark as read once marked (read state is permanent)
3. Soft delete is permanent (no restoration)
4. Hard delete after 30 days via cleanup job (database-level)

### Performance Indexes

**Existing Indexes** (already optimized):
```prisma
@@index([recipientId, createdAt]) // List notifications for user (sorted by recency)
@@index([recipientId, read])      // Count unread notifications (fast filtering)
@@index([createdAt])              // Cleanup job (30-day retention query)
```

**Query Optimization**:
- Listing user notifications: O(log n) via `[recipientId, createdAt]` composite index
- Counting unread: O(log n) via `[recipientId, read]` composite index
- Bulk cleanup: O(log n) via `[createdAt]` single-column index

---

## Entity 2: Comment (Existing, No Changes)

### Purpose in This Feature
Source of mention content. AI-board comments are created via `/api/projects/[projectId]/tickets/[id]/comments/ai-board` endpoint and may contain user mentions in `@[userId:displayName]` format.

### Relevant Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Primary Key (referenced by Notification.commentId) |
| `ticketId` | Int | Foreign Key (Ticket) - used for Notification.ticketId |
| `userId` | String | Foreign Key (User) - must be AI-board user ID for this feature |
| `content` | String | Comment text containing mentions (parsed by mention-parser) |
| `createdAt` | DateTime | Comment creation timestamp |

### Validation Rules for AI-Board Comments
- `userId` must equal AI-board user ID (`ai-board@system.local`)
- `content` must pass mention format validation (optional, best-effort parsing)
- `ticketId` must reference valid ticket in specified project

---

## Entity 3: User (Existing, No Changes)

### Purpose in This Feature
Represents actors and recipients in the notification system. AI-board is a special system user.

### Relevant Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary Key (used for actorId and recipientId) |
| `email` | String | Unique identifier (AI-board: `ai-board@system.local`) |
| `name` | String | Display name (AI-board: "AI Board Assistant") |

### Special User: AI-Board
- **Email**: `ai-board@system.local`
- **Role**: System user for automated comments
- **Created By**: Seed script (`prisma/seed.ts`)
- **Cached**: User ID cached in-memory by `getAIBoardUserId()` utility

---

## Entity 4: Project (Existing, No Changes)

### Purpose in This Feature
Defines project membership for notification recipient validation. Only project members (owner + members) can receive notifications.

### Relevant Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Primary Key (used for project context) |
| `userId` | String | Foreign Key (User) - project owner (always a valid recipient) |

### Relationships
- **Has many `ProjectMember`**: One-to-many (additional valid recipients beyond owner)

---

## Entity 5: ProjectMember (Existing, No Changes)

### Purpose in This Feature
Defines additional project members (beyond owner) who are valid notification recipients.

### Relevant Fields

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | Int | Foreign Key (Project) - composite primary key part |
| `userId` | String | Foreign Key (User) - composite primary key part, valid recipient |

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. AI-Board Workflow Posts Comment                              │
│    POST /api/projects/:projectId/tickets/:id/comments/ai-board  │
│    Body: { content: "Hey @[user-123:Alice]...", userId: "..." } │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Create Comment (Prisma)                                      │
│    Comment { userId: AI-BOARD_ID, content: "...", ... }        │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Extract Mentions (mention-parser)                            │
│    extractMentionUserIds(content) → ["user-123"]               │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Validate Project Membership (Prisma query)                   │
│    Project.findUnique({ include: { members } })                │
│    validRecipients = filter(memberIds, mentioned)              │
│    Exclude: AI-BOARD_ID (no self-notifications)                │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Create Notifications (Prisma.createMany)                     │
│    Notification[] {                                             │
│      recipientId: "user-123",                                   │
│      actorId: AI-BOARD_ID,                                      │
│      commentId: comment.id,                                     │
│      ticketId: ticket.id                                        │
│    }                                                            │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. User Polls Notifications (existing system)                   │
│    GET /api/notifications (15-second interval)                  │
│    Returns: Unread notifications including AI-board mentions    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Edge Cases & Data Integrity

### Edge Case 1: Mentioned User Removed from Project During Processing
**Scenario**: User is removed from project between mention extraction and notification creation

**Handling**:
- Project membership query executes AFTER mention extraction
- Removed user filtered out during validation step (not in `projectMemberIds`)
- No notification created for removed user
- **Integrity Preserved**: No orphaned notifications

### Edge Case 2: Mentioned User Account Deleted
**Scenario**: User account deleted between mention extraction and notification creation

**Handling**:
- Foreign key constraint on `Notification.recipientId` references User
- `createMany` will fail for deleted user (database constraint violation)
- Try-catch wrapper catches error, logs it, continues execution
- **Integrity Preserved**: Comment creation succeeds, notification skipped

### Edge Case 3: AI-Board Mentions Itself
**Scenario**: Comment content includes `@[AI-BOARD-ID:AI Board]`

**Handling**:
- Mention extraction captures AI-board user ID
- Validation step filters out: `id !== aiBoardUserId`
- No notification created for AI-board
- **Integrity Preserved**: No meaningless self-notifications

### Edge Case 4: Duplicate Mentions in Same Comment
**Scenario**: Comment mentions same user multiple times (e.g., `@[user-123:Alice] ... @[user-123:Alice]`)

**Handling**:
- `extractMentionUserIds()` uses `Set` for deduplication
- Only one notification created per unique user ID
- **Integrity Preserved**: No duplicate notifications

### Edge Case 5: Notification Creation Fails (Database Error)
**Scenario**: Database timeout, connection error, or constraint violation during `createMany`

**Handling**:
- Try-catch wrapper catches exception
- Error logged: `console.error('[ai-board-comment] Failed to create notifications:', error)`
- Comment creation already succeeded (notification logic is post-creation)
- **System Reliability**: AI-board response always posted, notification best-effort

---

## Migration Requirements

**No database migrations required** for this feature. All necessary tables, columns, indexes, and constraints already exist.

### Verification Checklist
- ✅ `Notification` table exists with all required fields
- ✅ Foreign key constraints configured (User, Comment, Ticket)
- ✅ Indexes optimized for notification queries
- ✅ Soft delete column (`deletedAt`) present
- ✅ AI-board user seeded in database (`ai-board@system.local`)

---

## Data Retention Policy

**Existing Policy** (no changes):
- Notifications soft-deleted via `deletedAt` timestamp
- Hard delete after 30 days (cleanup job queries `createdAt` index)
- Cascade delete if parent entities removed (User, Comment, Ticket)

**AI-Board Notifications Follow Same Policy**:
- User deletes notification → `deletedAt` set to current timestamp
- Cleanup job removes notifications where `deletedAt < NOW() - 30 days`
- If AI-board comment deleted → all child notifications cascade delete

---

## Summary

**Zero schema changes required.** This feature leverages existing data model:
- `Notification` entity supports arbitrary actor (including AI-board)
- `Comment` entity already supports AI-board authorship
- `Project` and `ProjectMember` entities provide membership validation
- All indexes, constraints, and validation rules already in place

**Implementation only requires**:
1. Querying existing entities (Project with members relation)
2. Creating notifications using existing `Notification` schema
3. Using existing utilities (`extractMentionUserIds`, `getAIBoardUserId`)
