# Data Model: User Mentions in Comments

**Feature**: 043-tag-user-comment
**Date**: 2025-10-22
**Status**: Complete

## Overview

User mentions are stored as plain text markup within existing `Comment.content` field. No database schema changes required for MVP. Mentions are parsed at read-time and resolved with current user data.

## Existing Models (No Changes)

### Comment Model

```prisma
model Comment {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  userId    String
  content   String   @db.VarChar(2000)  // Stores mention markup
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([ticketId, createdAt])
  @@index([userId])
}
```

**No schema changes**. Mention markup stored in existing `content` field.

### User Model

```prisma
model User {
  id            String    @id
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime
  accounts      Account[]
  comments      Comment[]
  projects      Project[]
  sessions      Session[]

  @@index([email])
}
```

**No schema changes**. Used for mention resolution and autocomplete.

### Project Model (Relation Context)

```prisma
model Project {
  id                  Int                 @id @default(autoincrement())
  name                String              @db.VarChar(100)
  description         String              @db.VarChar(1000)
  githubOwner         String              @db.VarChar(100)
  githubRepo          String              @db.VarChar(100)
  userId              String
  createdAt           DateTime            @default(now())
  updatedAt           DateTime
  clarificationPolicy ClarificationPolicy @default(AUTO)
  user                User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  tickets             Ticket[]

  @@unique([githubOwner, githubRepo])
  @@index([githubOwner, githubRepo])
  @@index([userId])
}
```

**No schema changes**. Project membership determines which users appear in autocomplete.

## Mention Markup Format

### Storage Format

Mentions are stored as plain text with the following markup pattern:

```
@[userId:displayName]
```

**Examples**:
```
"Hey @[user-abc123:John Doe], can you review this?"
"Thanks @[user-xyz789:Jane Smith] and @[user-def456:Bob Johnson] for the feedback!"
```

**Format Specification**:
- `@[` - Opening delimiter (2 characters)
- `userId` - User ID from User.id field (variable length, alphanumeric + hyphens)
- `:` - Separator (1 character)
- `displayName` - User's name at time of mention (for readability in raw content)
- `]` - Closing delimiter (1 character)

**Character Limit Impact**:
- Minimum mention: `@[a:X]` = 6 characters
- Typical mention: `@[user-abc123:John Doe]` = 24 characters
- Comment.content VARCHAR(2000) supports ~80+ typical mentions per comment

### Parsing Regex

```typescript
const MENTION_REGEX = /@\[([^:]+):([^\]]+)\]/g;

interface ParsedMention {
  userId: string;      // Captured group 1
  displayName: string; // Captured group 2 (for fallback if user deleted)
  startIndex: number;  // Position in original string
  endIndex: number;    // Position in original string
}

function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  let match: RegExpExecArray | null;

  while ((match = MENTION_REGEX.exec(content)) !== null) {
    mentions.push({
      userId: match[1],
      displayName: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return mentions;
}
```

### Validation Rules

**Server-Side Validation** (when comment is created/updated):
1. Valid markup format (matches MENTION_REGEX)
2. User IDs exist in database
3. Mentioned users are members of the project (authorized to see ticket)
4. Total content length (including markup) ≤ 2000 characters

**Client-Side Validation** (before submission):
1. Prevent typing @ in middle of existing mention
2. Autocomplete only inserts valid markup format
3. Character count includes mention markup length

## Data Flow

### 1. Creating Comment with Mentions

```typescript
// Client → Server
POST /api/projects/:projectId/tickets/:ticketId/comments
{
  content: "Hey @[user-123:John Doe], can you review?"
}

// Server validation
const mentions = parseMentions(content);
const userIds = mentions.map(m => m.userId);

// Validate mentioned users are project members
const validUsers = await prisma.user.findMany({
  where: {
    id: { in: userIds },
    projects: { some: { id: projectId } }
  }
});

if (validUsers.length !== userIds.length) {
  throw new Error('Invalid mention: user not in project');
}

// Save comment with mention markup in content field
await prisma.comment.create({
  data: {
    ticketId,
    userId: session.user.id,
    content,  // Stores: "Hey @[user-123:John Doe], can you review?"
  }
});
```

### 2. Fetching Comments with Mention Resolution

```typescript
// Client → Server
GET /api/projects/:projectId/tickets/:ticketId/comments

// Server query
const comments = await prisma.comment.findMany({
  where: { ticketId },
  include: { user: true },  // Comment author
  orderBy: { createdAt: 'asc' },
});

// Extract all mentioned user IDs across all comments
const allMentionedUserIds = comments.flatMap(comment =>
  parseMentions(comment.content).map(m => m.userId)
);

// Fetch mentioned users (LEFT JOIN behavior for deleted users)
const mentionedUsers = await prisma.user.findMany({
  where: { id: { in: Array.from(new Set(allMentionedUserIds)) } },
});

// Map user IDs to user objects for client rendering
const userMap = new Map(mentionedUsers.map(u => [u.id, u]));

// Return to client
{
  comments,
  mentionedUsers: userMap  // Client uses this to resolve mentions
}
```

### 3. Rendering Mentions on Client

```typescript
// Client component
function CommentDisplay({ comment, mentionedUsers }) {
  const mentions = parseMentions(comment.content);

  // Split content into text segments and mention segments
  const segments = [];
  let lastIndex = 0;

  mentions.forEach(mention => {
    // Text before mention
    segments.push({
      type: 'text',
      content: comment.content.substring(lastIndex, mention.startIndex)
    });

    // Mention segment
    const user = mentionedUsers.get(mention.userId);
    segments.push({
      type: 'mention',
      userId: mention.userId,
      displayName: user?.name || '[Removed User]',
      isDeleted: !user,
    });

    lastIndex = mention.endIndex;
  });

  // Remaining text
  segments.push({
    type: 'text',
    content: comment.content.substring(lastIndex)
  });

  return (
    <div>
      {segments.map((seg, i) =>
        seg.type === 'mention' ? (
          <MentionChip key={i} {...seg} />
        ) : (
          <span key={i}>{seg.content}</span>
        )
      )}
    </div>
  );
}
```

## TypeScript Interfaces

```typescript
// Core types
interface User {
  id: string;
  name: string | null;
  email: string;
}

interface ProjectMember extends User {
  // User who is member of specific project
}

interface Comment {
  id: number;
  ticketId: number;
  userId: string;
  content: string;  // Contains mention markup
  createdAt: Date;
  updatedAt: Date;
  user: User;       // Comment author
}

// Mention-specific types
interface ParsedMention {
  userId: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
}

interface MentionSegment {
  type: 'mention';
  userId: string;
  displayName: string;
  isDeleted: boolean;
}

interface TextSegment {
  type: 'text';
  content: string;
}

type CommentSegment = MentionSegment | TextSegment;

// API types
interface CreateCommentRequest {
  content: string;  // May contain mention markup
}

interface GetCommentsResponse {
  comments: Comment[];
  mentionedUsers: Map<string, User>;  // For mention resolution
}

interface GetProjectMembersResponse {
  members: ProjectMember[];
}
```

## Validation Schemas (Zod)

```typescript
import { z } from 'zod';

// Mention markup validation
const mentionMarkupRegex = /@\[([^:]+):([^\]]+)\]/g;

// Comment creation schema
export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment exceeds maximum length')
    .refine(
      (content) => {
        // Validate mention markup format if @ exists
        if (!content.includes('@[')) return true;

        const mentions = Array.from(content.matchAll(mentionMarkupRegex));
        // All @[ sequences must be valid mentions
        return content.split('@[').length - 1 === mentions.length;
      },
      { message: 'Invalid mention format' }
    ),
});

// Project member response schema
export const projectMemberSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().email(),
});

export const getProjectMembersResponseSchema = z.object({
  members: z.array(projectMemberSchema),
});
```

## Query Optimization

### Preventing N+1 Queries

**Problem**: Fetching users for each mention individually

```typescript
// BAD: N+1 query anti-pattern
for (const comment of comments) {
  const mentions = parseMentions(comment.content);
  for (const mention of mentions) {
    const user = await prisma.user.findUnique({
      where: { id: mention.userId }  // Separate query per mention!
    });
  }
}
```

**Solution**: Batch fetch all mentioned users

```typescript
// GOOD: Single query for all users
const allUserIds = comments.flatMap(c =>
  parseMentions(c.content).map(m => m.userId)
);

const users = await prisma.user.findMany({
  where: { id: { in: Array.from(new Set(allUserIds)) } }
});

const userMap = new Map(users.map(u => [u.id, u]));
```

## Future Enhancements (Out of Scope for MVP)

### Separate Mention Table

For notification system (future phase), create normalized Mention model:

```prisma
model Mention {
  id        Int      @id @default(autoincrement())
  commentId Int
  userId    String
  createdAt DateTime @default(now())

  comment Comment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([commentId, userId])
  @@index([userId, createdAt])  // For "mentions of me" query
}
```

**Migration Path**:
1. Keep mention markup in Comment.content
2. Parse and populate Mention table on read (backfill)
3. Create Mention records on write (going forward)
4. Use Mention table for notification triggers
5. Eventually deprecate mention markup (far future)

## Security Considerations

### XSS Prevention

**Risk**: Malicious user injects HTML/JavaScript in mention displayName

**Mitigation**:
1. Mention markup stored in Comment.content is plain text (no HTML)
2. React JSX automatically escapes text content (prevents XSS)
3. Zod schema validates content length and format before storage
4. Display name from User.name (validated at user creation, trusted source)

**Safe Rendering**:
```tsx
// SAFE: React escapes displayName automatically
<span className="mention">@{user.name}</span>

// UNSAFE: Don't use dangerouslySetInnerHTML
<span dangerouslySetInnerHTML={{ __html: user.name }} />  // DON'T DO THIS
```

### Authorization

**Requirement**: Only show project members in autocomplete

```typescript
// GET /api/projects/:projectId/members
const members = await prisma.user.findMany({
  where: {
    projects: { some: { id: projectId } }  // Only users in this project
  },
  select: {
    id: true,
    name: true,
    email: true,
  }
});
```

**Server-side validation** on comment creation:
```typescript
// Verify mentioned users are project members
const isValid = mentionedUserIds.every(userId =>
  members.some(m => m.id === userId)
);
```
