# Mention Notifications - Quick Reference Guide

**For**: AIB-77 Implementation Team
**Link to Full Research**: `/MENTION_NOTIFICATIONS_RESEARCH.md`

---

## Quick Decision Summary

| Topic | Decision | Key File | Notes |
|-------|----------|----------|-------|
| **@Mention Parsing** | Regex on `@[userId:displayName]` | `/app/lib/utils/mention-parser.ts` | Already implemented, extract with `extractMentionUserIds()` |
| **Notification Polling** | TanStack Query 15-second interval | `/app/lib/hooks/queries/use-notifications.ts` | Dynamic interval stops when all read |
| **Mark as Read** | Optimistic update via onMutate | `/app/lib/hooks/mutations/use-mark-notification-read.ts` | Instant UI update with rollback on error |
| **UI Container** | Popover + ScrollArea + Badge | `/components/notifications/notification-bell.tsx` | shadcn/ui components, 5 items visible |
| **Timestamps** | formatDistanceToNow < 3 days | `/app/lib/utils/format-notification-time.ts` | "2 hours ago" for recent, "Nov 20, 2025" for older |

---

## Implementation Priority

### Must Have (MVP)
1. Notification model & DB persistence
2. Comment hook to extract & create notifications
3. Polling hook (15s interval)
4. Optimistic read status mutations
5. NotificationBell + NotificationDropdown UI
6. Time formatting utility

### Nice to Have (Phase 2)
1. `/notifications` full page
2. Notification filters
3. Notification preferences
4. Batch cleanup job

---

## Code Templates

### Create Notification in Comment API
```typescript
const content = req.body.content; // e.g., "Hey @[user-123:John], check this"
const { extractMentionUserIds } = await import('@/app/lib/utils/mention-parser');

const mentionedUserIds = extractMentionUserIds(content);
for (const userId of mentionedUserIds) {
  if (userId === currentUserId) continue; // Skip self

  const isMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (isMember) {
    await prisma.notification.create({
      data: {
        recipientId: userId,
        actorId: currentUserId,
        commentId: comment.id,
        ticketId,
        read: false,
      },
    });
  }
}
```

### Use Polling Hook
```typescript
const { data: notifications = [] } = useNotifications();
const unreadCount = notifications.filter(n => !n.read).length;
```

### Optimistic Update
```typescript
const { mutate: markAsRead } = useMarkNotificationRead();

markAsRead(notificationId, {
  onSuccess: () => router.push(`/ticket/${ticketKey}#comment-${commentId}`)
});
```

### Format Timestamps
```typescript
import { formatNotificationTime } from '@/app/lib/utils/format-notification-time';

const timeStr = formatNotificationTime(notification.createdAt); // "2 hours ago"
```

---

## Database Schema

```prisma
model Notification {
  id          Int      @id @default(autoincrement())
  recipientId String   // User mentioned
  actorId     String   // User who posted comment
  commentId   Int      // Source comment
  ticketId    Int      // Source ticket
  read        Boolean  @default(false)
  readAt      DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  recipient   User     @relation("notifications_recipient", fields: [recipientId], references: [id], onDelete: Cascade)
  actor       User     @relation("notifications_actor", fields: [actorId], references: [id], onDelete: Cascade)
  comment     Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  ticket      Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([recipientId, createdAt])
  @@index([recipientId, read])
  @@index([createdAt]) // For 30-day cleanup job
}
```

---

## API Endpoints

### GET /api/notifications
Returns list of notifications for current user, ordered by newest first.

**Response**:
```json
[
  {
    "id": 1,
    "recipientId": "user-2",
    "actorId": "user-1",
    "actorName": "John Doe",
    "actorImage": "https://...",
    "commentId": 123,
    "commentPreview": "Hey, check this out...",
    "ticketId": 456,
    "ticketKey": "AIB-77",
    "read": false,
    "createdAt": "2025-11-24T12:00:00Z",
    "readAt": null
  }
]
```

### PATCH /api/notifications/:id/read
Mark single notification as read.

**Response**: `{ success: true, notification: {...} }`

### PATCH /api/notifications/mark-all-read
Mark all unread notifications as read.

**Response**: `{ success: true, count: 5 }`

---

## Component Tree

```
App Layout
└── Header
    └── NotificationBell
        ├── Bell Icon (Lucide)
        ├── Badge (count)
        └── Popover
            └── NotificationDropdown
                ├── NotificationHeader ("Notifications" + "Mark all as read")
                ├── NotificationList (ScrollArea)
                │   └── NotificationItem[] (5 items)
                │       ├── Unread dot
                │       ├── Actor avatar (optional)
                │       ├── Text
                │       │   ├── "User mentioned you in TICKET-123"
                │       │   ├── "Comment preview..."
                │       │   └── "2 hours ago"
                │       └── Click → markAsRead + navigate
                └── NotificationFooter ("View all" link)
```

---

## Hooks & Mutations

### Queries
- `useNotifications()` - List with 15s polling
- `useNotificationUnreadCount()` - Derived from list (filtered)

### Mutations
- `useMarkNotificationRead(notificationId)` - Optimistic update
- `useMarkAllNotificationsRead()` - Optimistic update all

---

## Testing Checklist

### Unit Tests
- [ ] `extractMentionUserIds()` with various input formats
- [ ] `formatNotificationTime()` for all time ranges
- [ ] `useNotifications()` hook with mock data

### Integration Tests
- [ ] Create comment with @mention → notification created
- [ ] Non-member mention → no notification
- [ ] Self-mention → no notification
- [ ] Mark notification read → updates cache optimistically

### E2E Tests
- [ ] User A mentions User B → User B sees badge within 15s
- [ ] User B clicks notification → navigates to comment + marked read
- [ ] User B marks all read → badge disappears
- [ ] Timestamp displays correctly (relative < 3 days, absolute >= 3 days)

---

## Performance Notes

- **Polling**: 4 requests/min per user (15s interval) is acceptable
- **Database**: Index on `(recipientId, createdAt)` for efficient queries
- **Cache**: TanStack Query deduplicates requests across components
- **Timestamps**: Don't auto-update; refresh on polling interval

---

## Edge Cases Handled

✅ Multiple mentions in one comment → separate notifications
✅ Deleted comments → notification still visible, click shows "no longer available"
✅ Deleted users → notification shows "[Deleted User]"
✅ Non-member mentions → silently ignored
✅ Comment edits → no new notifications
✅ Concurrent reads → sync within next polling interval
✅ Notification overflow → dropdown shows 5 most recent, "View all" link

---

## Known Gotchas

1. **ScrollArea in Popover**: May need explicit height div wrapper
2. **Timestamp Updates**: Not real-time; only update on polling refresh
3. **Comment Deletion**: Notification persists but comment preview becomes stale
4. **User Deletion**: Actor name shows "[Deleted User]" gracefully

---

## References

- **Full Research Document**: `/MENTION_NOTIFICATIONS_RESEARCH.md`
- **Spec**: `/specs/AIB-77-mention-notifications/spec.md`
- **Existing Mention Parser**: `/app/lib/utils/mention-parser.ts`
- **Existing Polling Pattern**: `/app/lib/hooks/useJobPolling.ts`
- **Existing Time Format**: `/lib/utils/format-timestamp.ts`

---

**Last Updated**: 2025-11-24
**Status**: Ready for Implementation
