# Quickstart: Ticket Comments Implementation

**Feature**: 042-ticket-comments-context
**Branch**: `042-ticket-comments-context`
**Date**: 2025-01-22

## Prerequisites

- Node.js 22.20.0 LTS installed
- PostgreSQL 14+ running locally
- Project dependencies installed (`npm install`)
- Test user created (`test@e2e.local`)

## Implementation Order

Follow this sequence to implement the feature with TDD:

### Phase 1: Database & Types (30 minutes)

1. **Update Prisma Schema**
   ```bash
   # Edit prisma/schema.prisma
   # Add Comment model (see data-model.md for complete schema)
   ```

2. **Create Migration**
   ```bash
   npx prisma migrate dev --name add_comment_model
   ```

3. **Verify Migration**
   ```bash
   npx prisma studio  # Inspect Comment table
   ```

4. **Create TypeScript Types**
   ```bash
   # Create app/lib/types/comment.ts
   # Define CommentWithUser interface (see data-model.md)
   ```

### Phase 2: API Contracts & Tests (1-2 hours)

**MANDATORY**: Search for existing tests FIRST before creating new files.

1. **Search for Existing Test Files**
   ```bash
   # Search for comment-related tests
   npx grep -r "describe.*comment" tests/

   # Search for ticket API tests
   npx grep -r "api/projects.*tickets" tests/api/

   # List existing API test files
   npx glob "tests/api/**/*.spec.ts"
   ```

2. **Create Contract Tests** (only if none exist)
   ```bash
   # If search above found no comment tests, create new files:
   mkdir -p tests/api/comments
   touch tests/api/comments/create-comment.spec.ts
   touch tests/api/comments/list-comments.spec.ts
   touch tests/api/comments/delete-comment.spec.ts
   ```

3. **Write Failing Tests** (Red)
   - Test POST /comments validation (empty, too long, valid)
   - Test GET /comments with authorization
   - Test DELETE /comments with authorship check
   - Run tests: `npx playwright test tests/api/comments/`
   - **Expected**: All tests fail (API routes don't exist yet)

### Phase 3: API Implementation (2-3 hours)

1. **Create Zod Validation Schema**
   ```bash
   touch app/lib/schemas/comment-validation.ts
   ```
   - Define `createCommentSchema` (1-2000 characters)

2. **Implement GET /comments Endpoint**
   ```bash
   mkdir -p app/api/projects/[projectId]/tickets/[ticketId]/comments
   touch app/api/projects/[projectId]/tickets/[ticketId]/comments/route.ts
   ```
   - Extract projectId, ticketId from params
   - Validate session (NextAuth)
   - Check project ownership (403 if not owner)
   - Query comments with Prisma (`include: { user }`)
   - Return JSON array

3. **Implement POST /comments Endpoint** (same file)
   - Validate request body with Zod
   - Check project ownership
   - Create comment with Prisma
   - Return created comment with user data

4. **Implement DELETE /comments/:id Endpoint**
   ```bash
   touch app/api/projects/[projectId]/tickets/[ticketId]/comments/[commentId]/route.ts
   ```
   - Check project ownership
   - Fetch comment and validate authorship (403 if not author)
   - Delete with Prisma
   - Return 204 No Content

5. **Run Contract Tests** (Green)
   ```bash
   npx playwright test tests/api/comments/
   ```
   - **Expected**: All API tests pass

### Phase 4: TanStack Query Hooks (1 hour)

1. **Update Query Keys**
   ```bash
   # Edit app/lib/query-keys.ts
   # Add comments: { list: (ticketId) => ['comments', ticketId] }
   ```

2. **Create useComments Query Hook**
   ```bash
   touch app/lib/hooks/queries/use-comments.ts
   ```
   - Use TanStack Query `useQuery`
   - Fetch from GET /comments endpoint
   - Enable polling: `refetchInterval: 10000`
   - Conditional enable based on tab visibility

3. **Create useCreateComment Mutation**
   ```bash
   touch app/lib/hooks/mutations/use-create-comment.ts
   ```
   - Use TanStack Query `useMutation`
   - Optimistic update in `onMutate`
   - Rollback on error in `onError`
   - Invalidate queries in `onSuccess`

4. **Create useDeleteComment Mutation**
   ```bash
   touch app/lib/hooks/mutations/use-delete-comment.ts
   ```
   - Similar pattern to create mutation
   - Optimistic delete from cache

### Phase 5: UI Components (2-3 hours)

1. **Create Avatar Component**
   ```bash
   touch components/comments/avatar.tsx
   ```
   - Display user.image if available
   - Fallback to initials (first letters of name)
   - Use shadcn/ui Avatar component

2. **Create CommentItem Component**
   ```bash
   touch components/comments/comment-item.tsx
   ```
   - Display avatar, author name, timestamp, content
   - Render markdown with react-markdown
   - Show delete button only for own comments
   - Confirm deletion with shadcn/ui AlertDialog

3. **Create CommentForm Component**
   ```bash
   touch components/comments/comment-form.tsx
   ```
   - Textarea with character counter
   - Submit button (disabled when invalid)
   - Auto-focus on mount
   - Handle Cmd/Ctrl+Enter shortcut
   - Use useCreateComment mutation

4. **Create CommentList Component**
   ```bash
   touch components/comments/comment-list.tsx
   ```
   - Use useComments query hook
   - Render CommentItem for each comment
   - Show loading state
   - Show empty state: "No comments yet. Be the first to comment!"
   - Render CommentForm at top

### Phase 6: Tabs Layout Refactor (1-2 hours)

1. **Refactor ticket-detail-modal.tsx**
   - Import shadcn/ui Tabs components
   - Wrap existing content in `<Tabs defaultValue="details">`
   - Move title/metadata to DialogHeader (above tabs)
   - Create TabsList with 3 triggers: Details, Comments, Files
   - Move existing content to Details TabsContent
   - Move ImageGallery to Files TabsContent
   - Add CommentList to Comments TabsContent

2. **Add Comment Count Badge**
   - Use useComments to get comment count
   - Display badge in Comments TabsTrigger: `Comments (5)`

3. **Add Keyboard Shortcuts**
   - useEffect with keydown listener
   - Handle Cmd/Ctrl+[1-4] to switch tabs
   - Cleanup listener on unmount

### Phase 7: E2E Tests (1-2 hours)

**MANDATORY**: Search for existing tests FIRST.

1. **Search for Existing E2E Tests**
   ```bash
   # Search for ticket modal tests
   npx grep -r "ticket.*modal" tests/e2e/

   # Search for tabs tests
   npx grep -r "tabs" tests/e2e/

   # List existing E2E test files
   npx glob "tests/e2e/**/*.spec.ts"
   ```

2. **Create E2E Test File** (only if none exist)
   ```bash
   # If search found no ticket-comments tests:
   touch tests/e2e/ticket-comments.spec.ts
   ```

3. **Write E2E Test Scenarios**
   - User creates comment and sees it in list
   - User views existing comments with markdown
   - User deletes own comment
   - User cannot delete another user's comment
   - Tab navigation with keyboard shortcuts
   - Comment count badge updates
   - Real-time polling updates (two browser windows)

4. **Run E2E Tests**
   ```bash
   npx playwright test tests/e2e/ticket-comments.spec.ts
   ```
   - **Expected**: All E2E tests pass
   - **Target**: ≥90% coverage (9/10 scenarios)

### Phase 8: Polish & Verification (30 minutes)

1. **Run All Tests**
   ```bash
   npx playwright test
   ```

2. **Verify Type Safety**
   ```bash
   npx tsc --noEmit
   ```

3. **Run Linter**
   ```bash
   npm run lint
   ```

4. **Manual Testing**
   - Open ticket modal
   - Test all 6 user stories from spec.md
   - Verify mobile responsiveness
   - Test keyboard navigation
   - Test markdown rendering

5. **Performance Check**
   - Create 100 comments (seed script)
   - Verify render time < 500ms
   - Check polling doesn't cause memory leaks

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

## Testing Checklist

Before marking feature complete, verify:

- [ ] All API contract tests pass (create, list, delete)
- [ ] All E2E tests pass (≥90% coverage target)
- [ ] TypeScript compiles without errors
- [ ] ESLint passes with no warnings
- [ ] Manual testing: All 6 user stories work
- [ ] Authorization: 403 errors for unauthorized access
- [ ] Validation: 400 errors for invalid input
- [ ] XSS: Markdown renders safely (no script execution)
- [ ] Performance: 100 comments render < 500ms
- [ ] Polling: Updates appear within 10 seconds
- [ ] Mobile: Full-screen modal works on small screens
- [ ] Keyboard: Arrow keys and Cmd+[1-4] shortcuts work

## Next Steps

After implementation complete:

1. **Create Pull Request**
   ```bash
   git add .
   git commit -m "feat(ticket-042): add comment system with tabs layout"
   git push origin 042-ticket-comments-context
   gh pr create --title "Add Ticket Comments with Tabs Layout" --body "..."
   ```

2. **Deploy Preview**
   - Vercel auto-deploys PR preview
   - Test on preview URL before merging

3. **Merge to Main**
   - Get code review approval
   - Merge PR
   - Verify production deployment

4. **Monitor Production**
   - Check error logs (Vercel dashboard)
   - Monitor performance (< 2s comment submission)
   - Gather user feedback

## Time Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Database & Types | 30 min | Straightforward Prisma setup |
| API Contracts & Tests | 1-2 hours | Write failing tests first |
| API Implementation | 2-3 hours | 3 endpoints with authorization |
| TanStack Query Hooks | 1 hour | Follow existing patterns |
| UI Components | 2-3 hours | 4 new components |
| Tabs Layout Refactor | 1-2 hours | Refactor existing modal |
| E2E Tests | 1-2 hours | 6-7 test scenarios |
| Polish & Verification | 30 min | Final checks |
| **Total** | **9-13 hours** | ~2 days for single developer |

## Additional Resources

- [Specification](./spec.md) - Feature requirements and user stories
- [Data Model](./data-model.md) - Database schema and query patterns
- [API Contracts](./contracts/) - OpenAPI specifications for endpoints
- [Research](./research.md) - Technology decisions and best practices
- [Constitution](.specify/memory/constitution.md) - Non-negotiable rules

## Support

For questions or issues:
- Review similar patterns in existing code (`/api/tickets`, `useJobPolling`)
- Check TanStack Query docs: https://tanstack.com/query/latest
- Check shadcn/ui docs: https://ui.shadcn.com
- Review Prisma docs: https://www.prisma.io/docs
