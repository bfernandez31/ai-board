# Data Model: Rollback VERIFY to PLAN

**Feature**: AIB-75 | **Date**: 2025-11-23

## Overview

This feature extends existing data models rather than introducing new entities. The changes affect the Ticket and Job entities during the rollback transition.

---

## Entities

### Ticket (Existing - Extended Behavior)

**Table**: `tickets`

| Field | Type | Rollback Behavior |
|-------|------|-------------------|
| `id` | UUID | Unchanged |
| `ticketKey` | String | Unchanged |
| `title` | String | Unchanged |
| `description` | String? | Unchanged |
| `stage` | Enum(Stage) | **CHANGED**: VERIFY → PLAN |
| `workflowType` | Enum(WorkflowType) | Unchanged (stays FULL) |
| `branch` | String? | **PRESERVED** (contains spec files) |
| `previewUrl` | String? | **CLEARED** (set to null) |
| `version` | Int | **INCREMENTED** (+1) |
| `projectId` | UUID (FK) | Unchanged |
| `createdAt` | DateTime | Unchanged |
| `updatedAt` | DateTime | Updated automatically |

**Validation Rules**:
- Rollback allowed only when `stage = VERIFY`
- Rollback allowed only when `workflowType = FULL`
- QUICK and CLEAN workflows cannot rollback to PLAN

**State Transition**:
```
VERIFY (workflowType=FULL, job COMPLETED|FAILED|CANCELLED)
  ↓ [user confirms rollback]
PLAN (previewUrl=null, version+1)
```

---

### Job (Existing - Deletion on Rollback)

**Table**: `jobs`

| Field | Type | Rollback Behavior |
|-------|------|-------------------|
| `id` | UUID | Record deleted |
| `ticketId` | UUID (FK) | - |
| `projectId` | UUID (FK) | - |
| `command` | String | Used for filtering (exclude `comment-*`) |
| `status` | Enum(JobStatus) | Must be COMPLETED, FAILED, or CANCELLED |
| `runId` | String? | - |
| `createdAt` | DateTime | - |
| `updatedAt` | DateTime | - |

**Rollback Validation**:
- Only non-AI-BOARD jobs affect rollback eligibility
- AI-BOARD jobs have commands starting with `comment-`
- Most recent workflow job determines eligibility

**Status Values**:
```typescript
enum JobStatus {
  PENDING    // Block rollback
  RUNNING    // Block rollback
  COMPLETED  // Allow rollback (user requirement)
  FAILED     // Allow rollback
  CANCELLED  // Allow rollback
}
```

---

### RollbackValidation (New Type)

**Not a database entity** - TypeScript interface for validation results.

```typescript
interface RollbackValidation {
  allowed: boolean;
  reason?: string;
}
```

**Validation Outcomes**:

| Condition | allowed | reason |
|-----------|---------|--------|
| Not VERIFY stage | `false` | "Rollback only available from VERIFY stage" |
| Not FULL workflow | `false` | "Rollback not available for QUICK or CLEAN workflows" |
| No workflow job | `false` | "No workflow job found for this ticket" |
| Job RUNNING | `false` | "Cannot rollback while workflow is running" |
| Job PENDING | `false` | "Cannot rollback while job is pending" |
| Job COMPLETED/FAILED/CANCELLED | `true` | - |

---

## Stage Enum Extension

**No schema change** - existing Stage enum already includes VERIFY and PLAN.

```typescript
enum Stage {
  INBOX = 'INBOX',
  SPECIFY = 'SPECIFY',
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  SHIP = 'SHIP'
}
```

**New Valid Transition**:
```
VERIFY → PLAN  // Conditional: workflowType=FULL, job status allows
```

---

## WorkflowType Enum

**No change** - existing enum values determine rollback eligibility.

```typescript
enum WorkflowType {
  FULL = 'FULL',    // Allows VERIFY→PLAN rollback
  QUICK = 'QUICK',  // Does not use PLAN stage
  CLEAN = 'CLEAN'   // Different stage progression
}
```

---

## Relationships

```
Project (1) ─────< (N) Ticket
   │                    │
   │                    │ stage, workflowType, previewUrl
   │                    │
   └───────< (N) Job ──< (1) Ticket
                   │
                   │ command, status
```

**Rollback Transaction**:
1. Update Ticket (stage, previewUrl, version)
2. Delete Job (most recent workflow job)
3. Both in single atomic transaction

---

## Prisma Schema Reference

No schema modifications required. Existing schema supports the feature:

```prisma
model Ticket {
  id          String       @id @default(cuid())
  ticketKey   String       @unique
  title       String
  description String?
  stage       Stage        @default(INBOX)
  workflowType WorkflowType @default(FULL)
  branch      String?
  previewUrl  String?
  version     Int          @default(1)
  projectId   String
  project     Project      @relation(fields: [projectId], references: [id])
  jobs        Job[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model Job {
  id        String    @id @default(cuid())
  ticketId  String
  ticket    Ticket    @relation(fields: [ticketId], references: [id])
  projectId String
  project   Project   @relation(fields: [projectId], references: [id])
  command   String
  status    JobStatus @default(PENDING)
  runId     String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

---

## Data Integrity Constraints

1. **Foreign Key Cascade**: Job deletion doesn't affect ticket (correct behavior)
2. **Version Increment**: Ensures optimistic locking detects changes
3. **Atomic Transaction**: Both ticket update and job deletion must succeed together
4. **PreviewUrl Cleanup**: Clearing URL prevents accessing stale deployments
