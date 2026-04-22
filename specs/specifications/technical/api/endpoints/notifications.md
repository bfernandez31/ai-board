# Notification Endpoints

## Notification Endpoints

### GET /api/notifications

Fetch notifications for authenticated user with unread count.

**Authentication**: Required (session)
**Authorization**: User can only access their own notifications

**Auth Guard Behavior**:
- Requests without a valid session return `401`
- `x-test-user-id` does not create a notification identity outside explicit test runs
- If a valid session is present, any conflicting `x-test-user-id` is ignored

**Query Parameters**:
- `limit` (optional): Maximum notifications to return (default: 5, max: 50)

**Response** (200 OK):
```json
{
  "notifications": [
    {
      "id": 1,
      "actorName": "Alice Smith",
      "actorImage": "https://...",
      "ticketKey": "ABC-42",
      "commentPreview": "Can you review the authentication logic in the login handler...",
      "createdAt": "2025-01-20T14:30:00.000Z",
      "read": false,
      "commentId": 123,
      "projectId": 1
    },
    {
      "id": 2,
      "actorName": "Bob Johnson",
      "actorImage": null,
      "ticketKey": "ABC-38",
      "commentPreview": "Thanks for the feedback! I've updated the spec accordingly.",
      "createdAt": "2025-01-19T10:15:00.000Z",
      "read": true,
      "commentId": 118,
      "projectId": 1
    }
  ],
  "unreadCount": 3,
  "hasMore": false
}
```

**Fields**:
- `actorName`: Display name or email of user who created the mention
- `actorImage`: Avatar URL (null if not available)
- `ticketKey`: Human-readable ticket identifier for navigation
- `commentPreview`: First 80 characters of comment content (truncated with "...")
- `createdAt`: ISO 8601 timestamp of notification creation
- `read`: Boolean indicating if notification has been read
- `commentId`: ID for comment anchor navigation and scroll targeting
- `projectId`: Project ID for navigation URL construction and cross-project detection
- `unreadCount`: Total number of unread notifications for user
- `hasMore`: Boolean indicating if more notifications exist beyond limit

**Navigation Context**:
- `projectId` enables same-project vs cross-project detection
- Same-project: Current window navigation when notification.projectId matches board projectId
- Cross-project: New tab navigation when notification.projectId differs from board projectId
- `commentId` used to construct comment anchor (#comment-{id}) for scroll targeting
- `ticketKey` used to construct navigation URL (/projects/{projectId}?modal=open&ticketKey={ticketKey}&tab=comments#comment-{commentId})

**Errors**:
- `401`: Not authenticated
- `500`: Database error

### PATCH /api/notifications/:id/mark-read

Mark a single notification as read.

**Authentication**: Required (session)
**Authorization**: User can only mark their own notifications as read

**Path Parameters**:
- `id` (number, required): Notification ID

**Request Body**: Empty

**Response** (200 OK):
```json
{
  "success": true
}
```

**Errors**:
- `400`: Invalid notification ID (non-numeric)
- `401`: Not authenticated
- `403`: Notification belongs to another user
- `404`: Notification not found
- `500`: Database error

**Idempotency**: Marking an already-read notification returns 200 OK

**Usage Pattern**:
- Called by notification dropdown before navigation
- Updates `read` to true and sets `readAt` timestamp
- Triggers TanStack Query cache invalidation for notification list
- Supports optimistic updates (UI updates before server confirms)
- Navigation begins immediately after mutation call (non-blocking)

### POST /api/notifications/mark-all-read

Mark all notifications as read for authenticated user.

**Authentication**: Required (session)
**Authorization**: Only affects current user's notifications

**Request Body**: Empty

**Response** (200 OK):
```json
{
  "success": true,
  "count": 5
}
```

**Fields**:
- `count`: Number of notifications marked as read

**Errors**:
- `401`: Not authenticated
- `500`: Database error

**Behavior**:
- Only marks unread notifications (read=false)
- Sets read=true and readAt=current timestamp
- Updates all unread notifications in single transaction
- Returns count of affected notifications

## Push Notification Endpoints

### POST /api/push/subscribe

Create or update browser push notification subscription for authenticated user.

**Authentication**: Required (session)
**Authorization**: User can only manage their own subscriptions

**Request Body**:
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "BNcRd...",
    "auth": "tBHI..."
  },
  "expirationTime": null
}
```

**Fields**:
- `endpoint`: Web Push endpoint URL provided by browser's push service
- `keys.p256dh`: Public key for message encryption (required by Web Push spec)
- `keys.auth`: Authentication secret for message encryption (required by Web Push spec)
- `expirationTime`: Optional subscription expiration timestamp (nullable)

**Response** (200 OK):
```json
{
  "success": true
}
```

**Errors**:
- `400`: Invalid subscription data (validation errors include field paths)
- `401`: Not authenticated
- `500`: Database error

**Behavior**:
- Upserts subscription (endpoint is unique key)
- Updates existing subscription if endpoint already exists
- Creates new subscription if endpoint not found
- Stores User-Agent header for device identification
- Subscription data validated with Zod schema before storage

### POST /api/push/unsubscribe

Remove browser push notification subscription for authenticated user.

**Authentication**: Required (session)
**Authorization**: User can only unsubscribe their own subscriptions

**Request Body**:
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

**Response** (200 OK):
```json
{
  "success": true
}
```

**Errors**:
- `400`: Invalid request (missing endpoint)
- `401`: Not authenticated
- `404`: Subscription not found
- `500`: Database error

**Behavior**:
- Deletes subscription matching endpoint for current user
- Idempotent: returns 404 if subscription doesn't exist
- Does not affect other subscriptions for the same user

### GET /api/push/status

Check browser push notification subscription status for authenticated user.

**Authentication**: Required (session)
**Authorization**: User can only check their own subscription status

**Response** (200 OK):
```json
{
  "enabled": true,
  "subscriptionCount": 2,
  "subscriptions": [
    {
      "id": 1,
      "userAgent": "Mozilla/5.0 (Macintosh...) Chrome/120.0.0.0",
      "createdAt": "2025-01-15T10:30:00.000Z"
    },
    {
      "id": 2,
      "userAgent": "Mozilla/5.0 (Windows NT...) Firefox/121.0",
      "createdAt": "2025-01-16T14:20:00.000Z"
    }
  ]
}
```

**Fields**:
- `enabled`: Boolean indicating if user has any active subscriptions
- `subscriptionCount`: Total number of active subscriptions
- `subscriptions`: Array of subscription summaries (excludes sensitive keys)
  - `id`: Subscription ID
  - `userAgent`: Browser/device identifier
  - `createdAt`: Subscription creation timestamp

**Errors**:
- `401`: Not authenticated
- `500`: Database error

**Usage**:
- Frontend checks status to display opt-in prompt or subscription UI
- Enables users to view which devices have push notifications enabled
- Does not expose encryption keys (p256dh, auth) for security

**Push Notification Delivery**:

Push notifications are sent server-side when:
1. **Job Completion**: Job status changes to COMPLETED, FAILED, or CANCELLED (sent to project owner)
2. **@Mentions**: User is mentioned in a comment (sent to mentioned user if they're a project owner)

Delivery handled by:
- `sendJobCompletionNotification()` in `app/lib/push/send-notification.ts` (called from job status update endpoint)
- `sendMentionNotification()` in `app/lib/push/send-notification.ts` (called from comment creation endpoint)
- Service worker at `/public/sw.js` handles push events and notification clicks in browser
- VAPID authentication configured via environment variables (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)

