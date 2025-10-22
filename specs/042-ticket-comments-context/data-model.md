# Data Model: Ticket Comments

**Feature**: 042-ticket-comments-context
**Date**: 2025-01-22
**Database**: PostgreSQL 14+ via Prisma ORM

## Entity: Comment

Represents a user comment on a ticket with markdown content and metadata.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | Int | PRIMARY KEY, AUTO INCREMENT | Unique comment identifier |
| `ticketId` | Int | NOT NULL, FOREIGN KEY → Ticket(id) | Associated ticket |
| `userId` | String | NOT NULL, FOREIGN KEY → User(id) | Comment author |
| `content` | String | NOT NULL, VARCHAR(2000) | Comment text (markdown) |
| `createdAt` | DateTime | NOT NULL, DEFAULT now() | Creation timestamp |
| `updatedAt` | DateTime | NOT NULL, AUTO UPDATE | Last modification timestamp |

### Relationships

- **Belongs to Ticket**: `ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)`
  - When ticket is deleted, all its comments are deleted (cascade)
  - Prevents orphaned comments

- **Belongs to User**: `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`
  - When user is deleted, all their comments are deleted (cascade)
  - Maintains referential integrity

### Indexes

1. **Composite Index**: `@@index([ticketId, createdAt])`
   - **Purpose**: Efficient comment list queries ordered by creation date
   - **Usage**: `SELECT * FROM Comment WHERE ticketId = ? ORDER BY createdAt DESC`
   - **Performance**: Single index scan for most common query pattern

2. **Single Index**: `@@index([userId])`
   - **Purpose**: Filter comments by author (e.g., for moderation, user profiles)
   - **Usage**: `SELECT * FROM Comment WHERE userId = ?`
   - **Performance**: Fast author lookups

### Validation Rules

**Server-Side (Zod)**:
- `content`: String, 1-2000 characters (inclusive)
- Trim whitespace before validation
- Reject empty strings or whitespace-only content

**Client-Side**:
- Character counter shows current/max (e.g., "250 / 2000")
- Submit button disabled when content is empty or > 2000 characters
- Real-time validation feedback

### State Transitions

Comments have no state machine (static entity). Lifecycle:
1. **Created**: User submits comment form → POST /api/comments
2. **Read**: Users view comments in ticket modal → GET /api/comments
3. **Deleted**: Author clicks delete button → DELETE /api/comments/:id

No edit functionality in v1 (deferred to future).

## Entity: Ticket (Extended)

### New Relationship

- **Has many Comments**: `comments Comment[]`
  - One-to-many relationship
  - Cascade delete ensures cleanup when ticket deleted
  - No changes to existing Ticket fields

## Entity: User (Extended)

### New Relationship

- **Has many Comments**: `comments Comment[]`
  - One-to-many relationship
  - Cascade delete ensures cleanup when user deleted
  - No changes to existing User fields

## Prisma Schema

```prisma
model Comment {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  userId    String
  content   String   @db.VarChar(2000)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([ticketId, createdAt])
  @@index([userId])
}

model Ticket {
  // ... existing fields ...
  comments Comment[] // NEW relationship
}

model User {
  // ... existing fields ...
  comments Comment[] // NEW relationship
}
```

## Migration Strategy

### Migration File

**File**: `prisma/migrations/[timestamp]_add_comment_model/migration.sql`

**Steps**:
1. Create Comment table with constraints
2. Add foreign key constraints (ticketId → Ticket, userId → User)
3. Create indexes (composite ticketId+createdAt, single userId)
4. Update Ticket and User models (implicit - no schema changes)

**SQL**:
```sql
-- CreateTable
CREATE TABLE "Comment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_ticketId_createdAt_idx" ON "Comment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Rollback Strategy

**Command**: `prisma migrate rollback`

**Steps**:
1. Drop foreign key constraints
2. Drop indexes
3. Drop Comment table

**Note**: No data loss risk since this is a new feature (no existing comments to preserve).

## Query Patterns

### 1. List Comments for Ticket

```typescript
// GET /api/projects/[projectId]/tickets/[ticketId]/comments
const comments = await prisma.comment.findMany({
  where: { ticketId: ticketId },
  include: {
    user: {
      select: {
        name: true,
        image: true,
      },
    },
  },
  orderBy: { createdAt: 'desc' }, // Newest first
});
```

**Performance**: Uses composite index `(ticketId, createdAt)` → single index scan

**Response**:
```json
[
  {
    "id": 123,
    "content": "This is a **comment** with markdown",
    "createdAt": "2025-01-22T10:30:00Z",
    "user": {
      "name": "John Doe",
      "image": "https://example.com/avatar.jpg"
    }
  }
]
```

### 2. Create Comment

```typescript
// POST /api/projects/[projectId]/tickets/[ticketId]/comments
const comment = await prisma.comment.create({
  data: {
    ticketId: ticketId,
    userId: session.user.id,
    content: validatedContent,
  },
  include: {
    user: {
      select: {
        name: true,
        image: true,
      },
    },
  },
});
```

**Performance**: Fast insert with auto-generated ID

**Response**: Same structure as list items (comment with user data)

### 3. Delete Comment

```typescript
// DELETE /api/projects/[projectId]/tickets/[ticketId]/comments/[commentId]

// Authorization check (fetch comment first)
const comment = await prisma.comment.findUnique({
  where: { id: commentId },
  select: { userId: true },
});

if (comment.userId !== session.user.id) {
  return new Response(null, { status: 403 });
}

// Delete if authorized
await prisma.comment.delete({
  where: { id: commentId },
});
```

**Performance**: Primary key lookup → fast delete

**Response**: 204 No Content

### 4. Count Comments for Badge

```typescript
// Client-side derived state (no separate API call)
const commentCount = comments?.length ?? 0;
```

**Rationale**: Comments already fetched for display, no need for separate count query

## TypeScript Interfaces

### Comment (API Response)

```typescript
interface CommentWithUser {
  id: number;
  ticketId: number;
  userId: string;
  content: string;
  createdAt: string; // ISO 8601 datetime
  updatedAt: string; // ISO 8601 datetime
  user: {
    name: string | null;
    image: string | null;
  };
}
```

### CreateCommentRequest

```typescript
interface CreateCommentRequest {
  content: string; // 1-2000 characters
}
```

### CreateCommentResponse

```typescript
type CreateCommentResponse = CommentWithUser;
```

### ListCommentsResponse

```typescript
type ListCommentsResponse = CommentWithUser[];
```

### DeleteCommentResponse

```typescript
// 204 No Content (empty body)
type DeleteCommentResponse = void;
```

## Error Scenarios

### 1. Invalid Content Length

**Request**: `POST /comments` with content > 2000 characters

**Response**: 400 Bad Request
```json
{
  "error": "Validation failed",
  "issues": [
    {
      "code": "too_big",
      "maximum": 2000,
      "path": ["content"],
      "message": "Content must be at most 2000 characters"
    }
  ]
}
```

### 2. Unauthorized Project Access

**Request**: `GET /comments` for project user doesn't own

**Response**: 403 Forbidden
```json
{
  "error": "Forbidden: You do not have access to this project"
}
```

### 3. Unauthorized Comment Deletion

**Request**: `DELETE /comments/:id` for comment user didn't create

**Response**: 403 Forbidden
```json
{
  "error": "Forbidden: You can only delete your own comments"
}
```

### 4. Comment Not Found

**Request**: `DELETE /comments/99999` (non-existent ID)

**Response**: 404 Not Found
```json
{
  "error": "Comment not found"
}
```

## Performance Considerations

### Index Strategy

**Composite Index** `(ticketId, createdAt)`:
- Covers most common query: "Get all comments for ticket X ordered by date"
- Single index scan (no separate sort needed)
- Memory-efficient (small index size)

**Single Index** `(userId)`:
- Supports author filtering (future moderation features)
- Low overhead (userId is String type, but indexed)

### Query Optimization

- **No N+1 problem**: Use Prisma `include: { user }` to join in single query
- **Pagination deferred**: v1 renders all comments (acceptable for < 100)
- **Polling efficiency**: 10-second interval balances real-time feel with load

### Caching Strategy

- **TanStack Query cache**: Comments cached in client for 5 minutes (default)
- **Stale-while-revalidate**: Show cached data while fetching updates
- **Optimistic updates**: Immediate UI feedback without waiting for server

## Security

### SQL Injection Prevention

- **Prisma parameterized queries**: All queries use Prisma ORM (no raw SQL)
- **Type safety**: TypeScript ensures correct parameter types

### XSS Prevention

- **Server validation**: Zod schema validates content before database insert
- **Client rendering**: react-markdown escapes HTML by default
- **No raw HTML**: Content stored as plain text, rendered as markdown

### Authorization

- **Project ownership**: Validated on all endpoints (403 if not owner)
- **Comment authorship**: Validated for deletion (403 if not author)
- **Session-based**: User ID from NextAuth session (cannot be spoofed)

## Testing

### Database Tests

**Seed Data** (for E2E tests):
```typescript
// tests/helpers/db-setup.ts
await prisma.comment.createMany({
  data: [
    {
      ticketId: 1,
      userId: testUser.id,
      content: "First comment",
    },
    {
      ticketId: 1,
      userId: testUser.id,
      content: "Second comment with **markdown**",
    },
  ],
});
```

**Cleanup** (before each test):
```typescript
await prisma.comment.deleteMany();
```

### Migration Tests

**Verify**:
- Migration applies cleanly
- Foreign key constraints work (cascade delete)
- Indexes improve query performance (use EXPLAIN)
- Rollback restores previous state

## Future Enhancements

### v2 Features (out of scope for v1)

1. **Edit Comments**:
   - Add `editedAt` timestamp field
   - Show "edited" indicator
   - Track edit history (separate table)

2. **Comment Reactions**:
   - New table: `CommentReaction(id, commentId, userId, emoji)`
   - Count reactions per comment
   - Prevent duplicate reactions per user

3. **@Mentions**:
   - Parse content for @username patterns
   - Create notifications for mentioned users
   - Link to user profiles

4. **Threading/Replies**:
   - Add `parentId` self-referencing foreign key
   - Support nested comment structure
   - Collapse/expand threads

5. **Pagination**:
   - Add cursor-based pagination
   - Virtual scrolling for large lists
   - Load more on scroll

## Summary

Data model complete with:
- ✅ Comment entity with all required fields
- ✅ Foreign key relationships with cascade delete
- ✅ Indexes for efficient querying
- ✅ Validation rules (server + client)
- ✅ TypeScript interfaces for type safety
- ✅ Error handling strategy
- ✅ Security considerations
- ✅ Performance optimizations

**Next Step**: Generate API contracts (OpenAPI specifications)
