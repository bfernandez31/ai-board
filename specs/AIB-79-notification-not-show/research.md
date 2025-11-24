# Phase 0: Research & Analysis

**Feature**: AI-Board Comment Mention Notifications
**Research Date**: 2025-11-24

## Technical Unknowns Resolved

### 1. Notification Creation Pattern

**Research Question**: How should AI-board comments create notifications for mentioned users?

**Decision**: Reuse exact pattern from regular comments endpoint (lines 252-290 in `/app/api/projects/[projectId]/tickets/[id]/comments/route.ts`)

**Rationale**:
- Proven non-blocking error handling (try-catch wrapper, log errors but don't block comment creation)
- Established validation logic (project membership checks, self-mention exclusion)
- Consistent notification data model (recipientId, actorId, commentId, ticketId)
- Uses `createMany` for batch notification creation (efficient for multiple mentions)

**Implementation Location**: Add notification creation logic after line 112 in `/app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts` (immediately after comment creation)

**Code Pattern to Follow**:
```typescript
// Create notifications for mentions (non-blocking)
try {
  if (mentionedUserIds.length > 0) {
    // Get project owner and members
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { select: { userId: true } } },
    });

    if (project) {
      const projectMemberIds = [
        project.userId, // Owner
        ...project.members.map(m => m.userId), // Members
      ];

      // Filter valid recipients (project members, exclude self)
      const validRecipients = mentionedUserIds.filter(
        id => id !== aiBoardUserId && projectMemberIds.includes(id)
      );

      // Create notifications
      if (validRecipients.length > 0) {
        await prisma.notification.createMany({
          data: validRecipients.map(recipientId => ({
            recipientId,
            actorId: aiBoardUserId,
            commentId: comment.id,
            ticketId,
          })),
        });
      }
    }
  }
} catch (notificationError) {
  // Log but don't block comment creation
  console.error('[ai-board-comment] Failed to create notifications:', notificationError);
}
```

**Alternatives Considered**:
- **Create dedicated notification service**: Rejected - premature abstraction, adds complexity
- **Use transaction for comment + notifications**: Rejected - violates non-blocking requirement (notifications should not block comment creation)
- **Real-time websocket notifications**: Rejected - out of scope, existing 15-second polling is sufficient

---

### 2. Mention Extraction Strategy

**Research Question**: How to extract user mentions from AI-board comment content?

**Decision**: Use existing `extractMentionUserIds()` utility from `/app/lib/utils/mention-parser.ts`

**Rationale**:
- Already used by regular comments endpoint (proven reliability)
- Handles mention format `@[userId:displayName]` correctly
- Built-in deduplication (returns unique user IDs only)
- TypeScript strict mode compliant with explicit return types

**Implementation**:
```typescript
import { extractMentionUserIds } from '@/app/lib/utils/mention-parser';

const mentionedUserIds = extractMentionUserIds(content);
```

**Mention Format**: `@[userId:displayName]`
- Example: `@[user-123:John Doe]`
- Regex: `/@\[([^:]+):([^\]]+)\]/g`
- Duplicates automatically handled by `Array.from(new Set(...))`

**Alternatives Considered**:
- **Write custom mention parser**: Rejected - unnecessary duplication, existing utility is well-tested
- **Use regex directly in endpoint**: Rejected - violates DRY principle, harder to maintain

---

### 3. AI-Board User ID Retrieval

**Research Question**: How to identify AI-board as the notification actor?

**Decision**: Use existing `getAIBoardUserId()` utility from `/app/lib/db/ai-board-user.ts`

**Rationale**:
- Already called in AI-board endpoint for comment authorship validation (line 84)
- In-memory caching prevents redundant database queries
- Throws clear error if AI-board user not seeded (explicit failure mode)
- TypeScript strict mode compliant

**Implementation**: Variable `aiBoardUserId` already available at line 84 in AI-board comments endpoint - reuse for notification `actorId`

**AI-Board User Details**:
- Email: `ai-board@system.local`
- Created by: `prisma/seed.ts` script
- Cached after first lookup (performance optimization)

**Alternatives Considered**:
- **Hardcode AI-board user ID**: Rejected - brittle, breaks if seed data changes
- **Query user on every notification**: Rejected - inefficient, caching already handles this

---

### 4. Project Membership Validation

**Research Question**: How to validate that mentioned users are project members before creating notifications?

**Decision**: Replicate validation logic from regular comments endpoint (lines 256-272)

**Validation Steps**:
1. Query project with `members` relation included
2. Collect valid member IDs: `[project.userId, ...project.members.map(m => m.userId)]`
3. Filter mentioned users: keep only those in member list AND not equal to actor ID

**Rationale**:
- Prevents orphaned notifications (no notifications to non-members)
- Self-mention exclusion (AI-board doesn't notify itself)
- Consistent with existing authorization model (owner + members pattern)

**Edge Cases Handled**:
- User removed from project during notification creation → filtered out (graceful)
- Mentioned user doesn't exist → filtered out by membership check
- AI-board mentions itself → excluded by `id !== aiBoardUserId` check

**Alternatives Considered**:
- **Skip validation, create all notifications**: Rejected - violates data integrity, creates orphaned records
- **Separate membership query function**: Rejected - premature abstraction for single-use case

---

### 5. Error Handling Strategy

**Research Question**: Should notification failures block AI-board comment creation?

**Decision**: Non-blocking notification creation with error logging (try-catch wrapper)

**Rationale**:
- AI-board comments are critical workflow responses - must always be posted
- Notification failures are typically transient (database timeouts, connection issues)
- User can still see comment content, just misses real-time notification
- Consistent with regular comments endpoint behavior (same error handling pattern)

**Error Handling Pattern**:
```typescript
try {
  // ... notification creation logic
} catch (notificationError) {
  console.error('[ai-board-comment] Failed to create notifications:', notificationError);
  // Do not throw - continue execution
}
```

**Monitoring Approach**: Error logs provide visibility into notification system health without blocking comment creation

**Alternatives Considered**:
- **Throw error and block comment creation**: Rejected - violates non-blocking requirement, degrades AI-board reliability
- **Queue notifications for retry**: Rejected - out of scope, adds infrastructure complexity (message queue not implemented)
- **Silent failure (no logging)**: Rejected - no visibility into system health

---

## Best Practices for Next.js API Routes

### Async Parameter Handling (Next.js 15)
- **Pattern**: `const params = await context.params` (already implemented in AI-board endpoint)
- **Rationale**: Next.js 15 requires async access to route parameters
- **Reference**: Line 42 in existing AI-board endpoint

### Zod Schema Validation
- **Pattern**: Use `safeParse()` for graceful error handling
- **Rationale**: Prevents unhandled exceptions, provides structured error messages
- **Reference**: Lines 46-49, 69-79 in existing AI-board endpoint

### Error Response Structure
- **Pattern**: `{ error: string, details?: object }` format
- **Status Codes**: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 500 (server error)
- **Reference**: Lines 37-39, 52-55, 86-89 in existing AI-board endpoint

---

## Dependencies Confirmed

### Existing Utilities (No Modifications Required)
- ✅ `extractMentionUserIds()` - `/app/lib/utils/mention-parser.ts` (lines 78-82)
- ✅ `getAIBoardUserId()` - `/app/lib/db/ai-board-user.ts` (lines 19-40)
- ✅ Prisma `notification.createMany()` - Existing schema supports all required fields

### Imports Required
```typescript
import { extractMentionUserIds } from '@/app/lib/utils/mention-parser';
// Note: getAIBoardUserId already imported at line 9
```

### Database Schema (No Migrations Required)
```prisma
model Notification {
  id          Int       @id @default(autoincrement())
  recipientId String    // User receiving notification
  actorId     String    // User who created the mention (AI-board)
  commentId   Int       // Comment containing the mention
  ticketId    Int       // Ticket where comment was posted
  read        Boolean   @default(false)
  readAt      DateTime?
  deletedAt   DateTime? // Soft delete (30-day retention)
  createdAt   DateTime  @default(now())
}
```

---

## Integration Points

### 1. Regular Comments Endpoint
**File**: `/app/api/projects/[projectId]/tickets/[id]/comments/route.ts`
**Reference Lines**: 252-290 (notification creation pattern)
**Relationship**: AI-board endpoint will mirror this implementation exactly

### 2. Notification Polling System
**Current Behavior**: 15-second polling interval (no changes required)
**Impact**: New AI-board notifications automatically picked up by existing polling
**Files**: Notification components in `/app/components/notifications/` (no changes)

### 3. AI-Board Workflow
**Workflow File**: `.github/workflows/ai-board-assist.yml`
**Trigger**: `@ai-board` mention in comments
**Response Flow**: Workflow → AI-board endpoint → Comment + Notifications created

---

## Performance Considerations

### Notification Creation Performance
- **Operation**: `prisma.notification.createMany()` with array of recipients
- **Expected Duration**: < 100ms for typical batch size (1-5 recipients)
- **Database Impact**: Single bulk insert (not N+1 queries)
- **Optimization**: Already batch-optimized by using `createMany` instead of multiple `create` calls

### Mention Extraction Performance
- **Operation**: Regex matching on comment content string
- **Expected Duration**: < 1ms for typical comment length (< 2000 characters)
- **Complexity**: O(n) where n = comment length
- **Optimization**: Regex compiled once, deduplication via Set (O(n) complexity)

### Project Membership Query Performance
- **Operation**: Single query with `include: { members: true }`
- **Expected Duration**: < 50ms (indexed foreign keys)
- **Database Impact**: Join on ProjectMember table (indexed by projectId)
- **Optimization**: Single query instead of N+1 (fetches all members at once)

**Total Overhead**: ~150ms worst case (well within 500ms success criteria)

---

## Testing Strategy

### Test Discovery (Constitution Requirement)
**Before writing tests**, search for existing notification tests:
```bash
# Search by feature
npx grep -r "describe.*notification" tests/

# Search by file path
npx glob "tests/**/*notification*.(test|spec).ts"

# Search by API route
npx grep -r "/api/.*comments/ai-board" tests/
```

**Expected Result**: Extend `tests/e2e/notifications.spec.ts` (found in constitution review)

### Test Coverage Requirements (from Spec)
1. **AI-board mentions create notifications** (User Story 1, Scenario 1)
2. **Multiple mentions create multiple notifications** (User Story 1, Scenario 2)
3. **No mentions = no notifications** (User Story 1, Scenario 3)
4. **Notification failures don't block comments** (User Story 1, Scenario 4)
5. **Non-member mentions filtered out** (User Story 2, Scenarios 1-2)
6. **Self-mention exclusion** (User Story 3, Scenarios 1-2)

### Test Tool Selection (Constitution Requirement)
- **Playwright E2E**: API integration tests (AI-board endpoint behavior)
- **Vitest Unit**: Not applicable (no pure utility functions added, only endpoint modification)

---

## Risk Analysis

### High Risk (Mitigated)
- **Risk**: Notification failures block AI-board responses
- **Mitigation**: Non-blocking try-catch wrapper (proven pattern from regular comments)
- **Validation**: Test scenario 4 verifies comment creation succeeds on notification failure

### Medium Risk (Mitigated)
- **Risk**: Orphaned notifications to non-members
- **Mitigation**: Project membership validation before `createMany`
- **Validation**: Test scenarios 5-6 verify filtering logic

### Low Risk (Accepted)
- **Risk**: Notification delay up to 15 seconds (polling interval)
- **Acceptance**: Existing system behavior, real-time not required per spec
- **Out of Scope**: Websocket notifications (future enhancement)

---

## Summary

All technical unknowns resolved. Implementation will:
1. Add `extractMentionUserIds()` import to AI-board endpoint
2. Extract mentions after comment creation (line 112)
3. Replicate notification creation pattern from regular comments endpoint (lines 252-290)
4. Use existing `aiBoardUserId` variable for notification actor
5. Maintain non-blocking error handling (try-catch wrapper with logging)

**No new dependencies, migrations, or infrastructure changes required.**
**All patterns proven by existing codebase implementation.**
