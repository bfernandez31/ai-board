# Data Model: Replace SSE with Client-Side Polling

**Feature**: 028-519-replace-sse
**Date**: 2025-10-14

## Overview

This feature requires **NO database schema changes**. The existing Job model fully supports the polling mechanism. This document describes the existing server-side data model and the new client-side state model for polling coordination.

---

## Server-Side Entities (Existing)

### Job Entity

**Table**: `Job`
**Purpose**: Tracks GitHub Actions workflow execution status

**Schema** (Existing, no changes):

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | Int | PRIMARY KEY, AUTO_INCREMENT | Unique job identifier |
| `status` | JobStatus | NOT NULL, ENUM | Current job state |
| `command` | String | NOT NULL | GitHub Actions command (e.g., "specify", "plan") |
| `ticketId` | Int | NOT NULL, FOREIGN KEY → Ticket.id | Associated ticket |
| `projectId` | Int | NOT NULL, FOREIGN KEY → Project.id | Associated project |
| `createdAt` | DateTime | NOT NULL, DEFAULT NOW() | Job creation timestamp |
| `updatedAt` | DateTime | NOT NULL, AUTO_UPDATE | Last modification timestamp |
| `completedAt` | DateTime | NULL | Terminal state timestamp (NULL for PENDING/RUNNING) |

**JobStatus Enum** (Existing):
```typescript
enum JobStatus {
  PENDING   = "PENDING"     // Job created, not started
  RUNNING   = "RUNNING"     // Workflow in progress
  COMPLETED = "COMPLETED"   // Workflow succeeded
  FAILED    = "FAILED"      // Workflow failed
  CANCELLED = "CANCELLED"   // Workflow cancelled
}
```

**Indexes** (Existing):
- Primary key: `id`
- Foreign key: `ticketId` → `Ticket(id)`
- Foreign key: `projectId` → `Project(id)`
- **Performance index**: `projectId` (for efficient job queries by project)

**State Machine** (Existing, preserved):
```
PENDING → RUNNING → COMPLETED
              ↓
            FAILED
              ↓
          CANCELLED
```

**Terminal States**: COMPLETED, FAILED, CANCELLED (no further transitions)

---

## Client-Side State Model (New)

### PollingState

**Scope**: Client-side only (React state, not persisted)
**Purpose**: Coordinate polling behavior and track terminal jobs

**TypeScript Interface**:
```typescript
interface PollingState {
  isPolling: boolean;              // Whether polling is active
  lastPollTime: number | null;     // Timestamp of last successful poll (ms since epoch)
  errorCount: number;              // Consecutive error count (informational only)
  terminalJobIds: Set<number>;     // Job IDs in terminal states (COMPLETED, FAILED, CANCELLED)
}
```

**Field Descriptions**:

| Field | Type | Purpose | Lifecycle |
|-------|------|---------|-----------|
| `isPolling` | `boolean` | Indicates if polling interval is active | Set `true` on mount, `false` on unmount or all jobs terminal |
| `lastPollTime` | `number \| null` | Timestamp of last successful API call | Updated after each successful poll, NULL initially |
| `errorCount` | `number` | Count of consecutive polling failures | Increment on error, reset on success (informational only) |
| `terminalJobIds` | `Set<number>` | Job IDs that reached terminal states | Add job ID when status becomes COMPLETED/FAILED/CANCELLED, never remove |

**State Transitions**:

1. **Component Mount**:
   ```typescript
   { isPolling: true, lastPollTime: null, errorCount: 0, terminalJobIds: new Set() }
   ```

2. **Successful Poll**:
   ```typescript
   {
     isPolling: true,
     lastPollTime: Date.now(),
     errorCount: 0, // Reset on success
     terminalJobIds: Set.union(previous, newTerminalIds)
   }
   ```

3. **Failed Poll**:
   ```typescript
   {
     isPolling: true,
     lastPollTime: previous, // Unchanged
     errorCount: previous + 1,
     terminalJobIds: previous // Unchanged
   }
   ```

4. **All Jobs Terminal**:
   ```typescript
   {
     isPolling: false, // Stop polling
     lastPollTime: previous,
     errorCount: 0,
     terminalJobIds: allJobIds // All jobs in terminal states
   }
   ```

5. **Component Unmount**:
   ```typescript
   // State destroyed, interval cleared
   ```

---

## API Response Model

### JobStatusResponse

**Endpoint**: `GET /api/projects/[projectId]/jobs/status`

**TypeScript Interface**:
```typescript
interface JobStatusResponse {
  jobs: Array<JobStatusDto>;
}

interface JobStatusDto {
  id: number;                    // Job unique identifier
  status: JobStatus;             // Current job state
  ticketId: number;              // Associated ticket ID (for UI mapping)
  updatedAt: string;             // ISO 8601 timestamp (last status change)
}
```

**Example Response**:
```json
{
  "jobs": [
    {
      "id": 42,
      "status": "RUNNING",
      "ticketId": 15,
      "updatedAt": "2025-10-14T10:30:45.123Z"
    },
    {
      "id": 43,
      "status": "COMPLETED",
      "ticketId": 16,
      "updatedAt": "2025-10-14T10:29:12.456Z"
    }
  ]
}
```

**Field Exclusions** (for security/efficiency):
- ❌ `command`: Internal implementation detail, not needed by UI
- ❌ `createdAt`: Not needed for polling (only status changes matter)
- ❌ `completedAt`: Can be inferred from terminal status
- ❌ `projectId`: Already known from request path param

---

## Validation Rules

### Server-Side Validation

**Request Validation**:
- `projectId`: Must be positive integer, must exist in database
- Session: Must have valid NextAuth.js session cookie
- Authorization: `project.userId` must match `session.user.id`

**Response Validation** (Zod Schema):
```typescript
const JobStatusDtoSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]),
  ticketId: z.number().int().positive(),
  updatedAt: z.string().datetime(), // ISO 8601 format
});

const JobStatusResponseSchema = z.object({
  jobs: z.array(JobStatusDtoSchema),
});
```

### Client-Side Validation

**Polling Interval Validation**:
- Interval: Must be exactly 2000ms (2 seconds)
- No dynamic adjustment, no exponential backoff

**Terminal State Detection**:
```typescript
const TERMINAL_STATES = new Set<JobStatus>([
  "COMPLETED",
  "FAILED",
  "CANCELLED"
]);

function isTerminal(status: JobStatus): boolean {
  return TERMINAL_STATES.has(status);
}
```

**Stop Condition**:
```typescript
function shouldStopPolling(jobs: JobStatusDto[], terminalJobIds: Set<number>): boolean {
  const allJobIds = new Set(jobs.map(j => j.id));
  return jobs.length > 0 && allJobIds.size === terminalJobIds.size;
}
```

---

## Relationships

### Entity Relationships (Existing, preserved)

```
Project (1) ──< (∞) Job
  userId ──────> User.id (owner validation)

Ticket (1) ──< (∞) Job
  id ──────> Job.ticketId (display mapping)
```

**Polling Query**:
```typescript
// Prisma query (conceptual)
const jobs = await prisma.job.findMany({
  where: { projectId: projectId },
  select: {
    id: true,
    status: true,
    ticketId: true,
    updatedAt: true,
  },
  orderBy: { updatedAt: 'desc' },
});
```

**Authorization Check**:
```typescript
const project = await prisma.project.findUnique({
  where: { id: projectId },
  select: { userId: true },
});

if (project.userId !== session.user.id) {
  return 403; // Forbidden
}
```

---

## Migration Plan

### Database Changes

✅ **No migrations required** - existing schema sufficient

### Data Migration

✅ **No data migration required** - no schema changes, no data transformations

### Rollback Plan

**If rollback needed**:
1. Revert client-side changes (restore SSEProvider)
2. Revert API route removal (restore /api/sse endpoint)
3. Database schema unchanged, no rollback needed

---

## Performance Considerations

### Database Query Optimization

**Current Index**: `projectId` (existing)
**Query Pattern**: `SELECT id, status, ticketId, updatedAt FROM Job WHERE projectId = ?`
**Expected Performance**: <10ms (indexed lookup, typical board has <50 jobs)

**Monitoring**:
- Track p95 response time for `/api/projects/[projectId]/jobs/status`
- Alert if p95 exceeds 100ms (indicates index issue or scale problem)

### Client-Side Performance

**State Updates**:
- `Set.add()` for terminal job IDs: O(1) operation
- Filter jobs by terminal IDs: O(n) where n = job count (typically <50)

**React Rendering**:
- Use `React.memo` for TicketCard to prevent unnecessary re-renders
- Only re-render tickets whose job status changed

---

## Security Considerations

### Authentication & Authorization

**Session Validation** (existing pattern):
```typescript
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return 401; // Unauthorized
}
```

**Project Ownership** (existing pattern):
```typescript
const project = await prisma.project.findUnique({
  where: { id: projectId },
  select: { userId: true },
});

if (!project || project.userId !== session.user.id) {
  return 403; // Forbidden
}
```

### Data Exposure

**Sensitive Fields Excluded**:
- ❌ Internal IDs beyond job/ticket IDs
- ❌ GitHub workflow URLs (not needed, potential info leak)
- ❌ Command details (internal implementation)

**Public Fields Included**:
- ✅ Job ID (public within project scope)
- ✅ Job status (user-facing, necessary for UI)
- ✅ Ticket ID (user-facing, necessary for mapping)
- ✅ Update timestamp (user-facing, useful for debugging)

---

## Conclusion

The polling mechanism requires **zero database schema changes**. The existing Job model fully supports the feature. Client-side state management uses standard React patterns (useState, Set) with clear lifecycle rules. API response model is minimal, secure, and efficient.

**Ready for**: Contract generation and test implementation (Phase 1 continuation)
