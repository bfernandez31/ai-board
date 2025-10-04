# Data Model: Add Job Model

**Feature**: 013-add-job-model
**Date**: 2025-10-04
**Status**: Complete

## Entity: Job

**Purpose**: Track spec-kit workflow command executions with status, logs, and Git metadata

**Lifecycle States**: pending → running → (completed | failed)

### Fields

| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | Int | Primary key, auto-increment | Unique job identifier |
| `ticketId` | Int | Foreign key → Ticket.id, required, cascade delete | Links job to triggering ticket |
| `command` | String | Max 50 chars, required | Spec-kit command executed (specify, plan, task, implement, clarify) |
| `status` | JobStatus | Enum, required | Current execution state (pending, running, completed, failed) |
| `branch` | String? | Max 200 chars, nullable | Git branch where command executed (null if unavailable) |
| `commitSha` | String? | Max 40 chars, nullable | Git commit SHA (null if unavailable) |
| `logs` | String? | Text, nullable | Complete execution logs including error traces |
| `startedAt` | DateTime | Required, default now() | When job execution began |
| `completedAt` | DateTime? | Nullable | When job finished (null if still running) |
| `createdAt` | DateTime | Required, default now() | Record creation timestamp |
| `updatedAt` | DateTime | Required, auto-updated | Last modification timestamp |

### Relationships

```
Job n:1 Ticket (many jobs per ticket, cascade delete when ticket deleted)
```

**Cascade Delete Behavior**:
- When ticket deleted → all associated jobs deleted automatically
- Running jobs marked as failed with "ticket deleted" in logs before cascade
- Database constraint ensures referential integrity

### Indexes

```prisma
@@index([ticketId])                    // Query jobs by ticket
@@index([status])                      // Query jobs by status
@@index([startedAt])                   // Query jobs by time range
@@index([ticketId, status, startedAt]) // Composite for common query pattern
```

**Query Patterns Supported**:
- All jobs for a ticket: `WHERE ticketId = ?`
- All pending/running jobs: `WHERE status = ?`
- Recent jobs: `WHERE startedAt > ?`
- Ticket jobs by status, ordered by time: `WHERE ticketId = ? AND status = ? ORDER BY startedAt`

### Validation Rules

**Field-Level**:
- `command`: Max 50 characters (enforced at DB level via VarChar(50))
- `branch`: Max 200 characters (enforced at DB level via VarChar(200))
- `commitSha`: Max 40 characters (enforced at DB level via VarChar(40), SHA-1 hash length)
- `logs`: Unlimited length (PostgreSQL TEXT type)

**Business Rules** (enforced at application level - future ticket):
- `command` must be one of: specify, plan, task, implement, clarify
- `status` transitions: pending → running → (completed | failed)
- Invalid transitions blocked (e.g., pending → completed)
- `completedAt` must be null when status is pending or running
- `completedAt` required when status is completed or failed

### State Transitions

```
[Job Created]
    ↓
pending (startedAt set, completedAt null)
    ↓ (execution begins)
running (status updated)
    ↓ (execution finishes)
    ├─→ completed (completedAt set, logs stored)
    └─→ failed (completedAt set, error logs stored)
```

**Special Transitions**:
- Timeout: running → failed (timeout indicated in logs)
- Ticket deletion: any state → failed → cascade deleted

## Entity: JobStatus (Enum)

**Purpose**: Valid job execution states

**Values**:
- `PENDING`: Job created but not yet started
- `RUNNING`: Job currently executing
- `COMPLETED`: Job finished successfully
- `FAILED`: Job encountered error or timeout

**Rationale**: Enum at database level ensures data integrity and provides type safety

## Schema Design

### Prisma Schema Definition

```prisma
enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  command     String    @db.VarChar(50)
  status      JobStatus @default(PENDING)
  branch      String?   @db.VarChar(200)
  commitSha   String?   @db.VarChar(40)
  logs        String?   @db.Text
  startedAt   DateTime  @default(now())
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([ticketId])
  @@index([status])
  @@index([startedAt])
  @@index([ticketId, status, startedAt])
}
```

### Ticket Model Update

```prisma
model Ticket {
  // ... existing fields ...
  jobs Job[] // Add this relation
}
```

## Migration Strategy

1. **Add enum and model** to `schema.prisma`
2. **Generate migration**: `npx prisma migrate dev --name add-job-model`
3. **Review migration SQL**: Verify enum creation, table creation, indexes, foreign key
4. **Apply migration**: Automatically applied by migrate dev
5. **Regenerate client**: `npx prisma generate` (automatic)

**Migration Checklist**:
- [x] JobStatus enum created with 4 values
- [x] Job table created with all fields
- [x] Foreign key constraint on ticketId with CASCADE delete
- [x] Default values applied (status=PENDING, startedAt=now(), createdAt=now())
- [x] Indexes created on ticketId, status, startedAt, and composite
- [x] Ticket model updated with jobs relation

## Design Decisions

### Why nullable logs?

Jobs created with status=PENDING may not have logs yet. Logs populated when job starts/completes.

### Why nullable completedAt?

Running and pending jobs have no completion time. Only set when status transitions to completed/failed.

### Why nullable Git metadata?

Clarification confirmed Git metadata may be unavailable at job creation time (e.g., detached HEAD, no Git repo).

### Why TEXT instead of VARCHAR for logs?

Logs can contain full stack traces and command output (potentially MB of data). PostgreSQL TEXT supports up to 1GB and automatically compresses via TOAST.

### Why composite index?

Common query pattern: "Get all jobs for ticket X with status Y, ordered by time". Composite index avoids sequential scan and sort.

### Why String for command instead of enum?

Allows future command additions without database migration. Application layer validates against allowed commands using Zod.

## Data Integrity Guarantees

1. **Referential Integrity**: Foreign key constraint ensures ticketId always references valid Ticket
2. **Cascade Delete**: Database automatically deletes jobs when ticket deleted
3. **Type Safety**: Enum constraint ensures status is always valid
4. **Performance**: Indexes ensure sub-second query times even with thousands of jobs per ticket
5. **ACID Compliance**: All operations wrapped in PostgreSQL transactions

## Storage Considerations

**Expected Growth**:
- Jobs created on every ticket stage transition
- Average 5-10 jobs per ticket (one per spec-kit command)
- Average log size: 10-100KB (varies by command)
- Large logs (>1MB): Compressed by PostgreSQL TOAST

**Retention**:
- Unlimited (FR-013: no cleanup policy)
- Jobs deleted only when ticket deleted
- Database backup includes all job history

**Performance Impact**:
- Indexes maintain O(log n) query performance
- TOAST stores large logs separately (no row bloat)
- Regular VACUUM recommended for deleted jobs cleanup

## TypeScript Types (Generated)

```typescript
// Generated by Prisma Client

enum JobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

interface Job {
  id: number;
  ticketId: number;
  command: string;
  status: JobStatus;
  branch: string | null;
  commitSha: string | null;
  logs: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ticket: Ticket; // Relation
}
```

## Future Enhancements (Not in Scope)

1. **External Log Storage**: Move logs >10MB to S3/object storage
2. **Log Compression**: Gzip logs before storage
3. **Timeout Duration Field**: Store actual timeout used (currently config-based)
4. **Retry Count**: Track number of execution attempts
5. **Job Artifacts**: Store command outputs (files, screenshots)
6. **Job Queue**: Manage pending jobs with priority
