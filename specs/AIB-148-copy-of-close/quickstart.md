# Quickstart: Close Ticket Feature

**Feature**: AIB-148-copy-of-close
**Date**: 2026-01-06

## Implementation Order

Execute in this order to maintain working state throughout implementation:

### Phase 1: Database & Core Logic

#### 1.1 Prisma Schema Update

**File**: `prisma/schema.prisma`

Add CLOSED to Stage enum:
```prisma
enum Stage {
  INBOX
  SPECIFY
  PLAN
  BUILD
  VERIFY
  SHIP
  CLOSED  // Add this line
}
```

Add closedAt field to Ticket model:
```prisma
model Ticket {
  // ... existing fields
  closedAt    DateTime?  // Add this field
}
```

**Run migration**:
```bash
bunx prisma migrate dev --name add_closed_stage
bunx prisma generate
```

#### 1.2 Stage Transitions Update

**File**: `lib/stage-transitions.ts`

Add CLOSED to Stage enum:
```typescript
export enum Stage {
  // ... existing values
  CLOSED = 'CLOSED',
}
```

Update `isTerminalStage()`:
```typescript
export function isTerminalStage(stage: Stage): boolean {
  return stage === Stage.SHIP || stage === Stage.CLOSED;
}
```

Update `isValidTransition()` - add VERIFY → CLOSED case:
```typescript
// Special case: VERIFY → CLOSED (close operation)
if (fromStage === Stage.VERIFY && toStage === Stage.CLOSED) {
  return true;
}
```

Note: Do NOT add CLOSED to `STAGE_ORDER` array (not part of normal progression).

---

### Phase 2: GitHub Integration

#### 2.1 PR Close Function

**File**: `lib/github/close-prs.ts` (NEW)

```typescript
import { Octokit } from '@octokit/rest';

export interface ClosePRsResult {
  prsClosed: number;
  prsAlreadyClosed: number;
}

/**
 * Closes all open PRs for a branch with explanatory comment
 * Does NOT delete the branch (preserves for reference)
 */
export async function closePRsForBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchName: string,
  comment: string
): Promise<ClosePRsResult> {
  // Find all open PRs with matching head branch
  const { data: prs } = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${branchName}`,
    state: 'open',
  });

  let prsClosed = 0;
  let prsAlreadyClosed = 0;

  // Close each PR with comment
  for (const pr of prs) {
    try {
      // Add explanatory comment
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pr.number,
        body: comment,
      });

      // Close the PR
      await octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: pr.number,
        state: 'closed',
      });

      prsClosed++;
    } catch (error: any) {
      if (error.status === 404 || error.status === 422) {
        // PR already closed or not found - idempotent
        prsAlreadyClosed++;
      } else {
        throw error;
      }
    }
  }

  return { prsClosed, prsAlreadyClosed };
}
```

---

### Phase 3: Close API Endpoint

#### 3.1 Close Endpoint

**File**: `app/api/projects/[projectId]/tickets/[id]/close/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyTicketAccess } from '@/lib/auth/project-access';
import { Stage } from '@/lib/stage-transitions';
import { closePRsForBranch } from '@/lib/github/close-prs';
import { Octokit } from '@octokit/rest';
import { isCleanupLockActive } from '@/lib/transition-lock';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; id: string }> }
) {
  try {
    const { projectId, id } = await params;
    const ticketId = parseInt(id, 10);
    const projId = parseInt(projectId, 10);

    // Authorization
    await verifyTicketAccess(ticketId);

    // Check cleanup lock
    const lockActive = await isCleanupLockActive(projId);
    if (lockActive) {
      return NextResponse.json(
        { error: 'Project cleanup is in progress. Please wait for it to complete.', code: 'CLEANUP_LOCKED' },
        { status: 423 }
      );
    }

    // Get ticket with project and jobs
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        project: true,
        jobs: {
          where: { status: { in: ['PENDING', 'RUNNING'] } },
          take: 1,
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Validate stage
    if (ticket.stage !== Stage.VERIFY) {
      return NextResponse.json(
        { error: 'Can only close tickets in VERIFY stage', code: 'INVALID_STAGE' },
        { status: 400 }
      );
    }

    // Check for active jobs
    if (ticket.jobs.length > 0) {
      return NextResponse.json(
        { error: 'Cannot close ticket with active jobs', code: 'ACTIVE_JOBS' },
        { status: 400 }
      );
    }

    // Close GitHub PRs (best-effort)
    let prsClosed = 0;
    if (ticket.branch && ticket.project.githubOwner && ticket.project.githubRepo) {
      try {
        const token = process.env.GITHUB_TOKEN;
        if (token) {
          const octokit = new Octokit({ auth: token });
          const result = await closePRsForBranch(
            octokit,
            ticket.project.githubOwner,
            ticket.project.githubRepo,
            ticket.branch,
            `Closed by ai-board - ticket ${ticket.ticketKey} moved to CLOSED state`
          );
          prsClosed = result.prsClosed;
        }
      } catch (error) {
        console.error('GitHub PR close failed (non-blocking):', error);
        // Continue with local transition even if GitHub fails
      }
    }

    // Update ticket to CLOSED
    const closedTicket = await prisma.ticket.update({
      where: { id: ticketId, version: ticket.version },
      data: {
        stage: Stage.CLOSED,
        closedAt: new Date(),
        version: { increment: 1 },
      },
    });

    return NextResponse.json({
      id: closedTicket.id,
      ticketKey: ticket.ticketKey,
      stage: closedTicket.stage,
      closedAt: closedTicket.closedAt?.toISOString(),
      version: closedTicket.version,
      prsClosed,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      // Version conflict
      return NextResponse.json(
        { error: 'Ticket was modified by another user. Please refresh and try again.', code: 'VERSION_CONFLICT' },
        { status: 409 }
      );
    }
    console.error('Close ticket error:', error);
    return NextResponse.json({ error: 'Failed to close ticket' }, { status: 500 });
  }
}
```

---

### Phase 4: UI Components

#### 4.1 Close Confirmation Modal

**File**: `components/board/close-confirmation-modal.tsx` (NEW)

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
import { Archive } from 'lucide-react';

interface CloseConfirmationModalProps {
  ticketKey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isClosing?: boolean;
}

export function CloseConfirmationModal({
  ticketKey,
  open,
  onOpenChange,
  onConfirm,
  isClosing = false,
}: CloseConfirmationModalProps) {
  if (!ticketKey) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="close-confirmation-modal">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-red-500" />
            Close Ticket {ticketKey}?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              This will close the ticket without shipping it.
            </span>
            <span className="block text-sm text-muted-foreground">
              - Associated GitHub PR(s) will be closed
              <br />
              - Git branch will be preserved for reference
              <br />
              - Ticket will be removed from the board but remains searchable
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isClosing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isClosing}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            data-testid="close-confirm-button"
          >
            {isClosing ? 'Closing...' : 'Close Ticket'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

#### 4.2 Board Modifications

**File**: `components/board/board.tsx`

Key changes:
1. Import CloseConfirmationModal
2. Add `pendingCloseTransition` state
3. Modify `getDropZoneStyle()` for SHIP column dual zones
4. Add `handleDragEnd` logic for close zone detection
5. Add `handleCloseConfirm` callback
6. Render CloseConfirmationModal

See tasks.md for detailed line-by-line changes.

#### 4.3 Stage Column Modifications

**File**: `components/board/stage-column.tsx`

Filter out CLOSED tickets from column rendering:
```typescript
const columnTickets = tickets.filter(
  (t) => t.stage === stage && t.stage !== 'CLOSED'
);
```

#### 4.4 Search Result Styling

**File**: `components/search/ticket-search.tsx`

Add styling for closed tickets in results:
```typescript
const isClosedTicket = result.stage === 'CLOSED';

// In result rendering
<div className={cn(
  'result-item',
  isClosedTicket && 'opacity-60 text-gray-500'
)}>
  {isClosedTicket && (
    <Badge variant="outline" className="bg-gray-100 text-gray-600">
      Closed
    </Badge>
  )}
  {/* ... rest of result */}
</div>
```

#### 4.5 Ticket Detail Modal Read-Only

**File**: `components/board/ticket-detail-modal.tsx`

Add read-only mode for CLOSED:
```typescript
const isClosedStage = ticket.stage === 'CLOSED';

// Disable all edit controls when closed
{!isClosedStage && (
  <EditableField ... />
)}

// Show read-only indicator
{isClosedStage && (
  <div className="text-sm text-muted-foreground">
    This ticket is closed and read-only.
  </div>
)}
```

---

### Phase 5: Testing

#### 5.1 RTL Component Test

**File**: `tests/unit/components/close-confirmation-modal.test.tsx`

Test cases:
- Renders modal with ticket key
- Shows warning message about PR closure
- Cancel button closes modal
- Confirm button triggers onConfirm
- Loading state disables buttons

#### 5.2 Integration Test

**File**: `tests/integration/tickets/close.test.ts`

Test cases:
- Close ticket from VERIFY stage (success)
- Reject close from non-VERIFY stage (400)
- Reject close with active jobs (400)
- Reject close during cleanup lock (423)
- Handle version conflict (409)

#### 5.3 E2E Test

**File**: `tests/e2e/ticket-close.spec.ts`

Test cases:
- Drag VERIFY ticket to SHIP column Close zone
- Confirm modal appears with correct content
- Cancel returns ticket to VERIFY
- Confirm closes ticket (disappears from board)
- Search finds closed ticket with muted styling

---

## Verification Checklist

- [ ] Prisma migration runs successfully
- [ ] CLOSED stage added to Stage enum
- [ ] closedAt field added to Ticket model
- [ ] isTerminalStage returns true for CLOSED
- [ ] isValidTransition allows VERIFY → CLOSED
- [ ] Close API endpoint validates correctly
- [ ] GitHub PRs closed with comment
- [ ] Branch preserved (not deleted)
- [ ] Close modal appears on Close zone drop
- [ ] CLOSED tickets excluded from board columns
- [ ] CLOSED tickets appear in search with muted styling
- [ ] Ticket detail modal read-only for CLOSED
- [ ] All tests pass
