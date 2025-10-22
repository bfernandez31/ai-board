# Implementation Tasks: Ticket Comments with Tabs Layout

**Feature**: 042-ticket-comments-context
**Branch**: `042-ticket-comments-context`
**Date**: 2025-01-22
**Total Stories**: 6 (3 P1, 2 P2, 1 P3)
**Estimated Time**: 9-13 hours

## Task Format

```
- [ ] [TASK-ID] [Priority] [Story] Description (file: path/to/file.ext)
```

## Phase 0: Setup & Foundation (30 minutes)

### Database Migration

- [X] [TASK-001] [P1] [Setup] Update Prisma schema with Comment model (file: prisma/schema.prisma)
  - Add Comment model with fields: id, ticketId, userId, content, createdAt, updatedAt
  - Add foreign keys: ticketId → Ticket(id) ON DELETE CASCADE, userId → User(id) ON DELETE CASCADE
  - Add composite index: @@index([ticketId, createdAt])
  - Add single index: @@index([userId])
  - Add comments relationship to Ticket model: comments Comment[]
  - Add comments relationship to User model: comments Comment[]

- [X] [TASK-002] [P1] [Setup] Create and apply Prisma migration (command: terminal)
  - Run: npx prisma migrate dev --name add_comment_model
  - Verify migration file created in prisma/migrations/
  - Inspect Comment table in Prisma Studio: npx prisma studio

- [X] [TASK-003] [P1] [Setup] Create TypeScript types for comments (file: app/lib/types/comment.ts)
  - Define CommentWithUser interface (id, ticketId, userId, content, createdAt, updatedAt, user: { name, image })
  - Define CreateCommentRequest interface (content: string)
  - Define CreateCommentResponse type (alias to CommentWithUser)
  - Define ListCommentsResponse type (array of CommentWithUser)

### Validation Schemas

- [X] [TASK-004] [P1] [Setup] Create Zod validation schema for comments (file: app/lib/schemas/comment-validation.ts)
  - Define createCommentSchema: z.object({ content: z.string().min(1).max(2000).trim() })
  - Export schema for use in API routes

### Query Keys

- [X] [TASK-005] [P1] [Setup] Update TanStack Query key factory (file: app/lib/query-keys.ts)
  - Add comments key factory: comments: { list: (ticketId: number) => ['comments', ticketId] as const }

**Dependencies**: None (can run in parallel)

## Phase 1: API Endpoints (2-3 hours)

### GET /comments Endpoint

- [X] [TASK-006] [P1] [US2] Create GET /comments API route (file: app/api/projects/[projectId]/tickets/[ticketId]/comments/route.ts)
  - Extract projectId, ticketId from params
  - Validate session with NextAuth (401 if not authenticated)
  - Fetch project and validate ownership: project.userId === session.user.id (403 if not owner)
  - Query comments with Prisma: findMany({ where: { ticketId }, include: { user: { select: { name, image } } }, orderBy: { createdAt: 'desc' } })
  - Return JSON array of CommentWithUser objects

- [X] [TASK-007] [P1] [US2] Create GET /comments contract test (file: tests/api/comments/list-comments.spec.ts)
  - Test: Returns 200 with empty array for ticket with no comments
  - Test: Returns 200 with array of comments in reverse chronological order
  - Test: Returns 401 for unauthenticated user
  - Test: Returns 403 for user who doesn't own the project
  - Test: Returns 404 for non-existent ticket
  - Test: Includes user data (name, image) in response

### POST /comments Endpoint

- [X] [TASK-008] [P1] [US1] Add POST handler to comments route (file: app/api/projects/[projectId]/tickets/[ticketId]/comments/route.ts)
  - Parse request body and validate with createCommentSchema (400 if invalid)
  - Validate session (401 if not authenticated)
  - Validate project ownership (403 if not owner)
  - Create comment with Prisma: create({ data: { ticketId, userId: session.user.id, content }, include: { user: { select: { name, image } } } })
  - Return 201 Created with CommentWithUser object

- [X] [TASK-009] [P1] [US1] Create POST /comments contract test (file: tests/api/comments/create-comment.spec.ts)
  - Test: Returns 201 with created comment for valid request
  - Test: Returns 400 for empty content
  - Test: Returns 400 for content exceeding 2000 characters
  - Test: Returns 400 for missing content field
  - Test: Returns 401 for unauthenticated user
  - Test: Returns 403 for user who doesn't own the project
  - Test: Created comment includes user data in response

### DELETE /comments/:id Endpoint

- [X] [TASK-010] [P2] [US3] Create DELETE /comments/:id API route (file: app/api/projects/[projectId]/tickets/[ticketId]/comments/[commentId]/route.ts)
  - Extract projectId, ticketId, commentId from params
  - Validate session (401 if not authenticated)
  - Validate project ownership (403 if not owner)
  - Fetch comment and validate authorship: comment.userId === session.user.id (403 if not author, 404 if not found)
  - Delete comment with Prisma: delete({ where: { id: commentId } })
  - Return 204 No Content

- [X] [TASK-011] [P2] [US3] Create DELETE /comments/:id contract test (file: tests/api/comments/delete-comment.spec.ts)
  - Test: Returns 204 for successful deletion by author
  - Test: Returns 403 for user trying to delete another user's comment
  - Test: Returns 403 for user who doesn't own the project
  - Test: Returns 404 for non-existent comment
  - Test: Returns 401 for unauthenticated user
  - Test: Verify comment is actually deleted from database

**Dependencies**: TASK-001 to TASK-005 must complete before starting this phase

## Phase 2: TanStack Query Hooks (1 hour)

### Query Hooks

- [X] [TASK-012] [P1] [US2] Create useComments query hook (file: app/lib/hooks/queries/use-comments.ts)
  - Use TanStack Query useQuery with queryKeys.comments.list(ticketId)
  - Fetch from GET /api/projects/:projectId/tickets/:ticketId/comments
  - Return { data: comments, isLoading, error }
  - Enable polling: refetchInterval: 10000 (10 seconds)
  - Conditional polling: enabled: isCommentsTabActive

- [X] [TASK-013] [P3] [US5] Add polling integration to useComments hook (file: app/lib/hooks/queries/use-comments.ts)
  - Accept enabled option to conditionally enable polling
  - Filter out optimistically added comments by ID during polling
  - Stop polling when modal unmounts (TanStack Query automatic cleanup)

### Mutation Hooks

- [X] [TASK-014] [P1] [US1] Create useCreateComment mutation hook (file: app/lib/hooks/mutations/use-create-comment.ts)
  - Use TanStack Query useMutation
  - POST to /api/projects/:projectId/tickets/:ticketId/comments
  - Implement onMutate: Cancel queries, snapshot previous state, optimistically add comment to cache
  - Implement onError: Rollback to previous state, show error toast
  - Implement onSuccess: Invalidate comments query, clear form

- [X] [TASK-015] [P2] [US3] Create useDeleteComment mutation hook (file: app/lib/hooks/mutations/use-delete-comment.ts)
  - Use TanStack Query useMutation
  - DELETE to /api/projects/:projectId/tickets/:ticketId/comments/:commentId
  - Implement onMutate: Cancel queries, snapshot previous state, optimistically remove comment from cache
  - Implement onError: Rollback to previous state, show error toast
  - Implement onSuccess: Invalidate comments query

**Dependencies**: TASK-006, TASK-008, TASK-010 (API endpoints) must complete first

## Phase 3: UI Components - Avatar & Comment Item (1 hour)

### Avatar Component

- [X] [TASK-016] [P1] [US2] Create Avatar component (file: components/comments/avatar.tsx)
  - Accept props: name (string | null), image (string | null)
  - Display user.image if available
  - Fallback to initials (first letters of name split by space)
  - Use shadcn/ui Avatar component (Avatar, AvatarImage, AvatarFallback)
  - Style with Catppuccin dark theme colors

### Comment Item Component

- [X] [TASK-017] [P1] [US2] Create CommentItem component (file: components/comments/comment-item.tsx)
  - Accept props: comment (CommentWithUser), currentUserId (string), onDelete ((commentId: number) => void)
  - Display Avatar with user name and image
  - Display author name (user.name || 'Anonymous')
  - Display relative timestamp with date-fns formatDistanceToNow (e.g., "2 hours ago")
  - Render markdown content with react-markdown (disallowedElements: ['script', 'iframe', 'embed', 'object'])
  - Show delete button (trash icon from lucide-react) only if comment.userId === currentUserId
  - Hover state: Show delete button on hover
  - Style with Catppuccin dark theme colors

- [X] [TASK-018] [P2] [US3] Add delete confirmation to CommentItem (file: components/comments/comment-item.tsx)
  - Wrap delete button with shadcn/ui AlertDialog
  - Show confirmation dialog: "Are you sure you want to delete this comment? This action cannot be undone."
  - On confirm: Call onDelete(comment.id)
  - On cancel: Close dialog

**Dependencies**: TASK-016 must complete before TASK-017

## Phase 4: UI Components - Comment Form (1 hour)

### Comment Form Component

- [X] [TASK-019] [P1] [US1] Create CommentForm component (file: components/comments/comment-form.tsx)
  - Use React state for content (max 2000 characters)
  - Textarea with auto-focus on mount
  - Character counter showing current/max (e.g., "250 / 2000")
  - Submit button disabled when content empty or > 2000 characters
  - Cmd/Ctrl+Enter keyboard shortcut to submit
  - Loading state during submission (disabled form, "Submitting..." button text)
  - Use useCreateComment mutation hook
  - Clear form on successful submission
  - Use shadcn/ui Textarea and Button components
  - Style with Catppuccin dark theme colors

- [X] [TASK-020] [P1] [US1] Add keyboard shortcut to CommentForm (file: components/comments/comment-form.tsx)
  - useEffect with keydown listener for Cmd/Ctrl+Enter
  - Submit form when shortcut detected
  - Cleanup listener on unmount

**Dependencies**: TASK-014 (useCreateComment hook) must complete first

## Phase 5: UI Components - Comment List (1 hour)

### Comment List Component

- [X] [TASK-021] [P1] [US1,US2] Create CommentList component (file: components/comments/comment-list.tsx)
  - Accept props: ticketId (number), projectId (number)
  - Use useComments query hook with polling enabled
  - Render CommentForm at top
  - Render CommentItem for each comment below form
  - Show loading state (skeleton or spinner) during initial fetch
  - Show empty state when no comments: "No comments yet. Be the first to comment!"
  - Use useDeleteComment mutation for comment deletion
  - Style with Catppuccin dark theme colors

- [X] [TASK-022] [P3] [US5] Add polling integration to CommentList (file: components/comments/comment-list.tsx)
  - Pass enabled: isCommentsTabActive to useComments hook
  - Stop polling when tab not visible
  - Update comment count automatically when new comments detected

**Dependencies**: TASK-012 (useComments hook), TASK-015 (useDeleteComment hook), TASK-017 (CommentItem), TASK-019 (CommentForm) must complete first

## Phase 6: Tabs Layout Refactor (1-2 hours)

### Ticket Detail Modal Refactor

- [X] [TASK-023] [P1] [US6] Refactor ticket-detail-modal to use tabs layout (file: components/board/ticket-detail-modal.tsx)
  - Import shadcn/ui Tabs components (Tabs, TabsList, TabsTrigger, TabsContent)
  - Wrap existing content in <Tabs defaultValue="details">
  - Move title and metadata to DialogHeader (above tabs)
  - Create TabsList with 3 triggers: Details, Comments, Files
  - Move existing description, metadata, actions, dates to Details TabsContent
  - Move ImageGallery to Files TabsContent (preserve all existing functionality)
  - Add CommentList to Comments TabsContent
  - Add state: activeTab (string, default: 'details')
  - Style tabs with Catppuccin dark theme colors

- [X] [TASK-024] [P1] [US2] Add comment count badge to Comments tab (file: components/board/ticket-detail-modal.tsx)
  - Use useComments hook to get comments array
  - Calculate commentCount: comments?.length ?? 0
  - Display badge in Comments TabsTrigger: "Comments {commentCount > 0 && <Badge>{commentCount}</Badge>}"
  - Badge updates automatically via polling

- [X] [TASK-025] [P2] [US4] Add keyboard shortcuts to ticket-detail-modal (file: components/board/ticket-detail-modal.tsx)
  - useEffect with keydown listener
  - Handle Cmd/Ctrl+1 → setActiveTab('details')
  - Handle Cmd/Ctrl+2 → setActiveTab('comments')
  - Handle Cmd/Ctrl+3 → setActiveTab('files')
  - Cleanup listener on unmount
  - Prevent default browser behavior for these shortcuts

**Dependencies**: TASK-021 (CommentList) must complete before TASK-023

## Phase 7: E2E Tests (1-2 hours)

### Test Discovery (MANDATORY)

- [ ] [TASK-026] [P1] [Testing] Search for existing ticket modal tests (command: terminal)
  - Run: npx grep -r "ticket.*modal" tests/e2e/
  - Run: npx grep -r "tabs" tests/e2e/
  - Run: npx glob "tests/e2e/**/*.spec.ts"
  - Document findings: If existing tests found, extend them; otherwise create new file

### E2E Test Implementation

- [ ] [TASK-027] [P1] [US1] Create E2E test: User creates comment (file: tests/e2e/ticket-comments.spec.ts)
  - Open ticket modal
  - Navigate to Comments tab
  - Verify empty state message shown
  - Type comment in textarea
  - Submit comment (click button or Cmd+Enter)
  - Verify comment appears in list with author name, avatar, timestamp
  - Verify form is cleared

- [ ] [TASK-028] [P1] [US2] Create E2E test: User views comments with markdown (file: tests/e2e/ticket-comments.spec.ts)
  - Create ticket with 5 comments (including markdown: bold, italic, links, code blocks)
  - Open ticket modal and navigate to Comments tab
  - Verify all 5 comments shown in reverse chronological order
  - Verify markdown rendered correctly (bold, italic, links, code blocks)
  - Verify relative timestamps shown (e.g., "2 hours ago")

- [ ] [TASK-029] [P2] [US3] Create E2E test: User deletes own comment (file: tests/e2e/ticket-comments.spec.ts)
  - Create ticket with comment by test user
  - Open ticket modal and navigate to Comments tab
  - Hover over own comment to reveal delete button
  - Click delete button and confirm deletion
  - Verify comment removed from list

- [ ] [TASK-030] [P2] [US3] Create E2E test: User cannot delete another user's comment (file: tests/e2e/ticket-comments.spec.ts)
  - Create ticket with comment by different user (seed data)
  - Open ticket modal and navigate to Comments tab
  - Hover over other user's comment
  - Verify delete button does NOT appear

- [ ] [TASK-031] [P1] [US6] Create E2E test: Tab navigation with keyboard shortcuts (file: tests/e2e/ticket-comments.spec.ts)
  - Open ticket modal (Details tab active by default)
  - Press Cmd/Ctrl+2 to navigate to Comments tab
  - Verify Comments tab active
  - Press right arrow key to navigate to Files tab
  - Verify Files tab active
  - Press Cmd/Ctrl+1 to navigate back to Details tab
  - Verify Details tab active

- [ ] [TASK-032] [P1] [US6] Create E2E test: Existing functionality preserved in tabs (file: tests/e2e/ticket-comments.spec.ts)
  - Open ticket modal
  - Test title editing in Details tab (existing functionality)
  - Test description editing in Details tab (existing functionality)
  - Test image upload in Files tab (existing functionality)
  - Verify all edits succeed without regression

- [ ] [TASK-033] [P3] [US5] Create E2E test: Real-time comment updates via polling (file: tests/e2e/ticket-comments.spec.ts)
  - Open ticket modal in first browser window (Comments tab active)
  - Create comment via API in second context
  - Wait 10 seconds for polling
  - Verify new comment appears in first browser window
  - Verify comment count badge updates (e.g., "Comments (1)" → "Comments (2)")

**Dependencies**: TASK-023 (tabs refactor) must complete before E2E tests

## Phase 8: Polish & Validation (30 minutes)

### Code Quality

- [ ] [TASK-034] [P1] [Polish] Run TypeScript type check (command: terminal)
  - Run: npx tsc --noEmit
  - Fix any type errors

- [ ] [TASK-035] [P1] [Polish] Run ESLint (command: terminal)
  - Run: npm run lint
  - Fix any linting errors

### Testing

- [ ] [TASK-036] [P1] [Polish] Run all tests (command: terminal)
  - Run: npx playwright test
  - Verify all tests pass (API contract tests + E2E tests)
  - Target: ≥90% test coverage for comment system

### Manual Testing

- [ ] [TASK-037] [P1] [Polish] Manual testing: All 6 user stories (manual)
  - US1: Add comment to ticket
  - US2: View comments on ticket
  - US3: Delete own comment
  - US4: Navigate between tabs (keyboard + mouse)
  - US5: Real-time comment updates (two browser windows)
  - US6: Reorganize ticket modal with tabs (verify existing functionality preserved)

- [ ] [TASK-038] [P1] [Polish] Manual testing: Mobile responsiveness (manual)
  - Open ticket modal on mobile viewport
  - Verify tabs horizontally scrollable
  - Verify comment form usable (no keyboard shortcuts needed)
  - Verify full-screen modal on small screens

### Performance

- [ ] [TASK-039] [P1] [Polish] Performance check: 100 comments render time (manual)
  - Create ticket with 100 comments (seed script)
  - Open ticket modal and navigate to Comments tab
  - Measure render time with browser DevTools Performance tab
  - Verify < 500ms render time

- [ ] [TASK-040] [P1] [Polish] Performance check: Polling memory leaks (manual)
  - Open ticket modal (Comments tab active)
  - Let polling run for 5 minutes
  - Open browser DevTools Memory tab
  - Verify no memory leaks (heap snapshot stable)

---

## Dependency Graph

### Critical Path (Must complete in order)

```
Phase 0: Setup (TASK-001 → TASK-002 → TASK-003 → TASK-004 → TASK-005)
         ↓
Phase 1: API Endpoints (TASK-006 → TASK-008 → TASK-010)
         ↓
Phase 2: TanStack Query Hooks (TASK-012 → TASK-014 → TASK-015)
         ↓
Phase 3: UI Components - Avatar & Item (TASK-016 → TASK-017 → TASK-018)
         ∥
Phase 4: UI Components - Form (TASK-019 → TASK-020)
         ↓
Phase 5: UI Components - List (TASK-021 → TASK-022)
         ↓
Phase 6: Tabs Refactor (TASK-023 → TASK-024 → TASK-025)
         ↓
Phase 7: E2E Tests (TASK-026 → TASK-027 to TASK-033)
         ↓
Phase 8: Polish & Validation (TASK-034 to TASK-040)
```

### Parallel Execution Opportunities

**Phase 0 (Setup)**: All tasks can run in parallel (no dependencies)

**Phase 1 (API Endpoints)**:
- TASK-007, TASK-009, TASK-011 (contract tests) can be written in parallel with TASK-006, TASK-008, TASK-010 (API implementations)
- Contract tests can run independently as TDD (write tests first, then implement endpoints)

**Phase 3 + Phase 4 (UI Components)**:
- TASK-019, TASK-020 (CommentForm) can be developed in parallel with TASK-016, TASK-017, TASK-018 (Avatar + CommentItem)

**Phase 7 (E2E Tests)**:
- TASK-027 to TASK-033 (all E2E test scenarios) can be written in parallel

## Story Completion Order

### Story Dependency Matrix

```
US6 (Reorganize Modal) → US1 (Add Comment) → US2 (View Comments) → US3 (Delete Comment) → US4 (Navigate Tabs) → US5 (Real-Time Updates)
```

**Rationale**:
1. **US6 first**: Must reorganize modal structure before adding comment functionality
2. **US1 then US2**: Create and view are core functionality (both P1)
3. **US3 after US1/US2**: Delete depends on having comments to delete
4. **US4 after US6**: Tab navigation requires tabs to exist
5. **US5 last**: Real-time updates build on top of all other functionality (P3)

### Independent Test Criteria

Each user story can be independently tested as defined in spec.md:
- **US1**: Create ticket → add comment → verify appears
- **US2**: Seed ticket with comments → view Comments tab → verify list
- **US3**: Create comment → delete it → verify removed
- **US4**: Open modal → test keyboard shortcuts → verify navigation
- **US5**: Two browser windows → create comment in one → verify appears in other
- **US6**: Open modal → verify tabs exist → test all existing functionality

## MVP Scope Recommendation

**Minimal Viable Product** (deliverable in 5-7 hours):
- **Phase 0**: Database migration and types (TASK-001 to TASK-005)
- **Phase 1**: POST and GET endpoints only (TASK-006, TASK-007, TASK-008, TASK-009) - skip DELETE
- **Phase 2**: useComments and useCreateComment hooks only (TASK-012, TASK-014) - skip delete hook and polling
- **Phase 3**: Avatar and CommentItem without delete button (TASK-016, TASK-017) - skip TASK-018
- **Phase 4**: CommentForm (TASK-019, TASK-020)
- **Phase 5**: CommentList without delete and polling (TASK-021) - skip TASK-022
- **Phase 6**: Basic tabs refactor without keyboard shortcuts (TASK-023, TASK-024) - skip TASK-025
- **Phase 7**: Core E2E tests only (TASK-027, TASK-028, TASK-031, TASK-032)
- **Phase 8**: Type check, lint, basic manual testing (TASK-034, TASK-035, TASK-037)

**MVP Delivers**:
- ✅ US1: Add Comment to Ticket (core P1)
- ✅ US2: View Comments on Ticket (core P1)
- ✅ US6: Reorganize Ticket Modal with Tabs (core P1)
- ❌ US3: Delete Own Comment (P2, deferred)
- ❌ US4: Navigate Between Tabs (P2, deferred - basic tab clicks work)
- ❌ US5: Real-Time Comment Updates (P3, deferred)

**Post-MVP Enhancements**:
- Delete comment functionality (US3)
- Keyboard shortcuts for tab navigation (US4)
- Real-time polling updates (US5)

## Implementation Strategy

### Test-Driven Development (TDD)

**Phase 1 (API Endpoints)**: Write contract tests FIRST
1. Write failing contract test (Red): TASK-007, TASK-009, TASK-011
2. Implement endpoint to pass test (Green): TASK-006, TASK-008, TASK-010
3. Run tests: `npx playwright test tests/api/comments/`

**Phase 7 (E2E Tests)**: Write E2E tests BEFORE refactoring
1. Write failing E2E test (Red): TASK-027 to TASK-033
2. Implement feature to pass test (Green): Already done in Phases 1-6
3. Run tests: `npx playwright test tests/e2e/ticket-comments.spec.ts`

### Incremental Integration

**Phase 6 (Tabs Refactor)**: Preserve existing functionality
1. Add tabs wrapper around existing content (no removal yet)
2. Verify existing functionality still works (regression test)
3. Move ImageGallery to Files tab (verify still works)
4. Add CommentList to Comments tab (new functionality)

### Quality Gates

**After Phase 1**: All API contract tests must pass before proceeding
**After Phase 6**: All existing functionality tests must pass (no regression)
**After Phase 7**: ≥90% E2E test coverage for comment system
**After Phase 8**: TypeScript compiles with no errors, ESLint passes with no warnings

## Common Issues & Solutions

### Issue 1: Migration Fails

**Symptom**: `prisma migrate dev` fails with foreign key error

**Solution**:
```bash
# Drop and recreate database
npx prisma migrate reset
npx prisma migrate dev
```

### Issue 2: Tests Fail with "Comment not found"

**Symptom**: Contract tests fail with 404 errors

**Solution**:
- Ensure test user exists: `await createTestUser()`
- Ensure test ticket exists: `await createTestTicket()`
- Check foreign key relationships in seed data

### Issue 3: Polling Doesn't Stop

**Symptom**: Polling continues after modal closed (memory leak)

**Solution**:
- Check TanStack Query `enabled` option
- Verify cleanup in useEffect
- Use React DevTools to inspect query status

### Issue 4: Markdown Renders HTML

**Symptom**: XSS vulnerability - script tags execute

**Solution**:
- Verify react-markdown default HTML escaping
- Add `disallowedElements={['script', 'iframe']}`
- Test with malicious input: `<script>alert('XSS')</script>`

### Issue 5: Optimistic Updates Don't Rollback

**Symptom**: Failed comment still shows in list

**Solution**:
- Check `onError` handler in mutation
- Verify `context.previousComments` is captured in `onMutate`
- Use queryClient.setQueryData with previous snapshot

## Task Summary

**Total Tasks**: 40
- **Setup**: 5 tasks (TASK-001 to TASK-005)
- **API Endpoints**: 6 tasks (TASK-006 to TASK-011)
- **TanStack Query Hooks**: 4 tasks (TASK-012 to TASK-015)
- **UI Components - Avatar & Item**: 3 tasks (TASK-016 to TASK-018)
- **UI Components - Form**: 2 tasks (TASK-019 to TASK-020)
- **UI Components - List**: 2 tasks (TASK-021 to TASK-022)
- **Tabs Refactor**: 3 tasks (TASK-023 to TASK-025)
- **E2E Tests**: 8 tasks (TASK-026 to TASK-033)
- **Polish & Validation**: 7 tasks (TASK-034 to TASK-040)

**By Priority**:
- **P1 (Critical)**: 28 tasks
- **P2 (High)**: 7 tasks
- **P3 (Medium)**: 5 tasks

**By Story**:
- **Setup**: 5 tasks (no story association)
- **US1 (Add Comment)**: 8 tasks
- **US2 (View Comments)**: 7 tasks
- **US3 (Delete Comment)**: 5 tasks
- **US4 (Navigate Tabs)**: 3 tasks
- **US5 (Real-Time Updates)**: 3 tasks
- **US6 (Reorganize Modal)**: 4 tasks
- **Testing**: 8 tasks (no story association)
- **Polish**: 7 tasks (no story association)

**Estimated Time**:
- **Minimum** (MVP only): 5-7 hours
- **Full Feature** (all tasks): 9-13 hours

## Next Steps

1. Review tasks.md with team for feedback
2. Begin implementation with TASK-001 (Prisma schema update)
3. Follow TDD approach: Write tests first, implement features second
4. Track progress by updating checkboxes in this file
5. Run quality gates after each phase before proceeding

---

**Generated**: 2025-01-22 via `/speckit.tasks` command
**Last Updated**: 2025-01-22
**Status**: Ready for implementation
