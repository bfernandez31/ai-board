# Quickstart: Quick Workflow Rollback Implementation

**Feature Branch**: `051-897-rollback-quick`
**Date**: 2025-10-24

## Implementation Overview

This quickstart provides the step-by-step implementation guide for adding rollback functionality to the AI Board. Implementation follows TDD principles with hybrid Vitest + Playwright testing.

---

## Prerequisites

- Read `spec.md` (functional requirements)
- Read `research.md` (technical decisions)
- Read `data-model.md` (entity relationships)
- Read `contracts/rollback-api.md` (API contract)

---

## Implementation Steps

### Step 1: Create Rollback Validation Utility (TDD)

**File**: `app/lib/workflows/rollback-validator.ts`

**Test First** (Vitest unit test):

1. Create `tests/unit/rollback-validator.test.ts`
2. Write failing tests for:
   - ✅ Valid rollback (BUILD → INBOX, FAILED job)
   - ✅ Valid rollback (BUILD → INBOX, CANCELLED job)
   - ❌ Invalid stage (SPECIFY → INBOX)
   - ❌ Invalid target (BUILD → VERIFY)
   - ❌ No job found
   - ❌ RUNNING job (blocked)
   - ❌ COMPLETED job (blocked)
   - ❌ PENDING job (blocked)

**Command**: `bun run test:unit tests/unit/rollback-validator.test.ts`

**Then Implement**:

```typescript
// app/lib/workflows/rollback-validator.ts
import { Stage, JobStatus } from '@prisma/client';

export type RollbackValidation = {
  allowed: boolean;
  reason?: string;
};

export type Job = {
  id: number;
  status: JobStatus;
  command: string;
};

export function canRollbackToInbox(
  currentStage: Stage,
  targetStage: Stage,
  mostRecentWorkflowJob: Job | null
): RollbackValidation {
  // Rule 1: Only BUILD → INBOX transitions
  if (currentStage !== 'BUILD' || targetStage !== 'INBOX') {
    return {
      allowed: false,
      reason: 'Rollback only available from BUILD to INBOX stage',
    };
  }

  // Rule 2: Must have a workflow job
  if (!mostRecentWorkflowJob) {
    return {
      allowed: false,
      reason: 'No workflow job found for this ticket',
    };
  }

  // Rule 3: Job must be FAILED or CANCELLED
  const allowedStatuses: JobStatus[] = ['FAILED', 'CANCELLED'];
  if (!allowedStatuses.includes(mostRecentWorkflowJob.status)) {
    if (mostRecentWorkflowJob.status === 'RUNNING') {
      return {
        allowed: false,
        reason: 'Cannot rollback: workflow is still running. Wait for completion or cancel the job.',
      };
    }
    if (mostRecentWorkflowJob.status === 'COMPLETED') {
      return {
        allowed: false,
        reason: 'Cannot rollback: workflow completed successfully. Rollback only available for failed or cancelled jobs.',
      };
    }
    if (mostRecentWorkflowJob.status === 'PENDING') {
      return {
        allowed: false,
        reason: 'Cannot rollback: workflow is pending. Wait for completion or cancel the job.',
      };
    }
    return {
      allowed: false,
      reason: 'Cannot rollback: invalid job status',
    };
  }

  return { allowed: true };
}
```

**Verify**: `bun run test:unit` (all tests pass)

---

### Step 2: Update Transition API Endpoint (TDD)

**File**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`

**Search for Existing Tests**:

```bash
npx grep -r "transition" tests/api/
npx glob "tests/api/*transition*.spec.ts"
```

**Test First** (Playwright API contract test):

1. Find or create `tests/api/rollback-transition.spec.ts`
2. Write failing tests for:
   - ✅ Successful rollback (BUILD → INBOX, FAILED job)
   - ✅ Successful rollback (BUILD → INBOX, CANCELLED job)
   - ❌ Blocked rollback (RUNNING job) → 400 error
   - ❌ Blocked rollback (COMPLETED job) → 400 error
   - ❌ Blocked rollback (PENDING job) → 400 error
   - ❌ Invalid stage (SPECIFY → INBOX) → 400 error
   - ❌ Unauthorized request → 401 error
   - ❌ Forbidden request (wrong project owner) → 403 error

**Command**: `bun run test:e2e tests/api/rollback-transition.spec.ts`

**Then Implement**:

```typescript
// app/api/projects/[projectId]/tickets/[id]/transition/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/app/lib/db/prisma';
import { canRollbackToInbox } from '@/app/lib/workflows/rollback-validator';
import { z } from 'zod';

const TransitionRequestSchema = z.object({
  targetStage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; id: string } }
) {
  try {
    // 1. Authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate request
    const body = await request.json();
    const { targetStage } = TransitionRequestSchema.parse(body);

    const projectId = parseInt(params.projectId, 10);
    const ticketId = parseInt(params.id, 10);

    // 3. Authorization + Ticket fetch
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        projectId,
        project: { user: { email: session.user.email } },
      },
      include: {
        jobs: {
          where: { command: { not: { startsWith: 'comment-' } } },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // 4. Rollback validation (BUILD → INBOX only)
    const isRollbackAttempt = ticket.stage === 'BUILD' && targetStage === 'INBOX';

    if (isRollbackAttempt) {
      const mostRecentJob = ticket.jobs[0] || null;
      const validation = canRollbackToInbox(ticket.stage, targetStage, mostRecentJob);

      if (!validation.allowed) {
        return NextResponse.json({ error: validation.reason }, { status: 400 });
      }

      // 5. Execute rollback transaction
      const updatedTicket = await prisma.$transaction(async (tx) => {
        // Update ticket state
        const updated = await tx.ticket.update({
          where: { id: ticketId },
          data: {
            stage: 'INBOX',
            workflowType: 'FULL',
            branch: null,
            version: 1,
          },
        });

        // Delete failed/cancelled job
        if (mostRecentJob) {
          await tx.job.delete({ where: { id: mostRecentJob.id } });
        }

        return updated;
      });

      return NextResponse.json({
        id: updatedTicket.id,
        stage: updatedTicket.stage,
        workflowType: updatedTicket.workflowType,
        branch: updatedTicket.branch,
        version: updatedTicket.version,
        updatedAt: updatedTicket.updatedAt.toISOString(),
      });
    }

    // 6. Handle normal transitions (existing logic)
    // ... existing transition logic for other stage changes ...

  } catch (error) {
    console.error('Transition error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Verify**: `bun run test:e2e tests/api/rollback-transition.spec.ts` (all tests pass)

---

### Step 3: Update Board Component (TDD)

**File**: `components/board/board.tsx`

**Search for Existing Tests**:

```bash
npx grep -r "drag.*drop" tests/e2e/
npx glob "tests/e2e/*board*.spec.ts"
```

**Test First** (Playwright E2E test):

1. Find or create `tests/e2e/rollback-quick-impl.spec.ts`
2. Write failing tests for:
   - ✅ Drag BUILD ticket with FAILED job to INBOX → success
   - ✅ Drag BUILD ticket with CANCELLED job to INBOX → success
   - ❌ Drag BUILD ticket with RUNNING job to INBOX → blocked (visual feedback)
   - ❌ Drag BUILD ticket with COMPLETED job to INBOX → blocked (visual feedback)
   - ✅ After rollback, ticket can transition to SPECIFY (normal workflow)
   - ✅ After rollback, ticket can transition to BUILD (quick-impl workflow)

**Command**: `bun run test:e2e tests/e2e/rollback-quick-impl.spec.ts`

**Then Implement**:

```typescript
// components/board/board.tsx (extend existing file)

import { canRollbackToInbox } from '@/app/lib/workflows/rollback-validator';

// Inside Board component
function Board({ projectId }: { projectId: number }) {
  const { tickets } = useTickets(projectId);
  const { jobs } = useJobPolling(projectId);

  // Existing drag-and-drop logic...

  // NEW: Rollback visual feedback
  const getRollbackFeedback = (ticket: Ticket) => {
    if (ticket.stage !== 'BUILD') return null;

    // Find most recent workflow job
    const workflowJobs = jobs.filter(
      (job) => job.ticketId === ticket.id && !job.command.startsWith('comment-')
    );
    const mostRecentJob = workflowJobs.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )[0] || null;

    const validation = canRollbackToInbox('BUILD', 'INBOX', mostRecentJob);

    if (validation.allowed) {
      return 'border-amber-500 bg-amber-500/10 border-dashed border-2'; // Rollback eligible
    }
    return 'opacity-50 cursor-not-allowed'; // Blocked
  };

  return (
    <div className="board">
      {/* Existing columns */}
      <Column stage="INBOX">
        {/* When dragging BUILD ticket over INBOX, show rollback feedback */}
        {draggedTicket?.stage === 'BUILD' && (
          <div className={getRollbackFeedback(draggedTicket)}>
            Drop here to rollback
          </div>
        )}
      </Column>
      {/* Other columns */}
    </div>
  );
}
```

**Verify**: `bun run test:e2e tests/e2e/rollback-quick-impl.spec.ts` (all tests pass)

---

### Step 4: Update TanStack Query Mutations

**File**: `app/lib/hooks/mutations/useTransitionTicket.ts`

**Search for Existing Patterns**:

```bash
npx grep -r "useMutation" app/lib/hooks/mutations/
npx glob "app/lib/hooks/mutations/use*.ts"
```

**Implementation** (no new mutation hook needed, reuse existing):

```typescript
// app/lib/hooks/mutations/useTransitionTicket.ts (existing file)

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export function useTransitionTicket(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketId, targetStage }: { ticketId: number; targetStage: Stage }) => {
      const response = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStage }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transition failed');
      }

      return response.json();
    },

    // Optimistic update (existing pattern)
    onMutate: async ({ ticketId, targetStage }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tickets(projectId) });

      const previousTickets = queryClient.getQueryData(queryKeys.tickets(projectId));

      queryClient.setQueryData(queryKeys.tickets(projectId), (old: Ticket[]) =>
        old.map((ticket) =>
          ticket.id === ticketId
            ? { ...ticket, stage: targetStage }
            : ticket
        )
      );

      return { previousTickets };
    },

    // Rollback on error (existing pattern)
    onError: (err, variables, context) => {
      if (context?.previousTickets) {
        queryClient.setQueryData(queryKeys.tickets(projectId), context.previousTickets);
      }
    },

    // Refetch on success (existing pattern)
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs(projectId) });
    },
  });
}
```

**Note**: No new mutation hook needed. Rollback reuses existing transition mutation. Optimistic update handles rollback case automatically.

---

## Testing Checklist

### Unit Tests (Vitest)

- [ ] `canRollbackToInbox()` validation logic (8 test cases)
  - Run: `bun run test:unit tests/unit/rollback-validator.test.ts`

### API Contract Tests (Playwright)

- [ ] Rollback transition endpoint (8 test cases)
  - Run: `bun run test:e2e tests/api/rollback-transition.spec.ts`

### E2E Tests (Playwright)

- [ ] Drag-and-drop rollback workflow (6 test cases)
  - Run: `bun run test:e2e tests/e2e/rollback-quick-impl.spec.ts`

### Full Test Suite

- [ ] All tests pass
  - Run: `bun test` (runs unit + E2E tests)

---

## Manual Testing Checklist

1. [ ] Start dev server: `bun run dev`
2. [ ] Create ticket and transition to BUILD via quick-impl
3. [ ] Simulate job failure (manually update job status to FAILED in database)
4. [ ] Drag ticket from BUILD to INBOX → success (amber border feedback)
5. [ ] Verify ticket state: stage=INBOX, workflowType=FULL, branch=null, version=1
6. [ ] Verify failed job is deleted
7. [ ] Transition rolled-back ticket to SPECIFY → success (normal workflow)
8. [ ] Transition rolled-back ticket to BUILD → success (quick-impl workflow)

---

## Performance Validation

- [ ] API response time <200ms (use browser DevTools Network tab)
- [ ] Visual feedback appears <100ms after drag start
- [ ] Total rollback transaction <3s (API + UI update)

---

## Files Modified/Created

**Created**:
- `app/lib/workflows/rollback-validator.ts` (validation logic)
- `tests/unit/rollback-validator.test.ts` (unit tests)
- `tests/api/rollback-transition.spec.ts` (API contract tests)
- `tests/e2e/rollback-quick-impl.spec.ts` (E2E tests)

**Modified**:
- `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` (add rollback logic)
- `components/board/board.tsx` (add visual feedback)
- `app/lib/hooks/mutations/useTransitionTicket.ts` (no changes, reuse existing)

**No Schema Changes**: All fields already exist in database

---

## Rollout Plan

1. **Develop**: Implement on feature branch `051-897-rollback-quick`
2. **Test**: Run full test suite (`bun test`)
3. **Review**: Submit PR for code review
4. **Deploy**: Merge to main → auto-deploy to Vercel
5. **Monitor**: Check error logs for rollback validation failures
6. **Document**: Update user-facing docs with rollback instructions

---

## Success Criteria Verification

After deployment, verify:

- [ ] SC-001: Rollback completes within 3 seconds
- [ ] SC-002: Rollback validation <200ms API response time
- [ ] SC-003: 100% of rollbacks correctly reset state (workflowType, branch, version, job deletion)
- [ ] SC-004: 100% of invalid rollbacks blocked with clear error messages
- [ ] SC-005: Post-rollback tickets can transition through both workflow paths
- [ ] SC-006: Only workflow jobs deleted (AI-BOARD jobs preserved)
- [ ] SC-007: Visual feedback appears within 100ms of drag start

---

## Known Limitations

1. **Manual Git Branch Cleanup**: Rollback sets branch field to `null` but does not delete the Git branch. Users must manually delete abandoned branches via `git branch -D {branch-name}`.

2. **Failed Job Logs**: After rollback, failed job information is no longer in the database. Users must check GitHub Actions logs for failure details.

3. **BUILD-Only Rollback**: Currently only supports rollback from BUILD stage. Future enhancement could extend to SPECIFY/PLAN stages if needed.

---

## Next Steps After Implementation

1. Monitor rollback usage metrics (how often users roll back vs retry)
2. Gather user feedback on rollback UX
3. Consider extending rollback to other stages (SPECIFY → INBOX, PLAN → SPECIFY)
4. Consider automated Git branch cleanup on rollback
5. Consider preserving failed job logs in separate audit table
