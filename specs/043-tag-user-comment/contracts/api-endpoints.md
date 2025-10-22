# API Contracts: User Mentions in Comments

**Feature**: 043-tag-user-comment
**Date**: 2025-10-22
**Status**: Complete

## Endpoints

### 1. Get Project Members

**Purpose**: Fetch all users who are members of a project for autocomplete dropdown

#### Request

```http
GET /api/projects/:projectId/members
Authorization: Session cookie (NextAuth.js)
```

**Path Parameters**:
- `projectId` (number, required): Project ID to fetch members for

**Query Parameters**: None

**Headers**:
- `Cookie`: Session cookie for authentication

#### Response (200 OK)

```json
{
  "members": [
    {
      "id": "user-abc123",
      "name": "John Doe",
      "email": "john@example.com"
    },
    {
      "id": "user-xyz789",
      "name": "Jane Smith",
      "email": "jane@example.com"
    }
  ]
}
```

**Response Schema**:
```typescript
interface GetProjectMembersResponse {
  members: ProjectMember[];
}

interface ProjectMember {
  id: string;
  name: string | null;
  email: string;
}
```

#### Error Responses

**401 Unauthorized**:
```json
{
  "error": "Unauthorized - No session found"
}
```

**403 Forbidden**:
```json
{
  "error": "Forbidden - Project not owned by user"
}
```

**404 Not Found**:
```json
{
  "error": "Project not found"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Failed to fetch project members"
}
```

#### Implementation Notes

- Returns only users who are members of the specified project
- Validates project ownership (session user must own the project)
- Result sorted alphabetically by name
- Excludes deleted users automatically (Prisma query)

#### Zod Schema

```typescript
import { z } from 'zod';

export const projectMemberSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().email(),
});

export const getProjectMembersResponseSchema = z.object({
  members: z.array(projectMemberSchema),
});
```

---

### 2. Create Comment with Mentions (Extended Endpoint)

**Purpose**: Create a new comment on a ticket, with optional user mentions

**Note**: This extends the existing `/api/projects/:projectId/tickets/:ticketId/comments` endpoint with mention validation logic.

#### Request

```http
POST /api/projects/:projectId/tickets/:ticketId/comments
Content-Type: application/json
Authorization: Session cookie (NextAuth.js)
```

**Path Parameters**:
- `projectId` (number, required): Project ID containing the ticket
- `ticketId` (number, required): Ticket ID to comment on

**Request Body**:
```json
{
  "content": "Hey @[user-abc123:John Doe], can you review this?"
}
```

**Request Schema**:
```typescript
interface CreateCommentRequest {
  content: string;  // Max 2000 chars, may contain mention markup @[userId:name]
}
```

#### Response (201 Created)

```json
{
  "id": 42,
  "ticketId": 5,
  "userId": "user-session123",
  "content": "Hey @[user-abc123:John Doe], can you review this?",
  "createdAt": "2025-10-22T10:30:00.000Z",
  "updatedAt": "2025-10-22T10:30:00.000Z"
}
```

**Response Schema**:
```typescript
interface CreateCommentResponse {
  id: number;
  ticketId: number;
  userId: string;
  content: string;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}
```

#### Error Responses

**400 Bad Request** (Invalid mention format):
```json
{
  "error": "Invalid mention format",
  "code": "INVALID_MENTION_FORMAT"
}
```

**400 Bad Request** (Content too long):
```json
{
  "error": "Comment exceeds maximum length (2000 characters)",
  "code": "CONTENT_TOO_LONG"
}
```

**400 Bad Request** (Mentioned user not in project):
```json
{
  "error": "Mentioned user is not a member of this project",
  "code": "INVALID_MENTION_USER",
  "details": {
    "invalidUserIds": ["user-invalid123"]
  }
}
```

**401 Unauthorized**:
```json
{
  "error": "Unauthorized - No session found"
}
```

**403 Forbidden**:
```json
{
  "error": "Forbidden - Project not owned by user"
}
```

**404 Not Found** (Ticket not found):
```json
{
  "error": "Ticket not found"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Failed to create comment"
}
```

#### Validation Rules

1. **Content length**: 1-2000 characters (including mention markup)
2. **Mention format**: Must match regex `@\[([^:]+):([^\]]+)\]`
3. **User existence**: All mentioned user IDs must exist in database
4. **Project membership**: All mentioned users must be members of the project
5. **Authorization**: Session user must own the project

#### Zod Schema

```typescript
import { z } from 'zod';

const mentionMarkupRegex = /@\[([^:]+):([^\]]+)\]/g;

export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment exceeds maximum length')
    .refine(
      (content) => {
        if (!content.includes('@[')) return true;
        const mentions = Array.from(content.matchAll(mentionMarkupRegex));
        return content.split('@[').length - 1 === mentions.length;
      },
      { message: 'Invalid mention format' }
    ),
});

export const createCommentResponseSchema = z.object({
  id: z.number(),
  ticketId: z.number(),
  userId: z.string(),
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

---

### 3. Get Comments with Mention Resolution (Extended Endpoint)

**Purpose**: Fetch all comments for a ticket with user data for mention resolution

**Note**: This extends the existing `/api/projects/:projectId/tickets/:ticketId/comments` GET endpoint to include mentioned user data.

#### Request

```http
GET /api/projects/:projectId/tickets/:ticketId/comments
Authorization: Session cookie (NextAuth.js)
```

**Path Parameters**:
- `projectId` (number, required): Project ID containing the ticket
- `ticketId` (number, required): Ticket ID to fetch comments for

**Query Parameters**: None

#### Response (200 OK)

```json
{
  "comments": [
    {
      "id": 42,
      "ticketId": 5,
      "userId": "user-session123",
      "content": "Hey @[user-abc123:John Doe], can you review this?",
      "createdAt": "2025-10-22T10:30:00.000Z",
      "updatedAt": "2025-10-22T10:30:00.000Z",
      "user": {
        "id": "user-session123",
        "name": "Alice Johnson",
        "email": "alice@example.com"
      }
    }
  ],
  "mentionedUsers": {
    "user-abc123": {
      "id": "user-abc123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

**Response Schema**:
```typescript
interface GetCommentsResponse {
  comments: CommentWithAuthor[];
  mentionedUsers: Record<string, User>;  // Map of userId → User for mention resolution
}

interface CommentWithAuthor {
  id: number;
  ticketId: number;
  userId: string;
  content: string;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
  user: User;  // Comment author
}

interface User {
  id: string;
  name: string | null;
  email: string;
}
```

#### Error Responses

**401 Unauthorized**:
```json
{
  "error": "Unauthorized - No session found"
}
```

**403 Forbidden**:
```json
{
  "error": "Forbidden - Project not owned by user"
}
```

**404 Not Found** (Ticket not found):
```json
{
  "error": "Ticket not found"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Failed to fetch comments"
}
```

#### Implementation Notes

- Returns comments ordered by `createdAt` ascending (chronological order)
- Includes comment author data (user field)
- Includes all mentioned users in `mentionedUsers` map for efficient client-side resolution
- Deleted users are excluded from `mentionedUsers` map (client shows "[Removed User]")
- Single query optimization: fetches all mentioned users in one batch (no N+1 queries)

#### Zod Schema

```typescript
import { z } from 'zod';

export const userSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().email(),
});

export const commentWithAuthorSchema = z.object({
  id: z.number(),
  ticketId: z.number(),
  userId: z.string(),
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  user: userSchema,
});

export const getCommentsResponseSchema = z.object({
  comments: z.array(commentWithAuthorSchema),
  mentionedUsers: z.record(z.string(), userSchema),
});
```

---

## TypeScript Types (Shared)

```typescript
// app/lib/types/mention.ts

export interface User {
  id: string;
  name: string | null;
  email: string;
}

export interface ProjectMember extends User {
  // No additional fields for MVP
}

export interface Comment {
  id: number;
  ticketId: number;
  userId: string;
  content: string;  // May contain mention markup
  createdAt: string;
  updatedAt: string;
}

export interface CommentWithAuthor extends Comment {
  user: User;  // Comment author
}

export interface ParsedMention {
  userId: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
}

// API request/response types
export interface GetProjectMembersResponse {
  members: ProjectMember[];
}

export interface CreateCommentRequest {
  content: string;
}

export interface CreateCommentResponse extends Comment {}

export interface GetCommentsResponse {
  comments: CommentWithAuthor[];
  mentionedUsers: Record<string, User>;
}
```

---

## Rate Limiting

**Note**: No rate limiting required for MVP. All endpoints are authenticated and scoped to project ownership.

**Future Consideration**: If notification system is added, rate limit mention creation to prevent spam:
- Max 10 mentions per comment
- Max 50 comments with mentions per user per hour

---

## Caching Strategy

### Client-Side (TanStack Query)

```typescript
// Query keys
export const queryKeys = {
  projectMembers: (projectId: number) => ['projects', projectId, 'members'] as const,
  ticketComments: (ticketId: number) => ['tickets', ticketId, 'comments'] as const,
};

// Cache configuration
const projectMembersQuery = useQuery({
  queryKey: queryKeys.projectMembers(projectId),
  queryFn: () => fetchProjectMembers(projectId),
  staleTime: 5 * 60 * 1000,  // 5 minutes (members don't change often)
  cacheTime: 10 * 60 * 1000, // 10 minutes
});

const commentsQuery = useQuery({
  queryKey: queryKeys.ticketComments(ticketId),
  queryFn: () => fetchComments(ticketId),
  staleTime: 30 * 1000,      // 30 seconds (comments update frequently)
  cacheTime: 5 * 60 * 1000,  // 5 minutes
});
```

### Server-Side

No server-side caching for MVP. Database queries are fast enough (<50ms p95).

**Future Consideration**: Add Redis caching for project members list if performance degrades with large projects.
