# Mention Notifications - Code Snippets & Examples

**Purpose**: Copy-paste ready code examples for implementing mention notifications
**Related**: See `/MENTION_NOTIFICATIONS_RESEARCH.md` for detailed rationale

---

## 1. Database Schema (Prisma)

Add to `/prisma/schema.prisma`:

```prisma
model Notification {
  id          Int       @id @default(autoincrement())
  recipientId String
  actorId     String
  commentId   Int
  ticketId    Int
  read        Boolean   @default(false)
  readAt      DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  recipient User    @relation("notifications_recipient", fields: [recipientId], references: [id], onDelete: Cascade)
  actor     User    @relation("notifications_actor", fields: [actorId], references: [id], onDelete: Cascade)
  comment   Comment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  ticket    Ticket  @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  // Indexes for efficient queries
  @@index([recipientId, createdAt])
  @@index([recipientId, read])
  @@index([createdAt]) // For 30-day retention cleanup
}
```

Update User model to include notification relations:

```prisma
model User {
  // ... existing fields ...

  // Add these relations
  notificationsReceived Notification[] @relation("notifications_recipient")
  notificationsCreated  Notification[] @relation("notifications_actor")
}
```

---

## 2. Comment Creation Handler - Extract & Create Notifications

**File**: `/app/api/projects/[projectId]/tickets/[ticketId]/comments/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { extractMentionUserIds } from '@/app/lib/utils/mention-parser';

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string; ticketId: string } }
) {
  try {
    const { content } = await req.json();
    const projectId = parseInt(params.projectId);
    const ticketId = parseInt(params.ticketId);

    // Get current user
    const session = await getSession(); // Your auth method
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserId = session.user.id;

    // Verify user has access to project
    const hasAccess = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: currentUserId,
      },
    });

    if (!hasAccess && !(await verifyProjectOwnership(projectId, currentUserId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        ticketId,
        userId: currentUserId,
        content,
      },
    });

    // Extract mentioned user IDs from comment content
    const mentionedUserIds = extractMentionUserIds(content);

    // Create notifications for each valid mention
    const validMentions = [];

    for (const userId of mentionedUserIds) {
      // Skip self-mentions
      if (userId === currentUserId) {
        continue;
      }

      // Verify user is a project member
      const isMember = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId,
          },
        },
      });

      if (!isMember) {
        continue;
      }

      // Create notification
      await prisma.notification.create({
        data: {
          recipientId: userId,
          actorId: currentUserId,
          commentId: comment.id,
          ticketId,
          read: false,
        },
      });

      validMentions.push(userId);
    }

    return NextResponse.json(
      {
        comment,
        notificationsSent: validMentions.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
```

---

## 3. Notification List API Endpoint

**File**: `/app/api/notifications/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch notifications with actor and ticket info
    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: userId,
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
          },
        },
        ticket: {
          select: {
            id: true,
            ticketKey: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit to prevent huge payloads
    });

    // Format response with computed fields
    const formattedNotifications = notifications.map(notif => ({
      id: notif.id,
      recipientId: notif.recipientId,
      actorId: notif.actorId,
      actorName: notif.actor.name || notif.actor.email || '[Deleted User]',
      actorImage: notif.actor.image || null,
      commentId: notif.comment.id,
      commentPreview: notif.comment.content.substring(0, 80),
      ticketId: notif.ticket.id,
      ticketKey: notif.ticket.ticketKey,
      ticketTitle: notif.ticket.title,
      read: notif.read,
      createdAt: notif.createdAt.toISOString(),
      readAt: notif.readAt?.toISOString() || null,
    }));

    return NextResponse.json(formattedNotifications);
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
```

---

## 4. Mark Notification as Read Endpoint

**File**: `/app/api/notifications/[id]/read/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notificationId = parseInt(params.id);
    const userId = session.user.id;

    // Verify notification belongs to current user
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientId: userId,
      },
    });

    if (!notification) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Update read status
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, notification: updated });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}
```

---

## 5. Mark All Notifications as Read Endpoint

**File**: `/app/api/notifications/mark-all-read/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth';

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const now = new Date();

    // Update all unread notifications for user
    const result = await prisma.notification.updateMany({
      where: {
        recipientId: userId,
        read: false,
      },
      data: {
        read: true,
        readAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      count: result.count,
    });
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 }
    );
  }
}
```

---

## 6. Query Keys Factory

**File**: `/app/lib/query-keys.ts` (extend existing)

```typescript
export const queryKeys = {
  // ... existing keys ...

  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
    detail: (id: number) => ['notifications', 'detail', id] as const,
    unreadCount: () => ['notifications', 'unreadCount'] as const,
  },
};
```

---

## 7. useNotifications Hook

**File**: `/app/lib/hooks/queries/use-notifications.ts`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { Notification } from '@/app/lib/types/notification';

interface UseNotificationsOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
}

export function useNotifications({
  enabled = true,
  refetchInterval = 15000, // 15 seconds per spec
}: UseNotificationsOptions = {}) {
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

    // Dynamic interval: reduce polling if all notifications read
    refetchInterval: (query) => {
      const notifications = query.state.data || [];
      const hasUnread = notifications.some(n => !n.read);

      // Poll frequently if unread, less frequently if all read
      return hasUnread ? refetchInterval : 30000; // 30s if all read
    },

    // Continue polling even when tab is inactive
    refetchIntervalInBackground: true,

    // Always stale (polling-based approach)
    staleTime: 0,

    // Keep cached 5 minutes after unmount
    gcTime: 5 * 60 * 1000,

    // Retry on failure
    retry: 2,
    retryDelay: (attemptIndex) =>
      Math.min(1000 * 2 ** attemptIndex, 30000),

    // Don't refetch on window focus (already polling in background)
    refetchOnWindowFocus: false,
  });
}

/**
 * Derived hook: get unread count without separate query
 */
export function useNotificationUnreadCount() {
  const { data: notifications = [] } = useNotifications();
  return notifications.filter(n => !n.read).length;
}
```

---

## 8. Mark Notification as Read Mutation Hook

**File**: `/app/lib/hooks/mutations/use-mark-notification-read.ts`

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { Notification } from '@/app/lib/types/notification';

interface MarkReadContext {
  previousNotifications: Notification[] | undefined;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation<
    Notification,
    Error,
    number,
    MarkReadContext
  >({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(
        `/api/notifications/${notificationId}/read`,
        { method: 'PATCH' }
      );

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      return response.json();
    },

    // Optimistic update
    onMutate: async (notificationId: number) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.list(),
      });

      // Snapshot previous state
      const previousNotifications = queryClient.getQueryData<Notification[]>(
        queryKeys.notifications.list()
      );

      // Optimistically update UI
      if (previousNotifications) {
        const now = new Date();
        queryClient.setQueryData(
          queryKeys.notifications.list(),
          previousNotifications.map(n =>
            n.id === notificationId
              ? { ...n, read: true, readAt: now.toISOString() }
              : n
          )
        );
      }

      return { previousNotifications };
    },

    // Rollback on error
    onError: (error, notificationId, context) => {
      console.error('Failed to mark notification as read:', error);

      if (context?.previousNotifications) {
        queryClient.setQueryData(
          queryKeys.notifications.list(),
          context.previousNotifications
        );
      }
    },

    // Refetch to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.list(),
      });
    },
  });
}
```

---

## 9. Mark All Notifications as Read Mutation Hook

**File**: `/app/lib/hooks/mutations/use-mark-all-notifications-read.ts`

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { Notification } from '@/app/lib/types/notification';

interface MarkAllReadContext {
  previousNotifications: Notification[] | undefined;
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: true; count: number },
    Error,
    void,
    MarkAllReadContext
  >({
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

      const previousNotifications = queryClient.getQueryData<Notification[]>(
        queryKeys.notifications.list()
      );

      if (previousNotifications) {
        const now = new Date();
        queryClient.setQueryData(
          queryKeys.notifications.list(),
          previousNotifications.map(n => ({
            ...n,
            read: true,
            readAt: now.toISOString(),
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

---

## 10. Time Formatting Utility

**File**: `/app/lib/utils/format-notification-time.ts`

```typescript
import {
  formatDistanceToNow,
  format,
  differenceInDays,
} from 'date-fns';

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

    // Use relative format for recent notifications
    if (daysAgo < 3) {
      return formatDistanceToNow(dateObj, { addSuffix: true });
    }

    // Use absolute date for older notifications
    return format(dateObj, 'MMM d, yyyy');
  } catch (error) {
    console.error('formatNotificationTime error:', error);
    return 'Unknown time';
  }
}

/**
 * Format time for tooltip (always exact)
 * e.g., "Nov 20, 2025 at 3:45 PM"
 */
export function formatNotificationTimeTooltip(date: Date | string): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return 'Unknown time';
    }

    return format(dateObj, 'MMM d, yyyy \'at\' h:mm a');
  } catch (error) {
    console.error('formatNotificationTimeTooltip error:', error);
    return 'Unknown time';
  }
}
```

---

## 11. TypeScript Types

**File**: `/app/lib/types/notification.ts`

```typescript
export interface Notification {
  id: number;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorImage: string | null;
  commentId: number;
  commentPreview: string;
  ticketId: number;
  ticketKey: string;
  ticketTitle: string;
  read: boolean;
  createdAt: string; // ISO string
  readAt: string | null;
}

export interface NotificationListResponse extends Array<Notification> {}
```

---

## 12. NotificationBell Component

**File**: `/components/notifications/notification-bell.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { useNotifications } from '@/app/lib/hooks/queries/use-notifications';
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

      <PopoverContent className="w-96 p-0" align="end" sideOffset={8}>
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

---

## 13. NotificationDropdown Component

**File**: `/components/notifications/notification-dropdown.tsx`

```typescript
'use client';

import { NotificationHeader } from './notification-header';
import { NotificationList } from './notification-list';
import { NotificationFooter } from './notification-footer';
import type { Notification } from '@/app/lib/types/notification';

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

---

## 14. NotificationItem Component

**File**: `/components/notifications/notification-item.tsx`

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { formatNotificationTime, formatNotificationTimeTooltip } from '@/app/lib/utils/format-notification-time';
import { useMarkNotificationRead } from '@/app/lib/hooks/mutations/use-mark-notification-read';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Notification } from '@/app/lib/types/notification';

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
    markAsRead(notification.id, {
      onSuccess: () => {
        onNavigate();
        router.push(
          `/ticket/${notification.ticketKey}#comment-${notification.commentId}`
        );
      },
    });
  };

  const relativeTime = formatNotificationTime(notification.createdAt);
  const tooltipTime = formatNotificationTimeTooltip(notification.createdAt);

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
        {/* Unread indicator */}
        {!notification.read && (
          <div className="mt-2 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {notification.actorName} mentioned you in{' '}
            <span className="font-semibold text-primary">
              {notification.ticketKey}
            </span>
          </p>

          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {notification.commentPreview?.substring(0, 80)}
          </p>

          {/* Timestamp with tooltip */}
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
        </div>
      </div>
    </button>
  );
}
```

---

## 15. NotificationHeader Component

**File**: `/components/notifications/notification-header.tsx`

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { useMarkAllNotificationsRead } from '@/app/lib/hooks/mutations/use-mark-all-notifications-read';

interface NotificationHeaderProps {
  unreadCount: number;
}

export function NotificationHeader({ unreadCount }: NotificationHeaderProps) {
  const { mutate: markAllAsRead, isPending } =
    useMarkAllNotificationsRead();

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <h2 className="font-semibold text-base">Notifications</h2>

      {unreadCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => markAllAsRead()}
          disabled={isPending}
          className="text-xs"
        >
          Mark all as read
        </Button>
      )}
    </div>
  );
}
```

---

## Testing: Unit Test Example

**File**: `/app/lib/utils/__tests__/format-notification-time.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatNotificationTime } from '../format-notification-time';

describe('formatNotificationTime', () => {
  let now: Date;

  beforeEach(() => {
    now = new Date('2025-11-24T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for recent times', () => {
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
    expect(formatNotificationTime(thirtySecondsAgo)).toBe('just now');
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
});
```

---

## Integration Test: Notification Creation

**File**: `/__tests__/notifications.integration.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Notifications', () => {
  test('creates notification when user is mentioned', async ({
    page,
    context,
  }) => {
    // Login as User A
    await page.goto('/auth/signin');
    // ... signin flow ...

    // Open project and create comment with @mention of User B
    await page.goto('/project/1/board');
    await page.click('[data-testid="ticket-123"]');
    await page.fill('[data-testid="comment-input"]', 'Hey @[user-b:User B], check this');
    await page.click('[data-testid="submit-comment"]');

    // Switch to User B in new context
    const userBContext = await context.browser().newContext();
    const userBPage = await userBContext.newPage();
    // ... login as User B ...

    // Wait for notification to appear
    const notificationBell = userBPage.locator('[data-testid="notification-bell"]');
    await expect(notificationBell).toContainText('1', { timeout: 20000 });

    // Click bell and verify notification
    await notificationBell.click();
    await expect(userBPage.locator('[data-testid="notification-item"]')).toContainText(
      'mentioned you in ABC-123'
    );
  });

  test('marks notification as read when clicked', async ({ page }) => {
    // ... setup: create notification ...

    await page.locator('[data-testid="notification-bell"]').click();
    const notificationItem = page.locator('[data-testid="notification-item"]');

    // Verify unread indicator before click
    await expect(notificationItem.locator('[data-testid="unread-dot"]')).toBeVisible();

    // Click notification
    await notificationItem.click();

    // Verify marked as read (UI updates optimistically)
    await expect(
      notificationItem.locator('[data-testid="unread-dot"]')
    ).not.toBeVisible();

    // Verify navigated to comment
    await expect(page).toHaveURL(/\/ticket\/.*#comment-/);
  });
});
```

---

**Last Updated**: 2025-11-24
**Status**: Ready to Copy & Paste
