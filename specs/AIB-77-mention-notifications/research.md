# Research: Mention Notifications Implementation

**Feature**: AIB-77 Mention Notifications
**Date**: 2025-11-24
**Status**: Complete

## Overview

This document consolidates research findings for implementing @mention notifications in the AI-Board Next.js application. All decisions prioritize integration with existing codebase patterns and the project constitution.

---

## Decision 1: @Mention Parsing Strategy

### Decision
Use the existing `mention-parser.ts` system with pre-formatted `@[userId:displayName]` markup pattern.

### Rationale
- **Existing infrastructure**: The codebase already has `/lib/mention-parser.ts` with tested parsing utilities
- **Type-safe**: Format includes both user ID (for lookup) and display name (for rendering)
- **Prevents invalid mentions**: Frontend validates users before inserting markup
- **Regex pattern**: `/@\[([^:]+):([^\]]+)\]/g` efficiently extracts user IDs
- **No username uniqueness required**: Works with existing User model (email-based, no unique username field)

### Implementation Approach
```typescript
// Extract user IDs from formatted mentions
function extractMentionUserIds(content: string): string[] {
  const mentionRegex = /@\[([^:]+):([^\]]+)\]/g;
  const userIds: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    userIds.push(match[1]); // Extract userId from @[userId:displayName]
  }

  return [...new Set(userIds)]; // Deduplicate
}
```

### Alternatives Considered
- **Twitter-style `@username`**: Rejected - requires unique usernames across projects (not in current User model)
- **NLP-based parsing**: Rejected - over-engineered, heavy dependencies, slower performance
- **Email-based mentions `@user@email.com`**: Rejected - poor UX, exposes emails in content

---

## Decision 2: Polling Strategy with TanStack Query

### Decision
Use TanStack Query v5 with 15-second polling interval, background polling enabled, and dynamic interval adjustment.

### Rationale
- **Specification requirement**: Feature spec explicitly states "polling every 15 seconds"
- **Consistency**: Matches existing comment polling pattern in codebase
- **Performance acceptable**: 15s delay acceptable for collaboration notifications (not critical alerts)
- **Background polling**: Continues when browser tab inactive (better user experience)
- **Dynamic intervals**: Reduce polling rate when all notifications are read (server efficiency)

### Implementation Approach
```typescript
// components/notifications/use-notifications.ts
import { useQuery } from '@tanstack/react-query';

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: (query) => {
      const notifications = query.state.data ?? [];
      const hasUnread = notifications.some(n => !n.read);
      return hasUnread ? 15000 : 30000; // 15s with unread, 30s when all read
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always fetch fresh data
  });
}
```

### Alternatives Considered
- **WebSocket/SSE (real-time)**: Rejected - adds infrastructure complexity, not needed for 15s acceptable delay, not requested in spec
- **Server-Sent Events**: Rejected - same complexity as WebSocket, overkill for this use case
- **Manual refresh button**: Rejected - breaks collaborative feel, requires explicit user action
- **30-second polling**: Rejected - spec explicitly states 15 seconds

---

## Decision 3: Optimistic Updates for Read Status

### Decision
Use TanStack Query `useMutation` with `onMutate` callback for optimistic UI updates and automatic rollback on errors.

### Rationale
- **Instant feedback**: Notification marked as read immediately (no waiting for server)
- **Safe error handling**: Snapshots previous state, rolls back on mutation failure
- **Automatic propagation**: Query cache updates reflect across all UI locations
- **Proven pattern**: Consistent with existing ticket stage transition optimistic updates in codebase

### Implementation Approach
```typescript
// components/notifications/use-notifications.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: number) =>
      fetch(`/api/notifications/${notificationId}/mark-read`, { method: 'PATCH' }),

    onMutate: async (notificationId) => {
      // Cancel outgoing queries to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      // Snapshot previous value for rollback
      const previousNotifications = queryClient.getQueryData<Notification[]>(['notifications']);

      // Optimistically update UI
      queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
        old?.map(n => n.id === notificationId ? { ...n, read: true, readAt: new Date() } : n)
      );

      return { previousNotifications }; // Context for rollback
    },

    onError: (error, _, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications'], context.previousNotifications);
      }
    },

    onSettled: () => {
      // Always refetch to ensure server sync
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
```

### Alternatives Considered
- **Simple state variable**: Rejected - only works for single UI location, no automatic rollback
- **Manual polling after update**: Rejected - delay in feedback, poor UX
- **Optimistic without rollback**: Rejected - leaves UI in inconsistent state on errors

---

## Decision 4: Notification UI Components with shadcn/ui

### Decision
Use shadcn/ui Popover for dropdown container, Badge for unread count, ScrollArea for notification list, and Button for bell trigger.

### Rationale
- **Constitution compliance**: Principle II requires shadcn/ui components exclusively
- **Accessible by default**: Radix UI primitives (shadcn foundation) include keyboard navigation, focus management, ARIA attributes
- **Proven components**: Existing codebase uses Popover for other dropdowns (consistent UX)
- **Badge component**: Perfect fit for unread count indicator (1-9, "9+" for 10+)
- **ScrollArea**: Handles overflow for >5 notifications with custom scrollbar styling

### Component Architecture
```
Header Navigation
└── NotificationBell (client component)
    ├── Button (bell icon)
    │   └── Badge (unread count)
    └── Popover
        └── NotificationDropdown
            ├── Header
            │   └── Button ("Mark all as read")
            ├── ScrollArea (max 5 visible)
            │   └── NotificationItem[] (list)
            │       ├── Avatar (actor)
            │       ├── Content (text + preview)
            │       └── Timestamp (relative)
            └── Footer
                └── Link ("View all")
```

### Implementation Details
- **Bell icon**: `lucide-react` Bell icon (already in dependencies)
- **Popover placement**: `align="end"` to align with right side of bell icon
- **ScrollArea height**: Fixed height (e.g., `max-h-[400px]`) to show ~5 notifications
- **Badge variant**: `destructive` for unread count (red background)
- **Unread indicator**: Blue dot (absolute positioned) or light blue background on item

### Known Issues & Workarounds
- **ScrollArea inside Popover**: May need explicit height wrapper due to Radix Popover content constraints
  ```tsx
  <PopoverContent className="w-[380px] p-0">
    <div className="max-h-[400px]"> {/* Explicit wrapper */}
      <ScrollArea>
        {/* Notification items */}
      </ScrollArea>
    </div>
  </PopoverContent>
  ```

### Alternatives Considered
- **Custom dropdown**: Rejected - violates constitution, reinvents accessibility
- **Dialog instead of Popover**: Rejected - too heavy for notification dropdown (full overlay)
- **Sheet component**: Rejected - mobile-first slide-in, overkill for desktop dropdown

---

## Decision 5: Relative Timestamps with date-fns

### Decision
Hybrid approach using `formatDistanceToNow` for recent notifications (<3 days) and absolute dates for older notifications.

### Rationale
- **Scannability**: Relative times ("2 hours ago") easier to parse for recent items
- **Precision for old items**: Absolute dates ("Nov 20, 2025") clearer for older notifications
- **Existing dependency**: date-fns v4.1.0 already in package.json
- **Localization ready**: date-fns supports i18n (future enhancement path)
- **Performance**: Lightweight utility functions, tree-shakeable

### Implementation Approach
```typescript
// lib/date-utils.ts
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';

export function formatNotificationTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const daysAgo = differenceInDays(new Date(), dateObj);

  if (daysAgo < 3) {
    // Recent: "2 hours ago", "just now"
    const distance = formatDistanceToNow(dateObj, { addSuffix: true });
    return distance === 'less than a minute ago' ? 'just now' : distance;
  }

  // Older: "Nov 20, 2025"
  return format(dateObj, 'MMM d, yyyy');
}
```

### Formatting Rules
| Time Range | Format | Example |
|------------|--------|---------|
| < 1 minute | "just now" | "just now" |
| < 1 hour | "X minutes ago" | "5 minutes ago" |
| < 24 hours | "X hours ago" | "2 hours ago" |
| < 3 days | "X days ago" | "1 day ago" |
| >= 3 days | "MMM d, yyyy" | "Nov 20, 2025" |

### Tooltip Enhancement
- Primary display: Relative or hybrid format
- Tooltip on hover: Absolute timestamp with time (`Nov 20, 2025 at 3:45 PM`)

```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <time>{formatNotificationTime(notification.createdAt)}</time>
  </TooltipTrigger>
  <TooltipContent>
    {format(notification.createdAt, 'MMM d, yyyy \'at\' h:mm a')}
  </TooltipContent>
</Tooltip>
```

### Alternatives Considered
- **Always relative**: Rejected - "32 days ago" is confusing, less precise
- **Always absolute**: Rejected - less scannable for recent items ("Nov 24, 2025" vs "2 hours ago")
- **Custom relative time logic**: Rejected - date-fns already handles edge cases (leap years, DST, etc.)
- **Intl.RelativeTimeFormat**: Rejected - more verbose API, less flexible formatting options

---

## Integration with Existing Codebase

### Existing Patterns to Follow

1. **Comment Creation Hook** (`/lib/hooks/mutations/use-create-comment.ts`)
   - Follow mutation pattern for notification creation
   - Use optimistic updates similar to comment creation

2. **Comment Polling** (`/lib/hooks/queries/use-comments.ts`)
   - Mirror polling configuration (refetchInterval, staleTime)
   - Consistent query key structure

3. **Job Polling** (`/lib/hooks/useJobPolling.ts`)
   - Similar background polling pattern
   - Badge count display inspiration

4. **Mention Parser** (`/lib/mention-parser.ts`)
   - Already exists! Use `extractMentionUserIds()` function
   - No new parsing logic needed

### Database Considerations

**New Notification Model** (to be added in Prisma schema):
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

  @@index([recipientId, createdAt]) // Efficient list query
  @@index([recipientId, read])      // Efficient unread count
  @@index([createdAt])              // Cleanup job (30-day retention)
}
```

**User Model Updates**:
```prisma
model User {
  // ... existing fields
  notificationsReceived Notification[] @relation("NotificationRecipient")
  notificationsCreated  Notification[] @relation("NotificationActor")
}
```

**Comment Model Updates**:
```prisma
model Comment {
  // ... existing fields
  notifications Notification[]
}
```

**Ticket Model Updates**:
```prisma
model Ticket {
  // ... existing fields
  notifications Notification[]
}
```

### API Endpoints

**GET /api/notifications** - List notifications for authenticated user
- Query params: `limit` (default 5), `offset` (pagination)
- Returns: `{ notifications: Notification[], unreadCount: number }`
- Authorization: Only show notifications for current user

**PATCH /api/notifications/[id]/mark-read** - Mark single notification as read
- Body: None (ID in URL)
- Returns: `{ success: boolean, notification: Notification }`
- Authorization: Only mark own notifications

**POST /api/notifications/mark-all-read** - Mark all notifications as read (bulk operation)
- Body: None
- Returns: `{ success: boolean, count: number }`
- Authorization: Only mark own notifications

**POST /api/comments** (existing endpoint) - Enhanced to create notifications
- After comment creation, extract mentions and create notification records
- Use Prisma transaction to ensure atomicity

---

## Testing Strategy

### Unit Tests (Vitest)

**File**: `tests/unit/mention-parser.test.ts`
- Test `extractMentionUserIds()` with various formats
- Edge cases: multiple mentions, duplicate mentions, malformed mentions
- Performance: parse 2000-character comment in <1ms

**File**: `tests/unit/date-utils.test.ts`
- Test `formatNotificationTime()` for all time ranges
- Edge cases: future dates, invalid dates, boundary conditions (exactly 3 days)

### Integration Tests (Playwright)

**File**: `tests/e2e/notifications.spec.ts`
- **Test 1**: Create comment with @mention → notification appears within 15 seconds
- **Test 2**: Click notification → navigates to ticket with comment visible
- **Test 3**: Mark notification as read → badge count updates, visual indicator changes
- **Test 4**: Mark all as read → all notifications marked, badge disappears
- **Test 5**: Polling updates → new notification appears without manual refresh
- **Test 6**: Self-mention → no notification created
- **Test 7**: Non-member mention → no notification created

---

## Performance Considerations

### Client-Side
- **Polling frequency**: 15s interval = 4 requests/min/user (acceptable load)
- **Dynamic intervals**: Reduce to 30s when all read (50% reduction in idle state)
- **Query caching**: TanStack Query caches responses, reduces redundant fetches
- **Optimistic updates**: Instant UI feedback, no waiting for server

### Server-Side
- **Database indexes**:
  - `(recipientId, createdAt)` for efficient list queries
  - `(recipientId, read)` for fast unread count
  - `(createdAt)` for cleanup job (delete notifications >30 days)
- **Batch operations**: "Mark all as read" uses single UPDATE query with WHERE clause
- **Soft deletes**: `deletedAt` field for audit trail, background job purges old records

### Database Query Examples
```sql
-- List notifications for user (optimized with index)
SELECT * FROM "Notification"
WHERE "recipientId" = $1 AND "deletedAt" IS NULL
ORDER BY "createdAt" DESC LIMIT 5;

-- Unread count (optimized with index)
SELECT COUNT(*) FROM "Notification"
WHERE "recipientId" = $1 AND "read" = false AND "deletedAt" IS NULL;

-- Mark all as read (single query)
UPDATE "Notification"
SET "read" = true, "readAt" = NOW()
WHERE "recipientId" = $1 AND "read" = false AND "deletedAt" IS NULL;

-- Cleanup job (runs daily, deletes >30 days old)
UPDATE "Notification"
SET "deletedAt" = NOW()
WHERE "createdAt" < NOW() - INTERVAL '30 days' AND "deletedAt" IS NULL;
```

---

## Edge Cases & Handling

### Duplicate Mentions
- **Scenario**: Comment contains "@[user1:Alice] @[user1:Alice]" (same user mentioned twice)
- **Handling**: Deduplicate user IDs before creating notifications (Set data structure)

### Self-Mentions
- **Scenario**: User mentions themselves in comment
- **Handling**: Filter out current user ID from notification creation list

### Non-Member Mentions
- **Scenario**: Comment contains @mention for user not in project members
- **Handling**: Query project members before creating notifications, silently skip invalid mentions

### Deleted Comments
- **Scenario**: Source comment is deleted after notification is created
- **Handling**: Notification remains visible (onDelete: Cascade handles cleanup), clicking shows "Comment no longer available" message

### Deleted Users
- **Scenario**: Actor user is deleted after creating mention
- **Handling**: Display "[Deleted User]" as actor name, avatar shows placeholder icon

### Comment Edits
- **Scenario**: User edits comment to add new @mentions
- **Handling**: Do NOT create new notifications (only on initial post, per spec)

### Concurrent Reads
- **Scenario**: User marks notification read on device A while viewing on device B
- **Handling**: Both devices sync within 15-second polling interval (TanStack Query cache)

### Notification Overflow
- **Scenario**: User accumulates >100 unread notifications
- **Handling**: Dropdown shows 5 most recent, "View all" link to full page, database query uses LIMIT for performance

---

## Implementation Checklist

### Phase 0: Database Schema ✅
- [ ] Add Notification model to Prisma schema
- [ ] Add User relation fields (notificationsReceived, notificationsCreated)
- [ ] Add Comment.notifications relation
- [ ] Add Ticket.notifications relation
- [ ] Run `prisma migrate dev` to apply migration

### Phase 1: Backend API ✅
- [ ] Implement GET /api/notifications (list + unread count)
- [ ] Implement PATCH /api/notifications/[id]/mark-read
- [ ] Implement POST /api/notifications/mark-all-read
- [ ] Enhance POST /api/comments to create notifications on mention
- [ ] Add authorization checks (only own notifications)

### Phase 2: Query Hooks ✅
- [ ] Create `useNotifications()` hook with 15s polling
- [ ] Create `useMarkNotificationRead()` mutation with optimistic updates
- [ ] Create `useMarkAllNotificationsRead()` mutation

### Phase 3: UI Components ✅
- [ ] NotificationBell component (bell icon + badge)
- [ ] NotificationDropdown component (popover content)
- [ ] NotificationItem component (single notification)
- [ ] NotificationHeader component ("Mark all as read" button)
- [ ] NotificationFooter component ("View all" link)
- [ ] Integrate NotificationBell into header/nav layout

### Phase 4: Utilities ✅
- [ ] Implement `formatNotificationTime()` in lib/date-utils.ts
- [ ] Use existing `extractMentionUserIds()` from lib/mention-parser.ts
- [ ] Add TypeScript interfaces for Notification types

### Phase 5: Testing ✅
- [ ] Unit tests: mention-parser.test.ts (if not exists)
- [ ] Unit tests: date-utils.test.ts
- [ ] E2E tests: notifications.spec.ts (full flow)

### Phase 6: Deployment ✅
- [ ] Run database migration in production (`prisma migrate deploy`)
- [ ] Verify no performance regressions (monitor database query times)
- [ ] Add background cleanup job (optional: delete notifications >30 days)

---

## Open Questions for Review

1. **Full Notifications Page**: Spec marks this as optional. Should we implement now or defer?
   - **Recommendation**: Defer - 5-notification dropdown sufficient for MVP per spec decision 4

2. **Notification Settings**: Allow users to disable mention notifications?
   - **Recommendation**: Defer - not in spec, can add later if requested

3. **Email Notifications**: Send email for mentions?
   - **Recommendation**: Defer - not in spec, separate feature

4. **@mention Autocomplete**: UI to help users find and insert mentions?
   - **Recommendation**: Check if already exists in comment input (likely does based on parsed format)

---

## Conclusion

All five research topics have been thoroughly investigated with practical implementation approaches that:
- ✅ Leverage existing codebase patterns and utilities
- ✅ Comply with project constitution (TypeScript strict, shadcn/ui, TDD, security-first)
- ✅ Use proven libraries and patterns (TanStack Query, date-fns, Prisma)
- ✅ Handle edge cases and error scenarios
- ✅ Provide clear testing strategy (unit + integration)
- ✅ Optimize for performance (indexes, polling intervals)

**Next Steps**: Proceed to Phase 1 (Data Model & Contracts) with confidence that all technical unknowns have been resolved.
