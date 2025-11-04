# Developer Quickstart: Drag and Drop Ticket to Trash

**Feature Branch**: `084-1500-drag-and`
**Estimated Implementation Time**: 6-8 hours (with tests)

---

## Overview

This feature adds drag-and-drop trash zone functionality to delete tickets from all stages except SHIP. Users drag tickets to a bottom-positioned trash zone, confirm deletion via stage-specific modal, and the system cleans up GitHub artifacts (branch, PRs) before permanently deleting the ticket from the database.

**What You'll Build**:
- Trash zone component (appears during drag)
- Delete confirmation modal (stage-specific messages)
- DELETE API endpoint with GitHub cleanup
- TanStack Query mutation hook (optimistic updates)
- Utility functions (eligibility, messages, GitHub operations)

---

## Prerequisites

### Required Knowledge
- TypeScript (strict mode)
- Next.js 15 App Router
- React 18 (hooks, context)
- @dnd-kit (drag-and-drop library)
- TanStack Query v5 (mutations, optimistic updates)
- Prisma (ORM, transactions)
- GitHub REST API (via @octokit/rest)
- Playwright (E2E testing)
- Vitest (unit testing)

### Existing Codebase Familiarity
- **Board drag-and-drop**: `components/board/board.tsx` (DndContext setup)
- **Ticket cards**: `components/board/ticket-card.tsx` (drag source)
- **Stage columns**: `components/board/stage-column.tsx` (droppable zones)
- **Job polling**: `lib/hooks/useJobPolling.ts` (job status checking)
- **Authorization helpers**: `lib/db/auth-helpers.ts` (`verifyTicketAccess`)
- **Mutation patterns**: `lib/hooks/mutations/useTransitionTicket.ts` (TanStack Query example)

### Environment Setup
Ensure you have:
- Node.js 22.20.0 LTS
- PostgreSQL 14+ (local or remote)
- GitHub token with `repo` scope (for testing)
- `.env.local` file with:
  ```env
  GITHUB_TOKEN=ghp_your_personal_access_token_here
  DATABASE_URL=postgresql://user:password@localhost:5432/ai_board
  ```

---

## Quick Start (5 Minutes)

### 1. Checkout Feature Branch
```bash
git checkout 084-1500-drag-and
git pull origin 084-1500-drag-and
```

### 2. Install Dependencies (if needed)
```bash
bun install
# @dnd-kit, @octokit/rest, TanStack Query already in package.json
```

### 3. Run Development Server
```bash
bun run dev
# Server: http://localhost:3000
```

### 4. Open Board in Browser
```
http://localhost:3000/projects/3/board
```
(Project 3 is the development project - see CLAUDE.md)

### 5. Explore Existing Drag-and-Drop
- Drag a ticket from INBOX to SPECIFY
- Notice the stage transition behavior
- This same drag system will be extended with a trash zone

---

## Implementation Roadmap

### Phase 1: Utilities (1 hour) - **START HERE**
Pure functions with no dependencies on React or Next.js.

**Files to Create**:
1. `lib/utils/trash-zone-eligibility.ts`
   - `isTicketDeletable(ticket: Ticket): boolean`
   - Checks: stage !== 'SHIP', no active jobs

2. `lib/utils/stage-confirmation-messages.ts`
   - `getConfirmationMessage(ticket: Ticket): string`
   - Returns stage-specific message (INBOX, SPECIFY, PLAN, BUILD, VERIFY)

3. `lib/github/delete-branch-and-prs.ts`
   - `deleteBranchAndPRs(octokit, owner, repo, branch): Promise<{ prsClosed, branchDeleted }>`
   - Sequential: close PRs → delete branch

**Testing (TDD Required)**:
- `tests/unit/trash-zone-eligibility.test.ts` (Vitest)
- `tests/unit/stage-confirmation-messages.test.ts` (Vitest)
- Write tests FIRST, then implement functions

**Example Test**:
```typescript
// tests/unit/trash-zone-eligibility.test.ts
import { describe, it, expect } from 'vitest';
import { isTicketDeletable } from '@/lib/utils/trash-zone-eligibility';

describe('isTicketDeletable', () => {
  it('returns false for SHIP stage tickets', () => {
    const ticket = { id: 1, stage: 'SHIP', jobs: [] } as Ticket;
    expect(isTicketDeletable(ticket)).toBe(false);
  });

  it('returns false when ticket has PENDING job', () => {
    const ticket = {
      id: 1,
      stage: 'BUILD',
      jobs: [{ status: 'PENDING' }],
    } as Ticket;
    expect(isTicketDeletable(ticket)).toBe(false);
  });

  it('returns true for INBOX ticket with no jobs', () => {
    const ticket = { id: 1, stage: 'INBOX', jobs: [] } as Ticket;
    expect(isTicketDeletable(ticket)).toBe(true);
  });
});
```

---

### Phase 2: API Endpoint (2 hours)
Server-side DELETE route with GitHub integration.

**File to Modify**:
- `app/api/projects/[projectId]/tickets/[id]/route.ts`

**Add DELETE Method**:
```typescript
export async function DELETE(
  request: Request,
  { params }: { params: { projectId: string; id: string } }
) {
  try {
    // 1. Parse and validate params
    const { projectId, id } = deleteTicketParamsSchema.parse(params);

    // 2. Authorization check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticket = await verifyTicketAccess(id);
    if (ticket.projectId !== projectId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Validate business rules
    if (ticket.stage === 'SHIP') {
      return NextResponse.json(
        { error: 'Cannot delete SHIP stage tickets', code: 'INVALID_STAGE' },
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
        { error: 'Cannot delete ticket while job is in progress', code: 'ACTIVE_JOB' },
        { status: 400 }
      );
    }

    // 4. GitHub cleanup (if branch exists)
    let prsClosed = 0;
    if (ticket.branch) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { githubOwner: true, githubRepo: true },
      });

      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

      const result = await deleteBranchAndPRs(
        octokit,
        project.githubOwner,
        project.githubRepo,
        ticket.branch
      );

      prsClosed = result.prsClosed;
    }

    // 5. Database deletion
    await prisma.ticket.delete({ where: { id: ticket.id } });

    return NextResponse.json({
      success: true,
      deleted: {
        ticketId: ticket.id,
        ticketKey: ticket.ticketKey,
        branch: ticket.branch,
        prsClosed,
      },
    });
  } catch (error) {
    console.error('Ticket deletion failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete ticket', code: 'GITHUB_API_ERROR' },
      { status: 500 }
    );
  }
}
```

**Zod Schema** (create `lib/schemas/ticket-delete.ts`):
```typescript
import { z } from 'zod';

export const deleteTicketParamsSchema = z.object({
  projectId: z.string().transform(Number).pipe(z.number().int().positive()),
  id: z.string().transform(Number).pipe(z.number().int().positive()),
});
```

**Testing (TDD Required)**:
- `tests/api/tickets-delete.spec.ts` (Playwright)
- Test all response codes: 200, 400 (SHIP), 400 (active job), 403, 404, 500

**Example Test**:
```typescript
test('DELETE /api/projects/:projectId/tickets/:id - success', async ({ request }) => {
  const ticket = await createTicket(request, {
    title: '[e2e] Test Ticket',
    stage: 'INBOX',
  });

  const response = await request.delete(`/api/projects/1/tickets/${ticket.id}`);
  expect(response.status()).toBe(200);

  const json = await response.json();
  expect(json.success).toBe(true);
  expect(json.deleted.ticketId).toBe(ticket.id);
});
```

---

### Phase 3: TanStack Query Mutation (1 hour)
Frontend mutation hook with optimistic updates.

**File to Create**:
- `lib/hooks/mutations/useDeleteTicket.ts`

**Implementation**:
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { Ticket } from '@prisma/client';

export function useDeleteTicket(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticketId: number) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/${ticketId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete ticket');
      }

      return response.json();
    },

    onMutate: async (ticketId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.tickets(projectId) });

      // Snapshot previous state
      const previousTickets = queryClient.getQueryData<Ticket[]>(
        queryKeys.tickets(projectId)
      );

      // Optimistically remove ticket
      queryClient.setQueryData<Ticket[]>(
        queryKeys.tickets(projectId),
        (old) => old?.filter((t) => t.id !== ticketId) ?? []
      );

      return { previousTickets };
    },

    onError: (error, ticketId, context) => {
      // Rollback on failure
      if (context?.previousTickets) {
        queryClient.setQueryData(
          queryKeys.tickets(projectId),
          context.previousTickets
        );
      }
    },

    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets(projectId) });
    },

    retry: false, // Don't retry GitHub API failures automatically
  });
}
```

**Testing**:
- Integration test in E2E test suite (verify optimistic update + rollback)

---

### Phase 4: UI Components (2-3 hours)
React components for trash zone and confirmation modal.

#### 4.1: Trash Zone Component

**File to Create**:
- `components/board/trash-zone.tsx`

**Implementation**:
```typescript
'use client';

import { useDroppable } from '@dnd-kit/core';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrashZoneProps {
  isVisible: boolean;
  isDisabled: boolean;
}

export function TrashZone({ isVisible, isDisabled }: TrashZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'trash-zone',
    disabled: isDisabled,
  });

  if (!isVisible) return null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 transition-all duration-200',
        'border-2 border-dashed rounded-lg p-4 bg-white shadow-lg z-50',
        'flex items-center gap-2',
        isOver && !isDisabled && 'border-red-500 bg-red-50',
        isDisabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <Trash2 className={cn('w-6 h-6', isOver && !isDisabled && 'text-red-500')} />
      <span className="font-medium">Delete Ticket</span>
    </div>
  );
}
```

#### 4.2: Confirmation Modal

**File to Create**:
- `components/board/delete-confirmation-modal.tsx`

**Implementation** (using shadcn/ui AlertDialog):
```typescript
'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getConfirmationMessage } from '@/lib/utils/stage-confirmation-messages';
import { Ticket } from '@prisma/client';

interface DeleteConfirmationModalProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteConfirmationModal({
  ticket,
  open,
  onOpenChange,
  onConfirm,
}: DeleteConfirmationModalProps) {
  if (!ticket) return null;

  const message = getConfirmationMessage(ticket);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Ticket?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              You are about to permanently delete <strong>{ticket.ticketKey}</strong>:{' '}
              {ticket.title}
            </p>
            <p className="text-sm text-muted-foreground">{message}</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

#### 4.3: Extend Board Component

**File to Modify**:
- `components/board/board.tsx`

**Key Changes**:
```typescript
'use client';

import { useState } from 'react';
import { DndContext, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { TrashZone } from './trash-zone';
import { DeleteConfirmationModal } from './delete-confirmation-modal';
import { useDeleteTicket } from '@/lib/hooks/mutations/useDeleteTicket';
import { isTicketDeletable } from '@/lib/utils/trash-zone-eligibility';

export function Board({ projectId }: { projectId: number }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<Ticket | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const deleteTicket = useDeleteTicket(projectId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Check if dropped on trash zone
    if (over.id === 'trash-zone') {
      const ticket = active.data.current?.ticket as Ticket;
      if (ticket && isTicketDeletable(ticket)) {
        setTicketToDelete(ticket);
        setConfirmModalOpen(true);
      }
      return;
    }

    // Existing stage transition logic...
  };

  const handleDeleteConfirm = () => {
    if (!ticketToDelete) return;

    deleteTicket.mutate(ticketToDelete.id, {
      onSuccess: () => {
        setConfirmModalOpen(false);
        setTicketToDelete(null);
      },
    });
  };

  // Determine if trash zone should be disabled
  const activeTicket = activeId
    ? tickets.find((t) => `ticket-${t.id}` === activeId)
    : null;
  const trashDisabled = activeTicket ? !isTicketDeletable(activeTicket) : false;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Existing board columns... */}

      <TrashZone
        isVisible={activeId !== null}
        isDisabled={trashDisabled}
      />

      <DeleteConfirmationModal
        ticket={ticketToDelete}
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        onConfirm={handleDeleteConfirm}
      />
    </DndContext>
  );
}
```

---

### Phase 5: E2E Testing (1-2 hours)
End-to-end tests for user flows.

**File to Extend**:
- `tests/e2e/board-drag-drop.spec.ts`

**New Test Cases**:
```typescript
test('drag INBOX ticket to trash → confirm → ticket deleted', async ({ page }) => {
  await page.goto('http://localhost:3000/projects/3/board');

  // Create test ticket
  const ticket = await createTicket({ title: '[e2e] Delete Me', stage: 'INBOX' });

  // Drag ticket to trash zone
  const ticketCard = page.locator(`[data-testid="ticket-${ticket.id}"]`);
  const trashZone = page.locator('[data-testid="trash-zone"]');

  await ticketCard.dragTo(trashZone);

  // Confirm deletion in modal
  await page.locator('button:has-text("Delete Permanently")').click();

  // Verify ticket no longer visible
  await expect(ticketCard).not.toBeVisible();
});

test('drag ticket with pending job → trash zone disabled', async ({ page }) => {
  await page.goto('http://localhost:3000/projects/3/board');

  const ticket = await createTicket({ title: '[e2e] With Job', stage: 'BUILD' });
  await createJob({ ticketId: ticket.id, status: 'PENDING' });

  const ticketCard = page.locator(`[data-testid="ticket-${ticket.id}"]`);
  await ticketCard.hover();

  // Verify tooltip shows "Cannot delete"
  await expect(page.locator('text=/cannot delete.*job/i')).toBeVisible();
});
```

---

## Common Pitfalls & Solutions

### Pitfall 1: Trash Zone Not Appearing
**Symptom**: Trash zone doesn't show when dragging tickets

**Solution**: Check `activeId` state in Board component
```typescript
// Ensure onDragStart sets activeId
const handleDragStart = (event: DragStartEvent) => {
  setActiveId(event.active.id as string); // ← Must be set
};

// TrashZone visibility depends on activeId
<TrashZone isVisible={activeId !== null} />
```

---

### Pitfall 2: Optimistic Update Not Rolling Back
**Symptom**: UI shows ticket deleted even when API fails

**Solution**: Verify `onError` restores snapshot
```typescript
onError: (error, ticketId, context) => {
  if (context?.previousTickets) {
    queryClient.setQueryData(
      queryKeys.tickets(projectId),
      context.previousTickets // ← Must restore full array
    );
  }
},
```

---

### Pitfall 3: GitHub API 404 Treated as Error
**Symptom**: Deletion fails when branch already deleted manually

**Solution**: Handle 404 as success (idempotent)
```typescript
try {
  await octokit.rest.git.deleteRef({ owner, repo, ref: `heads/${branch}` });
} catch (error) {
  if (error.status === 404) {
    // Branch already deleted, treat as success
    return { prsClosed: 0, branchDeleted: false };
  }
  throw error; // Re-throw other errors
}
```

---

### Pitfall 4: SHIP Tickets Can Be Dragged
**Symptom**: SHIP tickets show trash zone despite stage restriction

**Solution**: Check stage before showing trash zone
```typescript
const handleDragStart = (event: DragStartEvent) => {
  const ticket = event.active.data.current?.ticket as Ticket;
  if (ticket.stage === 'SHIP') {
    // Don't set activeId for SHIP tickets
    return;
  }
  setActiveId(event.active.id as string);
};
```

---

## Testing Checklist

Before marking implementation complete, verify:

### Unit Tests (Vitest)
- [ ] `trash-zone-eligibility.test.ts` - All scenarios (SHIP, active job, valid)
- [ ] `stage-confirmation-messages.test.ts` - All stages (INBOX, SPECIFY, PLAN, BUILD, VERIFY)

### API Contract Tests (Playwright)
- [ ] DELETE success (200) - INBOX ticket
- [ ] DELETE success (200) - Ticket with branch and PR
- [ ] DELETE rejected (400) - SHIP stage
- [ ] DELETE rejected (400) - Active job (PENDING/RUNNING)
- [ ] DELETE forbidden (403) - Wrong project
- [ ] DELETE not found (404) - Non-existent ticket

### E2E Tests (Playwright)
- [ ] Drag to trash → Confirm → Ticket deleted
- [ ] Drag to trash → Cancel → Ticket remains
- [ ] Drag with pending job → Trash disabled → Tooltip shown
- [ ] SHIP ticket drag → Trash zone not visible
- [ ] GitHub API failure → Ticket remains → Error toast

### Manual Testing
- [ ] Visual feedback: Trash zone appears on drag start
- [ ] Visual feedback: Red border on hover
- [ ] Confirmation modal shows correct stage-specific message
- [ ] Optimistic update: Ticket disappears immediately on confirm
- [ ] Rollback: Ticket reappears if GitHub API fails
- [ ] Performance: Trash zone appears within 100ms

---

## Performance Optimization Tips

### 1. Memoize Trash Zone Component
```typescript
export const TrashZone = React.memo(function TrashZone({ isVisible, isDisabled }) {
  // Component implementation...
});
```

### 2. Debounce GitHub API Calls (if rate limiting)
```typescript
// Unlikely needed for delete operations, but useful pattern:
import { debounce } from 'lodash';

const debouncedDelete = debounce(deleteBranchAndPRs, 500);
```

### 3. Prefetch Ticket Data for Modals
```typescript
// Already available via TanStack Query cache
const ticket = queryClient.getQueryData<Ticket>(['ticket', ticketId]);
// No additional API call needed for modal content
```

---

## Debugging Tips

### Enable Verbose Logging

**GitHub API Calls**:
```typescript
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  log: console, // Enable request/response logging
});
```

**TanStack Query Devtools**:
```typescript
// Already enabled in development
// Open browser devtools → TanStack Query tab
// View query cache, mutations, invalidations
```

### Simulate GitHub API Failures

**Local Testing**:
```typescript
// In lib/github/delete-branch-and-prs.ts
if (process.env.NODE_ENV === 'development') {
  throw new Error('Simulated GitHub API failure');
}
```

---

## Resources

### Documentation
- [@dnd-kit docs](https://docs.dndkit.com/)
- [TanStack Query docs](https://tanstack.com/query/latest)
- [Octokit REST API](https://octokit.github.io/rest.js/)
- [Prisma docs](https://www.prisma.io/docs)

### Existing Code References
- Board drag-and-drop: `components/board/board.tsx:45-120`
- Mutation pattern: `lib/hooks/mutations/useTransitionTicket.ts:12-50`
- Authorization: `lib/db/auth-helpers.ts:10-30`
- Job filtering: `lib/utils/job-filtering.ts:5-15`

### Spec Documents
- Feature spec: `specs/084-1500-drag-and/spec.md`
- Implementation plan: `specs/084-1500-drag-and/plan.md` (this document's parent)
- API contract: `specs/084-1500-drag-and/contracts/api-delete-ticket.md`
- Data model: `specs/084-1500-drag-and/data-model.md`
- Research notes: `specs/084-1500-drag-and/research.md`

---

## FAQ

### Q: Do I need to create a new table for trash/soft delete?
**A**: No. Deletion is permanent (hard delete). Prisma cascade handles related records.

### Q: What if GitHub token is missing in .env.local?
**A**: API will return 500 error. Set `GITHUB_TOKEN=ghp_...` in `.env.local` for local dev.

### Q: Can I test without a real GitHub repository?
**A**: For API tests, you can mock Octokit. For E2E, use a test repository or skip GitHub tests.

### Q: How do I handle multiple PRs with the same branch?
**A**: The `deleteBranchAndPRs` function loops through all PRs returned by the list query.

### Q: Should I add an undo feature?
**A**: Not in scope for this feature. Deletion is permanent. Consider future enhancement.

---

## Next Steps After Implementation

1. **Code Review**: Submit PR with all tests passing
2. **Manual QA**: Test on staging environment with real GitHub repo
3. **Performance Testing**: Verify <100ms trash zone appearance
4. **Documentation Update**: Update CLAUDE.md with new mutation pattern (if novel)
5. **Analytics**: Consider adding telemetry for deletion operations (future)

---

## Summary

**Implementation Order**:
1. Utilities + Unit Tests (1 hour)
2. API Endpoint + API Tests (2 hours)
3. Mutation Hook (1 hour)
4. UI Components (2-3 hours)
5. E2E Tests (1-2 hours)

**Total Estimate**: 6-8 hours (with TDD approach)

**Key Success Metrics**:
- All tests pass (unit + API + E2E)
- Trash zone appears within 100ms
- Deletion completes in <10s (including GitHub cleanup)
- Optimistic updates feel instant (<50ms perceived latency)
- Zero orphaned branches/PRs after successful deletion

**Ready to Start?** Begin with Phase 1 (utilities + unit tests) and follow the TDD approach: write tests first, implement functions second.
