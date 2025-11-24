# Mention Notifications Research & Implementation Guide

**Feature**: AIB-77 Mention Notifications for Next.js + TypeScript Application
**Date**: 2025-11-24
**Tech Stack**: Next.js 15 (App Router), TypeScript 5.6, TanStack Query v5.90.5, shadcn/ui, date-fns 4.1.0

---

## 1. @Mention Parsing in TypeScript

### Decision: Regex-Based Parsing with Custom Formatted Mentions

**Approach**: Use regex pattern `/@\[([^:]+):([^\]]+)\]/g` to parse pre-formatted mentions stored in the database as `@[userId:displayName]` markup.

### Rationale

1. **Leverages Existing Patterns**: The application already implements mention parsing with a dedicated utility module (`/app/lib/utils/mention-parser.ts`) that:
   - Stores mentions in a structured format: `@[userId:displayName]`
   - Provides utility functions: `parseMentions()`, `formatMention()`, `extractMentionUserIds()`, `validateMentionFormat()`
   - Handles edge cases like deleted users and deleted comments

2. **Type Safety**: Mentions are stored with both user ID and display name, enabling:
   - Lookup of user objects by ID for notifications
   - Graceful handling of deleted users (show "[Removed User]")
   - Filtering of invalid mentions (non-members) during creation

3. **Separation of Concerns**: Unlike Twitter-style `@username` parsing:
   - Comment form validates mentions during input via `MentionInput` component with autocomplete
   - Backend validation ensures only valid project members are mentioned
   - Notification creation extracts user IDs from pre-formatted mentions

4. **Performance**: Simple regex on finite mention count per comment (typically 1-5 mentions) is negligible CPU cost

5. **Maintainability**: Dedicated utility functions make code intent clear and testable

### Implementation Details

**Existing Mention Regex** (`/app/lib/utils/mention-parser.ts`):
```typescript
export const MENTION_REGEX = /@\[([^:]+):([^\]]+)\]/g;

export function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  MENTION_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    const userId = match[1];
    const displayName = match[2];
    if (!userId || !displayName) continue;

    mentions.push({
      userId,
      displayName,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }
  return mentions;
}

export function extractMentionUserIds(content: string): string[] {
  const mentions = parseMentions(content);
  return Array.from(new Set(mentions.map(m => m.userId)));
}
```

**Comment Input Flow**:
1. User types in textarea and types `@` → `MentionInput` component detects `@` at word boundary
2. Shows autocomplete dropdown of project members via `UserAutocomplete`
3. User selects member → mention formatted as `@[userId:displayName]` and inserted in text
4. On submit, comment text contains pre-formatted mentions

**Notification Creation**:
```typescript
// In API handler creating comment
const content = req.body.content; // e.g., "Hey @[user-123:John], check this"
const mentionedUserIds = extractMentionUserIds(content);
const currentUserId = req.userId;

// Create notifications only for valid mentions
for (const userId of mentionedUserIds) {
  if (userId === currentUserId) continue; // Skip self-mentions

  // Verify user is project member before creating notification
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
        type: 'MENTION',
        read: false,
      },
    });
  }
}
```

### Alternatives Considered

1. **Twitter-Style `@username` Parsing**: Pattern `/@\B[a-z0-9_-]+/gi`
   - Pros: More familiar to users, simpler regex
   - Cons: Requires username uniqueness across all projects (breaks multi-project design), slower lookup time, edge cases with email addresses
   - Decision: Rejected (requires architectural change)

2. **NLP-Based Entity Recognition**: Use library like `compromise` or `natural`
   - Pros: Handles variants like "hey user_name" or "user.name"
   - Cons: Heavy dependency (50+ KB), overkill for structured mentions, slower parsing
   - Decision: Rejected (over-engineered for use case)

3. **Server-Side Comment Parsing on Edit**: Re-parse mentions if comment is edited
   - Pros: Could detect new mentions in edited comments
   - Cons: Contradicts spec requirement "Comment edit with new mentions does NOT create new notifications"
   - Decision: Rejected per spec

### Type Definitions

```typescript
// /app/lib/types/mention.ts
export interface ParsedMention {
  userId: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  image?: string;
}

export interface ProjectMember extends User {
  email: string; // ProjectMember always has email
}
```

### Testing Strategy

- Unit tests for `parseMentions()`, `extractMentionUserIds()`, `validateMentionFormat()`
- Integration test: Create comment with @mention → verify notification created for valid members only
- Edge cases:
  - Multiple mentions in one comment
  - Self-mention (@own-user-id)
  - Non-member mentions (@invalid-user-id)
  - Partial markup (@[invalid, @[user without closing)

---

## 2. TanStack Query Polling for Notifications

### Decision: 15-Second Polling with Dynamic Intervals and Background Support

**Approach**: Implement `useNotifications` hook using TanStack Query v5 with:
- `refetchInterval: 15000` (15 seconds per spec requirement)
- `refetchIntervalInBackground: true` (continue polling even when tab is inactive)
- Dynamic interval function to stop polling when not needed

### Rationale

1. **Consistency with Existing Patterns**: Application already implements polling for:
   - Comments: `useComments()` hook with configurable `refetchInterval`
   - Jobs: `useJobPolling()` with 2-second interval and conditional stop logic
   - Both use TanStack Query v5 with dynamic intervals

2. **Explicit Spec Requirement**: Feature specification explicitly states "polling every 15 seconds for new notifications (similar to comments)"

3. **Background Polling Necessity**: Notification system must update even when user switches tabs because:
   - User might be mentioned while reading another page
   - Badge count needs to update without tab refocus
   - Aligns with app's real-time collaboration feel

4. **Smart Polling**: Dynamic intervals stop unnecessary requests when:
   - Notification dropdown is closed AND all notifications marked as read
   - Reduces server load and client-side processing

5. **TanStack Query v5 Improvements**:
   - Better request deduplication than manual polling
   - Automatic retry with exponential backoff
   - Browser focus tracking built-in
   - GC (garbage collection) for stale data

### Implementation Details

**Hook: useNotifications**
```typescript
// /app/lib/hooks/queries/use-notifications.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { Notification } from '@prisma/client';

interface UseNotificationsOptions {
  enabled?: boolean; // Default: true (always poll when authenticated)
  refetchInterval?: number | false; // Default: 15000ms
}

export function useNotifications({
  enabled = true,
  refetchInterval = 15000
}: UseNotificationsOptions = {}) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: async (): Promise<Notification[]> => {
      const response = await fetch('/api/notifications');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch notifications');
      }

      return response.json();
    },

    enabled,

    // Dynamic interval: stop polling if all notifications are read
    refetchInterval: (query) => {
      const notifications = query.state.data || [];
      const hasUnread = notifications.some(n => !n.read);

      // Continue polling if there are unread notifications
      // Otherwise poll every 30 seconds (lower frequency)
      return hasUnread ? refetchInterval : 30000;
    },

    // Continue polling even when tab is inactive
    refetchIntervalInBackground: true,

    // Data is always stale (polling-based)
    staleTime: 0,

    // Keep cached for 5 minutes after unmount
    gcTime: 5 * 60 * 1000,

    // Retry on failure (helps with transient network issues)
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Don't refetch on window focus (already polling in background)
    refetchOnWindowFocus: false,
  });
}
```

**Query Key Factory**:
```typescript
// /app/lib/query-keys.ts - extend existing
export const queryKeys = {
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
    detail: (id: number) => ['notifications', 'detail', id] as const,
    unreadCount: () => ['notifications', 'unreadCount'] as const,
  },
  // ... other keys
};
```

**Hook: useNotificationUnreadCount**
```typescript
// Derived from notification list, no separate query needed
export function useNotificationUnreadCount() {
  const { data: notifications = [] } = useNotifications();
  return notifications.filter(n => !n.read).length;
}
```

**Mark as Read Mutation**:
```typescript
// /app/lib/hooks/mutations/use-mark-notification-read.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      return response.json();
    },

    onMutate: async (notificationId) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.list(),
      });

      // Snapshot previous data
      const previous = queryClient.getQueryData<Notification[]>(
        queryKeys.notifications.list()
      );

      // Optimistic update
      if (previous) {
        queryClient.setQueryData(
          queryKeys.notifications.list(),
          previous.map(n =>
            n.id === notificationId ? { ...n, read: true, readAt: new Date() } : n
          )
        );
      }

      return { previous };
    },

    onError: (err, notificationId, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.notifications.list(),
          context.previous
        );
      }
    },

    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.list(),
      });
    },
  });
}
```

**Mark All As Read Mutation**:
```typescript
// /app/lib/hooks/mutations/use-mark-all-notifications-read.ts
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }

      return response.json();
    },

    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.list(),
      });

      const previous = queryClient.getQueryData<Notification[]>(
        queryKeys.notifications.list()
      );

      if (previous) {
        const now = new Date();
        queryClient.setQueryData(
          queryKeys.notifications.list(),
          previous.map(n => ({ ...n, read: true, readAt: now }))
        );
      }

      return { previous };
    },

    onError: (err, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.notifications.list(),
          context.previous
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.list(),
      });
    },
  });
}
```

**Usage in Header Component**:
```typescript
// /components/header/notification-bell.tsx
'use client';

import { useNotifications, useNotificationUnreadCount } from '@/app/lib/hooks/queries/use-notifications';
import { useMarkNotificationRead, useMarkAllNotificationsRead } from '@/app/lib/hooks/mutations/use-mark-notification-read';
import { Bell } from 'lucide-react';
import { useState } from 'react';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: notifications = [] } = useNotifications();
  const unreadCount = useNotificationUnreadCount();
  const { mutate: markAsRead } = useMarkNotificationRead();
  const { mutate: markAllAsRead } = useMarkAllNotificationsRead();

  const recentNotifications = notifications.slice(0, 5);
  const hasMore = notifications.length > 5;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96">
        {/* Header with title and mark all read */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
            >
              Mark all as read
            </Button>
          )}
        </div>

        {/* Scrollable notification list */}
        {recentNotifications.length > 0 ? (
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {recentNotifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={() => {
                    markAsRead(notification.id);
                    // Navigate to ticket
                  }}
                />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-center text-muted-foreground py-8">No notifications</p>
        )}

        {/* Footer with view all link */}
        {hasMore && (
          <div className="border-t mt-4 pt-2">
            <Link href="/notifications" className="text-sm text-primary hover:underline">
              View all notifications
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

### Configuration Options

| Option | Value | Purpose |
|--------|-------|---------|
| `refetchInterval` | `15000` | 15 seconds per spec |
| `refetchIntervalInBackground` | `true` | Continue polling when tab inactive |
| `staleTime` | `0` | Always stale (polling-based) |
| `gcTime` | `5 * 60 * 1000` | Keep cache 5 min after unmount |
| `retry` | `2` | Retry on transient failures |
| `refetchOnWindowFocus` | `false` | Don't double-poll on focus |

### Alternatives Considered

1. **WebSocket/SSE**: Real-time delivery without polling
   - Pros: Instant delivery
   - Cons: Adds server complexity (WebSocket handler, connection management), infrastructure changes, battery drain on mobile, 15-second delay acceptable per spec
   - Decision: Rejected (scope and complexity exceed MVP needs)

2. **Fixed 15-Second Polling Only**: No dynamic intervals
   - Pros: Simplest implementation
   - Cons: Unnecessary server load when no unread notifications, doesn't scale to 100+ unread
   - Decision: Rejected (dynamic intervals provide efficiency)

3. **Manual Refetch Buttons**: User-initiated polling
   - Pros: Zero server load
   - Cons: Breaks real-time collaboration feel, contradicts spec "polling every 15 seconds"
   - Decision: Rejected per spec

### Performance Considerations

- **Request Size**: Paginate notifications (show 5 in dropdown, paginate on full page)
- **Cache Strategy**: Keep full list in cache, derived hook filters to unread count
- **Background Load**: 4 requests per minute per user (15s interval × 60s) is acceptable
- **Concurrent Users**: Scale linearly; no special handling needed for 100+ concurrent

---

## 3. Optimistic Updates for Notification Read Status

### Decision: TanStack Query onMutate Pattern with Dual Rollback Strategy

**Approach**: Use `useMutation` with `onMutate` callback to:
1. Cancel in-flight queries
2. Snapshot previous state
3. Optimistically update UI
4. Roll back on error
5. Refetch on completion to ensure consistency

### Rationale

1. **Immediate Visual Feedback**: Mark notification as read instantly, no 15-second delay
   - User clicks notification → badge disappears immediately
   - Better perceived performance and responsiveness

2. **Consistent with App Patterns**: Application uses this pattern for:
   - Ticket stage transitions (optimistic stage change before server confirmation)
   - Comment mutations (optimistic comment addition before fetch completes)
   - Prevents UI jank from waiting for network round-trip

3. **Safe Error Handling**: Rollback pattern ensures:
   - If server rejects read request, UI reverts to correct state
   - No stale state cached after failed operation
   - User sees accurate notification list on retry

4. **TanStack Query Native**: Built-in mutation hooks handle:
   - Query cancellation (no race conditions)
   - Data consistency via snapshots
   - Automatic invalidation

### Implementation Details

**Mark Single Notification as Read** (with optimistic update):
```typescript
// /app/lib/hooks/mutations/use-mark-notification-read.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { Notification } from '@prisma/client';

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(
        `/api/notifications/${notificationId}/read`,
        { method: 'PATCH' }
      );

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      return response.json() as Promise<Notification>;
    },

    // Step 1: Prepare optimistic update
    onMutate: async (notificationId: number) => {
      // Cancel queries to prevent race condition
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.list(),
      });

      // Snapshot current state for rollback
      const previousNotifications = queryClient.getQueryData<Notification[]>(
        queryKeys.notifications.list()
      );

      // Optimistic update: mark as read immediately
      if (previousNotifications) {
        const now = new Date();
        queryClient.setQueryData(
          queryKeys.notifications.list(),
          previousNotifications.map(n =>
            n.id === notificationId
              ? { ...n, read: true, readAt: now }
              : n
          )
        );
      }

      // Return context for rollback
      return { previousNotifications };
    },

    // Step 2: Handle errors - revert optimistic update
    onError: (error, notificationId, context) => {
      console.error('Failed to mark notification as read:', error);

      // Rollback to previous state
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          queryKeys.notifications.list(),
          context.previousNotifications
        );
      }

      // Optional: Show error toast to user
      // toast.error('Failed to mark notification as read');
    },

    // Step 3: Refetch to ensure consistency with server
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.list(),
      });
    },
  });
}
```

**Mark All Notifications as Read** (batch operation):
```typescript
// /app/lib/hooks/mutations/use-mark-all-notifications-read.ts
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(
        '/api/notifications/mark-all-read',
        { method: 'PATCH' }
      );

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }

      return response.json() as Promise<{ count: number }>;
    },

    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.list(),
      });

      const previousNotifications = queryClient.getQueryData<Notification[]>(
        queryKeys.notifications.list()
      );

      // Optimistic: mark all as read
      if (previousNotifications) {
        const now = new Date();
        queryClient.setQueryData(
          queryKeys.notifications.list(),
          previousNotifications.map(n => ({
            ...n,
            read: true,
            readAt: now
          }))
        );
      }

      return { previousNotifications };
    },

    onError: (error, _, context) => {
      console.error('Failed to mark all notifications as read:', error);

      if (context?.previousNotifications) {
        queryClient.setQueryData(
          queryKeys.notifications.list(),
          context.previousNotifications
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.list(),
      });
    },
  });
}
```

**UI Component Usage**:
```typescript
// /components/header/notification-item.tsx
'use client';

import { useMarkNotificationRead } from '@/app/lib/hooks/mutations/use-mark-notification-read';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import type { Notification } from '@prisma/client';

interface NotificationItemProps {
  notification: Notification;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const router = useRouter();
  const { mutate: markAsRead } = useMarkNotificationRead();

  const handleClick = () => {
    // Optimistic update happens automatically via mutation
    markAsRead(notification.id, {
      onSuccess: () => {
        // Navigate after marking as read
        router.push(`/ticket/${notification.ticketKey}#comment-${notification.commentId}`);
      },
    });
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left px-3 py-2 rounded hover:bg-accent transition-colors',
        !notification.read && 'bg-blue-50 dark:bg-blue-950'
      )}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full" />
      )}

      {/* Content */}
      <div className="ml-3">
        <p className="text-sm font-medium">
          {notification.actorName} mentioned you in {notification.ticketKey}
        </p>
        <p className="text-xs text-muted-foreground truncate max-w-xs">
          {notification.commentPreview}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}
```

### Type-Safe Mutation Context

```typescript
// /app/lib/types/mutations.ts
export interface MarkNotificationReadContext {
  previousNotifications: Notification[] | undefined;
}
```

### Optimistic Update Patterns Comparison

| Pattern | Use Case | Pros | Cons |
|---------|----------|------|------|
| **Variables (Simple)** | Single item updates | Minimal code, no rollback needed | Only works for single UI location |
| **Cache Manipulation (onMutate)** | Multi-location updates | Handles complex scenarios, propagates updates | More boilerplate, requires snapshots |
| **useMutationState** | Concurrent mutations | Access mutations across components | Requires mutationKey setup |

**Selected**: Cache Manipulation via `onMutate` because:
- Notification read state affects badge count, dropdown, full page list
- Multiple UI locations show same notification
- Automatic propagation via query invalidation

### Error Scenarios

1. **Network Failure**: Rollback + retry button
2. **Server Rejects (400)**: Rollback + show error message
3. **Concurrent Updates**: Last-write-wins via server (optimistic update reverted if server has newer state)
4. **Lost Connection**: Retry on reconnect via TanStack Query auto-retry

### Testing Strategy

- Unit test: Verify mutation calls correct API endpoint with correct payload
- Integration test: Optimistic update → network delay → see UI change immediately
- E2E test: Click notification → mark read in background → verify badge updates before navigation

---

## 4. Notification UI with shadcn/ui Components

### Decision: Popover with ScrollArea Containing Notification Cards

**Components Selected**:
- **Popover**: Dropdown container (shows on bell click, hides on outside click)
- **Badge**: Unread count indicator (displays 1-9, "9+" for 10+)
- **ScrollArea**: Scrollable notification list (5 items visible, scroll for more)
- **Button**: Bell icon trigger and action buttons
- **Card** or custom div: Individual notification items

### Rationale

1. **Official shadcn/ui Recommendations**:
   - Popover is designed for "contextual content anchored to a trigger"
   - Badge is the standard pattern for notification count badges
   - ScrollArea handles scrolling in constrained spaces

2. **Accessibility**: shadcn/ui components built on Radix UI provide:
   - ARIA attributes for screen readers
   - Keyboard navigation (arrow keys, Enter, Escape)
   - Focus management
   - Portal rendering to avoid z-index stacking issues

3. **Consistent with App**: Application uses shadcn/ui throughout:
   - Existing components: Dialog, Select, Tooltip, ScrollArea
   - Design tokens: TailwindCSS + Radix UI colors
   - Typography and spacing already defined

4. **Component Composition**: Instead of single monolithic component:
   - `<NotificationBell>`: Icon + Badge trigger
   - `<NotificationDropdown>`: Popover + ScrollArea wrapper
   - `<NotificationItem>`: Individual notification card
   - `<NotificationHeader>`: Title + Mark all as read action
   - `<NotificationFooter>`: View all link

### Implementation Details

**File Structure**:
```
/components/notifications/
  ├── notification-bell.tsx       # Bell icon + Badge
  ├── notification-dropdown.tsx   # Popover wrapper
  ├── notification-item.tsx       # Individual notification card
  ├── notification-header.tsx     # Dropdown header
  ├── notification-footer.tsx     # Dropdown footer
  └── notification-list.tsx       # Scrollable list wrapper
```

**NotificationBell Component**:
```typescript
// /components/notifications/notification-bell.tsx
'use client';

import { useNotifications } from '@/app/lib/hooks/queries/use-notifications';
import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { NotificationDropdown } from './notification-dropdown';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: notifications = [], isLoading } = useNotifications();

  const unreadCount = notifications.filter(n => !n.read).length;
  const badgeText = unreadCount > 9 ? '9+' : unreadCount.toString();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`${unreadCount} unread notifications`}
        >
          <Bell className="h-5 w-5" />

          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {badgeText}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-96 p-0"
        align="end"
        sideOffset={8}
      >
        <NotificationDropdown
          notifications={notifications}
          isLoading={isLoading}
          onClose={() => setIsOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
```

**NotificationDropdown Component** (main container):
```typescript
// /components/notifications/notification-dropdown.tsx
'use client';

import { NotificationHeader } from './notification-header';
import { NotificationList } from './notification-list';
import { NotificationFooter } from './notification-footer';
import type { Notification } from '@prisma/client';

interface NotificationDropdownProps {
  notifications: Notification[];
  isLoading: boolean;
  onClose: () => void;
}

export function NotificationDropdown({
  notifications,
  isLoading,
  onClose,
}: NotificationDropdownProps) {
  const unreadCount = notifications.filter(n => !n.read).length;
  const recentNotifications = notifications.slice(0, 5);
  const hasMore = notifications.length > 5;

  return (
    <div className="divide-y bg-popover">
      <NotificationHeader unreadCount={unreadCount} />

      <NotificationList
        notifications={recentNotifications}
        isLoading={isLoading}
        onClose={onClose}
      />

      {(hasMore || notifications.length === 0) && (
        <NotificationFooter
          hasMore={hasMore}
          isEmpty={notifications.length === 0}
        />
      )}
    </div>
  );
}
```

**NotificationHeader Component** (title + mark all as read):
```typescript
// /components/notifications/notification-header.tsx
'use client';

import { useMarkAllNotificationsRead } from '@/app/lib/hooks/mutations/use-mark-all-notifications-read';
import { Button } from '@/components/ui/button';

interface NotificationHeaderProps {
  unreadCount: number;
}

export function NotificationHeader({ unreadCount }: NotificationHeaderProps) {
  const { mutate: markAllAsRead, isPending } = useMarkAllNotificationsRead();

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <h2 className="font-semibold text-base">Notifications</h2>

      {unreadCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => markAllAsRead()}
          disabled={isPending}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Mark all as read
        </Button>
      )}
    </div>
  );
}
```

**NotificationList Component** (ScrollArea wrapper):
```typescript
// /components/notifications/notification-list.tsx
'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationItem } from './notification-item';
import type { Notification } from '@prisma/client';

interface NotificationListProps {
  notifications: Notification[];
  isLoading: boolean;
  onClose: () => void;
}

export function NotificationList({
  notifications,
  isLoading,
  onClose,
}: NotificationListProps) {
  return (
    <ScrollArea className="h-96">
      <div className="px-4 py-2">
        {isLoading && notifications.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">
            Loading...
          </p>
        ) : notifications.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">
            No notifications
          </p>
        ) : (
          <div className="space-y-1">
            {notifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onNavigate={onClose}
              />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
```

**NotificationItem Component** (individual notification card):
```typescript
// /components/notifications/notification-item.tsx
'use client';

import { useMarkNotificationRead } from '@/app/lib/hooks/mutations/use-mark-notification-read';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Notification } from '@prisma/client';

interface NotificationItemProps {
  notification: Notification;
  onNavigate: () => void;
}

export function NotificationItem({
  notification,
  onNavigate,
}: NotificationItemProps) {
  const router = useRouter();
  const { mutate: markAsRead } = useMarkNotificationRead();

  const handleClick = () => {
    // Mutation automatically updates optimistically
    markAsRead(notification.id, {
      onSuccess: () => {
        // Close dropdown and navigate
        onNavigate();
        router.push(`/ticket/${notification.ticketKey}#comment-${notification.commentId}`);
      },
    });
  };

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  });

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left px-3 py-2 rounded-md transition-colors',
        'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
        !notification.read && 'bg-blue-50 dark:bg-blue-950/30'
      )}
    >
      <div className="flex gap-3">
        {/* Unread indicator dot */}
        {!notification.read && (
          <div className="mt-2 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-blue-500" aria-label="Unread" />
          </div>
        )}

        {/* Actor avatar (optional, remove if not in spec) */}
        {notification.actorImage && (
          <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
            <AvatarImage src={notification.actorImage} alt={notification.actorName} />
            <AvatarFallback>{notification.actorName?.[0]}</AvatarFallback>
          </Avatar>
        )}

        {/* Notification content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {notification.actorName} mentioned you in{' '}
            <span className="font-semibold text-primary">
              {notification.ticketKey}
            </span>
          </p>

          {/* Comment preview - truncated to 80 chars per spec */}
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {notification.commentPreview?.substring(0, 80)}
          </p>

          {/* Relative timestamp */}
          <time className="text-xs text-muted-foreground mt-1 block">
            {timeAgo}
          </time>
        </div>
      </div>
    </button>
  );
}
```

**NotificationFooter Component** (view all link):
```typescript
// /components/notifications/notification-footer.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

interface NotificationFooterProps {
  hasMore: boolean;
  isEmpty: boolean;
}

export function NotificationFooter({ hasMore, isEmpty }: NotificationFooterProps) {
  if (isEmpty) {
    return null;
  }

  return (
    <div className="px-4 py-2">
      <Link href="/notifications" className="w-full block">
        <Button
          variant="ghost"
          className="w-full justify-between text-primary text-sm h-8"
        >
          {hasMore ? 'View all notifications' : 'View notification history'}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
```

### Component Hierarchy

```
NotificationBell (header nav)
├── Bell Icon (Lucide)
├── Badge (unread count)
└── Popover
    └── PopoverContent (w-96)
        └── NotificationDropdown (divide-y bg-popover)
            ├── NotificationHeader
            │   ├── "Notifications" title
            │   └── "Mark all as read" button (if unread > 0)
            ├── NotificationList
            │   └── ScrollArea (h-96)
            │       └── NotificationItem[] (map notifications)
            │           ├── Unread dot (if !read)
            │           ├── Avatar (optional)
            │           ├── Text content
            │           │   ├── Actor + Ticket key
            │           │   ├── Comment preview
            │           │   └── Relative timestamp
            │           └── Click handler → markAsRead + navigate
            └── NotificationFooter
                └── "View all" link (if hasMore or empty)
```

### CSS Considerations

**TailwindCSS Classes**:
- `w-96`: Notification dropdown width (384px)
- `h-96`: ScrollArea height (384px)
- `space-y-1`: Gap between notification items
- `divide-y`: Border between header/list/footer
- `bg-blue-50 dark:bg-blue-950/30`: Unread item background
- `text-sm`, `text-xs`: Font sizes per spec
- `truncate max-w-xs`: Preview text truncation

**Responsive Design**:
- Mobile: Reduce dropdown width to `w-80` or full viewport width
- Tablet: Standard `w-96`
- Desktop: `w-96` with side offset for alignment

### Accessibility Features

- **ARIA Labels**: Bell button has `aria-label="N unread notifications"`
- **Keyboard Navigation**: Popover handles Escape to close, Tab to focus items
- **Focus Management**: Radix Popover manages focus automatically
- **Semantic HTML**: Button elements for all clickable items
- **High Contrast**: Badge uses `variant="destructive"` for visibility
- **Screen Reader**: Unread indicator has aria-label, time uses `<time>` element

### Known Issues & Workarounds

**Issue**: ScrollArea inside Popover - scrollbar visible but content not scrollable
**Workaround** (GitHub issue #542):
- Wrap content in explicit div with height
- Use `overflow-y-auto` as fallback
- Test thoroughly on mobile devices

```typescript
// Ensure ScrollArea works correctly
<ScrollArea className="h-96 w-full">
  <div className="px-4 py-2">
    {/* Content */}
  </div>
</ScrollArea>
```

### Alternatives Considered

1. **Dropdown Menu (Radix)**: Simpler component
   - Pros: Less CSS customization
   - Cons: Less flexible for custom layouts, no built-in scrolling
   - Decision: Rejected (Popover more suitable for complex content)

2. **Dialog Modal**: Full-screen notifications
   - Pros: More space, better mobile UX
   - Cons: Disrupts workflow, contradicts spec "dropdown"
   - Decision: Rejected per spec

3. **Sheet Component**: Slide-in from side (mobile pattern)
   - Pros: Mobile-optimized
   - Cons: Overkill for 5-item list, adds complexity
   - Decision: Rejected (Popover sufficient)

---

## 5. Relative Timestamps with date-fns

### Decision: Hybrid Approach - formatDistanceToNow for < 3 days, Absolute Date for Older

**Approach**:
- < 1 minute: "just now"
- < 1 hour: "X minutes ago"
- < 24 hours: "X hours ago"
- < 3 days: "X days ago"
- >= 3 days: "Nov 20, 2025" (absolute date)

### Rationale

1. **User Expectations**: Relative timestamps are most useful for recent events
   - "2 hours ago" makes sense contextually
   - "32 days ago" is less meaningful than specific date
   - Hybrid approach balances scannability and precision

2. **Existing Pattern**: App already uses relative timestamps:
   - `format-timestamp.ts` utility uses `Intl.RelativeTimeFormat` + `Intl.DateTimeFormat`
   - Supports locale-specific formatting
   - No date-fns dependency needed (uses native APIs)

3. **date-fns Advantages** over native APIs:
   - `formatDistanceToNow(date, { addSuffix: true })` is more concise
   - Better TypeScript support
   - Locale handling through language packs
   - Smaller bundle impact (tree-shakeable)

4. **Notification Context**: Notifications typically recent
   - 95%+ of notifications viewed within 24 hours
   - Older notifications less important (dropdown shows 5 most recent)
   - Relative timestamps work well for this use case

### Implementation Details

**Utility Function: formatNotificationTime**
```typescript
// /app/lib/utils/format-notification-time.ts
import { formatDistanceToNow, format, isToday, isYesterday, differenceInDays } from 'date-fns';

/**
 * Format timestamp for notification display
 * < 1 min: "just now"
 * < 1 hour: "5 minutes ago"
 * < 24 hours: "2 hours ago"
 * < 3 days: "1 day ago"
 * >= 3 days: "Nov 20, 2025"
 */
export function formatNotificationTime(date: Date | string): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Validate date
    if (isNaN(dateObj.getTime())) {
      return 'Unknown time';
    }

    const now = new Date();
    const daysAgo = differenceInDays(now, dateObj);

    // < 3 days: use relative format
    if (daysAgo < 3) {
      return formatDistanceToNow(dateObj, { addSuffix: true });
    }

    // >= 3 days: use absolute format
    return format(dateObj, 'MMM d, yyyy');
  } catch (error) {
    console.error('formatNotificationTime error:', error);
    return 'Unknown time';
  }
}

/**
 * Format time for tooltip (always shows exact time)
 */
export function formatNotificationTimeTooltip(date: Date | string): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return 'Unknown time';
    }

    // Format: "Nov 20, 2025 at 3:45 PM"
    return format(dateObj, 'MMM d, yyyy \'at\' h:mm a');
  } catch (error) {
    console.error('formatNotificationTimeTooltip error:', error);
    return 'Unknown time';
  }
}
```

**Usage in NotificationItem**:
```typescript
// /components/notifications/notification-item.tsx
'use client';

import { formatNotificationTime, formatNotificationTimeTooltip } from '@/app/lib/utils/format-notification-time';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Notification } from '@prisma/client';

export function NotificationItem({ notification }: NotificationItemProps) {
  const relativeTime = formatNotificationTime(notification.createdAt);
  const tooltipTime = formatNotificationTimeTooltip(notification.createdAt);

  return (
    <button>
      {/* ... other content ... */}

      {/* Relative timestamp with tooltip for exact time */}
      <Tooltip>
        <TooltipTrigger asChild>
          <time className="text-xs text-muted-foreground mt-1 block cursor-help">
            {relativeTime}
          </time>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {tooltipTime}
        </TooltipContent>
      </Tooltip>
    </button>
  );
}
```

**Unit Tests**:
```typescript
// /app/lib/utils/__tests__/format-notification-time.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatNotificationTime, formatNotificationTimeTooltip } from '../format-notification-time';

describe('formatNotificationTime', () => {
  let now: Date;

  beforeEach(() => {
    // Mock current time to Nov 24, 2025 12:00 PM
    now = new Date('2025-11-24T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for times < 1 minute ago', () => {
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
    expect(formatNotificationTime(thirtySecondsAgo)).toBe('just now');
  });

  it('returns relative time for < 1 hour', () => {
    const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
    expect(formatNotificationTime(threeMinutesAgo)).toMatch(/3 minutes ago/);
  });

  it('returns relative time for < 24 hours', () => {
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(formatNotificationTime(twoHoursAgo)).toMatch(/2 hours ago/);
  });

  it('returns relative time for < 3 days', () => {
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(formatNotificationTime(twoDaysAgo)).toMatch(/2 days ago/);
  });

  it('returns absolute date for >= 3 days', () => {
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    expect(formatNotificationTime(fiveDaysAgo)).toMatch(/Nov 19, 2025/);
  });

  it('handles ISO string input', () => {
    const iso = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatNotificationTime(iso)).toMatch(/5 minutes ago/);
  });

  it('handles invalid date gracefully', () => {
    expect(formatNotificationTime(new Date('invalid'))).toBe('Unknown time');
    expect(formatNotificationTime('invalid')).toBe('Unknown time');
  });
});

describe('formatNotificationTimeTooltip', () => {
  it('returns full datetime format', () => {
    const date = new Date('2025-11-24T15:30:00Z');
    const result = formatNotificationTimeTooltip(date);
    expect(result).toMatch(/Nov 24, 2025 at/);
  });
});
```

### date-fns vs Native APIs

| Feature | date-fns | Native (Intl) | Notes |
|---------|----------|---------------|-------|
| **Bundle Size** | ~10KB (tree-shakeable) | 0KB (built-in) | Native preferred if only simple formatting |
| **Locale Support** | Full language packs | Basic (navigator.language) | date-fns for multi-language apps |
| **Relative Time** | `formatDistanceToNow` | `RelativeTimeFormat` | date-fns more concise |
| **Absolute Dates** | `format` | `DateTimeFormat` | Both similar complexity |
| **Timestamps** | ✓ | ✓ | Both handle ISO strings |
| **Browser Support** | ✓ Node/browser | ✓ Modern browsers | date-fns works everywhere |

**Decision**: Use date-fns because:
- More concise API (`formatDistanceToNow` vs manual calculation)
- Already in `package.json` (v4.1.0)
- Better TypeScript types
- Easier testing with fake timers

### Locale Handling

```typescript
// Extend formatNotificationTime for locale support (future enhancement)
import { enUS, es, fr } from 'date-fns/locale';

export function formatNotificationTime(
  date: Date | string,
  locale: 'en' | 'es' | 'fr' = 'en'
): string {
  const localeMap = { en: enUS, es, fr };

  return formatDistanceToNow(dateObj, {
    addSuffix: true,
    locale: localeMap[locale],
  });
}
```

### Performance Considerations

- **No Polling for Timestamp Updates**: Timestamps don't auto-update as time passes
  - Notification created at 2:00 PM
  - User views at 2:05 PM → "5 minutes ago"
  - User views again at 2:10 PM → still "5 minutes ago" (no refetch)
  - Only updates on next polling interval (15 seconds)

- **Acceptable**: Users expect timestamp to stay same until notification updates from server

- **Optional Enhancement**: Re-render notification items every minute if needed:
  ```typescript
  useEffect(() => {
    const interval = setInterval(() => {
      setTimestamp(formatNotificationTime(notification.createdAt));
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [notification.createdAt]);
  ```

### Alternatives Considered

1. **Luxon Library**: More powerful date library
   - Pros: Better timezone handling, richer API
   - Cons: Larger bundle size, overkill for notifications
   - Decision: Rejected (date-fns sufficient)

2. **Manual Calculation**: Custom relative time function
   - Pros: Zero dependencies
   - Cons: Re-implement localization, formatting edge cases
   - Decision: Rejected (date-fns worth the dependency)

3. **Always Absolute Dates**: "Nov 24, 2025 at 3:45 PM"
   - Pros: Unambiguous
   - Cons: Less scannable, less user-friendly
   - Decision: Rejected (hybrid approach better UX)

---

## Implementation Checklist

### Phase 1: Backend (Notification Persistence)
- [ ] Add `Notification` model to Prisma schema
- [ ] Add `notificationCreatedAt` and `readAt` timestamps
- [ ] Create comment API handler to extract mentions and create notifications
- [ ] Create `/api/notifications` GET endpoint (list with pagination)
- [ ] Create `/api/notifications/:id/read` PATCH endpoint
- [ ] Create `/api/notifications/mark-all-read` PATCH endpoint
- [ ] Add notification retention job (30-day deletion)

### Phase 2: Query Hooks & Types
- [ ] Create `useNotifications()` hook with 15s polling
- [ ] Create `useNotificationUnreadCount()` derived hook
- [ ] Add query key factory `queryKeys.notifications`
- [ ] Create `use-mark-notification-read.ts` mutation hook
- [ ] Create `use-mark-all-notifications-read.ts` mutation hook
- [ ] Add TypeScript types for Notification entity

### Phase 3: UI Components
- [ ] Create `NotificationBell` with badge count
- [ ] Create `NotificationDropdown` container
- [ ] Create `NotificationItem` with unread indicator
- [ ] Create `NotificationHeader` with mark all as read
- [ ] Create `NotificationFooter` with view all link
- [ ] Create `NotificationList` with ScrollArea
- [ ] Add to application header/nav

### Phase 4: Utilities & Formatting
- [ ] Add `formatNotificationTime()` utility
- [ ] Add `formatNotificationTimeTooltip()` utility
- [ ] Integrate with existing `mention-parser.ts`
- [ ] Add timestamp formatting tests

### Phase 5: Testing
- [ ] Unit tests for mention parsing
- [ ] Unit tests for time formatting
- [ ] Integration tests for notification creation
- [ ] E2E test: Mention user → notification appears within 15s
- [ ] E2E test: Click notification → navigates to comment
- [ ] E2E test: Mark as read → badge updates

### Phase 6: Enhancement (Optional)
- [ ] Full `/notifications` page with pagination
- [ ] Notification filters (by ticket, by actor)
- [ ] Notification preferences/settings
- [ ] Batch notification cleanup job
- [ ] Notification analytics

---

## Summary Table

| Topic | Decision | Interval | Component |
|-------|----------|----------|-----------|
| **@Mention Parsing** | Regex on `@[userId:displayName]` | N/A | `mention-parser.ts` |
| **Polling Strategy** | TanStack Query 15s + dynamic | 15s (refetchInterval) | `useNotifications()` |
| **Optimistic Updates** | onMutate snapshot + rollback | Instant | `useMarkNotificationRead()` |
| **UI Components** | Popover + ScrollArea + Badge | N/A | `NotificationBell.tsx` |
| **Timestamps** | formatDistanceToNow < 3 days | Per poll | `format-notification-time.ts` |

---

## References & Sources

1. **@Mention Parsing**:
   - [Mastering TypeScript Regex Matching: A Comprehensive Guide](https://www.webdevtutor.net/blog/typescript-regex-matching)
   - [mentions-regex npm Package](https://www.npmjs.com/package/mentions-regex)
   - [GitHub mentions-regex: 100% Twitter Compatible](https://github.com/regexhq/mentions-regex)
   - [Twitter Mention Regex - Stack Overflow](https://stackoverflow.com/questions/7150652/regex-valid-twitter-mention)

2. **TanStack Query Polling**:
   - [TanStack Query v5 Important Defaults](https://tanstack.com/query/v5/docs/react/guides/important-defaults)
   - [React TanStack Query Auto Refetching Example](https://tanstack.com/query/v5/docs/framework/react/examples/auto-refetching)
   - [useQuery Reference Documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery)
   - [TanStack Query: Mastering Polling - Medium](https://medium.com/@soodakriti45/tanstack-query-mastering-polling-ee11dc3625cb)
   - [Practical React Query - TkDodo's Blog](https://tkdodo.eu/blog/practical-react-query)

3. **Optimistic Updates**:
   - [TanStack Query Optimistic Updates Guide](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
   - [React TanStack Query Optimistic Updates TypeScript Example](https://tanstack.com/query/v5/docs/framework/react/examples/optimistic-updates-typescript)
   - [Optimistic Updates UI Example](https://tanstack.com/query/latest/docs/framework/react/examples/optimistic-updates-ui)

4. **shadcn/ui Components**:
   - [shadcn/ui Popover Documentation](https://ui.shadcn.com/docs/components/popover)
   - [shadcn/ui Badge Documentation](https://ui.shadcn.com/docs/components/badge)
   - [shadcn/ui Alert Documentation](https://ui.shadcn.com/docs/components/alert)
   - [ScrollArea not working inside Popover - GitHub Issue #542](https://github.com/shadcn-ui/ui/issues/542)

5. **date-fns Relative Timestamps**:
   - [date-fns formatDistanceToNow Documentation](https://date-fns.org/docs/formatDistanceToNow)
   - [How to Format Distance to Now with Format String - GitHub Issue](https://github.com/date-fns/date-fns/issues/1815)
   - [Reduce Granularity in formatDistanceToNow - Stack Overflow](https://stackoverflow.com/questions/63138474/reduce-granularity-to-days-months-years-in-date-fns-formatdistancetonow)
   - [Relative Timestamps in Astro JS - Anson Lichtfuss Blog](https://www.ansonlichtfuss.com/blog/relative-timestamps-in-astro-js-date-fns-typescript)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-24
**Ready for Implementation**: ✅ Yes
