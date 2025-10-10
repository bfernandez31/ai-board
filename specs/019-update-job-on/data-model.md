# Data Model: Update Job Status on GitHub Actions Completion

**Feature**: 019-update-job-on
**Date**: 2025-10-10

## Overview

This feature extends the existing Job model to support a new CANCELLED status and implements state transition validation for workflow completion scenarios. No new entities are required; only the JobStatus enum is modified.

## Entity Changes

### JobStatus Enum (MODIFIED)

**Current State** (prisma/schema.prisma):
```prisma
enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}
```

**New State** (after migration):
```prisma
enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED  // NEW: Added for workflow cancellation support
}
```

**Rationale**:
- Clarification session specified adding CANCELLED status for user-initiated workflow cancellations
- Distinguishes between failure (error occurred) and cancellation (user stopped workflow)
- Allows filtering/reporting on cancelled vs failed jobs
- Terminal state like COMPLETED and FAILED (no transitions out)

### Job Model (UNCHANGED)

The existing Job model already has all required fields:

```prisma
model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  command     String    @db.VarChar(50)
  status      JobStatus @default(PENDING)    // Uses updated enum
  branch      String?   @db.VarChar(200)
  commitSha   String?   @db.VarChar(40)
  logs        String?   @db.Text
  startedAt   DateTime  @default(now())
  completedAt DateTime?                       // Set when status → terminal
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([ticketId])
  @@index([status])
  @@index([startedAt])
  @@index([ticketId, status, startedAt])
}
```

**Key Fields for This Feature**:
- `id`: Used for Job correlation (passed to workflow as input)
- `status`: Updated by workflow completion (JobStatus enum)
- `completedAt`: Set when transitioning to COMPLETED, FAILED, or CANCELLED
- `startedAt`: Preserved (FR-011 - don't modify when completing)
- `logs`: NOT used per clarification (FR-007 - no log persistence)

**No Schema Changes** to Job model itself - only the referenced enum is updated.

## State Machine

### State Transition Rules (FR-013)

**Valid Transitions**:
```
PENDING → RUNNING
RUNNING → COMPLETED
RUNNING → FAILED
RUNNING → CANCELLED
```

**Terminal States** (no outbound transitions):
- COMPLETED
- FAILED
- CANCELLED

**Invalid Transitions** (will be rejected with HTTP 400):
- Any transition from terminal states
- PENDING → COMPLETED/FAILED/CANCELLED (must go through RUNNING)
- Any other unspecified transitions

### State Machine Implementation

```typescript
// lib/job-state-machine.ts

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

/**
 * Defines all valid state transitions for Job lifecycle.
 * Terminal states (COMPLETED, FAILED, CANCELLED) have no outbound transitions.
 */
export const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  PENDING: ['RUNNING'],
  RUNNING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],  // Terminal
  FAILED: [],     // Terminal
  CANCELLED: []   // Terminal
}

/**
 * Validates whether a state transition is allowed.
 * @param from Current job status
 * @param to Requested new status
 * @returns true if transition is valid, false otherwise
 */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

/**
 * Checks if a status is terminal (no further transitions possible).
 * @param status Job status to check
 * @returns true if status is terminal (COMPLETED, FAILED, or CANCELLED)
 */
export function isTerminalStatus(status: JobStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0
}

/**
 * Custom error for invalid state transitions.
 */
export class InvalidTransitionError extends Error {
  constructor(from: JobStatus, to: JobStatus) {
    super(`Invalid transition from ${from} to ${to}`)
    this.name = 'InvalidTransitionError'
  }
}
```

### Idempotency Rules (FR-012)

**Same-State Requests** (idempotent):
- Request: COMPLETED → COMPLETED
- Response: HTTP 200 with current state
- Action: No database update

**Invalid Transitions** (not idempotent):
- Request: COMPLETED → FAILED
- Response: HTTP 400 "Invalid state transition"
- Action: No database update, error logged

## Validation Rules

### Field Validation

**Status Field** (Zod schema):
```typescript
import { z } from 'zod'

export const jobStatusUpdateSchema = z.object({
  status: z.enum(['COMPLETED', 'FAILED', 'CANCELLED'], {
    errorMap: () => ({ message: 'Status must be COMPLETED, FAILED, or CANCELLED' })
  })
})

export type JobStatusUpdate = z.infer<typeof jobStatusUpdateSchema>
```

**Notes**:
- Only terminal statuses allowed in API (workflows don't set PENDING/RUNNING)
- PENDING → RUNNING transition handled by workflow start (different endpoint/mechanism)
- Enum validation ensures type safety and invalid values rejected

### Business Logic Validation

**Pre-Update Checks**:
1. Job exists (404 if not found)
2. Current status allows transition (400 if invalid)
3. Requested status is valid enum value (400 if not - Zod handles this)

**Post-Update Actions**:
1. Set `completedAt` to current timestamp
2. Preserve `startedAt` (don't modify)
3. Return updated Job data (id, status, completedAt)

## Database Migration

### Migration Plan

**Step 1**: Add CANCELLED to enum
```sql
-- Migration: Add CANCELLED status to JobStatus enum
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
```

**Step 2**: Verify no data migration needed
- Existing jobs won't have CANCELLED status
- No default value change
- No backfill required

**Step 3**: Generate Prisma migration
```bash
npx prisma migrate dev --name add-cancelled-job-status
```

### Rollback Plan

**If Needed** (before deployment):
```bash
npx prisma migrate reset  # Development only
```

**After Deployment**:
- Cannot remove enum value with existing data
- Would require new migration to migrate CANCELLED → FAILED if rollback needed
- Low risk: CANCELLED status clearly defined, unlikely to need rollback

## Data Relationships

No new relationships introduced. Existing relationships unchanged:
- Job → Ticket (many-to-one, cascade delete)
- Job indexes optimized for queries by ticketId, status, and startedAt

## Performance Impact

**Database**:
- Enum addition: Minimal impact (metadata change)
- Query performance: No change (status index already exists)
- Update performance: Single-row atomic update, <10ms expected

**Application**:
- State validation: O(1) lookup in transition map
- No additional database queries needed
- Idempotency check uses existing data (no extra query)

## Test Data Requirements

**E2E Test Scenarios**:
1. Job with status RUNNING → update to COMPLETED
2. Job with status RUNNING → update to FAILED
3. Job with status RUNNING → update to CANCELLED
4. Job with status COMPLETED → update to COMPLETED (idempotent)
5. Job with status COMPLETED → update to FAILED (invalid)

**Test Data Setup**:
```typescript
// tests/fixtures/jobs.ts
export const runningJob = {
  ticketId: 1,
  command: 'specify',
  status: 'RUNNING' as JobStatus,
  branch: 'feature/test',
  startedAt: new Date('2025-10-10T10:00:00Z')
}

export const completedJob = {
  ...runningJob,
  status: 'COMPLETED' as JobStatus,
  completedAt: new Date('2025-10-10T10:05:00Z')
}
```

## Security Considerations

**Data Exposure**:
- API returns minimal data: id, status, completedAt
- Logs field not exposed (not used per FR-007)
- Ticket relation not eagerly loaded (prevents data leakage)

**Authorization**:
- Job ID correlation provides implicit authorization
- Only workflow with correct Job ID can update
- Future enhancement: Verify GitHub workflow token/signature

**Audit Trail**:
- `updatedAt` automatically tracked by Prisma
- Status transitions logged via application logging
- GitHub Actions provides separate audit trail

## Summary

| Aspect | Change | Impact |
|--------|--------|--------|
| JobStatus enum | Add CANCELLED value | Low - metadata only |
| Job model | None | None |
| State machine | 5 states, 4 transitions | New validation logic |
| Migration | Add enum value | Safe, reversible |
| Performance | Minimal | <10ms per update |
| Security | Job ID correlation | Acceptable for MVP |
