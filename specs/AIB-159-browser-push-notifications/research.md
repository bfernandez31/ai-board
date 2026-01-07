# Research: Browser Push Notifications

**Feature**: AIB-159 Browser Push Notifications
**Date**: 2026-01-07
**Status**: Complete

## Research Questions Addressed

### 1. Web Push API Integration with Next.js App Router

**Decision**: Use static service worker at `/public/sw.js` with client-side registration

**Rationale**:
- Next.js App Router serves static files from `/public` at root path
- Service worker must be at root scope (`/`) for full site coverage
- Client Components handle registration and subscription management
- No need for next-pwa or similar libraries—vanilla Web Push API is sufficient

**Alternatives Considered**:
- `next-pwa` package: Adds unnecessary complexity for simple push-only use case
- Dynamic service worker generation: Not needed since push logic is static

**Implementation Pattern**:
```
public/sw.js              → Served at /sw.js
components/use-push.ts    → Client-side registration hook
```

### 2. VAPID Key Management

**Decision**: Store VAPID keys as environment variables

**Rationale**:
- Public key: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (safe for client exposure)
- Private key: `VAPID_PRIVATE_KEY` (server-only, never bundled to client)
- Subject: `VAPID_SUBJECT` (mailto: or https: URL for identification)
- Generate once per deployment environment, never commit to git

**Alternatives Considered**:
- Key rotation: Adds complexity without security benefit for this use case
- Per-user keys: Not standard practice, complicates subscription management

**Key Generation**:
```bash
npx web-push generate-vapid-keys
```

### 3. Push Subscription Storage Schema

**Decision**: Dedicated `PushSubscription` model with user foreign key

**Rationale**:
- Web Push requires storing: endpoint (unique), p256dh key, auth key
- One user can have multiple subscriptions (multiple browsers/devices)
- Endpoint is unique constraint (same browser = same subscription)
- Cascade delete when user is removed

**Alternatives Considered**:
- JSON field on User model: Harder to query, manage expiration, handle multi-device
- Separate device table: Over-engineering for current requirements

**Schema Pattern** (see data-model.md):
```prisma
model PushSubscription {
  endpoint String @unique @db.VarChar(500)
  p256dh   String @db.VarChar(100)
  auth     String @db.VarChar(50)
  userId   String
  user     User @relation(...)
}
```

### 4. Job Completion Trigger Integration

**Decision**: Extend existing `PATCH /api/jobs/:id/status` route

**Rationale**:
- Job status updates already flow through single endpoint
- Terminal state detection (COMPLETED/FAILED/CANCELLED) already exists
- Add push notification as non-blocking side effect after status update
- Project owner lookup via `job.ticket.project.userId`

**Alternatives Considered**:
- Separate webhook endpoint: Adds unnecessary complexity
- Client-side polling trigger: Won't work when tab is closed (defeats purpose)

**Integration Point**: `app/api/jobs/[id]/status/route.ts` lines 50-80 (after status update)

### 5. @mention Trigger Integration

**Decision**: Extend existing notification creation in comment POST handler

**Rationale**:
- `createNotificationForMention` already handles in-app notifications
- Add push notification as additional delivery channel
- Same recipient filtering logic (project members only)

**Alternatives Considered**:
- Separate notification service: Over-architecture for single feature
- Database trigger: Too low-level, harder to maintain

**Integration Point**: `app/api/projects/[projectId]/tickets/[id]/comments/route.ts` lines 252-290

### 6. Notification Click Navigation

**Decision**: Service worker posts message to client, client uses Next.js router

**Rationale**:
- Service worker can't directly access Next.js router
- `clients.postMessage()` bridges service worker to client
- Client-side `NotificationListener` component handles navigation
- Falls back to `clients.openWindow()` if no existing tab

**Alternatives Considered**:
- Direct URL navigation in service worker: Works but loses SPA benefits
- Always open new tab: Creates tab proliferation

**Navigation Pattern**:
```
sw.js notificationclick → postMessage → NotificationListener → router.push
```

### 7. Opt-in Prompt UX

**Decision**: Floating card in bottom-right corner, dismissal stored in localStorage

**Rationale**:
- Non-blocking: Doesn't interrupt user workflow
- Persistent dismissal: localStorage key `push-notifications-dismissed`
- Show only to authenticated users who haven't dismissed or subscribed
- Re-shows after browser data clear (acceptable per spec decision)

**Alternatives Considered**:
- Modal dialog: Too intrusive for optional feature
- Banner: Takes valuable vertical space
- Settings-only: Users might never discover the feature

**Component**: `PushOptInPrompt` with shadcn/ui Card, Button

### 8. Browser Support Detection

**Decision**: Feature detection with graceful degradation

**Rationale**:
- Check `'serviceWorker' in navigator && 'PushManager' in window`
- Hide opt-in prompt if not supported
- No error states shown—users simply rely on in-app notifications
- iOS Safari requires PWA installation (document in future enhancement)

**Browser Coverage**:
| Browser | Support |
|---------|---------|
| Chrome 50+ | Full |
| Firefox 44+ | Full |
| Edge 17+ | Full |
| Safari 16.4+ | Full (macOS/iOS PWA) |

### 9. Error Handling for Failed Push Delivery

**Decision**: Graceful degradation with subscription cleanup

**Rationale**:
- 404/410 errors: Delete invalid subscription from database
- 429 rate limit: Log warning, don't delete (temporary issue)
- Other errors: Log and continue (don't block other notifications)
- Never throw to calling code (non-blocking side effect)

**Error Code Reference**:
| Code | Action |
|------|--------|
| 404, 410 | Delete subscription (expired/invalid) |
| 429 | Retry later (rate limit) |
| 5xx | Log error (server issue) |

### 10. Multiple Simultaneous Notifications

**Decision**: Send separate notifications, let OS handle grouping

**Rationale**:
- Each job completion is discrete event
- Browser/OS may group notifications with same `tag` option
- Use `ticketKey` as tag for per-ticket grouping
- `renotify: true` ensures each notification alerts user

**Alternatives Considered**:
- Server-side batching: Adds latency, complexity for edge case
- Single "multiple jobs completed" message: Loses individual ticket context

## Dependencies

### Production
- `web-push` ^3.6.x - Web Push protocol implementation (VAPID, encryption)

### Development
- `@types/web-push` ^3.6.x - TypeScript definitions

## Environment Variables

```env
# Client-side (safe to expose)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<generated-public-key>

# Server-side only
VAPID_PRIVATE_KEY=<generated-private-key>
VAPID_SUBJECT=mailto:notifications@ai-board.dev
```

## Key Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add PushSubscription model |
| `app/api/jobs/[id]/status/route.ts` | Add push notification trigger |
| `app/api/projects/.../comments/route.ts` | Add mention push trigger |
| `app/layout.tsx` | Add NotificationListener component |

## Key Files to Create

| File | Purpose |
|------|---------|
| `public/sw.js` | Service worker for push events |
| `app/components/push-notifications/` | UI components |
| `app/lib/push/` | Server-side push utilities |
| `lib/db/push-subscriptions.ts` | Database query functions |
| `app/api/push/` | Subscription management endpoints |
