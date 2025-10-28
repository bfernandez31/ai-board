# Data Model: Board Real-Time Update on Workflow Stage Transitions

## Overview

This feature **does not introduce new database models**. It leverages existing `Job` and `Ticket` models to detect workflow completions and trigger client-side cache invalidation.

## Existing Models (Reference)

### Job Model

Tracks GitHub Actions workflow execution status. Jobs transition through states: PENDING → RUNNING → (COMPLETED | FAILED | CANCELLED).

**Fields**:
- `id` (Int, PK): Unique job identifier
- `ticketId` (Int, FK): Reference to ticket this job processes
- `projectId` (Int, indexed): Project ID for efficient filtering
- `command` (String): Workflow command executed (e.g., "specify", "plan", "implement")
- `status` (JobStatus enum): Current execution state
  - `PENDING`: Job created, workflow not started
  - `RUNNING`: Workflow actively executing
  - `COMPLETED`: Workflow finished successfully
  - `FAILED`: Workflow encountered errors
  - `CANCELLED`: Workflow manually cancelled
- `branch` (String?): Git branch for workflow execution
- `commitSha` (String?): Commit SHA of workflow execution
- `logs` (String?): Workflow execution logs
- `startedAt` (DateTime): Job creation timestamp
- `completedAt` (DateTime?): Terminal state timestamp (null for PENDING/RUNNING)
- `createdAt` (DateTime): Record creation timestamp
- `updatedAt` (DateTime): Last modification timestamp

**Relationships**:
- Belongs to `Ticket` (many-to-one via `ticketId`)

**Indexes**:
- `projectId`: Efficient job filtering for polling endpoint
- `ticketId`: Efficient ticket → jobs lookup
- `status`: Efficient terminal status detection
- `(ticketId, status, startedAt)`: Composite index for job history queries

**Relevant to Feature**:
- `status` field transitions trigger cache invalidation
- Terminal statuses (`COMPLETED`, `FAILED`, `CANCELLED`) indicate workflow completion
- Polled every 2 seconds via `/api/projects/:id/jobs/status` endpoint

**Schema Reference**: `prisma/schema.prisma` (Job model)

---

### Ticket Model

Represents a work item on the project board. Tickets transition through stages: INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP.

**Fields (relevant to feature)**:
- `id` (Int, PK): Unique ticket identifier
- `title` (String): Ticket title (max 100 chars)
- `description` (String): Ticket description (max 2500 chars)
- `stage` (Stage enum): Current workflow stage
  - `INBOX`: New ticket, not started
  - `SPECIFY`: Requirements gathering
  - `PLAN`: Implementation planning
  - `BUILD`: Active development
  - `VERIFY`: Testing and review
  - `SHIP`: Deployed to production
- `version` (Int): Optimistic concurrency control version
- `projectId` (Int, FK): Reference to project
- `branch` (String?): Git branch for ticket work
- `autoMode` (Boolean): Enable automatic workflow progression
- `workflowType` (WorkflowType): Workflow path used (FULL or QUICK)
- `updatedAt` (DateTime): Last modification timestamp

**Relationships**:
- Has many `Job` records (one-to-many)
- Belongs to `Project` (many-to-one via `projectId`)

**Indexes**:
- `projectId`: Efficient ticket filtering by project
- `stage`: Efficient stage-grouped queries (board columns)
- `updatedAt`: Efficient sorting by recency

**Relevant to Feature**:
- `stage` field updated by workflows when they complete successfully
- GitHub Actions workflows call `/api/projects/:id/tickets/:id/transition` to update stage
- Transition API updates `stage` and `version` atomically
- Board component displays tickets grouped by `stage`

**Schema Reference**: `prisma/schema.prisma` (Ticket model)

---

## Data Flow (No Database Changes)

1. **Workflow Execution** (GitHub Actions):
   - Workflow runs command (e.g., `/speckit.implement`)
   - On success, workflow calls `POST /api/projects/:id/tickets/:id/transition`
   - Transition API updates `ticket.stage` and creates new Job (or updates existing)
   - Workflow calls `PATCH /api/jobs/:id/status` to mark job as COMPLETED

2. **Client-Side Polling** (useJobPolling hook):
   - Polls `/api/projects/:id/jobs/status` every 2 seconds
   - Receives updated job list with status changes
   - Detects jobs that transitioned to terminal status (COMPLETED/FAILED/CANCELLED)

3. **Cache Invalidation** (new logic in useJobPolling):
   - When terminal status detected, calls `queryClient.invalidateQueries()`
   - Marks ticket cache as stale
   - TanStack Query automatically refetches `/api/projects/:id/tickets`

4. **Board Update** (Board component):
   - `useTickets()` hook receives updated ticket data
   - React re-renders board with new ticket positions
   - User sees ticket moved to new stage column

**No Database Queries Changed**:
- Existing queries remain unchanged
- Existing indexes support current query patterns
- No new database load introduced

---

## State Transitions (Reference)

### Job Status State Machine

Valid transitions (enforced by `app/lib/job-state-machine.ts`):
```
PENDING → RUNNING → COMPLETED
              ↓ → FAILED
              ↓ → CANCELLED
```

Terminal states (no further transitions):
- `COMPLETED`: Workflow succeeded, ticket stage updated
- `FAILED`: Workflow encountered errors, ticket stage unchanged
- `CANCELLED`: Workflow manually stopped, ticket stage may or may not change

**Relevant to Feature**: Only terminal status transitions trigger cache invalidation. PENDING → RUNNING transitions are ignored (workflow still executing, ticket stage unchanged).

---

### Ticket Stage Transitions

Manual transitions (drag-and-drop):
- User drags ticket → Board calls `POST /api/projects/:id/tickets/:id/transition`
- Optimistic update moves ticket immediately
- Server validates and creates Job if workflow required
- Cache invalidated after server confirms

Automated transitions (workflow-initiated):
- Workflow completes → Calls `POST /api/projects/:id/tickets/:id/transition`
- Server updates `ticket.stage` and job status
- Job polling detects terminal status → Invalidates cache
- Board refetches tickets → Ticket appears in new stage

**Relevant to Feature**: Automated transitions lack optimistic updates (user didn't initiate action). Cache invalidation provides delayed update (within 2 seconds) instead of immediate update.

---

## No Schema Changes Required

**Rationale**:
- All necessary data already captured in existing models
- Job polling endpoint already exists (`/api/projects/:id/jobs/status`)
- Ticket query endpoint already exists (`/api/projects/:id/tickets`)
- Transition API already exists (`POST /api/projects/:id/tickets/:id/transition`)
- No new relationships needed (Job → Ticket already exists)
- No new indexes needed (existing indexes support current queries)

**Migration**: None required

**References**:
- Database schema: `prisma/schema.prisma`
- Job state machine: `app/lib/job-state-machine.ts`
- Transition API: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
- Polling API: `app/api/projects/[projectId]/jobs/status/route.ts`
