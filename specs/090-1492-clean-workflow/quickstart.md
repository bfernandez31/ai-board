# Quickstart: Clean Workflow Implementation

**Feature**: Clean Workflow
**Branch**: 090-1492-clean-workflow
**Estimated Effort**: 8-12 hours
**Priority**: P1

## Overview

This guide provides a step-by-step quickstart for implementing the Clean Workflow feature. Follow these steps in order for efficient implementation.

---

## Prerequisites

- [ ] Read `spec.md` (feature requirements)
- [ ] Read `plan.md` (implementation plan)
- [ ] Read `research.md` (design decisions)
- [ ] Read `data-model.md` (schema changes)
- [ ] Review existing workflows: `speckit.yml`, `quick-impl.yml`

---

## Implementation Phases

### Phase 1: Database Schema (1 hour)

**Goal**: Add CLEAN workflow type and cleanup lock mechanism

#### 1.1 Update Prisma Schema

**File**: `prisma/schema.prisma`

```prisma
// Add to WorkflowType enum (around line 197)
enum WorkflowType {
  FULL
  QUICK
  CLEAN  // NEW
}

// Add to Project model (around line 51-70)
model Project {
  // ... existing fields ...
  activeCleanupJobId Int? // NEW - nullable FK to Job
  // ... rest of fields ...

  @@index([activeCleanupJobId]) // NEW index
}
```

#### 1.2 Create Migration

```bash
npx prisma migrate dev --name add_cleanup_workflow
```

**Expected output**:
- Migration file created in `prisma/migrations/`
- Database updated with new field and enum value
- Prisma Client regenerated

#### 1.3 Verify Migration

```bash
npx prisma studio
```

- Navigate to Project model
- Verify `activeCleanupJobId` field exists (nullable)
- Verify WorkflowType enum has CLEAN value

**Testing**: Run existing tests to ensure no regressions
```bash
bun run test:unit
```

---

### Phase 2: Backend APIs (3-4 hours)

**Goal**: Create cleanup trigger API and update transition lock checking

#### 2.1 Create Utility Functions

**File**: `lib/db/shipped-branches.ts` (NEW)

```typescript
import { prisma } from './client';

export async function getLastCleanupDate(projectId: number): Promise<Date> {
  const lastCleanTicket = await prisma.ticket.findFirst({
    where: {
      projectId,
      workflowType: 'CLEAN',
      stage: { in: ['BUILD', 'VERIFY', 'SHIP'] }
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true }
  });

  return lastCleanTicket?.createdAt || new Date(0);
}

export async function getShippedBranchesSinceLastClean(
  projectId: number,
  lastCleanDate: Date
): Promise<{ branch: string; ticketKey: string; title: string }[]> {
  const tickets = await prisma.ticket.findMany({
    where: {
      projectId,
      stage: 'SHIP',
      updatedAt: { gt: lastCleanDate },
      branch: { not: null }
    },
    select: { branch: true, ticketKey: true, title: true },
    orderBy: { updatedAt: 'desc' }
  });

  return tickets.filter(t => t.branch !== null);
}
```

**Testing**: Create unit test
```typescript
// tests/unit/shipped-branches.test.ts
import { describe, it, expect } from 'vitest';
import { getLastCleanupDate } from '@/lib/db/shipped-branches';

describe('getLastCleanupDate', () => {
  it('returns epoch for first cleanup', async () => {
    const date = await getLastCleanupDate(999);
    expect(date).toEqual(new Date(0));
  });
});
```

#### 2.2 Create Cleanup Trigger API

**File**: `app/api/projects/[projectId]/clean/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/auth';
import { getLastCleanupDate, getShippedBranchesSinceLastClean } from '@/lib/db/shipped-branches';
import { z } from 'zod';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const projectId = parseInt((await context.params).projectId);

  // Authorization
  await verifyProjectAccess(projectId);

  // Check for existing cleanup
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { activeCleanupJobId: true, key: true }
  });

  if (project?.activeCleanupJobId) {
    const existingJob = await prisma.job.findUnique({
      where: { id: project.activeCleanupJobId },
      select: { status: true }
    });

    if (existingJob && ['PENDING', 'RUNNING'].includes(existingJob.status)) {
      return NextResponse.json(
        {
          error: 'Cleanup workflow already in progress',
          code: 'CLEANUP_ALREADY_RUNNING'
        },
        { status: 409 }
      );
    }
  }

  // Get shipped branches
  const lastCleanDate = await getLastCleanupDate(projectId);
  const shippedTickets = await getShippedBranchesSinceLastClean(projectId, lastCleanDate);

  if (shippedTickets.length === 0) {
    return NextResponse.json(
      { error: 'No branches shipped since last cleanup', code: 'NO_BRANCHES' },
      { status: 400 }
    );
  }

  // Create cleanup ticket + job + lock atomically
  const result = await prisma.$transaction(async (tx) => {
    const ticketNumber = await getNextTicketNumber(tx, projectId);

    const description = `Analyzing branches shipped since ${lastCleanDate.toISOString().split('T')[0]}:\n\n${
      shippedTickets.map(t => `- \`${t.branch}\` (${t.ticketKey}: ${t.title})`).join('\n')
    }\n\nTotal: ${shippedTickets.length} branches`;

    const cleanupTicket = await tx.ticket.create({
      data: {
        title: `Clean ${new Date().toISOString().split('T')[0]}`,
        description,
        stage: 'BUILD',
        workflowType: 'CLEAN',
        projectId,
        ticketNumber,
        ticketKey: `${project!.key}-${ticketNumber}`,
        autoMode: false,
        updatedAt: new Date()
      }
    });

    const job = await tx.job.create({
      data: {
        ticketId: cleanupTicket.id,
        projectId,
        command: 'clean',
        status: 'PENDING',
        startedAt: new Date(),
        updatedAt: new Date()
      }
    });

    await tx.project.update({
      where: { id: projectId },
      data: { activeCleanupJobId: job.id }
    });

    return { ticket: cleanupTicket, job };
  });

  // Dispatch workflow (implement workflow dispatch logic here)
  // ... workflow dispatch code ...

  return NextResponse.json(
    {
      ticket: result.ticket,
      job: result.job,
      shippedBranches: shippedTickets.map(t => t.branch),
      lastCleanDate
    },
    { status: 201 }
  );
}
```

#### 2.3 Update Transition API (Add Lock Check)

**File**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`

Find the section after ticket is fetched (around line 90), add lock check:

```typescript
// After: const ticket = await resolveTicketWithRelations(...)

// NEW: Check for active cleanup job
const project = await prisma.project.findUnique({
  where: { id: projectId },
  select: { activeCleanupJobId: true }
});

if (project?.activeCleanupJobId) {
  const cleanupJob = await prisma.job.findUnique({
    where: { id: project.activeCleanupJobId },
    select: { status: true }
  });

  if (cleanupJob && ['PENDING', 'RUNNING'].includes(cleanupJob.status)) {
    return NextResponse.json(
      {
        error: 'Project cleanup is in progress. Stage transitions are temporarily disabled.',
        code: 'CLEANUP_IN_PROGRESS',
        details: {
          activeCleanupJobId: project.activeCleanupJobId,
          jobStatus: cleanupJob.status,
          message: 'You can still update ticket descriptions, documents, and preview deployments.'
        }
      },
      { status: 423 }
    );
  }

  // Self-healing: clear lock if job terminal
  if (cleanupJob && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(cleanupJob.status)) {
    await prisma.project.update({
      where: { id: projectId },
      data: { activeCleanupJobId: null }
    });
  }
}

// Continue with existing transition logic...
```

#### 2.4 Update Job Status API (Release Lock)

**File**: `app/api/jobs/[id]/status/route.ts`

After job status update (around line 190), add lock release logic:

```typescript
// After: const updatedJob = await prisma.job.update(...)

// NEW: Release cleanup lock if terminal state
if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) {
  const project = await prisma.project.findFirst({
    where: { activeCleanupJobId: jobId },
    select: { id: true }
  });

  if (project) {
    await prisma.project.update({
      where: { id: project.id },
      data: { activeCleanupJobId: null }
    });
    console.log(`[Job Status] Released cleanup lock for project ${project.id}`);
  }
}
```

**Testing**: Create integration tests
```bash
# tests/integration/cleanup-api.spec.ts
# Test: POST /api/projects/1/clean
# Test: Transition blocked during cleanup
# Test: Lock released on job completion
```

---

### Phase 3: Frontend UI (2-3 hours)

**Goal**: Add cleanup trigger button and lock indicators

#### 3.1 Add Cleanup Menu Option

**File**: `app/(dashboard)/projects/[id]/components/ProjectMenu.tsx`

```tsx
// Add to existing dropdown menu
<DropdownMenuItem onClick={() => setShowCleanupDialog(true)}>
  <Sparkles className="mr-2 h-4 w-4" />
  Clean Project
</DropdownMenuItem>

{showCleanupDialog && (
  <CleanupConfirmDialog
    projectId={project.id}
    onClose={() => setShowCleanupDialog(false)}
  />
)}
```

#### 3.2 Create Cleanup Confirm Dialog

**File**: `components/cleanup/CleanupConfirmDialog.tsx` (NEW)

```tsx
'use client';

import { useState } from 'react';
import { AlertDialog, AlertDialogContent } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function CleanupConfirmDialog({
  projectId,
  onClose
}: {
  projectId: number;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleTrigger = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/clean`, {
        method: 'POST'
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      toast({
        title: 'Cleanup started',
        description: 'Analyzing technical debt from shipped features...'
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Cleanup failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={onClose}>
      <AlertDialogContent>
        <h2>Start Project Cleanup?</h2>
        <p>
          This will analyze technical debt from recently shipped features
          and create fixes for code quality issues, test improvements, and
          documentation updates.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleTrigger} disabled={loading}>
            {loading ? 'Starting...' : 'Start Cleanup'}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

#### 3.3 Add Cleanup Banner

**File**: `components/board/board.tsx`

```tsx
// Add at top of board (after imports)
{project.activeCleanupJobId && (
  <CleanupInProgressBanner
    projectId={project.id}
    jobId={project.activeCleanupJobId}
  />
)}
```

**File**: `components/cleanup/CleanupInProgressBanner.tsx` (NEW)

```tsx
'use client';

import { useJobPolling } from '@/hooks/useJobPolling';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export function CleanupInProgressBanner({
  projectId,
  jobId
}: {
  projectId: number;
  jobId: number;
}) {
  const { data: job } = useJobPolling(projectId);

  // Only show if job is still running
  if (!job || !['PENDING', 'RUNNING'].includes(job.status)) {
    return null;
  }

  return (
    <Alert variant="warning" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <strong>Project cleanup in progress</strong> — Stage transitions
        are temporarily disabled. You can still update ticket descriptions,
        documents, and preview deployments.
      </AlertDescription>
    </Alert>
  );
}
```

**Testing**: Manual testing
- Click "Clean Project" → dialog appears
- Confirm → cleanup ticket created
- Banner appears on board
- Drag ticket → toast shows "transitions blocked"

---

### Phase 4: GitHub Workflow (2-3 hours)

**Goal**: Create cleanup.yml workflow and /cleanup command

#### 4.1 Create Cleanup Workflow

**File**: `.github/workflows/cleanup.yml` (NEW)

See `contracts/workflow-dispatch.yaml` and `research.md` for full specification.

Key steps:
1. Checkout main branch (full history)
2. Setup test environment (Prisma, Playwright)
3. Execute `/cleanup` command
4. Run full test suite
5. Create PR with fixes
6. Transition to VERIFY

#### 4.2 Create Cleanup Command

**File**: `.claude/commands/cleanup.md` (NEW)

See `research.md` "Example Claude Command" section for full template.

Key instructions:
- Analyze git diffs from shipped branches
- Identify technical debt patterns
- Apply fixes incrementally with test validation
- No behavior changes allowed

**Testing**: Manual workflow dispatch
```bash
gh workflow run cleanup.yml \
  -f ticket_id="[e2e] Clean Test" \
  -f project_id="3" \
  -f shipped_branches='["test-branch"]' \
  -f job_id="999" \
  -f githubRepository="owner/repo"
```

---

### Phase 5: Testing (2-3 hours)

**Goal**: Comprehensive test coverage

#### 5.1 Unit Tests

**File**: `tests/unit/cleanup-lock.test.ts` (NEW)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/client';

describe('Cleanup Lock Mechanism', () => {
  let projectId: number;

  beforeEach(async () => {
    // Setup test project
  });

  it('prevents transitions when cleanup job is RUNNING', async () => {
    // Create cleanup job
    // Set activeCleanupJobId
    // Attempt transition
    // Expect 423 Locked
  });

  it('allows transitions when cleanup job is COMPLETED', async () => {
    // Create completed cleanup job
    // Clear activeCleanupJobId
    // Attempt transition
    // Expect 200 OK
  });

  it('self-heals orphaned locks', async () => {
    // Set activeCleanupJobId to completed job
    // Attempt transition
    // Expect lock cleared and transition succeeds
  });
});
```

#### 5.2 Integration Tests

**File**: `tests/integration/cleanup-workflow.spec.ts` (NEW)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Cleanup Workflow Integration', () => {
  test('full cleanup flow', async ({ request }) => {
    // 1. Trigger cleanup
    const cleanup = await request.post('/api/projects/3/clean');
    expect(cleanup.status()).toBe(201);

    // 2. Verify lock applied
    const transition = await request.patch('/api/projects/3/tickets/1/transition', {
      data: { newStage: 'VERIFY' }
    });
    expect(transition.status()).toBe(423);

    // 3. Complete job
    const jobUpdate = await request.patch(`/api/jobs/${jobId}/status`, {
      data: { status: 'COMPLETED' }
    });

    // 4. Verify lock released
    const transition2 = await request.patch('/api/projects/3/tickets/1/transition', {
      data: { newStage: 'VERIFY' }
    });
    expect(transition2.status()).toBe(200);
  });
});
```

#### 5.3 E2E Tests

**File**: `tests/e2e/cleanup-feature.spec.ts` (NEW)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Cleanup Feature E2E', () => {
  test('user triggers cleanup from project menu', async ({ page }) => {
    await page.goto('/projects/3');

    // Open project menu
    await page.click('[data-testid="project-menu"]');

    // Click cleanup option
    await page.click('text=Clean Project');

    // Confirm dialog
    await page.click('text=Start Cleanup');

    // Verify banner appears
    await expect(page.locator('text=Project cleanup in progress')).toBeVisible();

    // Attempt drag (should show toast)
    // ... drag-and-drop test ...
  });
});
```

---

## Verification Checklist

Before marking feature complete, verify:

- [ ] Schema migration applied successfully
- [ ] All unit tests pass (`bun run test:unit`)
- [ ] All integration tests pass (`bun run test:e2e`)
- [ ] TypeScript compiles without errors (`bun run type-check`)
- [ ] Cleanup API creates ticket + job + lock
- [ ] Transitions blocked during cleanup
- [ ] Banner shows during cleanup
- [ ] Lock released on job completion
- [ ] Workflow dispatches successfully
- [ ] PR created by workflow
- [ ] No regressions in existing features

---

## Common Issues & Troubleshooting

### Issue: Migration fails with "enum value already exists"

**Solution**: Drop and recreate migration
```bash
npx prisma migrate reset
npx prisma migrate dev
```

### Issue: Transition lock check returns wrong status

**Debug**: Check activeCleanupJobId value
```sql
SELECT id, "activeCleanupJobId" FROM "Project" WHERE id = 1;
SELECT id, status FROM "Job" WHERE id = <activeCleanupJobId>;
```

### Issue: Cleanup workflow not triggering

**Debug**: Check workflow dispatch logs
```bash
gh run list --workflow=cleanup.yml
gh run view <run_id> --log
```

### Issue: Tests fail with "Cannot find module"

**Solution**: Regenerate Prisma client
```bash
npx prisma generate
```

---

## Performance Benchmarks

Expected performance targets:

| Operation | Target | Actual |
|-----------|--------|--------|
| Cleanup trigger API | <500ms | ___ |
| Lock check overhead | <20ms | ___ |
| Shipped branches query | <100ms | ___ |
| Full workflow execution | <45min | ___ |

---

## Documentation Updates

After implementation, update:

- [ ] `CLAUDE.md` - Add cleanup workflow documentation
- [ ] `README.md` - Mention cleanup feature (if user-facing)
- [ ] API documentation - Update with new endpoints
- [ ] Update this quickstart with actual timings

---

## Next Steps (After Feature Complete)

1. Monitor cleanup workflow executions in production
2. Gather user feedback on cleanup quality
3. Tune Claude cleanup prompts based on results
4. Consider adding cleanup scheduling (weekly auto-cleanup)
5. Add metrics dashboard for technical debt trends

---

**Estimated Total Time**: 8-12 hours (1-1.5 days)

**Critical Path**: Schema → Backend APIs → Workflow → Testing

**Blockers**: None identified

**Dependencies**: None (feature is self-contained)
