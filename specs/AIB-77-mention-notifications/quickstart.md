# Quickstart: Mention Notifications Implementation

**Feature**: AIB-77 Mention Notifications
**Date**: 2025-11-24
**Estimated Time**: 4-6 hours for complete implementation

## Overview

This guide walks you through implementing mention notifications from scratch. Follow the phases sequentially for optimal development flow (TDD approach).

---

## Prerequisites

- Node.js 22.20.0+ and Bun 1.3.1+ installed
- PostgreSQL 14+ database running
- AI-Board codebase cloned and dependencies installed
- Familiarity with Next.js App Router, Prisma, and TanStack Query

---

## Phase 1: Database Schema (30 min)

### Step 1.1: Update Prisma Schema

Edit `prisma/schema.prisma`:

```prisma
// Add new Notification model
model Notification {
  id           Int       @id @default(autoincrement())
  recipientId  String
  actorId      String
  commentId    Int
  ticketId     Int
  read         Boolean   @default(false)
  readAt       DateTime?
  createdAt    DateTime  @default(now())
  deletedAt    DateTime?

  recipient    User      @relation("NotificationRecipient", fields: [recipientId], references: [id], onDelete: Cascade)
  actor        User      @relation("NotificationActor", fields: [actorId], references: [id], onDelete: Cascade)
  comment      Comment   @relation(fields: [commentId], references: [id], onDelete: Cascade)
  ticket       Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([recipientId, createdAt])
  @@index([recipientId, read])
  @@index([createdAt])
}

// Update User model (add notification relations)
model User {
  // ... existing fields
  notificationsReceived Notification[] @relation("NotificationRecipient")
  notificationsCreated  Notification[] @relation("NotificationActor")
}

// Update Comment model
model Comment {
  // ... existing fields
  notifications Notification[]
}

// Update Ticket model
model Ticket {
  // ... existing fields
  notifications Notification[]
}
```

### Step 1.2: Create Migration

```bash
bun run npx prisma migrate dev --name add_notifications
```

Expected output:
- Migration file created in `prisma/migrations/`
- Database schema updated
- Prisma Client regenerated

### Step 1.3: Verify Migration

```bash
bun run npx prisma studio
```

Open Prisma Studio and verify `Notification` table exists with correct columns and indexes.

---

## Phase 2: Utility Functions (45 min, TDD)

### Step 2.1: Date Utilities (Unit Tests FIRST)

**Create test file**: `tests/unit/date-utils.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { formatNotificationTime } from '@/lib/date-utils';

describe('formatNotificationTime', () => {
  it('should return "just now" for times less than 1 minute ago', () => {
    const now = new Date();
    const result = formatNotificationTime(now);
    expect(result).toBe('just now');
  });

  it('should return relative time for recent dates', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = formatNotificationTime(twoHoursAgo);
    expect(result).toMatch(/\d+ hours? ago/);
  });

  it('should return absolute date for dates >= 3 days old', () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const result = formatNotificationTime(fourDaysAgo);
    expect(result).toMatch(/[A-Z][a-z]{2} \d{1,2}, \d{4}/); // "Nov 20, 2025"
  });
});
```

**Run tests** (they should FAIL):
```bash
bun run test:unit tests/unit/date-utils.test.ts
```

**Implement function**: `lib/date-utils.ts`

```typescript
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';

export function formatNotificationTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const daysAgo = differenceInDays(new Date(), dateObj);

  if (daysAgo < 3) {
    const distance = formatDistanceToNow(dateObj, { addSuffix: true });
    return distance === 'less than a minute ago' ? 'just now' : distance;
  }

  return format(dateObj, 'MMM d, yyyy');
}
```

**Run tests again** (they should PASS):
```bash
bun run test:unit tests/unit/date-utils.test.ts
```

### Step 2.2: Mention Parser (Use Existing)

The codebase already has `lib/mention-parser.ts` with `extractMentionUserIds()` function. Verify it exists:

```bash
cat lib/mention-parser.ts
```

If it doesn't exist, check `lib/utils/mention-parser.ts` or similar location. If still not found, create:

```typescript
// lib/mention-parser.ts
export function extractMentionUserIds(content: string): string[] {
  const mentionRegex = /@\[([^:]+):([^\]]+)\]/g;
  const userIds: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    userIds.push(match[1]); // Extract userId from @[userId:displayName]
  }

  return [...new Set(userIds)]; // Deduplicate
}
```

---

## Phase 3: Database Query Functions (30 min)

**Create**: `lib/db/notifications.ts`

```typescript
import { prisma } from '@/lib/prisma';

export async function createNotificationForMention(params: {
  recipientId: string;
  actorId: string;
  commentId: number;
  ticketId: number;
}) {
  return prisma.notification.create({
    data: params,
  });
}

export async function getNotificationsForUser(userId: string, limit = 5) {
  return prisma.notification.findMany({
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
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      recipientId: userId,
      read: false,
      deletedAt: null,
    },
  });
}

export async function markNotificationAsRead(notificationId: number, userId: string) {
  return prisma.notification.update({
    where: {
      id: notificationId,
      recipientId: userId,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
}

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

---

## Phase 4: API Routes (60 min)

### Step 4.1: List Notifications Endpoint

**Create**: `app/api/notifications/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getNotificationsForUser, getUnreadCount } from '@/lib/db/notifications';
import { formatNotificationTime } from '@/lib/date-utils';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 50);

    const notifications = await getNotificationsForUser(session.user.id, limit);
    const unreadCount = await getUnreadCount(session.user.id);

    const notificationsDisplay = notifications.map(n => ({
      id: n.id,
      actorName: n.actor.name || n.actor.email,
      actorImage: n.actor.image,
      ticketKey: n.ticket.ticketKey,
      commentPreview: n.comment.content.substring(0, 80) + (n.comment.content.length > 80 ? '...' : ''),
      createdAt: n.createdAt.toISOString(),
      read: n.read,
      commentId: n.commentId,
      projectId: n.ticket.projectId,
    }));

    return NextResponse.json({
      notifications: notificationsDisplay,
      unreadCount,
      hasMore: notifications.length === limit,
    });
  } catch (error) {
    console.error('[API] Failed to fetch notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications', code: 'DATABASE_ERROR' }, { status: 500 });
  }
}
```

### Step 4.2: Mark Notification as Read

**Create**: `app/api/notifications/[id]/mark-read/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { markNotificationAsRead } from '@/lib/db/notifications';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const notificationId = parseInt(params.id);
    if (isNaN(notificationId)) {
      return NextResponse.json({ error: 'Invalid notification ID', code: 'INVALID_ID' }, { status: 400 });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    if (notification.recipientId !== session.user.id) {
      return NextResponse.json({ error: 'Cannot mark notification belonging to another user', code: 'FORBIDDEN' }, { status: 403 });
    }

    await markNotificationAsRead(notificationId, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to mark notification as read:', error);
    return NextResponse.json({ error: 'Failed to update notification', code: 'DATABASE_ERROR' }, { status: 500 });
  }
}
```

### Step 4.3: Mark All Notifications as Read

**Create**: `app/api/notifications/mark-all-read/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { markAllNotificationsAsRead } from '@/lib/db/notifications';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const result = await markAllNotificationsAsRead(session.user.id);

    return NextResponse.json({
      success: true,
      count: result.count,
    });
  } catch (error) {
    console.error('[API] Failed to mark all notifications as read:', error);
    return NextResponse.json({ error: 'Failed to mark notifications as read', code: 'DATABASE_ERROR' }, { status: 500 });
  }
}
```

### Step 4.4: Enhance Comment Creation

**Edit**: `app/api/comments/route.ts`

Add notification creation logic after comment is created:

```typescript
// Existing POST handler
export async function POST(request: NextRequest) {
  // ... existing comment creation logic

  // NEW: Create notifications for mentions
  try {
    const mentionedUserIds = extractMentionUserIds(commentData.content);

    if (mentionedUserIds.length > 0) {
      // Get project members
      const ticket = await prisma.ticket.findUnique({
        where: { id: commentData.ticketId },
        include: {
          project: {
            include: {
              members: { select: { userId: true } },
            },
          },
        },
      });

      if (ticket) {
        const projectMemberIds = [
          ticket.project.userId, // Owner
          ...ticket.project.members.map(m => m.userId), // Members
        ];

        // Filter valid recipients (project members, exclude self)
        const validRecipients = mentionedUserIds.filter(
          id => id !== session.user.id && projectMemberIds.includes(id)
        );

        // Create notifications
        if (validRecipients.length > 0) {
          await prisma.notification.createMany({
            data: validRecipients.map(recipientId => ({
              recipientId,
              actorId: session.user.id,
              commentId: comment.id,
              ticketId: ticket.id,
            })),
          });
        }
      }
    }
  } catch (notificationError) {
    // Log but don't block comment creation
    console.error('[API] Failed to create notifications:', notificationError);
  }

  // Return comment as normal
  return NextResponse.json({ comment });
}
```

---

## Phase 5: Client Components (90 min)

### Step 5.1: TanStack Query Hooks

**Create**: `components/notifications/use-notifications.ts`

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface NotificationDisplay {
  id: number;
  actorName: string;
  actorImage: string | null;
  ticketKey: string;
  commentPreview: string;
  createdAt: string;
  read: boolean;
  commentId: number;
  projectId: number;
}

interface NotificationsResponse {
  notifications: NotificationDisplay[];
  unreadCount: number;
  hasMore: boolean;
}

async function fetchNotifications(): Promise<NotificationsResponse> {
  const response = await fetch('/api/notifications?limit=5');
  if (!response.ok) throw new Error('Failed to fetch notifications');
  return response.json();
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasUnread = data && data.unreadCount > 0;
      return hasUnread ? 15000 : 30000; // 15s with unread, 30s when all read
    },
    refetchIntervalInBackground: true,
    staleTime: 0,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(`/api/notifications/${notificationId}/mark-read`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to mark notification as read');
      return response.json();
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      const previousData = queryClient.getQueryData<NotificationsResponse>(['notifications']);

      queryClient.setQueryData<NotificationsResponse>(['notifications'], (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map(n =>
            n.id === notificationId ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, old.unreadCount - 1),
        };
      });

      return { previousData };
    },
    onError: (error, _, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['notifications'], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to mark all notifications as read');
      return response.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      const previousData = queryClient.getQueryData<NotificationsResponse>(['notifications']);

      queryClient.setQueryData<NotificationsResponse>(['notifications'], (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map(n => ({ ...n, read: true })),
          unreadCount: 0,
        };
      });

      return { previousData };
    },
    onError: (error, _, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['notifications'], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
```

### Step 5.2: Notification Bell Component

**Create**: `components/notifications/notification-bell.tsx`

```typescript
'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications } from './use-notifications';
import { NotificationDropdown } from './notification-dropdown';

export function NotificationBell() {
  const { data } = useNotifications();

  const unreadCount = data?.unreadCount ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <NotificationDropdown />
      </PopoverContent>
    </Popover>
  );
}
```

### Step 5.3: Notification Dropdown Component

**Create**: `components/notifications/notification-dropdown.tsx`

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from './use-notifications';
import { formatNotificationTime } from '@/lib/date-utils';

export function NotificationDropdown() {
  const router = useRouter();
  const { data, isLoading } = useNotifications();
  const markAsRead = useMarkNotificationRead();
  const markAllAsRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];

  const handleNotificationClick = (notification: any) => {
    markAsRead.mutate(notification.id);
    router.push(`/projects/${notification.projectId}/tickets/${notification.ticketKey}#comment-${notification.commentId}`);
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Notifications</h3>
        {data && data.unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[400px]">
        <ScrollArea className="h-full">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No notifications</div>
          ) : (
            <div className="divide-y">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 cursor-pointer hover:bg-accent transition-colors ${
                    !notification.read ? 'bg-blue-50 dark:bg-blue-950' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={notification.actorImage || undefined} />
                      <AvatarFallback>{notification.actorName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <span className="font-medium">{notification.actorName}</span>
                        {' mentioned you in '}
                        <span className="font-medium">{notification.ticketKey}</span>
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {notification.commentPreview}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatNotificationTime(notification.createdAt)}
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="flex-shrink-0">
                        <div className="h-2 w-2 bg-blue-500 rounded-full" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Footer */}
      {data && data.hasMore && (
        <div className="p-2 border-t">
          <Button variant="ghost" size="sm" className="w-full">
            View all
          </Button>
        </div>
      )}
    </div>
  );
}
```

### Step 5.4: Add to Layout

**Edit**: `app/(dashboard)/layout.tsx`

```typescript
import { NotificationBell } from '@/components/notifications/notification-bell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="flex items-center justify-between p-4">
        {/* Existing header content */}

        {/* Add notification bell */}
        <NotificationBell />
      </header>

      {children}
    </div>
  );
}
```

---

## Phase 6: Testing (90 min)

### Step 6.1: E2E Tests

**Create**: `tests/e2e/notifications.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Mention Notifications', () => {
  test('should create notification when user is mentioned', async ({ page, browser }) => {
    // Login as User A
    await page.goto('/login');
    // ... login logic

    // Open ticket detail
    await page.goto('/projects/1/tickets/AIB-123');

    // Open second browser context as User B
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/login');
    // ... login as User B

    // User B posts comment with @UserA mention
    await page2.goto('/projects/1/tickets/AIB-123');
    await page2.fill('[data-testid="comment-input"]', 'Hey @[userA:Alice] can you check this?');
    await page2.click('[data-testid="comment-submit"]');

    // Wait for notification to appear for User A (within 15 seconds)
    await page.waitForTimeout(16000); // Wait for polling

    // Check notification bell badge
    const badge = page.locator('[data-testid="notification-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('1');

    // Click bell to open dropdown
    await page.click('[data-testid="notification-bell"]');

    // Verify notification content
    const notification = page.locator('[data-testid="notification-item"]').first();
    await expect(notification).toContainText('User B');
    await expect(notification).toContainText('mentioned you in AIB-123');
    await expect(notification).toContainText('Hey @Alice can you check this?');

    // Click notification to navigate
    await notification.click();

    // Verify navigation to ticket with comment visible
    await expect(page).toHaveURL(/\/projects\/1\/tickets\/AIB-123#comment-\d+/);
  });

  test('should mark notification as read when clicked', async ({ page }) => {
    // ... setup notification

    // Click notification
    await page.click('[data-testid="notification-item"]');

    // Verify badge count decreased
    const badge = page.locator('[data-testid="notification-badge"]');
    await expect(badge).not.toBeVisible(); // or have decreased count
  });

  test('should mark all notifications as read', async ({ page }) => {
    // ... setup multiple notifications

    // Open dropdown
    await page.click('[data-testid="notification-bell"]');

    // Click "Mark all as read"
    await page.click('text=Mark all as read');

    // Verify badge disappeared
    const badge = page.locator('[data-testid="notification-badge"]');
    await expect(badge).not.toBeVisible();
  });
});
```

**Run tests**:
```bash
bun run test:e2e tests/e2e/notifications.spec.ts
```

---

## Phase 7: Verification (15 min)

### Checklist

- [ ] Database migration applied successfully
- [ ] Unit tests pass (`bun run test:unit`)
- [ ] E2E tests pass (`bun run test:e2e`)
- [ ] Notification bell appears in header
- [ ] Badge shows unread count
- [ ] Dropdown opens on click
- [ ] Notifications list displays correctly
- [ ] Clicking notification navigates to ticket
- [ ] "Mark all as read" works
- [ ] Polling updates notifications every 15 seconds
- [ ] Self-mentions don't create notifications
- [ ] Non-member mentions don't create notifications

---

## Troubleshooting

### Issue: Migration fails

**Solution**: Check existing schema conflicts. If `Notification` table already exists, drop it manually:

```sql
DROP TABLE "Notification" CASCADE;
```

Then re-run migration.

### Issue: Notifications not appearing

**Checklist**:
1. Verify comment API is creating notifications (check database)
2. Check browser console for API errors
3. Verify polling is running (check Network tab, should see `/api/notifications` every 15s)
4. Verify user is a project member

### Issue: Polling not working

**Solution**: Check TanStack Query DevTools (`npm i @tanstack/react-query-devtools`):

```typescript
// app/providers.tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<QueryClientProvider client={queryClient}>
  {children}
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

---

## Next Steps

- [ ] Optional: Implement full `/notifications` page with pagination
- [ ] Optional: Add email notifications for mentions
- [ ] Optional: Add notification preferences (mute mentions, disable notifications)
- [ ] Optional: Add @channel or @here mentions for project-wide notifications

---

## Summary

You've successfully implemented:
- ✅ Database schema with Prisma migrations
- ✅ API endpoints for CRUD operations
- ✅ Client-side polling with TanStack Query
- ✅ Optimistic updates for instant feedback
- ✅ shadcn/ui components for accessible UI
- ✅ Comprehensive tests (unit + E2E)

**Estimated Actual Time**: 4-6 hours depending on familiarity with tech stack.

**Feature Status**: Production-ready for initial release (MVP scope complete).
