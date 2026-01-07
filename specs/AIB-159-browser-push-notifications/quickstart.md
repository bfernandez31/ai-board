# Quickstart: Browser Push Notifications Implementation

**Feature**: AIB-159 Browser Push Notifications
**Date**: 2026-01-07

## Implementation Entry Points

### 1. Database Schema (Start Here)

**File**: `prisma/schema.prisma`

Add the PushSubscription model and User relation:

```prisma
model PushSubscription {
  id             Int       @id @default(autoincrement())
  userId         String
  endpoint       String    @unique @db.VarChar(500)
  p256dh         String    @db.VarChar(100)
  auth           String    @db.VarChar(50)
  expirationTime DateTime?
  userAgent      String?   @db.VarChar(200)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([endpoint])
}

// Add to User model:
model User {
  // ... existing fields ...
  pushSubscriptions PushSubscription[]
}
```

Then run: `bunx prisma migrate dev --name add_push_subscriptions`

### 2. Environment Variables

**File**: `.env.local` (create if not exists)

Generate VAPID keys once:
```bash
npx web-push generate-vapid-keys
```

Add to environment:
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your-public-key>
VAPID_PRIVATE_KEY=<your-private-key>
VAPID_SUBJECT=mailto:notifications@ai-board.dev
```

### 3. Install Dependency

```bash
bun add web-push
bun add -D @types/web-push
```

### 4. Service Worker

**File**: `public/sw.js`

Static service worker for push event handling:

```javascript
self.addEventListener('push', function(event) {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: data.ticketKey,
    renotify: true,
    data: { url: data.url, ticketKey: data.ticketKey, type: data.type }
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then(() => {
              client.postMessage({ type: 'NOTIFICATION_CLICK', url });
            });
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
```

### 5. Server-Side Push Configuration

**File**: `app/lib/push/web-push-config.ts`

```typescript
import webpush from 'web-push';

if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  console.warn('VAPID keys not configured - push notifications disabled');
} else {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export { webpush };
```

### 6. Key Integration Points

#### Job Completion Trigger

**File**: `app/api/jobs/[id]/status/route.ts`

After updating job to terminal state, add:

```typescript
import { sendJobCompletionNotification } from '@/app/lib/push/send-notification';

// After: if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(newStatus))
await sendJobCompletionNotification(job.id, newStatus);
```

#### @mention Trigger

**File**: `app/api/projects/[projectId]/tickets/[id]/comments/route.ts`

After creating in-app notifications, add:

```typescript
import { sendMentionNotification } from '@/app/lib/push/send-notification';

// After: await prisma.notification.createMany(...)
await sendMentionNotification(recipientId, actorName, ticketKey, projectId);
```

## Implementation Order

1. **Schema & Migration** - Database foundation
2. **Environment Setup** - VAPID keys
3. **Service Worker** - Browser-side push handling
4. **Server Push Config** - web-push library setup
5. **Database Functions** - `lib/db/push-subscriptions.ts`
6. **API Routes** - `/api/push/subscribe`, `/api/push/unsubscribe`, `/api/push/status`
7. **Send Notification Logic** - `app/lib/push/send-notification.ts`
8. **UI Components** - Opt-in prompt, settings panel
9. **Integration** - Job status and comment routes
10. **Tests** - Unit, integration, E2E

## Testing Checkpoints

### After Step 1 (Schema)
- `bunx prisma migrate dev` succeeds
- `bunx prisma studio` shows PushSubscription table

### After Step 6 (API Routes)
- `POST /api/push/subscribe` returns 200 with valid subscription
- `GET /api/push/status` returns enabled: false for new user

### After Step 8 (UI)
- Opt-in prompt visible on page load (if not dismissed)
- "Enable" button triggers browser permission request

### After Step 9 (Integration)
- Job completion creates push notification for project owner
- @mention creates push notification for recipient

## Files Created

| Path | Description |
|------|-------------|
| `public/sw.js` | Service worker |
| `app/lib/push/web-push-config.ts` | VAPID configuration |
| `app/lib/push/send-notification.ts` | Push delivery logic |
| `app/lib/push/subscription-schema.ts` | Zod validation |
| `lib/db/push-subscriptions.ts` | Database queries |
| `app/api/push/subscribe/route.ts` | Subscribe endpoint |
| `app/api/push/unsubscribe/route.ts` | Unsubscribe endpoint |
| `app/api/push/status/route.ts` | Status endpoint |
| `app/components/push-notifications/push-opt-in-prompt.tsx` | Opt-in UI |
| `app/components/push-notifications/use-push-notifications.ts` | React hooks |
| `app/components/push-notifications/notification-listener.tsx` | SW message handler |

## Files Modified

| Path | Change |
|------|--------|
| `prisma/schema.prisma` | Add PushSubscription model |
| `app/api/jobs/[id]/status/route.ts` | Trigger job completion notification |
| `app/api/projects/[projectId]/tickets/[id]/comments/route.ts` | Trigger mention notification |
| `app/layout.tsx` | Add NotificationListener component |
