# Research: Drag and Drop Ticket to Trash

**Feature Branch**: `084-1500-drag-and`
**Created**: 2025-11-04

## Research Questions

Based on Technical Context analysis, the following areas require research:

1. **@dnd-kit trash zone patterns**: How to implement a conditional droppable zone that appears only during drag operations?
2. **GitHub API deletion order**: What is the correct sequence for deleting PRs and branches to avoid orphaned references?
3. **TanStack Query optimistic deletion**: Best practices for rollback when external API (GitHub) fails after optimistic UI update?
4. **@dnd-kit drag constraints**: How to disable drag sources based on ticket state (pending/running jobs)?

---

## Decision 1: @dnd-kit Trash Zone Implementation

**Decision**: Use conditional droppable with `disabled` prop and CSS transitions for smooth appearance/disappearance

**Rationale**:
- @dnd-kit `useDroppable` hook supports conditional rendering via parent component state
- Droppable zones can be dynamically enabled/disabled without unmounting
- CSS transitions (`opacity`, `transform`) provide smooth visual feedback within 100ms requirement
- Existing board already uses `DndContext` with `closestCenter` collision detection

**Implementation Pattern**:
```typescript
const TrashZone = ({ isVisible, isDisabled }: { isVisible: boolean, isDisabled: boolean }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'trash-zone',
    disabled: isDisabled,
  });

  if (!isVisible) return null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 transition-all duration-200",
        "border-2 border-dashed rounded-lg p-4 bg-white shadow-lg",
        isOver && !isDisabled && "border-red-500 bg-red-50",
        isDisabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <Trash2 className="w-6 h-6" />
      <span>Delete Ticket</span>
    </div>
  );
};
```

**Alternatives Considered**:
- Portal-based positioning: Rejected due to z-index complexity and interaction with existing drag overlay
- Absolute positioning within board container: Rejected because scroll state would affect visibility
- Fixed viewport positioning: **CHOSEN** - Always visible during drag, independent of scroll

**References**:
- @dnd-kit docs: https://docs.dndkit.com/api-documentation/droppable/usedroppable
- Existing implementation: `components/board/board.tsx` (DndContext usage)

---

## Decision 2: GitHub API Deletion Sequence

**Decision**: Close PRs first, then delete branch (sequential operations with error handling)

**Rationale**:
- GitHub API requires PRs to be closed/merged before branch deletion (attempting to delete branch with open PR fails)
- Sequential operation ensures correct dependency order
- Octokit REST API provides methods: `pulls.update({ state: 'closed' })` then `git.deleteRef()`
- Idempotent operations: If PR already closed or branch already deleted, API returns 404 (graceful)

**Implementation Pattern**:
```typescript
export async function deleteBranchAndPRs(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchName: string
): Promise<{ prsClosecd: number, branchDeleted: boolean }> {
  // Step 1: Find all PRs with matching head branch
  const { data: prs } = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${branchName}`,
    state: 'open',
  });

  // Step 2: Close all matching PRs
  const closedPRs = await Promise.all(
    prs.map(pr =>
      octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: pr.number,
        state: 'closed',
      })
    )
  );

  // Step 3: Delete branch (ref format: refs/heads/branch-name)
  await octokit.rest.git.deleteRef({
    owner,
    repo,
    ref: `heads/${branchName}`,
  });

  return { prsClosed: closedPRs.length, branchDeleted: true };
}
```

**Error Handling**:
- 404 errors for already-deleted resources are acceptable (idempotent)
- 403/401 errors indicate permission issues (propagate to user)
- Rate limit errors (429) should be retried with exponential backoff
- Network errors should fail transaction (preserve ticket in database)

**Alternatives Considered**:
- Parallel PR closure + branch deletion: Rejected due to race conditions
- Branch deletion first: Rejected because GitHub API prevents this
- Force delete without PR closure: Not supported by GitHub API

**References**:
- GitHub REST API docs: https://docs.github.com/en/rest/pulls/pulls#update-a-pull-request
- GitHub REST API docs: https://docs.github.com/en/rest/git/refs#delete-a-reference
- Octokit REST: `@octokit/rest` v22.0.0 TypeScript definitions

---

## Decision 3: TanStack Query Optimistic Deletion with External API Rollback

**Decision**: Use `onMutate` for optimistic update, `onError` for rollback with previous snapshot, retry disabled for external API failures

**Rationale**:
- TanStack Query mutation lifecycle: `onMutate` → API call → `onSuccess` / `onError` → `onSettled`
- Optimistic update provides immediate feedback (perceived performance)
- Snapshot previous state in `onMutate`, restore in `onError` if GitHub API fails
- Disable automatic retry for GitHub API failures (user should manually retry after resolving issues)
- Invalidate queries on success to ensure consistency

**Implementation Pattern**:
```typescript
export function useDeleteTicket(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticketId: number) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/${ticketId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete ticket');
      }
      return response.json();
    },

    onMutate: async (ticketId: number) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tickets', projectId] });

      // Snapshot previous state
      const previousTickets = queryClient.getQueryData<Ticket[]>(['tickets', projectId]);

      // Optimistically remove ticket from cache
      queryClient.setQueryData<Ticket[]>(['tickets', projectId], (old) =>
        old?.filter(ticket => ticket.id !== ticketId) ?? []
      );

      return { previousTickets };
    },

    onError: (error, ticketId, context) => {
      // Rollback to previous state
      if (context?.previousTickets) {
        queryClient.setQueryData(['tickets', projectId], context.previousTickets);
      }
      toast.error(`Failed to delete ticket: ${error.message}`);
    },

    onSuccess: () => {
      toast.success('Ticket deleted successfully');
    },

    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['tickets', projectId] });
    },

    retry: false, // Don't retry GitHub API failures automatically
  });
}
```

**Edge Cases Handled**:
- GitHub API timeout: User sees rollback + error message
- Race condition (ticket deleted by another user): 404 from API, optimistic update appears successful but refetch shows correct state
- Network failure: Rollback occurs, user can retry

**Alternatives Considered**:
- No optimistic update: Rejected due to poor perceived performance (10s wait for GitHub cleanup)
- Automatic retry: Rejected because GitHub failures may require user intervention (permissions, rate limits)
- Pessimistic update: Rejected because UX requires immediate feedback

**References**:
- TanStack Query docs: https://tanstack.com/query/latest/docs/react/guides/optimistic-updates
- Existing patterns: `app/lib/hooks/mutations/useTransitionTicket.ts` (similar mutation pattern)

---

## Decision 4: @dnd-kit Drag Source Constraints for Tickets with Active Jobs

**Decision**: Use `useSensors` with custom activation constraint and conditional `disabled` prop on draggable items

**Rationale**:
- @dnd-kit `useDraggable` hook supports `disabled` prop for conditional drag prevention
- Existing board already checks job status for stage transitions (reuse `hasRunningJob` utility)
- Visual feedback via CSS (`opacity-50 cursor-not-allowed`) when ticket cannot be dragged
- Tooltip component (shadcn/ui) explains why drag is disabled

**Implementation Pattern**:
```typescript
const TicketCard = ({ ticket }: { ticket: Ticket }) => {
  const hasActiveJob = ticket.jobs?.some(job =>
    job.status === 'PENDING' || job.status === 'RUNNING'
  );

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `ticket-${ticket.id}`,
    disabled: hasActiveJob,
    data: { ticket }, // Pass ticket data for drop handler
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform) }}
            className={cn(
              "border rounded p-2",
              hasActiveJob && "opacity-50 cursor-not-allowed"
            )}
            {...(hasActiveJob ? {} : { ...attributes, ...listeners })}
          >
            {ticket.title}
          </div>
        </TooltipTrigger>
        {hasActiveJob && (
          <TooltipContent>
            Cannot delete ticket while job is in progress
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};
```

**Visual Feedback**:
- Disabled tickets: Reduced opacity (`opacity-50`), no drag cursor
- Trash zone when disabled ticket hovered: Shows strikethrough icon, tooltip with explanation
- Consistent with existing stage transition constraints

**Alternatives Considered**:
- Allow drag but show error on drop: Rejected because user effort wasted
- Global drag prevention during any active job: Rejected because only affects specific ticket
- Modal confirmation before checking job status: Rejected because check should happen before drag starts

**References**:
- @dnd-kit docs: https://docs.dndkit.com/api-documentation/draggable
- Existing implementation: `components/board/ticket-card.tsx` (drag source setup)
- Job status utility: `app/lib/utils/job-filtering.ts` (existing `getRunningJob` function)

---

## Best Practices for Dependencies

### @dnd-kit/core + @dnd-kit/sortable
**Version**: Already in use (check package.json for current version)

**Best Practices**:
- Use `DndContext` sensors: `PointerSensor`, `KeyboardSensor` for accessibility
- `closestCenter` collision detection for trash zone (same as existing columns)
- Single `DndContext` for entire board (already implemented)
- `onDragStart` to show trash zone, `onDragEnd` to hide and handle drop
- `data` prop on draggables to pass ticket information to drop handlers

**Trash Zone Specific**:
- Trash zone is NOT sortable (just droppable)
- Fixed positioning outside main board container
- Show only when `activeId !== null` (drag in progress)
- Different drop handler logic than stage columns

---

### @octokit/rest v22.0.0
**Current Version**: ^22.0.0 (already in dependencies)

**Best Practices**:
- Create Octokit instance per request (avoid singleton with stale tokens)
- Use `GITHUB_TOKEN` from environment (Next.js API route)
- TypeScript types built-in (no `@types/octokit` needed)
- Rate limit handling: Check `response.headers['x-ratelimit-remaining']`
- Idempotent operations: Wrap in try-catch, ignore 404 errors

**Authentication**:
```typescript
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});
```

**Rate Limit Check**:
```typescript
const { data: rateLimit } = await octokit.rest.rateLimit.get();
if (rateLimit.resources.core.remaining < 100) {
  console.warn('GitHub API rate limit low:', rateLimit.resources.core.remaining);
}
```

---

### TanStack Query v5.90.5
**Current Version**: v5.90.5 (already in dependencies)

**Best Practices**:
- Query keys from centralized factory (`app/lib/query-keys.ts`)
- Mutations use optimistic updates for all write operations
- `onMutate` for optimistic update, `onError` for rollback, `onSettled` for invalidation
- Disable retry for external API failures (let user decide to retry)
- Use `queryClient.cancelQueries` to prevent race conditions during optimistic updates

**Delete Mutation Pattern** (for this feature):
- Key: `['tickets', projectId]`
- Optimistic: Remove ticket immediately
- Rollback: Restore from snapshot on error
- Invalidate: Refetch on success to ensure consistency

**Query Invalidation**:
```typescript
queryClient.invalidateQueries({ queryKey: ['tickets', projectId] });
```

---

## Technology Integration Patterns

### Drag-to-Delete Flow

```
User starts drag (ticket-card)
  ↓
onDragStart(event) → Show trash zone
  ↓
User drags over trash zone
  ↓
isOver = true → Visual feedback (red border)
  ↓
User drops on trash zone
  ↓
onDragEnd(event) → Check event.over.id === 'trash-zone'
  ↓
Show confirmation modal (stage-specific message)
  ↓
User confirms deletion
  ↓
Call useDeleteTicket mutation
  ↓
Optimistic update: Remove from UI
  ↓
API: DELETE /api/projects/[projectId]/tickets/[id]
  ↓
Server: Close GitHub PRs → Delete branch → Delete ticket from DB
  ↓
Success: Invalidate queries → Refetch
Failure: Rollback → Show error toast
```

### Transactional Deletion in API Route

```typescript
// app/api/projects/[projectId]/tickets/[id]/route.ts

export async function DELETE(
  request: Request,
  { params }: { params: { projectId: string; id: string } }
) {
  try {
    // 1. Authorization check
    const session = await getServerSession(authOptions);
    const ticket = await verifyTicketAccess(params.id);

    // 2. Validate business rules
    if (ticket.stage === 'SHIP') {
      return NextResponse.json(
        { error: 'Cannot delete SHIP stage tickets' },
        { status: 400 }
      );
    }

    const hasActiveJob = await prisma.job.findFirst({
      where: {
        ticketId: ticket.id,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });

    if (hasActiveJob) {
      return NextResponse.json(
        { error: 'Cannot delete ticket while job is in progress' },
        { status: 400 }
      );
    }

    // 3. GitHub cleanup (if branch exists)
    if (ticket.branch) {
      const project = await prisma.project.findUnique({
        where: { id: ticket.projectId },
      });

      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

      await deleteBranchAndPRs(
        octokit,
        project.githubOwner,
        project.githubRepo,
        ticket.branch
      );
    }

    // 4. Database deletion (transactional)
    await prisma.ticket.delete({
      where: { id: ticket.id },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Ticket deletion failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete ticket' },
      { status: 500 }
    );
  }
}
```

---

## Performance Considerations

### Trash Zone Rendering (Target: <100ms)
- **Conditional rendering**: Mount/unmount based on `activeId` state (from `onDragStart`/`onDragEnd`)
- **CSS transitions**: Use `transition-all duration-200` for smooth appearance (200ms < 300ms threshold)
- **Fixed positioning**: Avoid reflow by positioning outside document flow
- **Memoization**: Use `React.memo` for TrashZone component to prevent unnecessary re-renders

### GitHub API Operations (Target: <10s total)
- **Sequential operations**: PR closure (2-3s) + Branch deletion (1-2s) = ~5s typical
- **Rate limits**: 5000 req/hour authenticated = ~1.4 req/s sustained
- **Timeout handling**: Set fetch timeout to 8s (allows 2s buffer for network)
- **Error recovery**: Don't retry automatically (let user decide after seeing error)

### TanStack Query Cache Invalidation
- **Selective invalidation**: Only invalidate `['tickets', projectId]` query (not all queries)
- **Optimistic update**: Perceived instant response (0ms from user perspective)
- **Background refetch**: Occurs after success, non-blocking to user

---

## Security Considerations

### Authorization Chain
1. **Session validation**: NextAuth.js session must exist
2. **Project ownership**: User must be owner or member via `verifyTicketAccess()`
3. **Ticket ownership**: Ticket must belong to specified project
4. **Stage validation**: SHIP stage tickets cannot be deleted (business rule)

### GitHub Token Security
- **Environment variable**: `GITHUB_TOKEN` never exposed to client
- **Server-side only**: Octokit instantiated in API route (not frontend)
- **Scope**: Token requires `repo` scope (read/write access to repository)
- **Rotation**: Token can be rotated in Vercel environment variables without code changes

### Input Validation
- **Zod schema**: Validate `projectId` and `ticketId` parameters
- **SQL injection**: Prisma parameterized queries prevent injection
- **XSS prevention**: No user-generated content rendered without sanitization (not applicable to delete operation)

---

## Testing Strategy

### Unit Tests (Vitest)

**tests/unit/trash-zone-eligibility.test.ts**:
- Ticket with PENDING job → eligibility = false
- Ticket with RUNNING job → eligibility = false
- Ticket with COMPLETED job → eligibility = true
- Ticket in SHIP stage → eligibility = false
- Ticket in INBOX/SPECIFY/PLAN/BUILD/VERIFY → eligibility = true

**tests/unit/stage-confirmation-messages.test.ts**:
- INBOX ticket → "No workflow artifacts" message
- SPECIFY ticket → Lists branch, spec.md
- PLAN ticket → Lists branch, spec.md, plan.md, tasks.md
- BUILD ticket → Lists branch, implementation artifacts, PR
- VERIFY ticket → Lists branch, preview deployment, PR, all artifacts

### Integration Tests (Playwright)

**tests/api/tickets-delete.spec.ts**:
- DELETE with valid ticket → 200 response, ticket removed from database
- DELETE with SHIP ticket → 400 error
- DELETE with active job → 400 error
- DELETE with invalid project ownership → 403 error
- DELETE non-existent ticket → 404 error
- DELETE with GitHub API failure → 500 error, ticket preserved

### E2E Tests (Playwright)

**tests/e2e/board-drag-drop.spec.ts** (extend existing):
- Drag INBOX ticket to trash → Confirmation modal → Confirm → Ticket disappears
- Drag ticket with branch → Confirmation lists branch name → Confirm → Branch deleted from GitHub
- Drag ticket with pending job → Trash zone shows disabled state → No modal
- Drag SHIP ticket → Trash zone does not appear
- Cancel confirmation modal → Ticket returns to original position
- Drag to trash, GitHub API fails → Error toast → Ticket remains on board

---

## Summary

All technical unknowns have been resolved:

1. **@dnd-kit trash zone**: Fixed viewport positioning with conditional rendering
2. **GitHub deletion order**: Close PRs first, then delete branch (sequential)
3. **TanStack Query rollback**: Snapshot in `onMutate`, restore in `onError`, no automatic retry
4. **Drag constraints**: `disabled` prop on `useDraggable` based on job status

Implementation can proceed to Phase 1 (data model, contracts, quickstart).
