# Data Model: Real-Time UI Stage Synchronization

**Feature**: Real-Time UI Stage Synchronization
**Date**: 2025-10-30
**Status**: No schema changes required

## Overview

This feature does not require any database schema changes. The existing Job and Ticket models already contain all necessary data for detecting workflow-initiated stage transitions. This document describes the relevant data model and relationships used by the feature.

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Project   │       │   Ticket    │       │     Job     │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │───┐   │ id (PK)     │───┐   │ id (PK)     │
│ name        │   └──<│ projectId   │   └──<│ ticketId    │
│ userId      │       │ stage       │       │ projectId   │
│ ...         │       │ branch      │       │ status      │
└─────────────┘       │ version     │       │ command     │
                      │ ...         │       │ completedAt │
                      └─────────────┘       │ ...         │
                                            └─────────────┘

Relationships:
- Project has many Tickets (1:N)
- Ticket has many Jobs (1:N)
- Job belongs to one Ticket (N:1)
- Job has projectId for efficient polling queries (denormalized for performance)
```

## Core Entities

### Job

**Purpose**: Tracks GitHub Actions workflow execution status. Used by polling hook to detect workflow completion.

**Schema** (`prisma/schema.prisma`, lines 29-49):

```prisma
model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  command     String    @db.VarChar(50)
  status      JobStatus @default(PENDING)
  branch      String?   @db.VarChar(200)
  commitSha   String?   @db.VarChar(40)
  logs        String?
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
  @@index([ticketId, status, startedAt])
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

**Key Fields**:
- `id` (Int, PK): Unique identifier for job
- `ticketId` (Int, FK): Associated ticket ID
- `projectId` (Int, FK): Associated project ID (denormalized for efficient polling)
- `status` (JobStatus): Current execution state (PENDING → RUNNING → COMPLETED/FAILED/CANCELLED)
- `command` (String): Workflow command type (e.g., "specify", "plan", "implement", "quick-impl", "verify", "ship")
- `completedAt` (DateTime?): Timestamp when job reached terminal status (COMPLETED/FAILED/CANCELLED)

**Indexes**:
- `projectId`: Used by polling endpoint to fetch all jobs for a project
- `status`: Filters for PENDING/RUNNING jobs
- `ticketId`: Associates job with ticket
- `ticketId, status, startedAt`: Composite index for efficient job queries

**Relationships**:
- Belongs to one Ticket (N:1)
- `onDelete: Cascade`: Deleting ticket deletes all associated jobs

**Validation Rules**:
- `status` must be one of: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
- `command` max length: 50 characters
- `completedAt` is `null` for PENDING/RUNNING, non-null for terminal states

### Ticket

**Purpose**: Represents a work item moving through workflow stages. Stage field is updated by workflows and must be synchronized with UI.

**Schema** (`prisma/schema.prisma`, lines 95-117):

```prisma
model Ticket {
  id                  Int                  @id @default(autoincrement())
  title               String               @db.VarChar(100)
  description         String               @db.VarChar(2500)
  stage               Stage                @default(INBOX)
  version             Int                  @default(1)
  projectId           Int
  branch              String?              @db.VarChar(200)
  autoMode            Boolean              @default(false)
  workflowType        WorkflowType         @default(FULL)
  attachments         Json?                @default("[]")
  createdAt           DateTime             @default(now())
  updatedAt           DateTime
  clarificationPolicy ClarificationPolicy?
  comments            Comment[]
  jobs                Job[]
  project             Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([stage])
  @@index([updatedAt])
  @@index([projectId, workflowType])
}

enum Stage {
  INBOX
  SPECIFY
  PLAN
  BUILD
  VERIFY
  SHIP
}

enum WorkflowType {
  FULL
  QUICK
}
```

**Key Fields**:
- `id` (Int, PK): Unique identifier for ticket
- `projectId` (Int, FK): Associated project ID
- `stage` (Stage): Current workflow stage (INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP)
- `version` (Int): Optimistic concurrency control version (incremented on updates)
- `branch` (String?): Git branch associated with ticket (set by workflows)
- `workflowType` (WorkflowType): Workflow path used (FULL: normal workflow, QUICK: quick-impl)

**Indexes**:
- `projectId`: Used by tickets query endpoint
- `stage`: Filters tickets by stage for board columns
- `updatedAt`: Orders tickets by most recent update

**Relationships**:
- Belongs to one Project (N:1)
- Has many Jobs (1:N)
- `onDelete: Cascade`: Deleting project deletes all tickets

**Validation Rules**:
- `stage` must be one of: INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP
- `version` is incremented on every update (optimistic locking)
- `workflowType` is FULL (default) or QUICK (set during quick-impl)

### Project

**Purpose**: Container for tickets and jobs. Used as query scope for polling and tickets endpoints.

**Schema** (`prisma/schema.prisma`, lines 51-69):

```prisma
model Project {
  id                  Int                 @id @default(autoincrement())
  name                String              @db.VarChar(100)
  description         String              @db.VarChar(1000)
  githubOwner         String              @db.VarChar(100)
  githubRepo          String              @db.VarChar(100)
  userId              String
  deploymentUrl       String?             @db.VarChar(500)
  createdAt           DateTime            @default(now())
  updatedAt           DateTime
  clarificationPolicy ClarificationPolicy @default(AUTO)
  user                User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  tickets             Ticket[]
  members             ProjectMember[]

  @@unique([githubOwner, githubRepo])
  @@index([githubOwner, githubRepo])
  @@index([userId])
}
```

**Key Fields**:
- `id` (Int, PK): Unique identifier for project
- `userId` (String, FK): Owner user ID (authorization check)
- `githubOwner` (String): GitHub repository owner
- `githubRepo` (String): GitHub repository name

**Relationships**:
- Belongs to one User (N:1)
- Has many Tickets (1:N)
- Has many ProjectMembers (1:N)

## State Transitions

### Job Status State Machine

```
PENDING ──> RUNNING ──> COMPLETED
                   ├──> FAILED
                   └──> CANCELLED
```

**Terminal States**: COMPLETED, FAILED, CANCELLED (no further transitions possible)

**State Transition Rules**:
- PENDING → RUNNING: Workflow starts execution
- RUNNING → COMPLETED: Workflow succeeds
- RUNNING → FAILED: Workflow fails
- RUNNING → CANCELLED: Workflow cancelled manually

**Enforced By**: `app/lib/job-state-machine.ts` (server-side validation)

### Ticket Stage Transitions

**Manual Transitions** (User drag-and-drop):
```
INBOX <──> SPECIFY <──> PLAN <──> BUILD <──> VERIFY <──> SHIP
```

**Workflow-Initiated Transitions** (GitHub Actions):
```
INBOX ──> SPECIFY ──> PLAN ──> BUILD ──> VERIFY ──> SHIP
```

**Quick-Impl Workflow** (INBOX → BUILD shortcut):
```
INBOX ──> BUILD ──> VERIFY ──> SHIP
```

**Auto-Ship Workflow** (Deployment automation):
```
VERIFY ──> SHIP
```

**Critical Insight**: Workflows transition ticket stages via API call (`PATCH /api/projects/:projectId/tickets/:id`), which updates the database but does not automatically invalidate the frontend cache. This is the root cause of the bug this feature fixes.

## Query Patterns

### Polling Query (Job Status)

**Endpoint**: `GET /api/projects/:projectId/jobs/status`

**Query** (server-side):
```typescript
const jobs = await prisma.job.findMany({
  where: {
    projectId: projectId,
  },
  select: {
    id: true,
    status: true,
    ticketId: true,
    command: true,
    updatedAt: true,
  },
  orderBy: {
    startedAt: 'desc',
  },
});
```

**Index Used**: `@@index([projectId])`

**Performance**: < 100ms p95 (measured, per CLAUDE.md)

### Tickets Query

**Endpoint**: `GET /api/projects/:projectId/tickets`

**Query** (server-side):
```typescript
const tickets = await prisma.ticket.findMany({
  where: {
    projectId: projectId,
  },
  orderBy: {
    updatedAt: 'desc',
  },
});
```

**Index Used**: `@@index([projectId])`

**Cache Strategy** (client-side):
- Cached by TanStack Query with key: `['projects', projectId, 'tickets']`
- Stale time: 5 seconds
- GC time: 10 minutes
- Invalidated when polling hook detects terminal job status

## Frontend Data Types

### JobStatusDto

**Schema** (`app/lib/schemas/job-polling.ts`):

```typescript
export const jobStatusSchema = z.object({
  id: z.number(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  ticketId: z.number(),
  command: z.string(),
  updatedAt: z.string(),
});

export type JobStatusDto = z.infer<typeof jobStatusSchema>;
```

**Purpose**: Type-safe representation of job status data returned by polling endpoint.

### TicketWithVersion

**Type** (`app/lib/types/query-types.ts`):

```typescript
export type TicketWithVersion = {
  id: number;
  title: string;
  description: string;
  stage: Stage;
  version: number;
  projectId: number;
  branch: string | null;
  autoMode: boolean;
  workflowType: WorkflowType;
  createdAt: string;
  updatedAt: string;
  // ... other fields
};
```

**Purpose**: Type-safe representation of ticket data with version for optimistic concurrency control.

### TicketsByStage

**Type** (`app/lib/types/query-types.ts`):

```typescript
export type TicketsByStage = {
  [Stage.INBOX]: TicketWithVersion[];
  [Stage.SPECIFY]: TicketWithVersion[];
  [Stage.PLAN]: TicketWithVersion[];
  [Stage.BUILD]: TicketWithVersion[];
  [Stage.VERIFY]: TicketWithVersion[];
  [Stage.SHIP]: TicketWithVersion[];
};
```

**Purpose**: Tickets grouped by stage for board column rendering. Generated by `useTicketsByStage` hook via TanStack Query `select` transformation.

## Data Flow

### Workflow-Initiated Stage Transition Flow

```
1. GitHub Actions Workflow
   └─> PATCH /api/projects/:projectId/tickets/:id
       (Update ticket stage: BUILD → VERIFY)
       └─> Prisma: UPDATE ticket SET stage = 'VERIFY', updatedAt = NOW()
           └─> PATCH /api/jobs/:id/status
               (Update job status: RUNNING → COMPLETED)
               └─> Prisma: UPDATE job SET status = 'COMPLETED', completedAt = NOW()

2. Frontend Polling (2-second interval)
   └─> GET /api/projects/:projectId/jobs/status
       └─> TanStack Query: Update jobs cache
           └─> useJobPolling hook: Detect terminal job status
               └─> queryClient.invalidateQueries(['projects', projectId, 'tickets'])
                   └─> TanStack Query: Mark tickets cache as stale
                       └─> Background refetch: GET /api/projects/:projectId/tickets
                           └─> TanStack Query: Update tickets cache with new stage
                               └─> React: Re-render board with ticket in correct column
```

**Key Insight**: The missing link (step 2, fifth bullet) is what this feature adds. Currently, `useJobPolling` does not invalidate the tickets cache, so the UI continues displaying stale ticket data.

## No Schema Changes Required

This feature requires **zero database migrations**. All necessary data already exists in the schema:

- **Job.status**: Detects workflow completion (terminal states)
- **Job.projectId**: Enables efficient polling queries
- **Job.completedAt**: Timestamp for terminal state (already tracked)
- **Ticket.stage**: Contains current workflow stage (already updated by workflows)
- **Ticket.version**: Optimistic concurrency control (already implemented)

The fix is purely client-side: enhancing the `useJobPolling` hook to invalidate the tickets cache when terminal job statuses are detected.

## Performance Considerations

### Database Indexes

All required indexes already exist:

- **Job.projectId**: Polling query performance
- **Ticket.projectId**: Tickets query performance
- **Job.status**: Terminal state filtering
- **Job.ticketId, status, startedAt**: Composite index for job history queries

No additional indexes required.

### Query Performance

Current performance metrics (from CLAUDE.md):

- Polling endpoint: < 100ms p95
- Tickets endpoint: < 100ms p95 (assumed similar performance profile)

**Impact of Cache Invalidation**:
- One additional tickets fetch per terminal job
- TanStack Query deduplication prevents redundant requests
- Background refetch keeps UI responsive

**Monitoring**: Track tickets API response time to ensure < 100ms p95 maintained after feature deployment.

## Migration Checklist

- [x] No schema changes required
- [x] No migrations to write
- [x] No database constraints to add
- [x] No indexes to create
- [x] All necessary data already exists
- [x] Client-side implementation only

## References

- **Prisma Schema**: `prisma/schema.prisma` (lines 29-117)
- **Job State Machine**: `app/lib/job-state-machine.ts`
- **Frontend Types**: `app/lib/types/query-types.ts`
- **Query Keys Factory**: `app/lib/query-keys.ts`
- **Feature Spec**: `specs/076-934-ui-stages/spec.md`
