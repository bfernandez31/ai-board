# Data Model: Job Completion Validation for Stage Transitions

**Feature**: 030-should-not-be
**Date**: 2025-10-15
**Purpose**: Define validation logic flow and data interactions

## Overview

This feature adds job completion validation to the ticket transition workflow. No schema changes are required—the feature leverages existing `Job` and `Ticket` models with their established relationships and indexes.

## Existing Data Model (No Changes Required)

### Job Entity
```prisma
model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  command     String    @db.VarChar(50)
  status      JobStatus @default(PENDING)
  startedAt   DateTime  @default(now())
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime
  projectId   Int

  ticket      Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([startedAt])
  @@index([status])
  @@index([ticketId])
  @@index([ticketId, status, startedAt])  // ✅ Composite index for validation query
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

**Validation Query Index**: The composite index `@@index([ticketId, status, startedAt])` efficiently supports the job validation query pattern.

### Ticket Entity
```prisma
model Ticket {
  id          Int      @id @default(autoincrement())
  stage       Stage    @default(INBOX)
  projectId   Int
  version     Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime

  jobs        Job[]
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([stage])
  @@index([updatedAt])
}

enum Stage {
  INBOX
  SPECIFY
  PLAN
  BUILD
  VERIFY
  SHIP
}
```

## Validation Logic Flow

### High-Level Workflow

```
┌──────────────────────────────────────────────────────┐
│ POST /api/projects/:id/tickets/:id/transition       │
│ Body: { targetStage: "PLAN" }                       │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│ Step 1: Validate Request & Auth                     │
│ - Parse projectId, ticketId, targetStage            │
│ - Verify project ownership (existing)               │
│ - Fetch ticket with project relation                │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│ Step 2: Sequential Stage Validation (existing)      │
│ - Call isValidTransition(currentStage, targetStage) │
│ - Block if not sequential (e.g., INBOX → BUILD)     │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│ Step 3: Job Completion Validation (NEW)             │
│ - Check if current stage requires job validation    │
│ - Query most recent job for ticket                  │
│ - Validate job status is COMPLETED                  │
└──────────────┬───────────────────────────────────────┘
               │
               ├─── Job validation fails
               │    (PENDING/RUNNING/FAILED/CANCELLED)
               │
               │    ┌──────────────────────────────────┐
               │    │ Return 400 Bad Request          │
               │    │ Error code: JOB_NOT_COMPLETED   │
               │    │ Include job status in details   │
               │    └──────────────────────────────────┘
               │
               └─── Job validation passes (COMPLETED or N/A)
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│ Step 4: Workflow Dispatch (existing)                │
│ - Create new Job record (if automated stage)        │
│ - Dispatch GitHub Actions workflow                  │
│ - Update ticket stage with version increment        │
└──────────────────────────────────────────────────────┘
```

### Detailed Validation Logic (Step 3)

```typescript
// Location: lib/workflows/transition.ts
// Function: validateJobCompletion()

async function validateJobCompletion(
  ticket: TicketWithProject,
  targetStage: Stage
): Promise<ValidationResult> {
  // 1. Check if validation is required
  const requiresValidation = shouldValidateJobCompletion(ticket.stage);
  if (!requiresValidation) {
    return { valid: true };
  }

  // 2. Fetch most recent job for ticket
  const mostRecentJob = await prisma.job.findFirst({
    where: { ticketId: ticket.id },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      status: true,
      command: true,
      startedAt: true,
    },
  });

  // 3. Handle missing job (data integrity issue)
  if (!mostRecentJob) {
    return {
      valid: false,
      errorCode: 'MISSING_JOB',
      message: `Expected job for stage ${ticket.stage} but none found`,
    };
  }

  // 4. Validate job status
  if (mostRecentJob.status !== 'COMPLETED') {
    const errorMessage = getJobValidationErrorMessage(mostRecentJob.status);
    return {
      valid: false,
      errorCode: 'JOB_NOT_COMPLETED',
      message: errorMessage,
      details: {
        currentStage: ticket.stage,
        targetStage: targetStage,
        jobStatus: mostRecentJob.status,
        jobCommand: mostRecentJob.command,
      },
    };
  }

  // 5. Validation passed
  return { valid: true };
}
```

### Stage-Based Validation Rules

```typescript
// Location: lib/workflows/transition.ts

/**
 * Determines if job completion validation is required for a given stage.
 *
 * Rules:
 * - INBOX → SPECIFY: No validation (first transition, no prior job)
 * - SPECIFY → PLAN: Requires COMPLETED "specify" job
 * - PLAN → BUILD: Requires COMPLETED "plan" job
 * - BUILD → VERIFY: Requires COMPLETED "implement" job
 * - VERIFY → SHIP: No validation (manual stage)
 */
function shouldValidateJobCompletion(currentStage: Stage): boolean {
  const stagesRequiringValidation: Stage[] = ['SPECIFY', 'PLAN', 'BUILD'];
  return stagesRequiringValidation.includes(currentStage);
}

/**
 * Maps job status to user-friendly error message.
 */
function getJobValidationErrorMessage(status: JobStatus): string {
  switch (status) {
    case 'PENDING':
    case 'RUNNING':
      return 'Cannot transition: workflow is still running';

    case 'FAILED':
      return 'Cannot transition: previous workflow failed. Please retry the workflow.';

    case 'CANCELLED':
      return 'Cannot transition: workflow was cancelled. Please retry the workflow.';

    default:
      return 'Cannot transition: job is not completed';
  }
}
```

## Query Performance Analysis

### Validation Query
```typescript
// Query executed during Step 3 (validation)
prisma.job.findFirst({
  where: { ticketId: ticket.id },
  orderBy: { startedAt: 'desc' },
  select: { id, status, command, startedAt },
});
```

### Database Execution Plan
1. **Index Scan**: Uses `@@index([ticketId, status, startedAt])` composite index
2. **Filter**: `ticketId = ?` (exact match on first index column)
3. **Sort**: `startedAt DESC` (already indexed, no additional sort needed)
4. **Limit**: Implicit LIMIT 1 from `findFirst()`
5. **Select**: Only 4 columns (id, status, command, startedAt)

**Estimated Performance**: <10ms query time (single index scan + row retrieval)

### Query Optimization
- ✅ Uses existing composite index (no new index needed)
- ✅ Minimal column selection (only required fields)
- ✅ Single-row retrieval (no pagination overhead)
- ✅ Type-safe Prisma query (compile-time validation)

## State Transitions with Job Validation

### Valid Transition Flow
```
Ticket (SPECIFY stage)
  └─> Job (command: "specify", status: COMPLETED)
        └─> Transition to PLAN ✅
              └─> Creates new Job (command: "plan", status: PENDING)
```

### Blocked Transition Flow (PENDING/RUNNING)
```
Ticket (SPECIFY stage)
  └─> Job (command: "specify", status: PENDING)
        └─> Transition to PLAN ❌
              └─> Returns 400 error: "workflow is still running"
```

### Blocked Transition Flow (FAILED/CANCELLED)
```
Ticket (SPECIFY stage)
  └─> Job (command: "specify", status: FAILED)
        └─> Transition to PLAN ❌
              └─> Returns 400 error: "workflow failed. Please retry"
```

### Multiple Jobs Scenario (Retry Workflow)
```
Ticket (SPECIFY stage)
  ├─> Job 1 (command: "specify", status: FAILED, startedAt: 2025-10-15 10:00)
  └─> Job 2 (command: "specify", status: COMPLETED, startedAt: 2025-10-15 10:05) ← Most recent
        └─> Transition to PLAN ✅
              └─> Validates against Job 2 (most recent by startedAt)
```

## Error Response Schema

See [contracts/job-validation-error.yaml](./contracts/job-validation-error.yaml) for complete error response specification.

**Summary**:
- HTTP Status: 400 Bad Request
- Error Code: `JOB_NOT_COMPLETED`
- Includes job status and descriptive message
- Provides details object with current/target stages and job info

## Integration Points

### Modified Files
1. **`lib/workflows/transition.ts`**:
   - Add `validateJobCompletion()` function
   - Add `shouldValidateJobCompletion()` helper
   - Add `getJobValidationErrorMessage()` helper
   - Update `handleTicketTransition()` to call validation before workflow dispatch

2. **`app/api/projects/[projectId]/tickets/[id]/transition/route.ts`**:
   - Update error handling to support `JOB_NOT_COMPLETED` error code
   - Add job details to error response

### No Changes Required
- **`prisma/schema.prisma`**: Existing schema sufficient (composite index already exists)
- **`lib/validations/ticket.ts`**: No new Zod validation schemas needed
- **`lib/stage-validation.ts`**: Sequential validation remains independent

## Testing Strategy

See [research.md](./research.md#task-3-test-update-strategy) for complete test strategy.

**Summary**:
- Update existing test file `/tests/api/ticket-transition.spec.ts`
- Add 7 new test scenarios for job validation
- Update 3 existing tests to simulate job completion
- Update `transitionThrough()` helper to complete jobs automatically
