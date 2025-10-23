# Quickstart: User Mentions in Comments

**Feature**: 043-tag-user-comment
**For**: Developers implementing the mention feature
**Date**: 2025-10-22

## Overview

Implement user mentions in ticket comments using @ symbol autocomplete. Users can type @ to see project members, filter by typing, and select with mouse or keyboard. Mentions are stored as plain text markup and rendered with visual formatting.

## Prerequisites

- Existing Comment system working (create/read comments on tickets)
- shadcn/ui installed and configured
- TanStack Query set up for server state management
- NextAuth.js session authentication working

## Implementation Checklist

### Phase 1: Backend API (1-2 hours)

- [ ] **Create GET /api/projects/:id/members endpoint**
  - File: `app/api/projects/[projectId]/members/route.ts`
  - Query: `prisma.user.findMany()` with project membership filter
  - Response: `{ members: [{ id, name, email }] }`
  - Auth: Validate session user owns project
  - Test: Fetch members for test project, verify authorization

- [ ] **Extend POST /api/projects/:id/tickets/:id/comments**
  - File: `app/api/projects/[projectId]/tickets/[ticketId]/comments/route.ts`
  - Add mention validation logic (parse mentions, verify user IDs)
  - Validate mentioned users are project members
  - Test: Create comment with valid/invalid mentions

- [ ] **Extend GET /api/projects/:id/tickets/:id/comments**
  - File: Same as above
  - Add `mentionedUsers` to response (batch fetch mentioned users)
  - Optimize: Single query for all users (prevent N+1)
  - Test: Fetch comments, verify mentionedUsers includes all users

### Phase 2: Mention Parser Utility (30 minutes)

- [ ] **Create mention parsing utility**
  - File: `app/lib/utils/mention-parser.ts`
  - Function: `parseMentions(content: string): ParsedMention[]`
  - Function: `formatMention(userId: string, displayName: string): string`
  - Regex: `/@\[([^:]+):([^\]]+)\]/g`
  - Test: Unit tests for parsing various mention formats

### Phase 3: TanStack Query Hooks (30 minutes)

- [ ] **Create useProjectMembers hook**
  - File: `app/lib/hooks/queries/useProjectMembers.ts`
  - Query key: `['projects', projectId, 'members']`
  - Fetch function: Call GET /api/projects/:id/members
  - Cache: 5 minutes staleTime
  - Test: Verify caching and refetching behavior

- [ ] **Extend useComments hook**
  - File: `app/lib/hooks/queries/useComments.ts` (if exists) or create new
  - Handle `mentionedUsers` in response
  - Test: Verify comments include mention resolution data

- [ ] **Extend useCreateComment mutation**
  - File: `app/lib/hooks/mutations/useCreateComment.ts`
  - No changes to mutation logic (server validates mentions)
  - Optimistic update: Include mention markup in optimistic comment
  - Test: Create comment, verify optimistic and actual updates

### Phase 4: Autocomplete UI Components (3-4 hours)

- [ ] **Create UserAutocomplete component**
  - File: `app/components/comments/user-autocomplete.tsx`
  - Use shadcn/ui Popover for dropdown
  - Props: `users`, `onSelect`, `isOpen`, `selectedIndex`
  - Keyboard nav: Arrow Up/Down, Enter, Escape
  - Test: Playwright E2E for keyboard navigation

- [ ] **Create MentionInput component**
  - File: `app/components/comments/mention-input.tsx`
  - Textarea with @ detection
  - Client-side filtering (case-insensitive substring match)
  - State: cursor position, autocomplete open/close, filtered users
  - Insert mention at cursor position on select
  - Test: Playwright E2E for typing @ and selecting user

- [ ] **Extend CommentForm component**
  - File: `app/components/comments/comment-form.tsx`
  - Replace textarea with MentionInput
  - Pass project members from useProjectMembers hook
  - Test: Create comment with mentions E2E

### Phase 5: Mention Display Components (2-3 hours)

- [ ] **Create MentionDisplay component**
  - File: `app/components/comments/mention-display.tsx`
  - Parse comment content into segments (text + mentions)
  - Render mentions as chips/badges with hover tooltip
  - Show "[Removed User]" for deleted users
  - Test: Playwright E2E for mention rendering and tooltips

- [ ] **Extend CommentList component**
  - File: `app/components/comments/comment-list.tsx`
  - Pass mentionedUsers map to MentionDisplay
  - Test: Verify mentions render correctly in comment list

### Phase 6: E2E Tests (2-3 hours)

- [ ] **Test autocomplete behavior**
  - File: `tests/e2e/mentions.spec.ts`
  - Test: Typing @ opens dropdown with all project members
  - Test: Typing "joh" filters to matching users
  - Test: Arrow keys navigate dropdown
  - Test: Enter key selects highlighted user
  - Test: Escape key closes dropdown

- [ ] **Test mention insertion**
  - Test: Click user in dropdown inserts mention
  - Test: Multiple mentions in one comment
  - Test: Mention inserted at correct cursor position

- [ ] **Test mention display**
  - Test: Saved comment shows formatted mentions
  - Test: Hover over mention shows user details
  - Test: Deleted user shows "[Removed User]"
  - Test: Page reload preserves mention formatting

- [ ] **Test validation errors**
  - Test: Server rejects mention with invalid user ID
  - Test: Server rejects mention of non-project member
  - Test: Character limit includes mention markup length

## File Structure Summary

```
app/
├── api/
│   └── projects/
│       └── [projectId]/
│           ├── members/
│           │   └── route.ts                    # NEW
│           └── tickets/
│               └── [ticketId]/
│                   └── comments/
│                       └── route.ts            # EXTEND
│
├── lib/
│   ├── hooks/
│   │   ├── queries/
│   │   │   ├── useProjectMembers.ts            # NEW
│   │   │   └── useComments.ts                  # EXTEND
│   │   └── mutations/
│   │       └── useCreateComment.ts             # EXTEND
│   └── utils/
│       └── mention-parser.ts                   # NEW
│
└── components/
    └── comments/
        ├── comment-form.tsx                    # EXTEND
        ├── comment-list.tsx                    # EXTEND
        ├── mention-input.tsx                   # NEW
        ├── mention-display.tsx                 # NEW
        └── user-autocomplete.tsx               # NEW

tests/
└── e2e/
    └── mentions.spec.ts                        # NEW
```

## Key Implementation Details

### Mention Markup Format

```typescript
// Storage format in database
"Hey @[user-abc123:John Doe], can you review?"

// Parsing regex
const MENTION_REGEX = /@\[([^:]+):([^\]]+)\]/g;

// Format function
function formatMention(userId: string, displayName: string): string {
  return `@[${userId}:${displayName}]`;
}
```

### Autocomplete Trigger Logic

```typescript
function handleInputChange(e: ChangeEvent<HTMLTextAreaElement>) {
  const { value, selectionStart } = e.target;

  // Find @ symbol before cursor
  const textBeforeCursor = value.substring(0, selectionStart);
  const lastAtIndex = textBeforeCursor.lastIndexOf('@');

  if (lastAtIndex === -1) {
    setIsAutocompleteOpen(false);
    return;
  }

  // Check if @ is at word boundary (start of word)
  const charBeforeAt = textBeforeCursor[lastAtIndex - 1];
  const isAtWordBoundary = !charBeforeAt || /\s/.test(charBeforeAt);

  if (!isAtWordBoundary) {
    setIsAutocompleteOpen(false);
    return;
  }

  // Extract search query after @
  const searchQuery = textBeforeCursor.substring(lastAtIndex + 1);

  // Check if query is inside existing mention markup
  const isInsideMention = textBeforeCursor.includes('@[') &&
                          textBeforeCursor.lastIndexOf('@[') > lastAtIndex;

  if (isInsideMention) {
    setIsAutocompleteOpen(false);
    return;
  }

  // Open autocomplete and filter users
  setIsAutocompleteOpen(true);
  setSearchQuery(searchQuery);
}
```

### Keyboard Navigation

```typescript
function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
  if (!isAutocompleteOpen) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredUsers.length - 1));
      break;

    case 'ArrowUp':
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
      break;

    case 'Enter':
      e.preventDefault();
      if (filteredUsers[selectedIndex]) {
        handleSelectUser(filteredUsers[selectedIndex]);
      }
      break;

    case 'Escape':
      e.preventDefault();
      setIsAutocompleteOpen(false);
      break;
  }
}
```

### User Selection and Insertion

```typescript
function handleSelectUser(user: ProjectMember) {
  const { value, selectionStart } = textareaRef.current!;

  // Find @ position before cursor
  const textBeforeCursor = value.substring(0, selectionStart);
  const atIndex = textBeforeCursor.lastIndexOf('@');

  // Build mention markup
  const mention = formatMention(user.id, user.name || user.email);

  // Replace from @ to cursor with mention
  const newValue =
    value.substring(0, atIndex) +
    mention +
    ' ' +  // Add space after mention
    value.substring(selectionStart);

  // Update textarea
  setValue(newValue);

  // Position cursor after mention + space
  const newCursorPos = atIndex + mention.length + 1;
  setTimeout(() => {
    textareaRef.current!.setSelectionRange(newCursorPos, newCursorPos);
    textareaRef.current!.focus();
  }, 0);

  // Close autocomplete
  setIsAutocompleteOpen(false);
}
```

### Mention Display Parsing

```typescript
function renderCommentWithMentions(
  content: string,
  mentionedUsers: Record<string, User>
): React.ReactNode {
  const mentions = parseMentions(content);
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;

  mentions.forEach((mention, idx) => {
    // Text before mention
    if (mention.startIndex > lastIndex) {
      segments.push(
        <span key={`text-${idx}`}>
          {content.substring(lastIndex, mention.startIndex)}
        </span>
      );
    }

    // Mention segment
    const user = mentionedUsers[mention.userId];
    segments.push(
      <MentionChip
        key={`mention-${idx}`}
        userId={mention.userId}
        displayName={user?.name || '[Removed User]'}
        email={user?.email}
        isDeleted={!user}
      />
    );

    lastIndex = mention.endIndex;
  });

  // Remaining text
  if (lastIndex < content.length) {
    segments.push(
      <span key="text-end">
        {content.substring(lastIndex)}
      </span>
    );
  }

  return <>{segments}</>;
}
```

## Testing Strategy

### Unit Tests

- Mention parser: Valid/invalid formats, edge cases
- Mention formatter: User ID escaping, special characters
- Filter logic: Case-insensitive matching, empty queries

### Integration Tests (API)

- GET /api/projects/:id/members: Authorization, project membership
- POST comments: Mention validation, error cases
- GET comments: Mention resolution, deleted users

### E2E Tests (Playwright)

Priority order (implement in this sequence):

1. **Autocomplete trigger**: Typing @ opens dropdown ✅
2. **User filtering**: Typing "joh" shows matching users ✅
3. **Mouse selection**: Click user inserts mention ✅
4. **Keyboard navigation**: Arrow keys + Enter works ✅
5. **Mention display**: Saved comments show formatted mentions ✅
6. **Multiple mentions**: Two mentions in one comment ✅
7. **Deleted users**: "[Removed User]" displayed ✅

## Performance Targets

- Autocomplete filtering: <100ms for 100 users
- Mention insertion: <3 seconds from typing @ to selection
- Dropdown render: <50ms (smooth UX)
- Comment with mentions render: <100ms

## Common Pitfalls

❌ **Don't**: Query user for each mention individually (N+1 queries)
✅ **Do**: Batch fetch all mentioned users in one query

❌ **Don't**: Use dangerouslySetInnerHTML for mention rendering
✅ **Do**: Let React escape user names automatically

❌ **Don't**: Allow mentions of users outside project
✅ **Do**: Validate server-side that mentioned users are project members

❌ **Don't**: Open autocomplete when typing @ inside existing mention
✅ **Do**: Check if cursor is inside `@[...]` markup before opening

❌ **Don't**: Create new test files without searching for existing ones
✅ **Do**: Use Test Discovery Workflow to find and extend existing tests

## Rollout Plan

1. **Phase 1**: Backend API (GET members, validate mentions)
2. **Phase 2**: Mention parser utility and tests
3. **Phase 3**: TanStack Query hooks
4. **Phase 4**: Autocomplete UI (input component)
5. **Phase 5**: Display UI (render mentions in comments)
6. **Phase 6**: E2E tests for all flows

## Success Criteria

- [ ] User can type @ and see autocomplete with project members
- [ ] Filtering works (case-insensitive, <100ms)
- [ ] Mouse and keyboard selection both work
- [ ] Multiple mentions in one comment supported
- [ ] Mentions render with visual formatting (bold/badge)
- [ ] Deleted users show "[Removed User]"
- [ ] Page reload preserves mentions
- [ ] All E2E tests pass
- [ ] No console errors or warnings
- [ ] Constitution compliance (TypeScript strict, shadcn/ui, TDD)

## Next Steps

After MVP:
- Notification system (notify mentioned users)
- Separate Mention table (for analytics)
- Mention search ("find comments mentioning me")
- Rich text editor integration (if needed for other features)
