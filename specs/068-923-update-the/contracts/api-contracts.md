# API Contracts: Board Real-Time Update on Workflow Stage Transitions

## Overview

This feature **does not introduce new API endpoints**. It leverages existing REST APIs to detect workflow completions and trigger client-side cache invalidation.

## Existing API Endpoints (Reference)

### GET `/api/projects/:projectId/jobs/status`

Polls job status updates for a project. Used by `useJobPolling` hook to detect workflow completions.

**Request**:
```http
GET /api/projects/1/jobs/status HTTP/1.1
Content-Type: application/json
Cookie: next-auth.session-token=...
```

**Response** (200 OK):
```json
{
  "jobs": [
    {
      "id": 123,
      "ticketId": 456,
      "status": "COMPLETED",
      "updatedAt": "2025-10-28T10:30:00.000Z"
    },
    {
      "id": 124,
      "ticketId": 457,
      "status": "RUNNING",
      "updatedAt": "2025-10-28T10:29:00.000Z"
    }
  ]
}
```

**Polling Behavior**:
- Called every 2 seconds by `useJobPolling` hook
- Continues until all jobs reach terminal status (COMPLETED/FAILED/CANCELLED)
- TanStack Query deduplicates concurrent requests

**Relevant to Feature**:
- Job status changes detected by comparing previous and current responses
- Terminal status transitions trigger cache invalidation
- No API changes required

**Implementation**: `app/api/projects/[projectId]/jobs/status/route.ts`

---

### GET `/api/projects/:projectId/tickets`

Fetches all tickets for a project. Used by `useTickets` hook to display board state.

**Request**:
```http
GET /api/projects/1/tickets HTTP/1.1
Content-Type: application/json
Cookie: next-auth.session-token=...
```

**Response** (200 OK):
```json
[
  {
    "id": 456,
    "title": "Implement user authentication",
    "description": "Add OAuth 2.0 authentication flow",
    "stage": "BUILD",
    "version": 3,
    "projectId": 1,
    "branch": "042-user-auth",
    "autoMode": true,
    "workflowType": "FULL",
    "createdAt": "2025-10-27T09:00:00.000Z",
    "updatedAt": "2025-10-28T10:30:00.000Z"
  },
  {
    "id": 457,
    "title": "Fix login button styling",
    "description": "Update button colors to match design system",
    "stage": "VERIFY",
    "version": 1,
    "projectId": 1,
    "branch": "043-login-button",
    "autoMode": false,
    "workflowType": "QUICK",
    "createdAt": "2025-10-28T08:00:00.000Z",
    "updatedAt": "2025-10-28T10:29:00.000Z"
  }
]
```

**Caching Behavior**:
- TanStack Query caches response for 5 seconds (staleTime)
- Cache invalidated when job reaches terminal status (new behavior)
- Automatic refetch after invalidation

**Relevant to Feature**:
- Refetched automatically after cache invalidation
- Updated ticket stages displayed on board
- No API changes required

**Implementation**: `app/api/projects/[projectId]/tickets/route.ts`

---

### POST `/api/projects/:projectId/tickets/:id/transition`

Transitions a ticket to a different stage. Called by workflows when they complete successfully.

**Request**:
```http
POST /api/projects/1/tickets/456/transition HTTP/1.1
Content-Type: application/json
Cookie: next-auth.session-token=...

{
  "targetStage": "VERIFY",
  "version": 3
}
```

**Response** (200 OK):
```json
{
  "id": 456,
  "title": "Implement user authentication",
  "description": "Add OAuth 2.0 authentication flow",
  "stage": "VERIFY",
  "version": 4,
  "projectId": 1,
  "branch": "042-user-auth",
  "autoMode": true,
  "workflowType": "FULL",
  "createdAt": "2025-10-27T09:00:00.000Z",
  "updatedAt": "2025-10-28T10:30:15.000Z"
}
```

**Behavior**:
- Updates `ticket.stage` and increments `version`
- Creates new Job record (PENDING status) if workflow required
- Returns updated ticket with new version for optimistic concurrency control

**Relevant to Feature**:
- Workflows call this endpoint after successful execution
- Server updates ticket stage in database
- Job polling detects job completion → triggers cache invalidation
- Board refetches tickets → displays updated stage

**Implementation**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`

---

### PATCH `/api/jobs/:id/status`

Updates job status when workflows complete. Called by GitHub Actions workflows at end of execution.

**Request**:
```http
PATCH /api/jobs/123/status HTTP/1.1
Content-Type: application/json
Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}

{
  "status": "COMPLETED"
}
```

**Response** (200 OK):
```json
{
  "id": 123,
  "status": "COMPLETED",
  "completedAt": "2025-10-28T10:30:15.000Z"
}
```

**Valid Status Transitions**:
- PENDING → RUNNING
- RUNNING → COMPLETED
- RUNNING → FAILED
- RUNNING → CANCELLED

**Behavior**:
- Updates `job.status` field
- Sets `job.completedAt` timestamp for terminal statuses
- Validates state machine transitions (returns 400 for invalid transitions)

**Relevant to Feature**:
- Workflow calls this endpoint to mark job as terminal
- Job polling detects status change → triggers cache invalidation
- Cache invalidation refetches tickets → board updates

**Implementation**: `app/api/jobs/[id]/status/route.ts`

---

## Client-Side Integration (New Behavior)

### TanStack Query Cache Invalidation

**Location**: `app/lib/hooks/useJobPolling.ts` (modified)

**New Logic**:
```typescript
// Pseudocode (implementation in quickstart.md)
const previousJobsRef = useRef<JobStatusDto[]>([]);
const queryClient = useQueryClient();

useEffect(() => {
  // Detect jobs that transitioned to terminal status
  const newlyTerminal = jobs.filter(job =>
    TERMINAL_STATUSES.has(job.status) &&
    !previousJobsRef.current.some(prev =>
      prev.id === job.id && TERMINAL_STATUSES.has(prev.status)
    )
  );

  // Invalidate tickets cache when workflow completes
  if (newlyTerminal.length > 0) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.projects.tickets(projectId),
    });
  }

  previousJobsRef.current = jobs;
}, [jobs, projectId, queryClient]);
```

**Behavior**:
- Runs after every job poll (every 2 seconds)
- Compares current jobs with previous jobs to detect status changes
- Only invalidates cache when job transitions to terminal status
- Does NOT invalidate on initial load (no previous jobs to compare)

**Cache Invalidation Effect**:
- TanStack Query marks tickets cache as stale
- Automatic refetch triggered for all components using `useTickets()`
- Board component re-renders with updated ticket positions
- User sees ticket moved to new stage column (within 2 seconds)

---

## No API Changes Required

**Rationale**:
- All necessary endpoints already exist and functional
- Job polling endpoint returns status changes
- Tickets endpoint returns updated ticket stages
- Transition endpoint already called by workflows
- Job status endpoint already called by workflows

**Client-Side Only**:
- Cache invalidation logic added to `useJobPolling` hook
- No server-side changes required
- No database queries modified
- No new API surface area

**References**:
- Job polling API: `app/api/projects/[projectId]/jobs/status/route.ts`
- Tickets API: `app/api/projects/[projectId]/tickets/route.ts`
- Transition API: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
- Job status API: `app/api/jobs/[id]/status/route.ts`
- TanStack Query invalidation: `app/lib/hooks/mutations/useStageTransition.ts:87-93` (existing pattern)
