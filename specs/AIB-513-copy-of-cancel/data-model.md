# Data Model: Cancel Jobs + Rollback Recovery

## Schema Changes

### Job Model Extension

**File**: `prisma/schema.prisma`

```prisma
model Job {
  // ... existing fields ...
  workflowRunId BigInt?  // GitHub Actions workflow run ID for cancellation
  // ... rest of fields ...
}
```

**Migration**: Add nullable `workflowRunId` column to `Job` table.

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| workflowRunId | BigInt | Yes | null | GitHub Actions run ID, set on PENDING→RUNNING transition |

**Constraints**:
- Nullable because PENDING jobs don't have a run ID yet
- BigInt to accommodate GitHub's large integer run IDs
- Set once on first RUNNING callback, never overwritten
- No unique constraint (different jobs may theoretically share run IDs across repos)

### No Other Schema Changes

- **Ticket**: No changes. Rollback behavior derived from `stage`, `workflowType`, and most recent job status. Existing `version` field provides optimistic concurrency.
- **Backup Tags**: Git objects, not stored in database. Convention: `backup/{ticketKey}/{stage}-{jobId}`

## State Machine Extension

**File**: `app/lib/job-state-machine.ts`

Current:
```typescript
PENDING: ['PENDING', 'RUNNING'],
```

Updated:
```typescript
PENDING: ['PENDING', 'RUNNING', 'CANCELLED'],
```

This allows direct cancellation of PENDING jobs without requiring a workflow run ID.

## Rollback Transition Matrix

| From | To | Workflow Type | Job Status Required | Git Operations |
|------|------|--------------|---------------------|----------------|
| SPECIFY | INBOX | Any | FAILED, CANCELLED | Delete branch (if exists) |
| PLAN | SPECIFY | Any | FAILED, CANCELLED | None |
| BUILD | INBOX | QUICK | FAILED, CANCELLED | Delete failed job (existing) |
| BUILD | PLAN | FULL | FAILED, CANCELLED | Backup tag + rollback-reset workflow |
| VERIFY | BUILD | FULL | FAILED, CANCELLED | None (re-verify) |
| VERIFY | PLAN | FULL | COMPLETED, FAILED, CANCELLED | Backup tag + rollback-reset workflow (existing) |

### New Rollback Paths (additions to existing system)

1. **SPECIFY→INBOX**: Reset ticket to INBOX. Delete branch via GitHub API if `ticket.branch` is set. Clear branch field.
2. **PLAN→SPECIFY**: Simple stage decrement. No git operations. Increment version.
3. **BUILD→PLAN** (FULL workflow): Destructive rollback. Create backup tag `backup/{ticketKey}/build-{jobId}`, then dispatch rollback-reset workflow to hard reset branch to pre-BUILD state while preserving spec files.
4. **VERIFY→BUILD**: Simple stage decrement. No git operations. Allows re-running verify. Increment version.

## Entity Relationships

```
Ticket (1) ──→ (N) Job
  │                  │
  │ stage            │ status (PENDING/RUNNING/COMPLETED/FAILED/CANCELLED)
  │ workflowType     │ workflowRunId (new, nullable BigInt)
  │ version          │ command
  │ branch           │
  │                  │
  └── Rollback determined by: ticket.stage + ticket.workflowType + job.status
```

## Validation Rules

1. **Cancel**: Job must be PENDING or RUNNING. If RUNNING, `workflowRunId` must be set to call GitHub API (graceful fallback if null — mark CANCELLED locally, log warning).
2. **Rollback**: Most recent non-comment job must be FAILED or CANCELLED (COMPLETED allowed only for VERIFY→PLAN). No RUNNING or PENDING jobs allowed.
3. **Concurrency**: Optimistic locking via `ticket.version` for rollback transitions. Job status check for cancel (re-read before update).
4. **Backup tag abort**: If tag creation fails during destructive rollback, abort the rollback and mark job as FAILED.
