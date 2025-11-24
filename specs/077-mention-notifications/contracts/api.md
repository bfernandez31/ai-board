# API Contracts: Mention Notifications

**Feature**: AIB-77 Mention Notifications
**Date**: 2025-11-24
**Base URL**: `/api/notifications`

## Overview

RESTful API endpoints for managing mention notifications. All endpoints require authentication via NextAuth.js session. Responses follow consistent JSON structure with error handling.

---

## Authentication

All endpoints require authenticated session:

```typescript
// Middleware check (Next.js App Router)
import { auth } from '@/lib/auth';

const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## Endpoints

### 1. List Notifications

**GET** `/api/notifications`

Retrieve paginated list of notifications for the authenticated user.

#### Request

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | 5 | Number of notifications to return (max: 50) |
| `offset` | number | No | 0 | Pagination offset |

**Headers**:
```
Cookie: next-auth.session-token=<session-token>
```

**Example**:
```
GET /api/notifications?limit=5&offset=0
```

#### Response

**Status**: `200 OK`

**Body**:
```typescript
{
  notifications: NotificationDisplay[];
  unreadCount: number;
  hasMore: boolean;
}
```

**NotificationDisplay Type**:
```typescript
interface NotificationDisplay {
  id: number;
  actorName: string;           // Display name or email
  actorImage: string | null;   // Avatar URL
  ticketKey: string;           // e.g., "AIB-123"
  commentPreview: string;      // First 80 chars of comment content
  createdAt: string;           // ISO 8601 timestamp
  read: boolean;
  commentId: number;
  projectId: number;
}
```

**Example Response**:
```json
{
  "notifications": [
    {
      "id": 42,
      "actorName": "Alice Smith",
      "actorImage": "https://example.com/avatar.jpg",
      "ticketKey": "AIB-123",
      "commentPreview": "Hey @Bob, can you review this implementation? I think we need to...",
      "createdAt": "2025-11-24T15:30:00.000Z",
      "read": false,
      "commentId": 567,
      "projectId": 1
    }
  ],
  "unreadCount": 3,
  "hasMore": false
}
```

#### Error Responses

**401 Unauthorized**:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED"
}
```

**400 Bad Request**:
```json
{
  "error": "Invalid limit parameter (max: 50)",
  "code": "INVALID_LIMIT"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Failed to fetch notifications",
  "code": "DATABASE_ERROR"
}
```

---

### 2. Mark Notification as Read

**PATCH** `/api/notifications/[id]/mark-read`

Mark a single notification as read. Uses optimistic update pattern (client updates UI immediately).

#### Request

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Notification ID |

**Headers**:
```
Cookie: next-auth.session-token=<session-token>
```

**Example**:
```
PATCH /api/notifications/42/mark-read
```

#### Response

**Status**: `200 OK`

**Body**:
```typescript
{
  success: boolean;
  notification: NotificationDisplay;
}
```

**Example Response**:
```json
{
  "success": true,
  "notification": {
    "id": 42,
    "actorName": "Alice Smith",
    "actorImage": "https://example.com/avatar.jpg",
    "ticketKey": "AIB-123",
    "commentPreview": "Hey @Bob, can you review this implementation?",
    "createdAt": "2025-11-24T15:30:00.000Z",
    "read": true,
    "commentId": 567,
    "projectId": 1
  }
}
```

#### Error Responses

**401 Unauthorized**:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED"
}
```

**403 Forbidden**:
```json
{
  "error": "Cannot mark notification belonging to another user",
  "code": "FORBIDDEN"
}
```

**404 Not Found**:
```json
{
  "error": "Notification not found",
  "code": "NOT_FOUND"
}
```

**400 Bad Request** (already read):
```json
{
  "success": true,
  "notification": { /* ... */ }
}
```
*Note: Marking an already-read notification returns 200 (idempotent operation)*

**500 Internal Server Error**:
```json
{
  "error": "Failed to update notification",
  "code": "DATABASE_ERROR"
}
```

---

### 3. Mark All Notifications as Read

**POST** `/api/notifications/mark-all-read`

Mark all unread notifications as read for the authenticated user (bulk operation).

#### Request

**Headers**:
```
Cookie: next-auth.session-token=<session-token>
```

**Body**: None

**Example**:
```
POST /api/notifications/mark-all-read
```

#### Response

**Status**: `200 OK`

**Body**:
```typescript
{
  success: boolean;
  count: number;  // Number of notifications marked as read
}
```

**Example Response**:
```json
{
  "success": true,
  "count": 12
}
```

#### Error Responses

**401 Unauthorized**:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Failed to mark notifications as read",
  "code": "DATABASE_ERROR"
}
```

---

### 4. Create Notifications on Comment (Internal)

**POST** `/api/comments` (Enhanced)

Existing endpoint enhanced to create notifications when @mentions are detected.

#### Enhanced Behavior

**After** comment is successfully created:

1. Extract @mentions from comment content using `extractMentionUserIds(content)`
2. Query project members for ticket's project
3. Filter mentions:
   - Remove self-mentions (actorId === recipientId)
   - Remove non-project members
   - Deduplicate user IDs
4. Create Notification records in database (Prisma transaction)
5. Return comment response as normal (notifications created asynchronously)

#### Example Flow

```typescript
// POST /api/comments
// Body: { ticketId: 1, content: "Hey @[user123:Alice] can you check this?" }

// 1. Create comment (existing behavior)
const comment = await prisma.comment.create({ /* ... */ });

// 2. Extract mentions (NEW)
const mentionedUserIds = extractMentionUserIds(content); // ["user123"]

// 3. Filter valid recipients (NEW)
const projectMembers = await getProjectMembers(ticket.projectId);
const validRecipients = mentionedUserIds.filter(
  id => id !== actorId && projectMembers.some(m => m.userId === id)
);

// 4. Create notifications (NEW)
await prisma.notification.createMany({
  data: validRecipients.map(recipientId => ({
    recipientId,
    actorId: session.user.id,
    commentId: comment.id,
    ticketId: ticket.id,
  })),
});

// 5. Return comment (existing behavior)
return NextResponse.json({ comment });
```

**Notes**:
- Comment creation is NOT blocked by notification errors (notifications fail silently)
- No changes to existing POST /api/comments contract (backwards compatible)
- Notification creation should use try-catch to prevent comment API failures

---

## TypeScript Type Definitions

```typescript
// types/notifications.ts

export interface NotificationDisplay {
  id: number;
  actorName: string;
  actorImage: string | null;
  ticketKey: string;
  commentPreview: string;
  createdAt: string; // ISO 8601
  read: boolean;
  commentId: number;
  projectId: number;
}

export interface NotificationsResponse {
  notifications: NotificationDisplay[];
  unreadCount: number;
  hasMore: boolean;
}

export interface MarkReadResponse {
  success: boolean;
  notification: NotificationDisplay;
}

export interface MarkAllReadResponse {
  success: boolean;
  count: number;
}

export interface ErrorResponse {
  error: string;
  code?: string;
}
```

---

## Request/Response Examples

### Successful List Request

**Request**:
```bash
curl -X GET "https://ai-board.app/api/notifications?limit=2" \
  -H "Cookie: next-auth.session-token=abc123"
```

**Response**:
```json
{
  "notifications": [
    {
      "id": 42,
      "actorName": "Alice Smith",
      "actorImage": "https://cloudinary.com/image/avatar1.jpg",
      "ticketKey": "AIB-123",
      "commentPreview": "Hey @Bob, can you review this implementation? I think we need to refactor...",
      "createdAt": "2025-11-24T15:30:00.000Z",
      "read": false,
      "commentId": 567,
      "projectId": 1
    },
    {
      "id": 41,
      "actorName": "Charlie Johnson",
      "actorImage": null,
      "ticketKey": "AIB-120",
      "commentPreview": "@Bob I noticed a bug in your last commit. Can you take a look?",
      "createdAt": "2025-11-24T10:15:00.000Z",
      "read": true,
      "commentId": 555,
      "projectId": 1
    }
  ],
  "unreadCount": 3,
  "hasMore": true
}
```

---

### Mark Single Notification as Read

**Request**:
```bash
curl -X PATCH "https://ai-board.app/api/notifications/42/mark-read" \
  -H "Cookie: next-auth.session-token=abc123"
```

**Response**:
```json
{
  "success": true,
  "notification": {
    "id": 42,
    "actorName": "Alice Smith",
    "actorImage": "https://cloudinary.com/image/avatar1.jpg",
    "ticketKey": "AIB-123",
    "commentPreview": "Hey @Bob, can you review this implementation?",
    "createdAt": "2025-11-24T15:30:00.000Z",
    "read": true,
    "commentId": 567,
    "projectId": 1
  }
}
```

---

### Mark All Notifications as Read

**Request**:
```bash
curl -X POST "https://ai-board.app/api/notifications/mark-all-read" \
  -H "Cookie: next-auth.session-token=abc123"
```

**Response**:
```json
{
  "success": true,
  "count": 12
}
```

---

## Authorization Rules

### Per-Endpoint Authorization

| Endpoint | Authorization | Logic |
|----------|---------------|-------|
| GET /api/notifications | User must be authenticated | Only returns notifications for current user |
| PATCH /api/notifications/[id]/mark-read | User must own notification | Verify `notification.recipientId === session.user.id` |
| POST /api/notifications/mark-all-read | User must be authenticated | Only marks current user's notifications |
| POST /api/comments (enhanced) | User must be project member | Existing authorization applies |

### Implementation Pattern

```typescript
// app/api/notifications/route.ts
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  // Only query notifications for authenticated user
  const notifications = await getNotificationsForUser(session.user.id);
  // ...
}
```

```typescript
// app/api/notifications/[id]/mark-read/route.ts
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const notificationId = parseInt(params.id);
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    return NextResponse.json({ error: 'Notification not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  if (notification.recipientId !== session.user.id) {
    return NextResponse.json({ error: 'Cannot mark notification belonging to another user', code: 'FORBIDDEN' }, { status: 403 });
  }

  // Proceed with update...
}
```

---

## Error Handling

### Error Response Structure

All errors follow consistent format:

```typescript
{
  error: string;      // Human-readable error message
  code?: string;      // Machine-readable error code
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_REQUIRED` | 401 | User not authenticated |
| `FORBIDDEN` | 403 | User not authorized for this resource |
| `NOT_FOUND` | 404 | Resource does not exist |
| `INVALID_LIMIT` | 400 | Query parameter out of range |
| `DATABASE_ERROR` | 500 | Database query failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Error Handling Pattern

```typescript
try {
  // Database operation
  const result = await prisma.notification.findMany(/* ... */);
  return NextResponse.json({ notifications: result });
} catch (error) {
  console.error('[API] Failed to fetch notifications:', error);
  return NextResponse.json(
    { error: 'Failed to fetch notifications', code: 'DATABASE_ERROR' },
    { status: 500 }
  );
}
```

---

## Validation Rules

### Query Parameters

**GET /api/notifications**:

| Parameter | Validation | Error Response |
|-----------|------------|----------------|
| `limit` | Must be 1-50 | `{ error: 'Invalid limit parameter (max: 50)', code: 'INVALID_LIMIT' }` |
| `offset` | Must be >= 0 | `{ error: 'Invalid offset parameter (must be >= 0)', code: 'INVALID_OFFSET' }` |

**Implementation**:
```typescript
const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 50);
const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
```

### Path Parameters

**PATCH /api/notifications/[id]/mark-read**:

| Parameter | Validation | Error Response |
|-----------|------------|----------------|
| `id` | Must be positive integer | `{ error: 'Invalid notification ID', code: 'INVALID_ID' }` |
| `id` | Must exist in database | `{ error: 'Notification not found', code: 'NOT_FOUND' }` |

---

## Rate Limiting

**Client-Side Polling**:
- 15-second interval = 4 requests/minute/user
- Expected load: 50 users × 4 req/min = 200 req/min total

**No server-side rate limiting implemented** for MVP (polling rate is controlled client-side).

**Future Enhancement**: Consider rate limiting if abuse detected (e.g., 100 requests/minute/user threshold).

---

## Caching Strategy

### Client-Side (TanStack Query)

```typescript
// components/notifications/use-notifications.ts
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 0,              // Always fetch fresh data (polling-based)
    cacheTime: 5 * 60 * 1000,  // Keep in cache for 5 minutes
    refetchInterval: 15000,    // Poll every 15 seconds
  });
}
```

### Server-Side

- **No server-side caching** for notification lists (always fetch from database)
- **Rationale**: Notifications are user-specific, short-lived, and change frequently
- **Database indexes** provide sufficient performance (<10ms query time)

---

## Testing Contracts

### Unit Tests (API Routes)

```typescript
// tests/unit/api/notifications.test.ts
describe('GET /api/notifications', () => {
  it('should return notifications for authenticated user', async () => {
    const response = await GET(mockRequest);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.notifications).toHaveLength(5);
  });

  it('should return 401 for unauthenticated request', async () => {
    const response = await GET(mockUnauthenticatedRequest);
    expect(response.status).toBe(401);
  });
});
```

### Integration Tests (E2E)

```typescript
// tests/e2e/notifications.spec.ts
test('should fetch notifications via API', async ({ page }) => {
  await page.goto('/');

  // Wait for polling to fetch notifications
  const response = await page.waitForResponse(
    response => response.url().includes('/api/notifications') && response.status() === 200
  );

  const data = await response.json();
  expect(data.notifications).toBeDefined();
  expect(data.unreadCount).toBeGreaterThanOrEqual(0);
});
```

---

## OpenAPI Specification

**File**: `contracts/openapi.yaml` (Optional)

```yaml
openapi: 3.0.0
info:
  title: AI-Board Notifications API
  version: 1.0.0
  description: REST API for mention notifications

paths:
  /api/notifications:
    get:
      summary: List notifications
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 5
            maximum: 50
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NotificationsResponse'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/notifications/{id}/mark-read:
    patch:
      summary: Mark notification as read
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MarkReadResponse'
        '401':
          description: Unauthorized
        '403':
          description: Forbidden
        '404':
          description: Not found

  /api/notifications/mark-all-read:
    post:
      summary: Mark all notifications as read
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MarkAllReadResponse'
        '401':
          description: Unauthorized

components:
  schemas:
    NotificationDisplay:
      type: object
      properties:
        id:
          type: integer
        actorName:
          type: string
        actorImage:
          type: string
          nullable: true
        ticketKey:
          type: string
        commentPreview:
          type: string
        createdAt:
          type: string
          format: date-time
        read:
          type: boolean
        commentId:
          type: integer
        projectId:
          type: integer

    NotificationsResponse:
      type: object
      properties:
        notifications:
          type: array
          items:
            $ref: '#/components/schemas/NotificationDisplay'
        unreadCount:
          type: integer
        hasMore:
          type: boolean

    MarkReadResponse:
      type: object
      properties:
        success:
          type: boolean
        notification:
          $ref: '#/components/schemas/NotificationDisplay'

    MarkAllReadResponse:
      type: object
      properties:
        success:
          type: boolean
        count:
          type: integer

    ErrorResponse:
      type: object
      properties:
        error:
          type: string
        code:
          type: string
```

---

## Conclusion

API contracts provide:
- ✅ Clear request/response formats for all endpoints
- ✅ Comprehensive error handling with status codes
- ✅ Authorization rules per endpoint
- ✅ TypeScript type definitions
- ✅ Validation rules for parameters
- ✅ Testing guidance (unit + integration)
- ✅ OpenAPI specification (optional)

**Next Steps**: Generate quickstart.md for developer onboarding.
