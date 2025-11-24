# Quickstart: AI-Board Comment Mention Notifications

**Feature**: AIB-79 - Fix missing notifications when AI-board mentions users in comments
**Implementation Time**: ~30 minutes (single endpoint modification)

---

## Overview

This feature adds notification creation to the AI-board comments endpoint. When AI-board posts a comment mentioning project members, those users will receive notifications identical to mentions in regular comments.

**What You'll Do**:
1. Import mention parser utility
2. Extract mentions from AI-board comment content
3. Validate project membership (owner + members)
4. Create notifications using `Notification.createMany()`
5. Handle errors gracefully (non-blocking)

---

## Prerequisites

- ✅ AI-board user seeded in database (`ai-board@system.local`)
- ✅ Existing utilities functional:
  - `extractMentionUserIds()` in `app/lib/utils/mention-parser.ts`
  - `getAIBoardUserId()` in `app/lib/db/ai-board-user.ts`
- ✅ Notification schema exists with required fields
- ✅ Regular comments endpoint working as reference implementation

---

## Step 1: Read Reference Implementation (5 minutes)

Before modifying the AI-board endpoint, review the existing notification creation pattern:

**File**: `app/api/projects/[projectId]/tickets/[id]/comments/route.ts`
**Lines**: 252-290

**Key Pattern to Copy**:
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
        id => id !== userId && projectMemberIds.includes(id)
      );

      // Create notifications
      if (validRecipients.length > 0) {
        await prisma.notification.createMany({
          data: validRecipients.map(recipientId => ({
            recipientId,
            actorId: userId,
            commentId: comment.id,
            ticketId,
          })),
        });
      }
    }
  }
} catch (notificationError) {
  // Log but don't block comment creation
  console.error('[comments] Failed to create notifications:', notificationError);
}
```

**Why This Pattern?**
- ✅ Non-blocking: Errors logged but don't throw
- ✅ Validates project membership before creating notifications
- ✅ Excludes self-notifications (actor doesn't notify themselves)
- ✅ Efficient batch insert using `createMany()`

---

## Step 2: Modify AI-Board Comments Endpoint (15 minutes)

**File**: `app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts`

### 2.1: Add Import

Add this import at the top (after existing imports):

```typescript
import { extractMentionUserIds } from '@/app/lib/utils/mention-parser';
```

### 2.2: Add Notification Creation Logic

Insert after line 112 (after comment creation, before return statement):

```typescript
// Create comment with AI-BOARD authorship
const comment = await prisma.comment.create({
  data: {
    ticketId,
    userId: aiBoardUserId,
    content,
    updatedAt: new Date(),
  },
});

// ↓↓↓ INSERT NOTIFICATION LOGIC HERE ↓↓↓

// Extract mentions from comment content
const mentionedUserIds = extractMentionUserIds(content);

// Create notifications for mentions (non-blocking)
try {
  if (mentionedUserIds.length > 0) {
    // Get project owner and members
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { select: { userId: true } },
      },
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

// ↑↑↑ END NOTIFICATION LOGIC ↑↑↑

return NextResponse.json(comment, { status: 201 });
```

**Key Variables Already Available**:
- `aiBoardUserId`: AI-board user ID (from line 84, used as notification actor)
- `content`: Comment content (from line 81, contains mentions to parse)
- `comment.id`: Newly created comment ID (for `commentId` field)
- `ticketId`: Ticket ID (from line 102, for `ticketId` field)
- `projectId`: Project ID (from line 58, for membership query)

---

## Step 3: Test the Implementation (10 minutes)

### 3.1: Extend Existing Test File

**File**: `tests/e2e/notifications.spec.ts`

**Search First** (constitution requirement):
```bash
npx grep -r "AI-board" tests/e2e/notifications.spec.ts
```

**Add Test Cases**:
```typescript
test.describe('AI-Board Comment Notifications', () => {
  test('should create notification when AI-board mentions a user', async ({ page }) => {
    // Setup: Create test user, project, ticket
    // Action: POST to /api/projects/:projectId/tickets/:id/comments/ai-board
    //         with content containing @[userId:displayName]
    // Assert: Notification created with correct recipientId, actorId (AI-board)
  });

  test('should create multiple notifications for multiple mentions', async ({ page }) => {
    // Action: Comment mentions 2 users
    // Assert: 2 notifications created
  });

  test('should not create notification for AI-board self-mention', async ({ page }) => {
    // Action: Comment mentions AI-board user ID
    // Assert: 0 notifications created
  });

  test('should not create notification for non-member mentions', async ({ page }) => {
    // Setup: Mention user who is not project member
    // Assert: 0 notifications created for non-member
  });

  test('should not block comment creation if notification fails', async ({ page }) => {
    // Setup: Simulate notification failure (e.g., invalid ticketId)
    // Assert: Comment created successfully, error logged
  });
});
```

### 3.2: Manual Testing Checklist

- [ ] AI-board posts comment with user mention → notification created
- [ ] AI-board posts comment with multiple mentions → all notifications created
- [ ] AI-board posts comment with no mentions → no error, no notifications
- [ ] AI-board mentions non-member → no notification for that user
- [ ] AI-board mentions itself → no notification created
- [ ] Notification appears in recipient's notification dropdown within 15 seconds

---

## Step 4: Verify Constitution Compliance (5 minutes)

### Principle I: TypeScript-First Development
- [ ] No `any` types used
- [ ] All variables explicitly typed (inferred from utilities)
- [ ] TypeScript strict mode compiles without errors

**Command**: `bun run type-check`

### Principle III: Test-Driven Development
- [ ] Extended existing test file (`tests/e2e/notifications.spec.ts`)
- [ ] Did NOT create duplicate test file
- [ ] All acceptance scenarios from spec covered

**Command**: `bun run test:e2e`

### Principle IV: Security-First Design
- [ ] Validates project membership before creating notifications
- [ ] Uses parameterized Prisma queries (no raw SQL)
- [ ] Workflow token authentication already enforced (no changes needed)

### Principle V: Database Integrity
- [ ] Uses existing `Notification` schema (no migrations)
- [ ] Follows soft delete pattern (no changes needed)
- [ ] Foreign key constraints enforced by schema

---

## Step 5: Commit Changes (5 minutes)

**Files Modified**:
1. `app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts` (+45 lines)
2. `tests/e2e/notifications.spec.ts` (+50 lines for test cases)

**Commit Message**:
```
feat(AIB-79): add notification creation for AI-board comment mentions

- Import extractMentionUserIds utility
- Extract mentions after AI-board comment creation
- Validate project membership (owner + members)
- Create notifications using Notification.createMany()
- Non-blocking error handling (log errors, don't throw)
- Exclude AI-board from self-notifications

Follows existing pattern from regular comments endpoint (lines 252-290)

Tests:
- Extend tests/e2e/notifications.spec.ts with AI-board scenarios
- Verify notification creation for valid mentions
- Verify self-mention exclusion
- Verify non-member filtering
- Verify non-blocking error handling
```

---

## Common Issues & Troubleshooting

### Issue 1: "AI-BOARD user not found" Error
**Cause**: AI-board user not seeded in database

**Fix**:
```bash
bun run db:seed
```

### Issue 2: Notifications Not Appearing
**Possible Causes**:
1. Mentioned user not a project member → Check project membership
2. Self-mention (AI-board mentioning itself) → Excluded by design
3. Notification polling not running → Check frontend polling (15s interval)

**Debug**:
```typescript
// Add temporary logging in notification creation block
console.log('[ai-board-comment] Mentioned user IDs:', mentionedUserIds);
console.log('[ai-board-comment] Project member IDs:', projectMemberIds);
console.log('[ai-board-comment] Valid recipients:', validRecipients);
```

### Issue 3: TypeScript Errors
**Error**: "Property 'members' does not exist on type 'Project'"

**Fix**: Ensure Prisma client regenerated after schema changes
```bash
bunx prisma generate
```

### Issue 4: Test Failures
**Error**: Tests fail due to missing AI-board user in test database

**Fix**: Ensure test setup creates AI-board user before running tests
```typescript
// In test setup
const aiBoardUser = await prisma.user.upsert({
  where: { email: 'ai-board@system.local' },
  update: {},
  create: {
    id: 'ai-board-system-user',
    email: 'ai-board@system.local',
    name: 'AI Board Assistant',
  },
});
```

---

## Verification Checklist

Before marking as complete:

- [ ] **Implementation**
  - [ ] Import added: `extractMentionUserIds`
  - [ ] Mention extraction after comment creation
  - [ ] Project membership validation logic present
  - [ ] Notification creation using `createMany()`
  - [ ] Try-catch wrapper with logging
  - [ ] Self-mention exclusion (`id !== aiBoardUserId`)

- [ ] **Testing**
  - [ ] Test file extended (not duplicated)
  - [ ] All user stories covered (1-3 from spec)
  - [ ] All acceptance scenarios tested
  - [ ] Playwright tests pass: `bun run test:e2e`

- [ ] **Code Quality**
  - [ ] TypeScript compiles: `bun run type-check`
  - [ ] No linting errors: `bun run lint`
  - [ ] Code follows existing patterns (matches regular comments endpoint)

- [ ] **Constitution Compliance**
  - [ ] No `any` types
  - [ ] Existing test file extended
  - [ ] Security validation present
  - [ ] No database migrations required

- [ ] **Manual Testing**
  - [ ] AI-board comment with mention creates notification
  - [ ] Notification appears in UI within 15 seconds
  - [ ] Non-member mentions do not create notifications
  - [ ] Self-mentions do not create notifications
  - [ ] Comment creation succeeds even if notification fails

---

## Next Steps

After implementation:

1. **Run full test suite**:
   ```bash
   bun run test
   ```

2. **Create pull request**:
   - Reference ticket: AIB-79
   - Include before/after screenshots (notification bell with/without AI-board mentions)
   - Link to spec: `specs/AIB-79-notification-not-show/spec.md`

3. **Deploy preview**:
   - Vercel auto-deploys on PR creation
   - Test in preview environment with real AI-board workflow

4. **Monitor in production**:
   - Check logs for `[ai-board-comment] Failed to create notifications` errors
   - Verify notification delivery for real AI-board responses

---

## Reference Documentation

- **Spec**: `specs/AIB-79-notification-not-show/spec.md`
- **Research**: `specs/AIB-79-notification-not-show/research.md`
- **Data Model**: `specs/AIB-79-notification-not-show/data-model.md`
- **API Contract**: `specs/AIB-79-notification-not-show/contracts/ai-board-comments-api.yaml`

**Key Files**:
- Implementation: `app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts`
- Tests: `tests/e2e/notifications.spec.ts`
- Utilities: `app/lib/utils/mention-parser.ts`, `app/lib/db/ai-board-user.ts`
