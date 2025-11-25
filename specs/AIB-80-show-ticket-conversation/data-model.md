# Phase 1: Data Model

**Feature**: Notification Click Navigation to Ticket Conversation Tab
**Date**: 2025-11-25

## Entities

### Notification (Existing - No Changes)

**Source**: `prisma/schema.prisma` (lines 167-186)

**Fields**:
```typescript
{
  id: number;                // Primary key
  recipientId: string;       // User receiving notification
  actorId: string;           // User who created mention
  commentId: number;         // Source comment for navigation
  ticketId: number;          // Source ticket (used for navigation)
  read: boolean;             // Read status (default: false)
  readAt: DateTime | null;   // Timestamp when marked as read
  createdAt: DateTime;       // Creation timestamp
  deletedAt: DateTime | null;// Soft delete (30-day retention)

  // Relations
  recipient: User;
  actor: User;
  comment: Comment;
  ticket: Ticket;            // Includes ticketKey, projectId via relation
}
```

**Relationships**:
- `recipient`: Many-to-one with User
- `actor`: Many-to-one with User
- `comment`: Many-to-one with Comment
- `ticket`: Many-to-one with Ticket (provides ticketKey, projectId for navigation)

**Indexes**:
- `[recipientId, createdAt]`: List notifications for user
- `[recipientId, read]`: Count unread notifications
- `[createdAt]`: Cleanup job (30-day retention)

**Validation Rules**:
- `id`: Required, auto-increment
- `recipientId`: Required, must reference valid User
- `actorId`: Required, must reference valid User
- `commentId`: Required, must reference valid Comment
- `ticketId`: Required, must reference valid Ticket
- `read`: Required, default false
- `readAt`: Optional, set when read=true
- `createdAt`: Required, default now()
- `deletedAt`: Optional, for soft delete

**State Transitions**:
```
UNREAD (read=false, readAt=null)
  ↓ [User clicks notification]
READ (read=true, readAt=<timestamp>)
  ↓ [30 days after readAt]
SOFT_DELETED (deletedAt=<timestamp>)
```

**Notes**:
- No database schema changes required
- Existing `Notification.ticket` relation provides `projectId` via join
- Existing `Notification.ticketKey` can be accessed via `ticket.ticketKey`

---

### NavigationContext (New - Application State)

**Purpose**: Track current project context for same-project vs cross-project detection

**Fields**:
```typescript
interface NavigationContext {
  currentProjectId: number;      // Project user is currently viewing
  targetProjectId: number;       // Project of notification's ticket
  isSameProject: boolean;        // Computed: currentProjectId === targetProjectId
  targetUrl: string;             // Full URL to navigate to
  shouldOpenNewTab: boolean;     // Computed: !isSameProject
}
```

**Validation Rules**:
- `currentProjectId`: Required, must be positive integer
- `targetProjectId`: Required, must be positive integer
- `isSameProject`: Computed field (cannot be set directly)
- `targetUrl`: Required, must be valid URL format
- `shouldOpenNewTab`: Computed field (cannot be set directly)

**Lifecycle**: Ephemeral (created per navigation event, not persisted)

---

### NotificationNavigation (New - API Request/Response)

**Purpose**: Data structure for notification navigation API calls

**Request Schema**:
```typescript
interface MarkNotificationReadRequest {
  notificationId: number;        // ID of notification to mark as read
}
```

**Response Schema**:
```typescript
interface MarkNotificationReadResponse {
  success: boolean;              // Operation success status
  notification?: {               // Updated notification (optional)
    id: number;
    read: boolean;
    readAt: string;              // ISO 8601 timestamp
  };
  error?: string;                // Error message if success=false
}
```

**Validation Rules**:
- Request: `notificationId` must be positive integer, must exist in database
- Response: `success` required, `notification` OR `error` present (not both)

---

### TicketModalState (Extended - Existing)

**Source**: `components/board/ticket-detail-modal.tsx` (lines 85, 169)

**Current Fields**:
```typescript
interface TicketDetailModalProps {
  ticket: TicketData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (ticket: TicketData) => void;
  projectId: number;
  initialTab?: 'details' | 'comments' | 'files';  // ALREADY EXISTS
}
```

**Internal State**:
```typescript
const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'files'>(initialTab);
```

**Changes Required**: NONE
- Modal already supports `initialTab` prop (line 85, 161)
- State management already exists (line 169)
- `useEffect` already respects `initialTab` changes (line 198-206)

**Validation Rules**:
- `initialTab`: Optional, must be one of: 'details', 'comments', 'files'
- Default: 'details' if not specified

---

## Data Flow

### 1. Notification Click → Navigation

```
User clicks notification
  ↓
NotificationDropdown.handleNotificationClick(notification)
  ↓
1. Extract navigation data:
   - currentProjectId (from route)
   - targetProjectId (from notification.ticket.projectId)
   - ticketKey (from notification.ticket.ticketKey)
   - commentId (from notification.commentId)
  ↓
2. Build NavigationContext:
   - isSameProject = currentProjectId === targetProjectId
   - targetUrl = buildNotificationUrl({projectId, ticketKey, commentId})
   - shouldOpenNewTab = !isSameProject
  ↓
3. Mark as read (optimistic):
   - Call markAsRead.mutate(notification.id)
   - Update local cache: notification.read = true
  ↓
4. Navigate:
   IF shouldOpenNewTab:
     window.open(targetUrl, '_blank')
   ELSE:
     router.push(targetUrl)
  ↓
Target page loads with modal open + comments tab + scroll to comment
```

### 2. Mark as Read Flow

```
markAsRead.mutate(notificationId)
  ↓
POST /api/notifications/{id}/read
  ↓
Prisma update:
  notification.update({
    where: { id: notificationId },
    data: {
      read: true,
      readAt: new Date()
    }
  })
  ↓
Return success response
  ↓
TanStack Query:
  - Optimistic update succeeded
  - Invalidate notification cache
  - Re-fetch unread count
```

### 3. Modal Opening with Tab Selection

```
Board component receives URL:
  /projects/123/tickets/ABC-45?modal=open&tab=comments#comment-789
  ↓
Parse URL params:
  - modal: 'open'
  - tab: 'comments'
  - hash: 'comment-789'
  ↓
Board.tsx state:
  - selectedTicket = <ticket ABC-45>
  - modalOpen = true
  - initialTab = 'comments'  // Parsed from URL
  ↓
TicketDetailModal renders:
  - Receives initialTab='comments'
  - useEffect sets activeTab='comments'
  - TabsContent renders ConversationTimeline
  ↓
Browser scrolls to #comment-789 (native anchor behavior)
```

---

## Derived Data

### Notification with Navigation Data (Computed)

**Purpose**: Enrich notification with data needed for navigation

```typescript
interface NotificationWithNavData extends Notification {
  // Existing fields from Notification model
  id: number;
  recipientId: string;
  actorId: string;
  commentId: number;
  ticketId: number;
  read: boolean;
  readAt: DateTime | null;
  createdAt: DateTime;

  // Computed/joined fields (from relations)
  projectId: number;             // From ticket.projectId
  ticketKey: string;             // From ticket.ticketKey
  actorName: string;             // From actor.name
  actorImage: string | null;     // From actor.image
  commentPreview: string;        // From comment.content (first 100 chars)
}
```

**Source Query** (existing):
```typescript
// From app/api/notifications/route.ts or use-notifications.ts
prisma.notification.findMany({
  where: { recipientId, deletedAt: null },
  include: {
    actor: { select: { name: true, image: true } },
    comment: { select: { content: true } },
    ticket: {
      select: {
        ticketKey: true,
        projectId: true
      }
    }
  },
  orderBy: { createdAt: 'desc' },
  take: 20
})
```

**Transformation**:
```typescript
const enrichedNotification = {
  ...notification,
  projectId: notification.ticket.projectId,
  ticketKey: notification.ticket.ticketKey,
  actorName: notification.actor.name,
  actorImage: notification.actor.image,
  commentPreview: notification.comment.content.substring(0, 100)
};
```

---

## Validation Schemas (Zod)

### NotificationNavigationSchema

```typescript
import { z } from 'zod';

export const NotificationNavigationSchema = z.object({
  notificationId: z.number().int().positive(),
  currentProjectId: z.number().int().positive(),
  targetProjectId: z.number().int().positive(),
  ticketKey: z.string().min(1).max(20),
  commentId: z.number().int().positive(),
});

export type NotificationNavigation = z.infer<typeof NotificationNavigationSchema>;
```

### MarkNotificationReadSchema

```typescript
export const MarkNotificationReadRequestSchema = z.object({
  notificationId: z.number().int().positive(),
});

export const MarkNotificationReadResponseSchema = z.object({
  success: z.boolean(),
  notification: z.object({
    id: z.number(),
    read: z.boolean(),
    readAt: z.string().datetime(),
  }).optional(),
  error: z.string().optional(),
});

export type MarkNotificationReadRequest = z.infer<typeof MarkNotificationReadRequestSchema>;
export type MarkNotificationReadResponse = z.infer<typeof MarkNotificationReadResponseSchema>;
```

---

## Database Queries

### Check if Notification Exists and User Has Access

```typescript
const notification = await prisma.notification.findFirst({
  where: {
    id: notificationId,
    recipientId: userId,        // Security: ensure user owns notification
    deletedAt: null,            // Exclude soft-deleted
  },
  include: {
    ticket: {
      select: {
        ticketKey: true,
        projectId: true,
      }
    }
  }
});

if (!notification) {
  throw new Error('Notification not found or access denied');
}
```

### Mark Notification as Read

```typescript
const updatedNotification = await prisma.notification.update({
  where: { id: notificationId },
  data: {
    read: true,
    readAt: new Date(),
  },
  select: {
    id: true,
    read: true,
    readAt: true,
  }
});
```

### Get Unread Count After Update

```typescript
const unreadCount = await prisma.notification.count({
  where: {
    recipientId: userId,
    read: false,
    deletedAt: null,
  }
});
```

---

## Summary

- **Existing Models**: Notification model has all required data (no schema changes)
- **New Interfaces**: NavigationContext (ephemeral), NotificationNavigation (API DTO)
- **Extended Interfaces**: TicketModalState already supports `initialTab` (no changes)
- **Validation**: Zod schemas for type safety and runtime validation
- **Queries**: Simple Prisma updates, no complex transactions needed
- **Security**: Row-level checks (recipientId matches userId) on all operations
