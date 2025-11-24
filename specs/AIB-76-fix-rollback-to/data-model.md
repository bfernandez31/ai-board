# Data Model: Fix Rollback to Plan from Verify

## Entity Changes

### Job Entity (Extended)

The Job entity already supports string-based commands. No schema migration required.

**New Command Type**: `rollback-reset`

```prisma
// No schema changes needed - command is VARCHAR(50)
model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  command     String    @db.VarChar(50)  // Add 'rollback-reset' as valid value
  status      JobStatus @default(PENDING)
  branch      String?   @db.VarChar(200)
  // ... existing fields
}
```

**Command Values** (updated list):
| Command | Stage Transition | Description |
|---------|-----------------|-------------|
| `specify` | INBOX → SPECIFY | Create specification |
| `plan` | SPECIFY → PLAN | Create plan |
| `implement` | PLAN → BUILD | Implement changes |
| `quick-impl` | INBOX → BUILD | Fast-track implementation |
| `verify` | BUILD → VERIFY | Test and create PR |
| `clean` | (triggered) → BUILD | Technical debt cleanup |
| `deploy-preview` | VERIFY (manual) | Vercel deployment |
| `rollback-reset` | VERIFY → PLAN (after db update) | **NEW: Git reset for rollback** |
| `comment-*` | Various | AI-BOARD assistance |

### Ticket Entity (No Changes)

The existing rollback implementation already:
- Updates `stage` to PLAN
- Clears `previewUrl`
- Increments `version`
- Preserves `branch` and `workflowType`

No ticket schema changes required.

## Data Flow

### Rollback Reset Workflow

```
User drags ticket VERIFY → PLAN
         ↓
Modal confirmation
         ↓
┌─────────────────────────────────────────────┐
│ API Transaction (atomic)                     │
│ 1. Update ticket: stage=PLAN, previewUrl=null│
│ 2. Delete existing verify/implement job      │
│ 3. Return success                            │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ Workflow Dispatch (async)                    │
│ 1. Create job: command='rollback-reset'      │
│ 2. Dispatch rollback-reset.yml workflow      │
│ 3. Return jobId to client                    │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ GitHub Workflow (async)                      │
│ 1. Clone target repo                         │
│ 2. Checkout branch                           │
│ 3. Stash spec folder                         │
│ 4. Git reset to pre-BUILD commit             │
│ 5. Restore spec folder                       │
│ 6. Force push                                │
│ 7. Update job status via API                 │
└─────────────────────────────────────────────┘
```

## State Transitions

### Job State Machine (No Changes)

The existing job state machine supports the rollback-reset job:

```
PENDING → RUNNING → COMPLETED
                 → FAILED
                 → CANCELLED
```

### Rollback Decision Matrix

| Current Stage | Target Stage | Workflow Type | Job Status | Result |
|---------------|--------------|---------------|------------|--------|
| VERIFY | PLAN | FULL | COMPLETED | Allow + git reset |
| VERIFY | PLAN | FULL | FAILED | Allow + git reset |
| VERIFY | PLAN | FULL | CANCELLED | Allow + git reset |
| VERIFY | PLAN | FULL | RUNNING | Block |
| VERIFY | PLAN | FULL | PENDING | Block |
| VERIFY | PLAN | QUICK | Any | Block (not allowed) |
| VERIFY | PLAN | CLEAN | Any | Block (not allowed) |

## Validation Rules

1. **Pre-rollback validation** (existing - no changes):
   - Ticket must be in VERIFY stage
   - Target must be PLAN stage
   - Workflow type must be FULL
   - Latest job must be COMPLETED, FAILED, or CANCELLED

2. **Workflow input validation** (new):
   - Branch must exist and be non-empty
   - Job ID must reference valid job
   - GitHub repository must be accessible

3. **Git operation validation** (in workflow):
   - Branch exists on remote
   - Spec folder exists (or no-op if not)
   - Reset commit is valid (fallback if not found)
