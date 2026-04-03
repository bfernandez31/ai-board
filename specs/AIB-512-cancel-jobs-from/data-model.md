# Data Model: Cancel Jobs + Rollback Recovery

## Schema Changes

### Job Model Extension

**Field Addition**: `workflowRunId BigInt?`

```prisma
model Job {
  // ... existing fields ...
  workflowRunId  BigInt?        // GitHub Actions workflow run ID for cancel support
  // ... existing fields ...

  @@index([workflowRunId])      // New index for cancel lookups
}
```

**Rationale**: Required to call `octokit.actions.cancelWorkflowRun()`. Populated when the workflow's first RUNNING status callback includes the run ID. Nullable because PENDING jobs haven't started yet and some jobs (e.g., test-mode) never get a real run ID.

**Migration**: `ALTER TABLE "Job" ADD COLUMN "workflowRunId" BIGINT;` + index.

---

## Entity Definitions

### Job (Extended)

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| workflowRunId | BigInt | Yes | GitHub Actions run ID, set on RUNNING callback |

**Validation Rules**:
- `workflowRunId` must be a positive BigInt when provided
- Only populated once per job (first RUNNING callback)
- Used by cancel endpoint to identify which GitHub run to terminate

**State Transitions** (existing, unchanged):
```
PENDING → RUNNING → COMPLETED
PENDING → RUNNING → FAILED
PENDING → RUNNING → CANCELLED
PENDING → CANCELLED (direct cancel before workflow starts)
```

### Rollback Transition Matrix (Logic Only — No Schema Change)

| From Stage | To Stage | Workflow Type | Git Action | Conditions |
|-----------|----------|---------------|------------|------------|
| SPECIFY | INBOX | FULL | Delete branch (if exists) | Last job FAILED/CANCELLED |
| PLAN | SPECIFY | FULL | None | Last job FAILED/CANCELLED |
| BUILD | PLAN | FULL | Backup tag + git reset | Last job FAILED/CANCELLED |
| BUILD | INBOX | QUICK | None (delete job, clear branch) | Last job FAILED/CANCELLED |
| VERIFY | BUILD | FULL | None | Last job FAILED/CANCELLED |
| VERIFY | PLAN | FULL | Backup tag + git reset | Last job COMPLETED/FAILED/CANCELLED |

**Conditions for all rollback transitions**:
- Last job for the ticket must be in a terminal failed/cancelled state
- No RUNNING or PENDING jobs allowed (blocks rollback)
- Ticket must match the expected workflow type

### Backup Tag (Git Object — No DB Entity)

| Attribute | Format | Example |
|-----------|--------|---------|
| Tag name | `backup/{ticketKey}/{stage}-{jobId}` | `backup/AIB-512/build-456` |
| Created | Before git reset in rollback-reset workflow | — |
| Deleted | Start of successful verify.yml run | — |

**Lifecycle**:
1. Created by rollback-reset.yml before `git reset --hard`
2. Pushed to origin: `git push origin backup/{ticketKey}/{stage}-{jobId}`
3. Cleaned up by verify.yml: delete all `backup/{ticketKey}/*` tags on successful start
4. Survives failed verify runs (preserved for recovery)

---

## Relationships

```
Job.workflowRunId  →  GitHub Actions Run (external, not FK)
Job.ticketId       →  Ticket.id (existing FK)
Ticket.stage       →  Rollback matrix determines valid transitions
```

No new database relationships are introduced. The workflowRunId is a reference to an external system (GitHub Actions), not a foreign key.
