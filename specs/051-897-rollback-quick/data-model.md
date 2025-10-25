# Data Model: Quick Workflow Rollback

**Feature Branch**: `051-897-rollback-quick`
**Date**: 2025-10-24

## Overview

This feature leverages existing database entities (`Ticket` and `Job`) without schema changes. All required fields already exist in the database schema.

---

## Entity: Ticket

**Location**: Existing entity in `prisma/schema.prisma`

**Fields Used by Rollback Feature**:

| Field | Type | Constraints | Rollback Behavior |
|-------|------|-------------|-------------------|
| `id` | Int | PRIMARY KEY | Read-only (identifier) |
| `stage` | Stage enum | NOT NULL | Updated: `BUILD` → `INBOX` |
| `workflowType` | WorkflowType enum | NOT NULL, default FULL | Reset: `QUICK` → `FULL` |
| `branch` | String? | max 200 chars, nullable | Reset: `"{num}-{desc}"` → `null` |
| `version` | Int | NOT NULL, default 1 | Reset: `current` → `1` |
| `projectId` | Int | NOT NULL, FK to Project.id | Read-only (authorization) |

**State Transitions**:

```
Normal Workflow:
INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP

Quick-Impl Workflow:
INBOX → BUILD (skip SPECIFY/PLAN)

Rollback (New):
BUILD → INBOX (when job FAILED or CANCELLED)
```

**Validation Rules**:

- Rollback ONLY allowed from `BUILD` stage
- Rollback ONLY allowed to `INBOX` stage
- Rollback ONLY allowed when most recent workflow job has status `FAILED` or `CANCELLED`
- Rollback BLOCKED when most recent workflow job has status `PENDING`, `RUNNING`, or `COMPLETED`

**Field Reset Logic**:

```typescript
// Atomic update in Prisma transaction
{
  stage: 'INBOX',          // Allow fresh start
  workflowType: 'FULL',    // Reset to default (user can choose workflow)
  branch: null,            // Clear Git branch reference
  version: 1,              // Reset optimistic concurrency version
}
```

---

## Entity: Job

**Location**: Existing entity in `prisma/schema.prisma`

**Fields Used by Rollback Feature**:

| Field | Type | Constraints | Rollback Behavior |
|-------|------|-------------|-------------------|
| `id` | Int | PRIMARY KEY | Used for deletion |
| `ticketId` | Int | NOT NULL, FK to Ticket.id | Filter jobs by ticket |
| `command` | String | NOT NULL | Filter workflow vs AI-BOARD jobs |
| `status` | JobStatus enum | NOT NULL | Determine rollback eligibility |
| `startedAt` | DateTime | NOT NULL | Sort to find most recent job |
| `completedAt` | DateTime? | nullable | Read-only (informational) |

**JobStatus Enum**:

```typescript
enum JobStatus {
  PENDING    // Workflow dispatched, not started
  RUNNING    // Workflow in progress
  COMPLETED  // Workflow finished successfully
  FAILED     // Workflow encountered error
  CANCELLED  // Workflow manually cancelled
}
```

**Job Filtering Logic**:

```typescript
// Distinguish workflow jobs from AI-BOARD jobs
const isWorkflowJob = !job.command.startsWith('comment-');

// Workflow commands: specify, plan, implement, quick-impl
// AI-BOARD commands: comment-specify, comment-plan, comment-build, comment-verify
```

**Job Deletion Logic**:

```typescript
// In Prisma transaction, delete failed/cancelled job
await tx.job.delete({
  where: { id: mostRecentWorkflowJob.id },
});
```

**Rationale for Hard Delete**:
- Clean state for workflow restart (no orphaned jobs)
- Failed job information available in GitHub Actions logs
- Prevents state confusion (multiple jobs for same stage)
- Aligns with FR-005 requirement

---

## Relationships

**Ticket → Job** (One-to-Many):

```prisma
model Ticket {
  id          Int         @id @default(autoincrement())
  jobs        Job[]       // Related jobs (workflow + AI-BOARD)
  // ... other fields
}

model Job {
  id          Int         @id @default(autoincrement())
  ticketId    Int
  ticket      Ticket      @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  // ... other fields
}
```

**Cascade Behavior**:
- Deleting ticket cascades to all jobs (existing behavior, unchanged)
- Rollback manually deletes specific job (failed/cancelled workflow job only)

---

## Validation State Machine

**Rollback Eligibility Check**:

```typescript
type RollbackValidation = {
  allowed: boolean;
  reason?: string;
};

function canRollbackToInbox(
  currentStage: Stage,
  targetStage: Stage,
  mostRecentWorkflowJob: Job | null
): RollbackValidation {
  // Rule 1: Only BUILD → INBOX transitions
  if (currentStage !== 'BUILD' || targetStage !== 'INBOX') {
    return {
      allowed: false,
      reason: 'Rollback only available from BUILD to INBOX stage'
    };
  }

  // Rule 2: Must have a workflow job
  if (!mostRecentWorkflowJob) {
    return {
      allowed: false,
      reason: 'No workflow job found for this ticket'
    };
  }

  // Rule 3: Job must be FAILED or CANCELLED
  if (!['FAILED', 'CANCELLED'].includes(mostRecentWorkflowJob.status)) {
    if (mostRecentWorkflowJob.status === 'RUNNING') {
      return {
        allowed: false,
        reason: 'Cannot rollback: workflow is still running'
      };
    }
    if (mostRecentWorkflowJob.status === 'COMPLETED') {
      return {
        allowed: false,
        reason: 'Cannot rollback: workflow completed successfully'
      };
    }
    return {
      allowed: false,
      reason: 'Cannot rollback: invalid job status'
    };
  }

  return { allowed: true };
}
```

---

## Database Operations

**Rollback Transaction** (Atomic):

```typescript
// app/api/projects/[projectId]/tickets/[id]/transition/route.ts

await prisma.$transaction(async (tx) => {
  // 1. Validate rollback eligibility (read-only check)
  const ticket = await tx.ticket.findUnique({
    where: { id: ticketId },
    include: {
      jobs: {
        where: { command: { not: { startsWith: 'comment-' } } },
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
    },
  });

  const validation = canRollbackToInbox(
    ticket.stage,
    'INBOX',
    ticket.jobs[0] || null
  );

  if (!validation.allowed) {
    throw new Error(validation.reason);
  }

  // 2. Update ticket state (atomic write)
  await tx.ticket.update({
    where: { id: ticketId },
    data: {
      stage: 'INBOX',
      workflowType: 'FULL',
      branch: null,
      version: 1,
    },
  });

  // 3. Delete failed/cancelled job (atomic write)
  await tx.job.delete({
    where: { id: ticket.jobs[0].id },
  });
});
```

**Performance Characteristics**:

- Read: 1 ticket + 1 job query (indexed on `ticketId`, sorted by `startedAt`)
- Write: 1 ticket update + 1 job delete
- Estimated latency: <50ms (single database round-trip with transaction)
- Meets SC-002 requirement: <200ms API response time

---

## No Schema Changes Required

✅ All fields exist in current schema:
- `Ticket.stage` (Stage enum)
- `Ticket.workflowType` (WorkflowType enum)
- `Ticket.branch` (String?, max 200 chars)
- `Ticket.version` (Int, default 1)
- `Job.status` (JobStatus enum)
- `Job.command` (String)

✅ No migrations needed
✅ No database downtime
✅ Backward compatible with existing tickets

---

## Summary

This feature uses existing database entities and fields. The only new component is the rollback validation logic (pure function, no database schema changes). All state transitions are atomic via Prisma transactions, ensuring data consistency per Constitution Principle V (Database Integrity).
