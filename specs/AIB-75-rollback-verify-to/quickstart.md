# Quickstart: Rollback VERIFY to PLAN

**Feature**: AIB-75 | **Date**: 2025-11-23

## Overview

This guide provides step-by-step instructions for implementing the VERIFY to PLAN rollback feature following Test-Driven Development.

---

## Prerequisites

- Node.js 22.20.0+
- PostgreSQL 14+ running locally
- Project dependencies installed (`bun install`)
- Understanding of existing BUILD→INBOX rollback pattern

---

## Implementation Order

### 1. Validator (TDD)

**Location**: `lib/workflows/rollback-validator.ts`

**Step 1**: Write failing test
```typescript
// tests/unit/rollback-validator.test.ts
import { describe, it, expect } from 'vitest';
import { canRollbackToPlan } from '@/lib/workflows/rollback-validator';

describe('canRollbackToPlan', () => {
  it('allows rollback for FULL workflow with COMPLETED job', () => {
    const result = canRollbackToPlan(
      'VERIFY',
      'PLAN',
      'FULL',
      { status: 'COMPLETED', command: 'verify' }
    );
    expect(result.allowed).toBe(true);
  });

  it('blocks rollback for QUICK workflow', () => {
    const result = canRollbackToPlan('VERIFY', 'PLAN', 'QUICK', null);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('QUICK');
  });
});
```

**Step 2**: Implement validator
```typescript
// lib/workflows/rollback-validator.ts (add to existing file)
export function canRollbackToPlan(
  currentStage: Stage,
  targetStage: Stage,
  workflowType: WorkflowType,
  mostRecentWorkflowJob: Job | null
): RollbackValidation {
  // Rule 1: Only VERIFY → PLAN
  if (currentStage !== 'VERIFY' || targetStage !== 'PLAN') {
    return { allowed: false, reason: 'Rollback only from VERIFY to PLAN' };
  }

  // Rule 2: Only FULL workflows
  if (workflowType !== 'FULL') {
    return { allowed: false, reason: 'Rollback not available for QUICK or CLEAN workflows' };
  }

  // Rule 3: Must have a workflow job
  if (!mostRecentWorkflowJob) {
    return { allowed: false, reason: 'No workflow job found' };
  }

  // Rule 4: Job must be terminal state
  const terminalStates = ['COMPLETED', 'FAILED', 'CANCELLED'];
  if (!terminalStates.includes(mostRecentWorkflowJob.status)) {
    return { allowed: false, reason: 'Cannot rollback while workflow is running' };
  }

  return { allowed: true };
}
```

**Run tests**: `bun run test:unit rollback-validator`

---

### 2. Stage Transitions

**Location**: `lib/stage-transitions.ts`

**Update** `isValidTransition()` to recognize VERIFY→PLAN:

```typescript
// Add after existing transitions
if (fromStage === 'VERIFY' && toStage === 'PLAN' && workflowType === 'FULL') {
  return true; // Validated fully in API route
}
```

---

### 3. API Route

**Location**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`

**Add** rollback handling after existing BUILD→INBOX logic:

```typescript
// Detect VERIFY → PLAN rollback
const isVerifyToPlanRollback = ticket.stage === 'VERIFY' && targetStage === 'PLAN';

if (isVerifyToPlanRollback) {
  const validation = canRollbackToPlan(
    ticket.stage,
    targetStage as Stage,
    ticket.workflowType,
    mostRecentJob
  );

  if (!validation.allowed) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  const updatedTicket = await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        stage: 'PLAN',
        previewUrl: null,  // Clear preview
        version: { increment: 1 },
      },
    });

    if (mostRecentJob) {
      await tx.job.delete({
        where: { id: mostRecentJob.id },
      });
    }

    return updated;
  });

  return NextResponse.json(updatedTicket);
}
```

---

### 4. Confirmation Modal

**Location**: `components/board/rollback-verify-modal.tsx`

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
import { AlertTriangle } from 'lucide-react';

interface RollbackVerifyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  ticketKey: string;
  hasPreviewUrl: boolean;
  isLoading?: boolean;
}

export function RollbackVerifyModal({
  open,
  onOpenChange,
  onConfirm,
  ticketKey,
  hasPreviewUrl,
  isLoading = false,
}: RollbackVerifyModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Rollback to Plan?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Rolling back <strong>{ticketKey}</strong> will:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Reset implementation code changes</li>
                {hasPreviewUrl && <li>Remove preview deployment</li>}
                <li>Delete the verification job record</li>
              </ul>
              <p className="text-sm">
                <strong>Preserved:</strong> Specification files and branch name
              </p>
              <p className="text-sm text-amber-600">
                This action cannot be undone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isLoading ? 'Rolling back...' : 'Confirm Rollback'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

### 5. Board Integration

**Location**: `components/board/board.tsx`

**Add state for pending rollback**:
```typescript
const [pendingVerifyRollback, setPendingVerifyRollback] = useState<{
  ticket: TicketWithVersion;
} | null>(null);
```

**Update handleDragEnd**:
```typescript
// Detect VERIFY → PLAN rollback
if (ticket.stage === Stage.VERIFY && targetStage === Stage.PLAN) {
  if (ticket.workflowType !== 'FULL') {
    toast({ variant: 'destructive', title: 'Rollback not available for this workflow type' });
    return;
  }
  setPendingVerifyRollback({ ticket });
  return;
}
```

**Add modal and handler**:
```typescript
<RollbackVerifyModal
  open={!!pendingVerifyRollback}
  onOpenChange={(open) => !open && setPendingVerifyRollback(null)}
  onConfirm={handleVerifyRollbackConfirm}
  ticketKey={pendingVerifyRollback?.ticket.ticketKey ?? ''}
  hasPreviewUrl={!!pendingVerifyRollback?.ticket.previewUrl}
/>
```

---

### 6. Visual Feedback

**Location**: `components/board/stage-column.tsx`

Add rollback styling detection:
```typescript
const isRollbackDropZone =
  stage === Stage.PLAN &&
  draggedTicket?.stage === Stage.VERIFY &&
  draggedTicket?.workflowType === 'FULL';

// Apply amber dashed border when isRollbackDropZone
```

---

## Testing Commands

```bash
# Unit tests (validators)
bun run test:unit

# Integration tests
bun run test:e2e -- --grep "verify.*rollback"

# All tests
bun run test
```

---

## Verification Checklist

- [ ] Validator tests pass (canRollbackToPlan)
- [ ] API returns 400 for invalid rollback attempts
- [ ] API returns 200 and updates ticket correctly
- [ ] Modal appears on VERIFY→PLAN drag
- [ ] Modal shows preview URL warning when applicable
- [ ] Cancel closes modal without changes
- [ ] Confirm executes rollback
- [ ] Toast confirms success
- [ ] PreviewUrl is cleared
- [ ] Job record is deleted
- [ ] Ticket version is incremented
- [ ] Visual feedback shows amber border on PLAN column
