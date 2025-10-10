# Data Model: GitHub Workflow Transition API

**Feature**: 018-add-github-transition
**Date**: 2025-10-09

## Overview

This feature requires **zero schema changes**. All necessary database models (Project, Ticket, Job) and fields already exist in the Prisma schema. This document describes how existing models are used and the relationships between them.

---

## Entity Relationship Diagram

```
┌─────────────────┐
│    Project      │
│─────────────────│
│ id (PK)         │
│ githubOwner     │◄────┐
│ githubRepo      │     │
│ ...             │     │ Many tickets
└─────────────────┘     │ belong to
                         │ one project
                         │
                 ┌───────┴───────────┐
                 │      Ticket        │
                 │────────────────────│
                 │ id (PK)            │
                 │ projectId (FK)     │
                 │ stage              │◄────┐
                 │ branch             │     │
                 │ version            │     │ Many jobs
                 │ ...                │     │ belong to
                 └────────────────────┘     │ one ticket
                                            │
                                    ┌───────┴────────┐
                                    │      Job       │
                                    │────────────────│
                                    │ id (PK)        │
                                    │ ticketId (FK)  │
                                    │ command        │
                                    │ status         │
                                    │ branch         │
                                    │ ...            │
                                    └────────────────┘
```

---

## Entity: Project (Existing)

**Purpose**: Represents a GitHub repository where spec-kit workflows are executed.

**Schema** (existing - no changes):
```prisma
model Project {
  id          Int      @id @default(autoincrement())
  name        String   @db.VarChar(100)
  description String   @db.VarChar(1000)
  githubOwner String   @db.VarChar(100)     // Required for workflow dispatch
  githubRepo  String   @db.VarChar(100)     // Required for workflow dispatch
  tickets     Ticket[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([githubOwner, githubRepo])
  @@index([githubOwner, githubRepo])
}
```

**Fields Used by Transition API**:
| Field | Type | Usage |
|-------|------|-------|
| `id` | Int | Validated in URL params, checked for existence |
| `githubOwner` | String | Passed to Octokit for workflow dispatch (owner parameter) |
| `githubRepo` | String | Passed to Octokit for workflow dispatch (repo parameter) |

**Validation Rules**:
- Project must exist before ticket transition (404 if missing)
- `githubOwner` and `githubRepo` must be valid GitHub identifiers (validated at creation time, trusted here)

**Relationships**:
- **One-to-Many** with Ticket (one project has many tickets)

---

## Entity: Ticket (Existing)

**Purpose**: Represents a work item that transitions through workflow stages, triggering automation at certain stages.

**Schema** (existing - no changes):
```prisma
model Ticket {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(100)
  description String   @db.VarChar(1000)
  stage       Stage    @default(INBOX)             // Updated by transition API
  version     Int      @default(1)                  // Optimistic concurrency control
  projectId   Int                                   // Foreign key to Project
  branch      String?  @db.VarChar(200)             // Updated during SPECIFY transition
  autoMode    Boolean  @default(false)
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  jobs        Job[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([stage])
  @@index([updatedAt])
  @@index([projectId])
}
```

**Fields Used by Transition API**:
| Field | Type | Usage |
|-------|------|-------|
| `id` | Int | Validated in URL params, used for job creation |
| `projectId` | Int | Cross-project access validation (must match URL param) |
| `stage` | Stage | Current state, validated with `isValidTransition()`, updated after workflow dispatch |
| `version` | Int | Optimistic concurrency control, incremented after update |
| `branch` | String? | Set to `feature/ticket-<id>` during INBOX→SPECIFY transition, reused for PLAN/BUILD |
| `title` | String | Passed to workflow dispatch for SPECIFY command only (context for spec generation) |
| `description` | String | Passed to workflow dispatch for SPECIFY command only (feature requirements) |

**Validation Rules**:
- Ticket must exist (404 if missing)
- Ticket must belong to projectId from URL (403 if mismatch)
- Stage transition must be sequential: `isValidTransition(currentStage, targetStage)` (400 if invalid)
- Version must match current database version (409 if conflict)

**State Machine**:
```
INBOX ──→ SPECIFY ──→ PLAN ──→ BUILD ──→ VERIFY ──→ SHIP
  │         │          │         │          │         │
  └─ job ──┴─ job ────┴─ job ───┘          └─ no job┘
     created  created     created              (manual)
```

**Relationships**:
- **Many-to-One** with Project (many tickets belong to one project)
- **One-to-Many** with Job (one ticket has many jobs, one per stage transition)

---

## Entity: Job (Existing)

**Purpose**: Tracks GitHub Actions workflow execution initiated by stage transitions.

**Schema** (existing - no changes):
```prisma
model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int                                       // Foreign key to Ticket
  command     String    @db.VarChar(50)                 // "specify", "plan", "implement"
  status      JobStatus @default(PENDING)               // PENDING, RUNNING, COMPLETED, FAILED
  branch      String?   @db.VarChar(200)                // NOT populated at creation (workflow callback updates this)
  commitSha   String?   @db.VarChar(40)                 // NOT populated at creation (workflow callback updates this)
  logs        String?   @db.Text                        // NOT populated at creation (workflow callback updates this)
  startedAt   DateTime  @default(now())
  completedAt DateTime?                                 // NULL until workflow completes
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([ticketId])
  @@index([status])
  @@index([startedAt])
  @@index([ticketId, status, startedAt])
}
```

**Fields Used by Transition API**:
| Field | Type | Usage |
|-------|------|-------|
| `ticketId` | Int | Links job to ticket (foreign key) |
| `command` | String | Mapped from stage: SPECIFY→"specify", PLAN→"plan", BUILD→"implement" |
| `status` | JobStatus | Set to PENDING at creation (workflow callback updates to RUNNING/COMPLETED/FAILED) |
| `startedAt` | DateTime | Auto-set to now() at creation |

**Fields NOT Used by Transition API** (populated by workflow callback):
- `branch`: Updated when workflow completes (out of scope for this ticket)
- `commitSha`: Updated when workflow pushes commits (out of scope)
- `logs`: Updated with workflow execution logs (out of scope)
- `completedAt`: Updated when workflow finishes (out of scope)

**Creation Logic**:
```typescript
const job = await prisma.job.create({
  data: {
    ticketId: ticket.id,
    command: STAGE_COMMAND_MAP[targetStage], // "specify" | "plan" | "implement"
    status: JobStatus.PENDING,
    startedAt: new Date()
    // branch, commitSha, logs, completedAt remain NULL (workflow callback updates)
  }
});
```

**Relationships**:
- **Many-to-One** with Ticket (many jobs belong to one ticket)

---

## Enum: Stage (Existing)

**Purpose**: Defines valid workflow stages for tickets.

**Definition** (existing in `lib/stage-validation.ts`):
```typescript
export enum Stage {
  INBOX = 'INBOX',
  SPECIFY = 'SPECIFY',
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  SHIP = 'SHIP'
}
```

**Workflow Automation Mapping**:
| Stage | Previous Stage | Command | Job Created? | Branch Action |
|-------|----------------|---------|--------------|---------------|
| INBOX | (initial) | - | No | - |
| SPECIFY | INBOX | `specify` | Yes | Generate `feature/ticket-<id>` |
| PLAN | SPECIFY | `plan` | Yes | Reuse existing branch |
| BUILD | PLAN | `implement` | Yes | Reuse existing branch |
| VERIFY | BUILD | - | No | - |
| SHIP | VERIFY | - | No | - |

**Validation Function** (existing):
```typescript
import { isValidTransition } from '@/lib/stage-validation';

// Only allows sequential transitions (no skipping, no backwards)
if (!isValidTransition(currentStage, targetStage)) {
  return NextResponse.json(
    { error: 'Invalid stage transition' },
    { status: 400 }
  );
}
```

---

## Enum: JobStatus (Existing)

**Purpose**: Tracks workflow execution state.

**Definition** (existing in Prisma schema):
```prisma
enum JobStatus {
  PENDING    // Initial state (transition API sets this)
  RUNNING    // Updated by workflow callback (out of scope)
  COMPLETED  // Updated by workflow callback (out of scope)
  FAILED     // Updated by workflow callback (out of scope)
}
```

**State Transitions**:
```
PENDING ──→ RUNNING ──→ COMPLETED
                  │
                  └──→ FAILED
```

**Transition API Usage**:
- Always creates jobs with `status: PENDING`
- Workflow callbacks update to RUNNING/COMPLETED/FAILED (out of scope for this ticket)

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ POST /api/projects/:projectId/tickets/:id/transition             │
│ Body: { targetStage: "SPECIFY" }                                 │
└────────────────┬─────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────────┐
│ 1. Validate projectId, ticketId (must be integers)             │
│ 2. Fetch project (404 if not found)                            │
│ 3. Fetch ticket with project relation (403 if wrong project)   │
│ 4. Validate stage transition (400 if invalid)                  │
└────────────────┬───────────────────────────────────────────────┘
                 │
                 ▼
      ┌──────────┴─────────────┐
      │  targetStage has        │
      │  automation?            │
      └──┬─────────────┬────────┘
    Yes  │             │ No
         │             │
         ▼             ▼
┌─────────────────┐  ┌──────────────────────────┐
│ Create Job      │  │ Update ticket.stage only │
│ ├─ ticketId     │  │ (no job, no dispatch)    │
│ ├─ command      │  └──────────┬───────────────┘
│ ├─ status=      │             │
│ │  PENDING      │             ▼
│ └─ startedAt    │  ┌──────────────────────────┐
└────────┬────────┘  │ Return 200 OK            │
         │           │ { success: true,         │
         ▼           │   message: "Stage        │
┌─────────────────┐  │            updated" }    │
│ Generate branch │  └──────────────────────────┘
│ (SPECIFY only)  │
│ feature/        │
│ ticket-<id>     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Dispatch GitHub Actions         │
│ Workflow via Octokit            │
│ ├─ owner: project.githubOwner   │
│ ├─ repo: project.githubRepo     │
│ ├─ workflow_id: 'speckit.yml'   │
│ ├─ ref: 'main'                  │
│ └─ inputs:                      │
│    ├─ ticket_id: "123"          │
│    ├─ command: "specify"        │
│    ├─ branch: "feature/..."     │
│    ├─ ticketTitle (if SPECIFY)  │
│    └─ ticketDescription (...)   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Update ticket atomically        │
│ ├─ stage = targetStage          │
│ ├─ version = version + 1        │
│ └─ branch = ... (if SPECIFY)    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Return 200 OK                   │
│ { success: true,                │
│   jobId: 456,                   │
│   message: "Workflow            │
│             dispatched" }       │
└─────────────────────────────────┘
```

---

## Validation Rules Summary

**Project Validation**:
- ✅ projectId must be positive integer (400 if invalid)
- ✅ Project must exist in database (404 if missing)

**Ticket Validation**:
- ✅ ticketId must be positive integer (400 if invalid)
- ✅ Ticket must exist in database (404 if missing)
- ✅ Ticket must belong to projectId from URL (403 if mismatch)

**Stage Transition Validation**:
- ✅ targetStage must be valid Stage enum value (400 if invalid)
- ✅ Transition must be sequential: `isValidTransition(currentStage, targetStage)` (400 if invalid)
- ✅ Examples of invalid transitions:
  - INBOX → PLAN (skipping SPECIFY)
  - BUILD → SPECIFY (backwards)
  - SHIP → INBOX (backwards from terminal)

**Optimistic Concurrency Validation**:
- ✅ ticket.version from client must match database version (409 if conflict)
- ✅ Version incremented after successful update

**Branch Validation**:
- ✅ Branch name format: `feature/ticket-<id>` (no validation needed, generated programmatically)
- ✅ Branch length ≤200 characters (guaranteed by ticket ID length constraints)

---

## Indexes and Performance

**Existing Indexes** (no changes needed):
- `Project(githubOwner, githubRepo)` - Unique constraint + index (used for workflow dispatch lookup)
- `Ticket(projectId)` - Index (used for cross-project validation)
- `Ticket(stage)` - Index (used for stage filtering, not directly used by transition API)
- `Job(ticketId, status, startedAt)` - Composite index (used for job tracking queries)

**Query Performance**:
- Project lookup: O(1) via primary key index
- Ticket lookup with project validation: O(1) via composite WHERE on id + projectId
- Job creation: O(1) insert with indexed foreign key
- Ticket update: O(1) via primary key + version match

---

## Database Transactions

**Atomicity Requirements**:
The transition API requires multiple database operations to execute atomically:

1. Fetch ticket (with project relation)
2. Create job record
3. Update ticket stage and version
4. Update ticket branch (SPECIFY only)

**Transaction Strategy**:
Prisma implicit transactions via single `prisma.$transaction()` call:

```typescript
const result = await prisma.$transaction(async (tx) => {
  // 1. Create job
  const job = await tx.job.create({
    data: {
      ticketId: ticket.id,
      command: command,
      status: JobStatus.PENDING
    }
  });

  // 2. Dispatch workflow (outside transaction - idempotent)
  await dispatchWorkflow(ticket, command);

  // 3. Update ticket atomically
  const updatedTicket = await tx.ticket.update({
    where: {
      id: ticket.id,
      version: ticket.version // Optimistic lock
    },
    data: {
      stage: targetStage,
      version: { increment: 1 },
      ...(branchName && { branch: branchName })
    }
  });

  return { job, ticket: updatedTicket };
});
```

**Rollback Scenarios**:
- If workflow dispatch fails → transaction rolls back, no job/stage update
- If ticket version mismatch (409) → transaction rolls back automatically (Prisma P2025 error)

---

## Schema Migrations

**Migration Status**: ✅ No migrations required

All necessary models (Project, Ticket, Job) and fields (stage, branch, version) already exist in the Prisma schema. This feature is a **zero-migration implementation**.

**Verification**:
```bash
# No schema changes needed
npx prisma migrate status
# Output: Database schema is up to date!
```

---

## Data Model Checklist

- [x] Entity relationships documented (Project → Ticket → Job)
- [x] Field usage documented (which fields used vs. ignored)
- [x] Validation rules specified (cross-project, stage transitions, optimistic concurrency)
- [x] State transitions defined (INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP)
- [x] Indexes verified (existing indexes sufficient, no new indexes needed)
- [x] Transaction strategy documented (atomic job creation + ticket update)
- [x] No schema migrations required (all models exist)

---

**Status**: ✅ Data model complete - Zero schema changes required
**Next Phase**: Phase 1 continues (API Contracts)
