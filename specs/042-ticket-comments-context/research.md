# Research: Ticket Comments with Tabs Layout

**Feature**: 042-ticket-comments-context
**Date**: 2025-01-22
**Status**: Complete

## Overview

This document consolidates research findings for implementing the ticket comments system with tabs layout reorganization. All technical decisions are based on existing project patterns, constitution requirements, and AUTO→CONSERVATIVE policy guidelines.

## Technology Decisions

### 1. Tabs Component Library

**Decision**: Use shadcn/ui Tabs component

**Rationale**:
- Constitution mandates shadcn/ui exclusively for UI primitives (Principle II)
- Already installed and configured in project
- Provides accessible, keyboard-navigable tabs out of the box
- Supports both horizontal and responsive layouts
- Consistent with existing modal components (Dialog, Badge, Button)

**Alternatives Considered**:
- Custom tabs implementation: Rejected - violates constitution (don't create UI primitives from scratch)
- Radix UI Tabs directly: Rejected - shadcn/ui already wraps Radix UI with project styling
- React Tabs library: Rejected - no additional dependencies beyond shadcn/ui allowed

**Implementation Notes**:
- Import from `@/components/ui/tabs`
- Use `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` components
- Apply Catppuccin dark theme colors for consistency
- Keyboard navigation (arrow keys) built-in via Radix UI
- Custom Cmd+[1-4] shortcuts will be added via `useEffect` and keyboard event listeners

### 2. Markdown Rendering

**Decision**: Use react-markdown 9.0.1 (already installed)

**Rationale**:
- Already in package.json (existing dependency)
- HTML escaping enabled by default (FR-038 XSS prevention)
- Supports all required markdown features: bold, italic, links, code blocks, lists, headings
- Lightweight and widely used (1M+ weekly downloads)
- Compatible with React 18 and Next.js 15

**Alternatives Considered**:
- marked + DOMPurify: Rejected - requires two libraries, more complex sanitization setup
- remark + rehype: Rejected - more complex plugin architecture for same result
- Custom markdown parser: Rejected - security risk, violates "don't reinvent the wheel"

**Implementation Notes**:
- Import from `react-markdown`
- Use `disallowedElements={['script', 'iframe']}` for additional XSS protection
- Style code blocks with `react-syntax-highlighter` (already installed)
- Wrap in `prose` class for Tailwind Typography if needed

### 3. Relative Timestamps

**Decision**: Use date-fns formatDistanceToNow()

**Rationale**:
- Already in package.json (existing dependency)
- Used elsewhere in project (formatTicketDate in ticket-detail-modal.tsx)
- Provides "2 hours ago" format matching FR-005 requirement
- Tree-shakeable (only import needed functions)
- TypeScript support built-in

**Alternatives Considered**:
- moment.js: Rejected - deprecated, large bundle size
- dayjs: Rejected - another dependency when date-fns already exists
- Custom relative time formatter: Rejected - complex edge cases (pluralization, i18n)

**Implementation Notes**:
- Import `formatDistanceToNow` from `date-fns`
- Use `addSuffix: true` option for "ago" suffix
- Handle edge case: comments < 1 minute show "just now"

### 4. State Management Pattern

**Decision**: TanStack Query v5 with optimistic updates

**Rationale**:
- Constitution mandates TanStack Query for server state (Principle II)
- Existing pattern in project (useTickets, useJobPolling)
- Built-in support for polling, caching, optimistic updates, and rollback
- Aligns with existing job polling implementation (10-second interval)

**Alternatives Considered**:
- useState + useEffect: Rejected - doesn't meet constitution requirement for server state
- SWR: Rejected - TanStack Query is the only allowed server state library
- Redux/MobX: Rejected - forbidden by constitution for client state

**Implementation Notes**:
- Create `useComments` query hook with `refetchInterval: 10000` (10 seconds)
- Create `useCreateComment` mutation with `onMutate` optimistic update
- Create `useDeleteComment` mutation with `onMutate` optimistic delete
- Use query key factory pattern: `queryKeys.comments.list(ticketId)`
- Follow existing pattern from `lib/hooks/queries/useTickets.ts`

### 5. Polling Strategy

**Decision**: Client-side polling with TanStack Query refetchInterval

**Rationale**:
- Consistent with existing job polling pattern (useJobPolling.ts)
- Spec explicitly requires polling (not WebSocket) per FR-027
- Vercel serverless functions don't support long-lived WebSocket connections
- 10-second interval balances real-time feel with server load
- TanStack Query handles polling lifecycle automatically (start/stop on mount/unmount)

**Alternatives Considered**:
- WebSocket: Rejected - spec requirement is polling, plus Vercel limitations
- Server-Sent Events (SSE): Rejected - spec removed SSE in favor of polling (see CLAUDE.md)
- Manual setInterval: Rejected - TanStack Query provides better error handling and lifecycle management

**Implementation Notes**:
- Use `refetchInterval: 10000` in useComments query
- Use `enabled` option to conditionally enable polling (only when Comments tab is active)
- Filter out optimistically added comments during polling (by ID)
- Stop polling on modal unmount (TanStack Query handles automatically)

## Best Practices

### Authorization Pattern

**Pattern**: Project ownership validation + comment authorship validation

**Implementation**:
```typescript
// GET /api/projects/[projectId]/tickets/[ticketId]/comments
1. Extract session user ID from NextAuth
2. Validate project ownership: project.userId === session.user.id (403 if false)
3. Query comments with ticketId filter
4. Include user data in response (name, avatar)

// POST /api/projects/[projectId]/tickets/[ticketId]/comments
1. Validate project ownership (403 if not owner)
2. Validate comment content with Zod (400 if invalid)
3. Create comment with userId from session
4. Return created comment with user data

// DELETE /api/projects/[projectId]/tickets/[ticketId]/comments/[commentId]
1. Validate project ownership (403 if not owner)
2. Fetch comment and validate authorship: comment.userId === session.user.id (403 if false)
3. Delete comment (Prisma cascade handles cleanup)
4. Return 204 No Content
```

**Rationale**:
- Two-level authorization: project ownership + comment authorship
- Follows existing pattern in ticket API (`/api/projects/[projectId]/tickets`)
- Prevents unauthorized access even with direct API manipulation

### Optimistic Updates Pattern

**Pattern**: Immediate UI update + rollback on error

**Implementation**:
```typescript
// Create comment (useCreateComment mutation)
onMutate: async (newComment) => {
  // Cancel ongoing queries
  await queryClient.cancelQueries({ queryKey: ['comments', ticketId] })

  // Snapshot previous state
  const previousComments = queryClient.getQueryData(['comments', ticketId])

  // Optimistically update
  queryClient.setQueryData(['comments', ticketId], (old) => [newComment, ...old])

  // Return context for rollback
  return { previousComments }
},
onError: (err, newComment, context) => {
  // Rollback on error
  queryClient.setQueryData(['comments', ticketId], context.previousComments)
},
onSettled: () => {
  // Refetch to sync with server
  queryClient.invalidateQueries({ queryKey: ['comments', ticketId] })
}
```

**Rationale**:
- Provides instant feedback (< 1 second perceived latency)
- Follows TanStack Query best practices
- Consistent with existing ticket update pattern

### Component Architecture

**Pattern**: Container/Presentation split with shadcn/ui primitives

**Implementation**:
```
CommentList (container)
├── CommentItem (presentation)
│   ├── Avatar (shadcn/ui Avatar or custom initials)
│   ├── Timestamp (date-fns formatDistanceToNow)
│   ├── Markdown (react-markdown)
│   └── DeleteButton (shadcn/ui Button + AlertDialog for confirmation)
└── CommentForm (container)
    ├── Textarea (shadcn/ui Textarea)
    ├── CharacterCounter (existing component)
    └── Button (shadcn/ui Button)
```

**Rationale**:
- Follows React best practices (container = logic, presentation = UI)
- Uses shadcn/ui primitives exclusively (constitution requirement)
- Reuses existing CharacterCounter component from ticket description editing

## Integration Patterns

### 1. Tabs Layout Integration

**Pattern**: Wrap existing modal content in Tabs component

**Implementation**:
```typescript
// ticket-detail-modal.tsx refactor
<Dialog>
  <DialogContent>
    <DialogHeader>
      {/* Title and metadata stay at top */}
    </DialogHeader>

    <Tabs defaultValue="details">
      <TabsList>
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="comments">
          Comments {commentCount > 0 && `(${commentCount})`}
        </TabsTrigger>
        <TabsTrigger value="files">Files</TabsTrigger>
      </TabsList>

      <TabsContent value="details">
        {/* Existing description, metadata, actions, dates */}
      </TabsContent>

      <TabsContent value="comments">
        <CommentList ticketId={ticket.id} projectId={ticket.projectId} />
      </TabsContent>

      <TabsContent value="files">
        <ImageGallery {...existingProps} />
      </TabsContent>
    </Tabs>
  </DialogContent>
</Dialog>
```

**Rationale**:
- Minimal refactoring of existing modal (low risk)
- Preserves all existing functionality in Details tab
- ImageGallery moves to Files tab unchanged
- Tabs component handles active state and keyboard navigation

### 2. Keyboard Shortcuts

**Pattern**: Custom keyboard event listener for Cmd+[1-4]

**Implementation**:
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case '1': setActiveTab('details'); break;
        case '2': setActiveTab('comments'); break;
        case '3': setActiveTab('files'); break;
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

**Rationale**:
- Arrow key navigation provided by Radix UI Tabs
- Cmd+[1-4] shortcuts require custom implementation
- Cleanup on unmount prevents memory leaks

### 3. Comment Count Badge

**Pattern**: TanStack Query derived state

**Implementation**:
```typescript
const { data: comments } = useComments(ticketId);
const commentCount = comments?.length ?? 0;

// In TabsTrigger
<TabsTrigger value="comments">
  Comments {commentCount > 0 && <Badge>{commentCount}</Badge>}
</TabsTrigger>
```

**Rationale**:
- Real-time count updates via TanStack Query polling
- Badge only shows when comments exist (cleaner UI)
- Consistent with existing badge usage in modal

## Testing Strategy

### Test Discovery Phase (MANDATORY)

**Pattern**: Search for existing tests before creating new files

**Steps**:
1. Search for existing comment tests: `npx grep -r "describe.*comment" tests/`
2. Search for ticket modal tests: `npx grep -r "ticket-detail-modal" tests/`
3. Search for tabs tests: `npx grep -r "tabs" tests/`
4. Review existing API test patterns: `tests/api/tickets/*.spec.ts`
5. Extend existing files if found, create new only if genuinely new functionality

**Rationale**:
- Constitution requires test discovery before creating new test files
- Prevents duplicate test files and maintains consistency
- Leverages established test patterns

### E2E Test Strategy

**Pattern**: User flow-based scenarios with Playwright

**Priority Tests** (from spec user stories):
1. **P1**: Create comment and verify it appears (User Story 1)
2. **P1**: View existing comments with markdown rendering (User Story 2)
3. **P1**: Tab navigation with keyboard shortcuts (User Story 6)
4. **P2**: Delete own comment with authorization check (User Story 3)
5. **P3**: Real-time comment updates via polling (User Story 5)

**Test File**: `tests/e2e/ticket-comments.spec.ts`

**Rationale**:
- Covers all P1 user stories (core functionality)
- Tests critical authorization requirements (FR-035 to FR-039)
- Validates real-time polling behavior (FR-027 to FR-031)

### Contract Test Strategy

**Pattern**: API endpoint validation with Playwright

**Test Files**:
- `tests/api/comments/create-comment.spec.ts`: POST validation (empty, too long, valid)
- `tests/api/comments/list-comments.spec.ts`: GET with project ownership check
- `tests/api/comments/delete-comment.spec.ts`: DELETE with authorship validation

**Rationale**:
- Constitution requires tests before implementation
- Validates all authorization rules (403 Forbidden cases)
- Tests Zod validation (400 Bad Request cases)

## Security Considerations

### XSS Prevention

**Implementation**:
- react-markdown escapes HTML by default
- Additional disallowedElements: `['script', 'iframe', 'embed', 'object']`
- Server-side Zod validation prevents malicious content injection
- No `dangerouslySetInnerHTML` used anywhere

**Rationale**:
- Multi-layer defense: client + server validation
- Follows OWASP recommendations for user-generated content
- Spec requirement FR-038

### Authorization Enforcement

**Implementation**:
- All API routes check session user ID
- Project ownership validated on every request
- Comment authorship validated for deletion
- Prisma queries filtered by userId/projectId

**Rationale**:
- Defense in depth: never trust client authorization
- Prevents unauthorized access even with direct API manipulation
- Spec requirements FR-035 to FR-037

## Performance Optimizations

### 1. Lazy Loading Comments

**Pattern**: Only fetch when Comments tab is opened

**Implementation**:
```typescript
const isCommentsTabActive = activeTab === 'comments';
const { data: comments } = useComments(ticketId, {
  enabled: isCommentsTabActive,
  refetchInterval: isCommentsTabActive ? 10000 : false
});
```

**Rationale**:
- Reduces initial modal load time
- Stops polling when tab not visible (saves API calls)
- Spec requirement from auto-resolved decisions

### 2. Optimistic Updates

**Pattern**: Immediate UI feedback, server sync in background

**Benefits**:
- Perceived comment submission < 1 second (instant feedback)
- Perceived deletion < 1 second (instant removal)
- User can continue interacting without waiting for network

**Rationale**:
- Success criteria SC-001 and SC-006 require < 2 second operations
- Optimistic updates achieve sub-1-second perceived latency

### 3. Efficient Rendering

**Pattern**: Virtualization deferred to v2

**Current Approach**:
- Render all comments (no pagination/virtualization in v1)
- Acceptable for typical use cases (< 100 comments)
- Success criteria SC-004: 100 comments render < 500ms

**Future Optimization** (if needed):
- Add react-window for virtualization if performance degrades
- Implement pagination if comment counts exceed 1000+

**Rationale**:
- YAGNI principle: don't optimize prematurely
- 100 comments is manageable for modern browsers
- Edge case documented in spec (see "What happens when Comments tab has 100+ comments?")

## Open Questions & Resolutions

### Q1: Should comments support edit functionality in v1?

**Resolution**: No - deferred to v2

**Rationale** (from auto-resolved decisions):
- Reduces scope and complexity for v1
- Users can delete and recreate comments as workaround
- Edit history and audit trail adds significant complexity
- CONSERVATIVE policy prioritizes quality over features

### Q2: Should comments use soft delete or hard delete?

**Resolution**: Hard delete

**Rationale** (from auto-resolved decisions):
- Simpler implementation (no deletedAt field or filtering)
- Meets user expectations (delete means gone)
- No audit trail requirement for comments (unlike tickets)
- Cascade delete on ticket deletion prevents orphaned data

### Q3: Should polling interval be configurable?

**Resolution**: No - fixed at 10 seconds

**Rationale**:
- Spec specifies 10-second interval (FR-027)
- Consistent with existing job polling pattern
- Balances real-time feel with server load
- Configuration adds unnecessary complexity for v1

## Dependencies

### Existing Dependencies (no installation needed)

- `next@15.x` - App Router, API routes
- `react@18.x` - Component library
- `@prisma/client@6.x` - Database ORM
- `@tanstack/react-query@5.90.5` - Server state management
- `react-markdown@9.0.1` - Markdown rendering
- `date-fns@latest` - Date formatting
- `zod@4.x` - Validation schemas
- `lucide-react@latest` - Icons (MessageSquare, Trash2)
- shadcn/ui components:
  - `@/components/ui/tabs` - Tabs component
  - `@/components/ui/button` - Button component
  - `@/components/ui/textarea` - Textarea component
  - `@/components/ui/badge` - Badge component
  - `@/components/ui/alert-dialog` - Delete confirmation

### New Dependencies

**None required** - all necessary dependencies already installed

## Summary

All technical decisions are resolved. No NEEDS CLARIFICATION markers remain. Implementation can proceed directly to Phase 1 (data model and contracts generation) followed by Phase 2 (task breakdown via `/speckit.tasks`).

**Key Decisions**:
- Tabs: shadcn/ui Tabs component (constitution-compliant)
- Markdown: react-markdown 9.0.1 (existing dependency, XSS-safe)
- Timestamps: date-fns formatDistanceToNow (existing dependency)
- State: TanStack Query with polling (constitution-compliant, existing pattern)
- Authorization: Two-level (project ownership + comment authorship)
- Optimistic updates: TanStack Query onMutate pattern (existing pattern)

**Next Steps**: Generate data-model.md, API contracts, and quickstart.md
