# Data Model: Mention Notifications

**Feature**: AIB-77 Mention Notifications
**Date**: 2025-11-24

## Overview

This document defines the database schema and data relationships for the mention notifications feature. All changes follow Prisma migration workflow and maintain referential integrity.

---

## Entities

### Notification (NEW)

Primary entity for tracking mention notifications.

#### Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | Int | Yes | auto-increment | Primary key |
| `recipientId` | String | Yes | - | User who receives the notification (FK to User.id) |
| `actorId` | String | Yes | - | User who created the mention (FK to User.id) |
| `commentId` | Int | Yes | - | Source comment containing the mention (FK to Comment.id) |
| `ticketId` | Int | Yes | - | Source ticket for navigation context (FK to Ticket.id) |
| `read` | Boolean | Yes | false | Read status indicator |
| `readAt` | DateTime | No | null | Timestamp when marked as read |
| `createdAt` | DateTime | Yes | now() | Timestamp when notification was created |
| `deletedAt` | DateTime | No | null | Soft delete timestamp (30-day retention policy) |

#### Relationships

- `recipient`: User (many-to-one) - User receiving the notification
- `actor`: User (many-to-one) - User who posted the mention
- `comment`: Comment (many-to-one) - Source comment
- `ticket`: Ticket (many-to-one) - Source ticket

#### Indexes

```prisma
@@index([recipientId, createdAt])  // List notifications for user (ordered)
@@index([recipientId, read])       // Count unread notifications
@@index([createdAt])               // Cleanup job (delete >30 days)
```

#### Validation Rules

- `recipientId` must reference existing User
- `actorId` must reference existing User
- `recipientId` ≠ `actorId` (no self-mentions)
- Both recipient and actor must be project members
- `commentId` must reference existing Comment
- `ticketId` must reference existing Ticket
- `readAt` can only be set if `read` is true
- `deletedAt` is null for active notifications

#### Cascade Behavior

- **User deletion** → CASCADE (delete all related notifications)
- **Comment deletion** → CASCADE (delete notification when source comment removed)
- **Ticket deletion** → CASCADE (delete all related notifications)

---

### User (ENHANCED)

Existing entity, adding notification relationships.

#### New Relationships

```prisma
notificationsReceived Notification[] @relation("NotificationRecipient")
notificationsCreated  Notification[] @relation("NotificationActor")
```

**Rationale**: Explicit relation names required because User has two relationships to Notification (recipient and actor). Without names, Prisma cannot infer which field maps to which relation.

---

### Comment (ENHANCED)

Existing entity, adding notification relationship.

#### New Relationships

```prisma
notifications Notification[]
```

**Behavior Change**: When a comment is created, the system will:
1. Extract @mentions from `content` field using existing `mention-parser.ts`
2. Validate mentioned users are project members
3. Create Notification records for each valid mention (excluding actor)

---

### Ticket (ENHANCED)

Existing entity, adding notification relationship.

#### New Relationships

```prisma
notifications Notification[]
```

**Purpose**: Provides navigation context. When user clicks notification, system navigates to `/projects/{projectId}/tickets/{ticketKey}#comment-{commentId}`.

---

## Complete Prisma Schema Changes

### Add Notification Model

```prisma
model Notification {
  id           Int       @id @default(autoincrement())
  recipientId  String    // User who receives notification
  actorId      String    // User who created the mention
  commentId    Int       // Source comment
  ticketId     Int       // Source ticket (for navigation)
  read         Boolean   @default(false)
  readAt       DateTime?
  createdAt    DateTime  @default(now())
  deletedAt    DateTime? // Soft delete for 30-day retention

  recipient    User      @relation("NotificationRecipient", fields: [recipientId], references: [id], onDelete: Cascade)
  actor        User      @relation("NotificationActor", fields: [actorId], references: [id], onDelete: Cascade)
  comment      Comment   @relation(fields: [commentId], references: [id], onDelete: Cascade)
  ticket       Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([recipientId, createdAt])
  @@index([recipientId, read])
  @@index([createdAt])
}
```

### Update User Model

```prisma
model User {
  id                    String    @id
  name                  String?
  email                 String          @unique
  emailVerified         DateTime?
  image                 String?
  createdAt             DateTime        @default(now())
  updatedAt             DateTime
  accounts              Account[]
  comments              Comment[]
  projects              Project[]
  sessions              Session[]
  memberships           ProjectMember[]
  notificationsReceived Notification[] @relation("NotificationRecipient")  // NEW
  notificationsCreated  Notification[] @relation("NotificationActor")      // NEW

  @@index([email])
}
```

### Update Comment Model

```prisma
model Comment {
  id            Int      @id @default(autoincrement())
  ticketId      Int
  userId        String
  content       String   @db.VarChar(2000)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  notifications Notification[]  // NEW

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([ticketId, createdAt])
  @@index([userId])
}
```

### Update Ticket Model

```prisma
model Ticket {
  id                  Int                  @id @default(autoincrement())
  title               String               @db.VarChar(100)
  description         String               @db.VarChar(2500)
  stage               Stage                @default(INBOX)
  version             Int                  @default(1)
  projectId           Int
  ticketNumber        Int
  ticketKey           String               @unique @db.VarChar(20)
  branch              String?              @db.VarChar(200)
  previewUrl          String?              @db.VarChar(500)
  autoMode            Boolean              @default(false)
  workflowType        WorkflowType         @default(FULL)
  attachments         Json?                @default("[]")
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @default(now()) @updatedAt
  clarificationPolicy ClarificationPolicy?
  comments            Comment[]
  jobs                Job[]
  notifications       Notification[]  // NEW
  project             Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, ticketNumber])
  @@index([projectId])
  @@index([stage])
  @@index([updatedAt])
  @@index([projectId, workflowType])
  @@index([ticketKey])
}
```

---

## State Transitions

### Notification Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ CREATED                                                     │
│ (Comment posted with @mention)                             │
│ - read: false                                               │
│ - readAt: null                                              │
│ - deletedAt: null                                           │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ READ                                                        │
│ (User clicks notification OR marks as read)                │
│ - read: true                                                │
│ - readAt: [timestamp]                                       │
│ - deletedAt: null                                           │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼ (After 30 days)
┌─────────────────────────────────────────────────────────────┐
│ SOFT DELETED                                                │
│ (Cleanup job runs daily)                                    │
│ - read: [unchanged]                                         │
│ - readAt: [unchanged]                                       │
│ - deletedAt: [timestamp]                                    │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼ (Future: hard delete after 60 days)
┌─────────────────────────────────────────────────────────────┐
│ PURGED                                                      │
│ (Optional: database record permanently deleted)             │
└─────────────────────────────────────────────────────────────┘
```

**Notes**:
- Notifications cannot transition from READ back to UNREAD
- Soft delete is permanent (no undo mechanism)
- Hard delete (purge) is optional future enhancement

---

## TypeScript Interfaces

### Notification

```typescript
// Generated by Prisma Client (example)
export interface Notification {
  id: number;
  recipientId: string;
  actorId: string;
  commentId: number;
  ticketId: number;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
}

// With relations (for API responses)
export interface NotificationWithRelations extends Notification {
  recipient: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  actor: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  comment: {
    id: number;
    content: string;
    createdAt: Date;
  };
  ticket: {
    id: number;
    ticketKey: string;
    title: string;
    projectId: number;
  };
}

// For frontend display
export interface NotificationDisplay {
  id: number;
  actorName: string;
  actorImage: string | null;
  ticketKey: string;
  commentPreview: string; // Truncated to 80 chars
  createdAt: Date;
  read: boolean;
  commentId: number;
  projectId: number;
}
```

### API Response Types

```typescript
// GET /api/notifications
export interface NotificationsResponse {
  notifications: NotificationDisplay[];
  unreadCount: number;
  hasMore: boolean;
}

// PATCH /api/notifications/[id]/mark-read
export interface MarkReadResponse {
  success: boolean;
  notification: NotificationDisplay;
}

// POST /api/notifications/mark-all-read
export interface MarkAllReadResponse {
  success: boolean;
  count: number; // Number of notifications marked as read
}
```

---

## Database Queries

### Create Notification (Server-Side)

```typescript
// lib/db/notifications.ts
import { prisma } from '@/lib/prisma';

export async function createNotificationForMention(params: {
  recipientId: string;
  actorId: string;
  commentId: number;
  ticketId: number;
}) {
  return prisma.notification.create({
    data: {
      recipientId: params.recipientId,
      actorId: params.actorId,
      commentId: params.commentId,
      ticketId: params.ticketId,
    },
  });
}
```

### List Notifications (with Relations)

```typescript
export async function getNotificationsForUser(userId: string, limit = 5) {
  const notifications = await prisma.notification.findMany({
    where: {
      recipientId: userId,
      deletedAt: null,
    },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      comment: {
        select: {
          id: true,
          content: true,
          createdAt: true,
        },
      },
      ticket: {
        select: {
          id: true,
          ticketKey: true,
          title: true,
          projectId: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });

  return notifications;
}
```

### Count Unread Notifications

```typescript
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      recipientId: userId,
      read: false,
      deletedAt: null,
    },
  });
}
```

### Mark Notification as Read

```typescript
export async function markNotificationAsRead(notificationId: number, userId: string) {
  return prisma.notification.update({
    where: {
      id: notificationId,
      recipientId: userId, // Ensure user owns notification
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
}
```

### Mark All Notifications as Read (Bulk)

```typescript
export async function markAllNotificationsAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      recipientId: userId,
      read: false,
      deletedAt: null,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
}
```

### Cleanup Job (30-Day Retention)

```typescript
export async function softDeleteOldNotifications() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return prisma.notification.updateMany({
    where: {
      createdAt: {
        lt: thirtyDaysAgo,
      },
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}
```

---

## Migration Strategy

### Step 1: Create Migration

```bash
npx prisma migrate dev --name add_notifications
```

This will:
1. Generate SQL migration file in `prisma/migrations/`
2. Apply migration to local development database
3. Regenerate Prisma Client with new Notification model

### Step 2: Review Generated SQL

```sql
-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "recipientId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "commentId" INTEGER NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_read_idx" ON "Notification"("recipientId", "read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Step 3: Test Migration

```bash
# Check Prisma schema is valid
npx prisma validate

# Ensure Prisma Client is generated
npx prisma generate

# Test database connection
npx prisma db pull --print
```

### Step 4: Production Deployment

```bash
# Run migration in production (automated in CI/CD)
npx prisma migrate deploy
```

---

## Data Integrity Constraints

### Application-Level Validations

1. **No self-mentions**: Before creating notification, verify `recipientId !== actorId`
2. **Project membership**: Both recipient and actor must be members of ticket's project
3. **No duplicates**: If same user mentioned multiple times in one comment, create only one notification
4. **Valid comment**: Comment must exist and belong to the specified ticket

### Database-Level Constraints

1. **Foreign keys**: Enforced by Prisma/PostgreSQL (recipientId, actorId, commentId, ticketId)
2. **Cascade deletes**: Automatic cleanup when related entities deleted
3. **Indexes**: Composite indexes optimize common queries (list, count unread)
4. **Non-nullable fields**: recipientId, actorId, commentId, ticketId, read, createdAt cannot be null

---

## Performance Considerations

### Query Optimization

- **List query**: `(recipientId, createdAt)` index enables fast sorting and filtering
- **Unread count**: `(recipientId, read)` index enables fast WHERE clause evaluation
- **Cleanup job**: `(createdAt)` index enables fast range query for old notifications

### Expected Query Performance

| Operation | Index Used | Estimated Time |
|-----------|------------|----------------|
| List 5 notifications | (recipientId, createdAt) | <10ms |
| Count unread | (recipientId, read) | <5ms |
| Mark single as read | Primary key (id) | <5ms |
| Mark all as read | (recipientId, read) | <50ms (batch) |
| Cleanup old notifications | (createdAt) | <100ms (daily job) |

### Storage Estimates

- **Notification size**: ~100 bytes per record
- **Daily volume**: 50 users × 5 mentions/day = 250 notifications/day
- **30-day retention**: 250 × 30 = 7,500 active records = ~750 KB
- **Annual volume** (with cleanup): Same as 30-day (constant ~7,500 records)

---

## Testing Data Model

### Unit Tests (Prisma Client)

```typescript
// tests/unit/notification-model.test.ts
import { prisma } from '@/lib/prisma';

describe('Notification Model', () => {
  it('should create notification with all required fields', async () => {
    const notification = await prisma.notification.create({
      data: {
        recipientId: 'user1',
        actorId: 'user2',
        commentId: 1,
        ticketId: 1,
      },
    });

    expect(notification.read).toBe(false);
    expect(notification.readAt).toBeNull();
    expect(notification.deletedAt).toBeNull();
  });

  it('should cascade delete notifications when user is deleted', async () => {
    // Create user, notification, then delete user
    // Verify notification is also deleted
  });
});
```

### Integration Tests (API)

```typescript
// tests/e2e/notifications.spec.ts
test('should create notification when user is mentioned in comment', async () => {
  // Post comment with @mention
  // Query notifications for mentioned user
  // Verify notification exists with correct fields
});
```

---

## Conclusion

The Notification data model:
- ✅ Supports all functional requirements from spec
- ✅ Maintains referential integrity with foreign keys
- ✅ Optimized with strategic indexes
- ✅ Includes soft delete for audit trail
- ✅ Follows Prisma best practices
- ✅ Type-safe with generated TypeScript interfaces

**Next Steps**: Generate API contracts based on this data model.
