# API Contracts: Real-Time UI Stage Synchronization

**Feature**: Real-Time UI Stage Synchronization
**Date**: 2025-10-30
**Status**: No API changes required

## Overview

This feature does not introduce any new API endpoints or modify existing endpoint contracts. The fix is purely client-side (polling hook enhancement). This document describes the existing API endpoints used by the feature for reference and testing purposes.

## Existing Endpoints (No Changes)

### GET /api/projects/:projectId/jobs/status

**Purpose**: Fetch all jobs for a project to detect workflow execution status.

**Implementation**: `app/api/projects/[projectId]/jobs/status/route.ts`

**Authorization**: Session-based (NextAuth.js)
- User must be owner OR member of project
- Validates via `verifyProjectAccess(projectId)`

**Request**:
```http
GET /api/projects/1/jobs/status HTTP/1.1
Content-Type: application/json
Cookie: next-auth.session-token=<session>
```

**Response (200 OK)**:
```json
{
  "jobs": [
    {
      "id": 42,
      "status": "COMPLETED",
      "ticketId": 10,
      "command": "quick-impl",
      "updatedAt": "2025-10-30T12:34:56.789Z"
    },
    {
      "id": 43,
      "status": "RUNNING",
      "ticketId": 11,
      "command": "specify",
      "updatedAt": "2025-10-30T12:35:00.123Z"
    }
  ]
}
```

**Response Schema** (Zod):
```typescript
const jobStatusSchema = z.object({
  id: z.number(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  ticketId: z.number(),
  command: z.string(),
  updatedAt: z.string(),
});

const responseSchema = z.object({
  jobs: z.array(jobStatusSchema),
});
```

**Error Responses**:
- **401 Unauthorized**: No valid session
  ```json
  { "error": "Unauthorized" }
  ```
- **403 Forbidden**: User not owner/member of project
  ```json
  { "error": "Forbidden" }
  ```
- **404 Not Found**: Project does not exist
  ```json
  { "error": "Project not found" }
  ```
- **500 Internal Server Error**: Database error
  ```json
  { "error": "Internal server error" }
  ```

**Performance**:
- Target: < 100ms p95 response time
- Polling interval: 2 seconds (client-side)
- Index used: `Job.@@index([projectId])`

**Caching**:
- `cache: 'no-store'` (client-side fetch)
- TanStack Query `staleTime: 0` (always fresh)
- TanStack Query `refetchInterval: 2000` (2-second polling)

**Usage by Feature**:
- Called by `useJobPolling` hook every 2 seconds
- Detects job status changes (RUNNING → COMPLETED)
- Triggers tickets cache invalidation on terminal status

---

### GET /api/projects/:projectId/tickets

**Purpose**: Fetch all tickets for a project, including current stage.

**Implementation**: `app/api/projects/[projectId]/tickets/route.ts`

**Authorization**: Session-based (NextAuth.js)
- User must be owner OR member of project
- Validates via `verifyProjectAccess(projectId)`

**Request**:
```http
GET /api/projects/1/tickets HTTP/1.1
Content-Type: application/json
Cookie: next-auth.session-token=<session>
```

**Response (200 OK)**:
```json
[
  {
    "id": 10,
    "title": "[e2e] Quick-impl test ticket",
    "description": "Test description",
    "stage": "VERIFY",
    "version": 3,
    "projectId": 1,
    "branch": "010-quick-impl-test",
    "autoMode": false,
    "workflowType": "QUICK",
    "attachments": [],
    "createdAt": "2025-10-30T10:00:00.000Z",
    "updatedAt": "2025-10-30T12:34:56.789Z",
    "clarificationPolicy": null
  },
  {
    "id": 11,
    "title": "[e2e] Full workflow test",
    "description": "Test description",
    "stage": "SPECIFY",
    "version": 2,
    "projectId": 1,
    "branch": "011-full-workflow-test",
    "autoMode": true,
    "workflowType": "FULL",
    "attachments": [],
    "createdAt": "2025-10-30T10:30:00.000Z",
    "updatedAt": "2025-10-30T12:00:00.000Z",
    "clarificationPolicy": "AUTO"
  }
]
```

**Response Schema** (TypeScript):
```typescript
type TicketWithVersion = {
  id: number;
  title: string;
  description: string;
  stage: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP';
  version: number;
  projectId: number;
  branch: string | null;
  autoMode: boolean;
  workflowType: 'FULL' | 'QUICK';
  attachments: unknown[];
  createdAt: string;
  updatedAt: string;
  clarificationPolicy: 'AUTO' | 'CONSERVATIVE' | 'PRAGMATIC' | 'INTERACTIVE' | null;
};

type Response = TicketWithVersion[];
```

**Error Responses**:
- **401 Unauthorized**: No valid session
  ```json
  { "error": "Unauthorized" }
  ```
- **403 Forbidden**: User not owner/member of project
  ```json
  { "error": "Forbidden" }
  ```
- **404 Not Found**: Project does not exist
  ```json
  { "error": "Project not found" }
  ```
- **500 Internal Server Error**: Database error
  ```json
  { "error": "Internal server error" }
  ```

**Performance**:
- Target: < 100ms p95 response time (assumed, similar to jobs endpoint)
- Called on-demand when tickets cache invalidated
- Index used: `Ticket.@@index([projectId])`

**Caching** (TanStack Query):
- Key: `['projects', projectId, 'tickets']`
- `staleTime: 5000` (fresh for 5 seconds)
- `gcTime: 600000` (keep in cache for 10 minutes)
- Invalidated by `useJobPolling` hook on terminal job status

**Usage by Feature**:
- Queried by `useProjectTickets` and `useTicketsByStage` hooks
- Automatically refetched when cache invalidated
- Background refetch keeps UI responsive

---

### PATCH /api/projects/:projectId/tickets/:id

**Purpose**: Update ticket fields, including stage (used by workflows and manual drag-and-drop).

**Implementation**: `app/api/projects/[projectId]/tickets/[id]/route.ts`

**Authorization**: Session-based (NextAuth.js)
- User must be owner OR member of project
- Validates via `verifyTicketAccess(ticketId)`

**Request** (Stage transition):
```http
PATCH /api/projects/1/tickets/10 HTTP/1.1
Content-Type: application/json
Cookie: next-auth.session-token=<session>

{
  "stage": "VERIFY",
  "version": 2
}
```

**Response (200 OK)**:
```json
{
  "id": 10,
  "title": "[e2e] Quick-impl test ticket",
  "description": "Test description",
  "stage": "VERIFY",
  "version": 3,
  "projectId": 1,
  "branch": "010-quick-impl-test",
  "autoMode": false,
  "workflowType": "QUICK",
  "attachments": [],
  "createdAt": "2025-10-30T10:00:00.000Z",
  "updatedAt": "2025-10-30T12:34:56.789Z",
  "clarificationPolicy": null
}
```

**Request Schema** (Zod):
```typescript
const updateTicketSchema = z.object({
  title: z.string().max(100).optional(),
  description: z.string().max(2500).optional(),
  stage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']).optional(),
  branch: z.string().max(200).nullable().optional(),
  autoMode: z.boolean().optional(),
  version: z.number().int().positive(), // Required for optimistic concurrency control
});
```

**Error Responses**:
- **400 Bad Request**: Validation error or version conflict
  ```json
  { "error": "Version conflict: ticket has been modified" }
  ```
- **401 Unauthorized**: No valid session
  ```json
  { "error": "Unauthorized" }
  ```
- **403 Forbidden**: User not owner/member of project
  ```json
  { "error": "Forbidden" }
  ```
- **404 Not Found**: Ticket does not exist
  ```json
  { "error": "Ticket not found" }
  ```
- **500 Internal Server Error**: Database error
  ```json
  { "error": "Internal server error" }
  ```

**Optimistic Concurrency Control**:
- Client sends current `version` in request body
- Server checks `version` matches database version
- If mismatch: returns 409 Conflict or 400 Bad Request
- If match: increments version and updates ticket

**Usage by Feature**:
- Called by GitHub Actions workflows to transition ticket stages
- Called by frontend drag-and-drop handler for manual transitions
- Does NOT automatically invalidate frontend cache (this is the bug being fixed)

**Critical Insight**: When workflows call this endpoint to update `stage`, the database is correctly updated, but the frontend polling hook does not detect the stage change because it only monitors job status, not ticket data. This feature fixes the issue by having the polling hook invalidate the tickets cache when terminal job statuses are detected (which correlate with stage transitions).

---

## Testing Endpoints

### Test Scenarios

#### Scenario 1: Quick-Impl Workflow Stage Transition

```
1. Create ticket in INBOX stage
2. Dispatch quick-impl workflow (INBOX → BUILD)
3. Workflow transitions ticket: BUILD → VERIFY
   - PATCH /api/projects/1/tickets/10 { stage: "VERIFY", version: 2 }
   - PATCH /api/jobs/42/status { status: "COMPLETED" }
4. Polling hook detects job status: RUNNING → COMPLETED
   - GET /api/projects/1/jobs/status (every 2s)
5. Polling hook invalidates tickets cache
6. TanStack Query refetches tickets
   - GET /api/projects/1/tickets (background refetch)
7. UI updates to show ticket in VERIFY column
```

**Expected Behavior**: Ticket moves from BUILD to VERIFY in UI within 2-3 seconds

**Acceptance Criteria**: Zero page refreshes required

---

#### Scenario 2: Auto-Ship Deployment Stage Transition

```
1. Create ticket in VERIFY stage with merged branch
2. Dispatch auto-ship workflow (VERIFY → SHIP)
3. Workflow transitions ticket: VERIFY → SHIP
   - PATCH /api/projects/1/tickets/11 { stage: "SHIP", version: 3 }
   - PATCH /api/jobs/43/status { status: "COMPLETED" }
4. Polling hook detects job status: RUNNING → COMPLETED
   - GET /api/projects/1/jobs/status (every 2s)
5. Polling hook invalidates tickets cache
6. TanStack Query refetches tickets
   - GET /api/projects/1/tickets (background refetch)
7. UI updates to show ticket in SHIP column
```

**Expected Behavior**: Ticket moves from VERIFY to SHIP in UI within 2-3 seconds

**Acceptance Criteria**: Zero page refreshes required

---

#### Scenario 3: Manual Drag-and-Drop (Backward Compatibility)

```
1. User drags ticket from BUILD to INBOX (rollback)
2. Frontend calls transition API with optimistic update
   - PATCH /api/projects/1/tickets/12 { stage: "INBOX", version: 4 }
3. TanStack Query optimistic update shows ticket in INBOX immediately
4. API responds with updated ticket
5. TanStack Query replaces optimistic data with server data
6. Polling continues to work for other tickets
```

**Expected Behavior**: Ticket moves immediately (optimistic update), no visual flicker

**Acceptance Criteria**: Manual transitions unaffected by polling logic

---

## Contract Testing Checklist

- [x] No new endpoints created
- [x] No existing endpoint signatures modified
- [x] No request/response schema changes
- [x] No new validation rules required
- [x] No authorization changes needed
- [x] All contracts remain backward compatible
- [x] Existing API tests cover all scenarios
- [x] No contract test updates required

## Performance Testing

**Polling Endpoint** (`GET /api/projects/:projectId/jobs/status`):
- Baseline: < 100ms p95 (measured)
- Post-feature: < 100ms p95 (no changes expected)
- Load test: 100 concurrent users polling every 2 seconds

**Tickets Endpoint** (`GET /api/projects/:projectId/tickets`):
- Baseline: < 100ms p95 (assumed)
- Post-feature: Monitor for increase due to additional refetches
- Alert threshold: > 150ms p95

**Cache Invalidation Impact**:
- One additional tickets fetch per terminal job
- TanStack Query deduplication prevents redundant requests
- Expected increase: < 10% additional API calls

## Monitoring & Alerting

**Key Metrics**:
1. Polling endpoint response time (p50, p95, p99)
2. Tickets endpoint response time (p50, p95, p99)
3. Tickets cache hit rate (TanStack Query devtools)
4. Time from workflow completion to UI update (E2E test measurement)

**Alerting Thresholds**:
- Polling endpoint p95 > 150ms: Investigate query performance
- Tickets endpoint p95 > 150ms: Investigate query performance or index usage
- UI update latency > 5s: Investigate polling or refetch failures

**Dashboard Panels**:
- API response times (time series)
- Cache invalidation frequency (counter)
- TanStack Query cache statistics (gauge)
- E2E test success rate (percentage)

## References

- **Polling Endpoint Implementation**: `app/api/projects/[projectId]/jobs/status/route.ts`
- **Tickets Endpoint Implementation**: `app/api/projects/[projectId]/tickets/route.ts`
- **Ticket Update Endpoint**: `app/api/projects/[projectId]/tickets/[id]/route.ts`
- **Query Hooks**: `app/lib/hooks/queries/useTickets.ts`
- **Polling Hook**: `app/lib/hooks/useJobPolling.ts`
- **Feature Spec**: `specs/076-934-ui-stages/spec.md`
