# Quickstart: Fix Rollback to Plan from Verify

## Implementation Overview

This feature adds git reset functionality to the existing VERIFY→PLAN rollback. The current implementation correctly updates the database but leaves implementation commits in the git branch.

## Key Files to Modify

### 1. Transition API Route
**File**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`

After the existing rollback transaction (lines 191-238), add workflow dispatch:

```typescript
if (isRollbackToPlanAttempt) {
  // ... existing transaction code ...

  // NEW: Dispatch rollback-reset workflow
  const dispatchResult = await dispatchRollbackResetWorkflow({
    ticketId: ticket.id,
    ticketKey: ticket.ticketKey,
    projectId: ticket.projectId,
    branch: ticket.branch,
    githubOwner: ticketWithProject.project.githubOwner,
    githubRepo: ticketWithProject.project.githubRepo,
  });

  return NextResponse.json({
    // ... existing response ...
    resetJobId: dispatchResult.jobId, // NEW: Include reset job ID
  });
}
```

### 2. New Dispatch Function
**File**: `app/lib/workflows/dispatch-rollback-reset.ts` (new)

```typescript
export interface RollbackResetInputs {
  ticketId: number;
  ticketKey: string;
  projectId: number;
  branch: string;
  githubOwner: string;
  githubRepo: string;
}

export async function dispatchRollbackResetWorkflow(
  inputs: RollbackResetInputs
): Promise<{ jobId: number }> {
  // 1. Create job record
  const job = await prisma.job.create({
    data: {
      ticketId: inputs.ticketId,
      projectId: inputs.projectId,
      command: 'rollback-reset',
      status: 'PENDING',
      branch: inputs.branch,
      startedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // 2. Dispatch workflow
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  await octokit.actions.createWorkflowDispatch({
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    workflow_id: 'rollback-reset.yml',
    ref: 'main',
    inputs: {
      ticket_id: inputs.ticketKey,
      job_id: job.id.toString(),
      project_id: inputs.projectId.toString(),
      branch: inputs.branch,
      githubRepository: `${inputs.githubOwner}/${inputs.githubRepo}`,
    },
  });

  return { jobId: job.id };
}
```

### 3. New GitHub Workflow
**File**: `.github/workflows/rollback-reset.yml` (new)

Key steps:
1. Update job status to RUNNING
2. Checkout target repo at feature branch
3. Identify reset commit (before BUILD phase)
4. Stash spec folder
5. Git reset --hard
6. Restore spec folder
7. Force push
8. Update job status

### 4. Extend Tests
**File**: `tests/e2e/verify-rollback.spec.ts`

Add test for git reset verification (mocked in E2E, real in integration):

```typescript
test('should dispatch rollback-reset workflow after rollback', async ({ page, projectId }) => {
  // ... setup ticket in VERIFY ...

  // Trigger rollback
  await dragTicketToColumn(page, ticket.id, 'PLAN');
  await modal.locator('button[data-action="confirm"]').click();

  // Verify response includes resetJobId
  const response = await waitForTransitionAPI(page, ticket.id, projectId);
  const body = await response.json();
  expect(body.resetJobId).toBeDefined();

  // Verify job was created
  const resetJob = await prisma.job.findFirst({
    where: { ticketId: ticket.id, command: 'rollback-reset' },
  });
  expect(resetJob).toBeDefined();
  expect(resetJob.status).toBe('PENDING');
});
```

## Implementation Checklist

- [ ] Create `app/lib/workflows/dispatch-rollback-reset.ts`
- [ ] Modify `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
- [ ] Create `.github/workflows/rollback-reset.yml`
- [ ] Add unit tests for dispatch function
- [ ] Extend E2E tests for rollback workflow
- [ ] Test manually: complete VERIFY→PLAN rollback flow

## Testing Strategy

1. **Unit Test** (Vitest): Test dispatch function input validation
2. **Integration Test** (Playwright): Test API response includes resetJobId
3. **E2E Test** (Playwright): Test full rollback flow updates UI correctly
4. **Manual Test**: Verify git branch is actually reset (check commit history)

## Deployment Notes

- No database migrations required
- New workflow file must be merged to main for dispatch to work
- Existing rollback functionality continues to work (graceful degradation)
