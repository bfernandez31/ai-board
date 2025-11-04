# API Contract: DELETE Ticket

**Endpoint**: `DELETE /api/projects/{projectId}/tickets/{id}`
**Purpose**: Delete a ticket and clean up associated GitHub artifacts (branch, PRs)
**Feature**: Drag and Drop Ticket to Trash

---

## Request

### HTTP Method
```
DELETE
```

### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `projectId` | integer | Yes | Project ID that owns the ticket | `1` |
| `id` | integer | Yes | Ticket ID to delete | `42` |

### Headers

| Header | Value | Required | Description |
|--------|-------|----------|-------------|
| `Content-Type` | `application/json` | Yes | Request content type |
| `Cookie` | `next-auth.session-token=...` | Yes | NextAuth.js session cookie (automatic) |

### Query Parameters
None

### Request Body
None (DELETE request with no body)

### Example Request

```http
DELETE /api/projects/1/tickets/42 HTTP/1.1
Host: ai-board.vercel.app
Content-Type: application/json
Cookie: next-auth.session-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

```bash
# cURL example
curl -X DELETE \
  https://ai-board.vercel.app/api/projects/1/tickets/42 \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..."
```

```typescript
// Fetch API example (from frontend)
const response = await fetch(`/api/projects/1/tickets/42`, {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Include session cookie
});
```

---

## Response

### Success Response (200 OK)

**Status Code**: `200 OK`

**Body**:
```json
{
  "success": true,
  "deleted": {
    "ticketId": 42,
    "ticketKey": "ABC-42",
    "branch": "084-feature-name",
    "prsClosed": 1
  }
}
```

**Response Schema**:
```typescript
interface DeleteTicketSuccessResponse {
  success: true;
  deleted: {
    ticketId: number;         // Deleted ticket ID
    ticketKey: string;        // Deleted ticket key (human-readable)
    branch: string | null;    // Branch name that was deleted (null if no branch)
    prsClosed: number;        // Number of PRs closed (0 if no PRs)
  };
}
```

**Example**:
```typescript
// Ticket with branch and PR
{
  "success": true,
  "deleted": {
    "ticketId": 42,
    "ticketKey": "MOB-42",
    "branch": "084-drag-and-drop",
    "prsClosed": 1
  }
}

// Ticket without branch (INBOX stage)
{
  "success": true,
  "deleted": {
    "ticketId": 15,
    "ticketKey": "MOB-15",
    "branch": null,
    "prsClosed": 0
  }
}
```

---

### Error Responses

#### 400 Bad Request - Invalid Stage

**Scenario**: Attempting to delete a SHIP stage ticket

**Body**:
```json
{
  "error": "Cannot delete SHIP stage tickets",
  "code": "INVALID_STAGE"
}
```

---

#### 400 Bad Request - Active Job

**Scenario**: Ticket has a pending or running job

**Body**:
```json
{
  "error": "Cannot delete ticket while job is in progress",
  "code": "ACTIVE_JOB"
}
```

---

#### 401 Unauthorized

**Scenario**: No session token provided or session expired

**Body**:
```json
{
  "error": "Unauthorized. Please sign in.",
  "code": "UNAUTHORIZED"
}
```

---

#### 403 Forbidden

**Scenario**: User is not the project owner or member

**Body**:
```json
{
  "error": "Forbidden. You do not have access to this project.",
  "code": "FORBIDDEN"
}
```

---

#### 404 Not Found

**Scenario 1**: Ticket does not exist
```json
{
  "error": "Ticket not found",
  "code": "NOT_FOUND"
}
```

**Scenario 2**: Ticket exists but does not belong to specified project
```json
{
  "error": "Ticket not found in this project",
  "code": "NOT_FOUND"
}
```

---

#### 500 Internal Server Error - GitHub API Failure

**Scenario**: GitHub API call failed (rate limit, network, permissions)

**Body**:
```json
{
  "error": "Failed to delete GitHub artifacts. Please try again.",
  "code": "GITHUB_API_ERROR",
  "details": {
    "operation": "delete_branch",
    "message": "API rate limit exceeded"
  }
}
```

**Rollback Behavior**: Ticket remains in database unchanged (transactional integrity).

---

#### 500 Internal Server Error - Database Failure

**Scenario**: Database deletion failed (unlikely)

**Body**:
```json
{
  "error": "Failed to delete ticket from database",
  "code": "DATABASE_ERROR"
}
```

---

## Business Rules & Validation

### Pre-Deletion Validation

1. **Authentication**: Session must exist (`next-auth.session-token` cookie)
2. **Authorization**: User must be project owner OR member
3. **Ticket Ownership**: Ticket must belong to specified `projectId`
4. **Stage Restriction**: `ticket.stage !== 'SHIP'`
5. **Job Status Check**: No jobs with `status IN ('PENDING', 'RUNNING')`

### Deletion Sequence

1. **Validate** (authorization, stage, active jobs)
2. **GitHub Cleanup** (if `ticket.branch` exists):
   - List open PRs with `head === ticket.branch`
   - Close all matching PRs (`pulls.update({ state: 'closed' })`)
   - Delete branch (`git.deleteRef({ ref: 'heads/{branch}' })`)
3. **Database Deletion** (transactional):
   - Delete ticket (cascade deletes Jobs, Comments via FK constraints)

### Error Handling

- **GitHub API failure**: Transaction rolled back, ticket preserved, error returned
- **Database failure**: Error returned (ticket may remain in inconsistent state - unlikely)
- **Idempotent operations**: 404 errors from GitHub (branch/PR already deleted) are acceptable

---

## Performance Characteristics

### Typical Response Times

| Scenario | GitHub Operations | Expected Time |
|----------|-------------------|---------------|
| INBOX ticket (no branch) | 0 API calls | <100ms |
| Ticket with branch, no PR | 2 API calls (list + delete) | ~2-3s |
| Ticket with branch + PR | 3 API calls (list + close + delete) | ~4-5s |
| Ticket with branch + 2 PRs | 4 API calls (list + close + close + delete) | ~6-7s |

### Rate Limits

- **GitHub API**: 5000 req/hour authenticated (1.4 req/s sustained)
- **Deletion impact**: ~3 requests per ticket (typical)
- **Max deletions/hour**: ~1600 tickets/hour (sustained)

### Timeout

- **Client timeout**: 10 seconds (recommended)
- **Server timeout**: 30 seconds (Vercel serverless function default)

---

## Security Considerations

### Authorization

- **Session-based**: NextAuth.js session cookie required
- **Project-level**: User must be owner or member (not just any authenticated user)
- **Ticket-level**: Ticket must belong to project (prevents cross-project access)

### GitHub Token

- **Storage**: Environment variable (`GITHUB_TOKEN`)
- **Scope**: `repo` (full repository access)
- **Exposure**: Never exposed to client (server-side only)

### Input Validation (Zod Schema)

```typescript
const deleteTicketParamsSchema = z.object({
  projectId: z.string().transform(Number).pipe(z.number().int().positive()),
  id: z.string().transform(Number).pipe(z.number().int().positive()),
});
```

### SQL Injection Protection

- **Prisma ORM**: All queries parameterized
- **No raw SQL**: DELETE operation uses Prisma client (`prisma.ticket.delete()`)

---

## Examples

### Example 1: Delete INBOX Ticket (No Branch)

**Request**:
```bash
DELETE /api/projects/3/tickets/20
```

**Response** (200 OK):
```json
{
  "success": true,
  "deleted": {
    "ticketId": 20,
    "ticketKey": "MOB-20",
    "branch": null,
    "prsClosed": 0
  }
}
```

**Timeline**:
- 0ms: Authorization check
- 10ms: Validate stage and job status
- 20ms: No GitHub cleanup needed
- 50ms: Delete from database
- **Total**: ~50ms

---

### Example 2: Delete BUILD Ticket (With Branch and PR)

**Request**:
```bash
DELETE /api/projects/3/tickets/42
```

**Response** (200 OK):
```json
{
  "success": true,
  "deleted": {
    "ticketId": 42,
    "ticketKey": "MOB-42",
    "branch": "084-drag-and-drop",
    "prsClosed": 1
  }
}
```

**Timeline**:
- 0ms: Authorization check
- 10ms: Validate stage and job status
- 20ms: List open PRs (GitHub API) → 1 PR found
- 2000ms: Close PR #123 (GitHub API)
- 4000ms: Delete branch (GitHub API)
- 4100ms: Delete from database
- **Total**: ~4100ms (~4 seconds)

---

### Example 3: Delete Fails - Active Job

**Request**:
```bash
DELETE /api/projects/3/tickets/55
```

**Response** (400 Bad Request):
```json
{
  "error": "Cannot delete ticket while job is in progress",
  "code": "ACTIVE_JOB"
}
```

**Timeline**:
- 0ms: Authorization check
- 10ms: Validate stage
- 20ms: Check active jobs → Found RUNNING job
- **Total**: ~20ms (fast failure)

---

### Example 4: Delete Fails - GitHub API Rate Limit

**Request**:
```bash
DELETE /api/projects/3/tickets/99
```

**Response** (500 Internal Server Error):
```json
{
  "error": "Failed to delete GitHub artifacts. Please try again.",
  "code": "GITHUB_API_ERROR",
  "details": {
    "operation": "list_prs",
    "message": "API rate limit exceeded. Resets at 2025-11-04T15:30:00Z"
  }
}
```

**Timeline**:
- 0ms: Authorization check
- 10ms: Validate stage and job status
- 20ms: List open PRs (GitHub API) → Rate limit error
- 30ms: Rollback transaction (ticket not deleted)
- **Total**: ~30ms (fast failure with rollback)

**Ticket State**: Remains unchanged in database (VERIFY stage, branch intact)

---

## Frontend Integration

### TanStack Query Mutation Hook

```typescript
// app/lib/hooks/mutations/useDeleteTicket.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export function useDeleteTicket(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticketId: number) => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete ticket');
      }

      return response.json();
    },

    onMutate: async (ticketId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.tickets(projectId),
      });

      // Snapshot previous state
      const previousTickets = queryClient.getQueryData<Ticket[]>(
        queryKeys.tickets(projectId)
      );

      // Optimistically remove ticket
      queryClient.setQueryData<Ticket[]>(
        queryKeys.tickets(projectId),
        (old) => old?.filter((t) => t.id !== ticketId) ?? []
      );

      return { previousTickets };
    },

    onError: (error, ticketId, context) => {
      // Rollback on failure
      if (context?.previousTickets) {
        queryClient.setQueryData(
          queryKeys.tickets(projectId),
          context.previousTickets
        );
      }
    },

    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.tickets(projectId),
      });
    },

    retry: false, // Don't retry GitHub API failures automatically
  });
}
```

### Usage in Component

```typescript
const deleteTicket = useDeleteTicket(projectId);

const handleDeleteConfirm = () => {
  deleteTicket.mutate(ticketId, {
    onSuccess: (data) => {
      toast.success(
        `Ticket ${data.deleted.ticketKey} deleted successfully`
      );
    },
    onError: (error) => {
      toast.error(`Failed to delete ticket: ${error.message}`);
    },
  });
};
```

---

## Testing

### API Contract Tests (Playwright)

**File**: `tests/api/tickets-delete.spec.ts`

```typescript
test('DELETE /api/projects/:projectId/tickets/:id - success', async ({ request }) => {
  // Create test ticket
  const ticket = await createTicket(request, {
    title: '[e2e] Test Ticket',
    stage: 'INBOX',
  });

  // Delete ticket
  const response = await request.delete(
    `/api/projects/1/tickets/${ticket.id}`
  );

  expect(response.status()).toBe(200);
  const json = await response.json();
  expect(json.success).toBe(true);
  expect(json.deleted.ticketId).toBe(ticket.id);

  // Verify ticket no longer exists
  const getResponse = await request.get(
    `/api/projects/1/tickets/${ticket.id}`
  );
  expect(getResponse.status()).toBe(404);
});

test('DELETE /api/projects/:projectId/tickets/:id - SHIP stage rejected', async ({ request }) => {
  const ticket = await createTicket(request, {
    title: '[e2e] SHIP Ticket',
    stage: 'SHIP',
  });

  const response = await request.delete(
    `/api/projects/1/tickets/${ticket.id}`
  );

  expect(response.status()).toBe(400);
  const json = await response.json();
  expect(json.error).toContain('SHIP stage');
  expect(json.code).toBe('INVALID_STAGE');
});

test('DELETE /api/projects/:projectId/tickets/:id - active job rejected', async ({ request }) => {
  const ticket = await createTicket(request, { title: '[e2e] Test' });

  // Create pending job
  await createJob(request, {
    ticketId: ticket.id,
    status: 'PENDING',
  });

  const response = await request.delete(
    `/api/projects/1/tickets/${ticket.id}`
  );

  expect(response.status()).toBe(400);
  const json = await response.json();
  expect(json.error).toContain('job is in progress');
  expect(json.code).toBe('ACTIVE_JOB');
});
```

---

## OpenAPI Specification

```yaml
openapi: 3.0.0
info:
  title: AI Board API - Ticket Deletion
  version: 1.0.0
paths:
  /api/projects/{projectId}/tickets/{id}:
    delete:
      summary: Delete a ticket
      description: Delete a ticket and clean up associated GitHub artifacts (branch, PRs)
      operationId: deleteTicket
      security:
        - sessionCookie: []
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: integer
            minimum: 1
          description: Project ID that owns the ticket
        - name: id
          in: path
          required: true
          schema:
            type: integer
            minimum: 1
          description: Ticket ID to delete
      responses:
        '200':
          description: Ticket deleted successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  deleted:
                    type: object
                    properties:
                      ticketId:
                        type: integer
                        example: 42
                      ticketKey:
                        type: string
                        example: "MOB-42"
                      branch:
                        type: string
                        nullable: true
                        example: "084-drag-and-drop"
                      prsClosed:
                        type: integer
                        example: 1
        '400':
          description: Bad request (invalid stage or active job)
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                  code:
                    type: string
                    enum: [INVALID_STAGE, ACTIVE_JOB]
        '401':
          description: Unauthorized (no session)
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                  code:
                    type: string
                    example: "UNAUTHORIZED"
        '403':
          description: Forbidden (not project owner or member)
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                  code:
                    type: string
                    example: "FORBIDDEN"
        '404':
          description: Ticket not found
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                  code:
                    type: string
                    example: "NOT_FOUND"
        '500':
          description: Internal server error (GitHub API or database failure)
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                  code:
                    type: string
                    enum: [GITHUB_API_ERROR, DATABASE_ERROR]
                  details:
                    type: object
                    nullable: true

components:
  securitySchemes:
    sessionCookie:
      type: apiKey
      in: cookie
      name: next-auth.session-token
```

---

## Summary

### Key Points

- **Endpoint**: `DELETE /api/projects/{projectId}/tickets/{id}`
- **Authentication**: Session-based (NextAuth.js cookie)
- **Authorization**: Project owner OR member
- **Validation**: Stage check (not SHIP), active job check (no PENDING/RUNNING)
- **GitHub Cleanup**: Close PRs → Delete branch (sequential)
- **Database Deletion**: Transactional (cascade to Jobs, Comments)
- **Rollback**: Ticket preserved if GitHub API fails
- **Performance**: 50ms (INBOX) to 5s (with GitHub cleanup)
- **Rate Limits**: ~1600 tickets/hour sustained (GitHub API constraint)

### Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `INVALID_STAGE` | 400 | Cannot delete SHIP stage tickets |
| `ACTIVE_JOB` | 400 | Ticket has pending/running job |
| `UNAUTHORIZED` | 401 | No session or session expired |
| `FORBIDDEN` | 403 | User not project owner/member |
| `NOT_FOUND` | 404 | Ticket does not exist |
| `GITHUB_API_ERROR` | 500 | GitHub API call failed |
| `DATABASE_ERROR` | 500 | Database deletion failed |

### Frontend Integration

- **Mutation Hook**: `useDeleteTicket(projectId)`
- **Optimistic Update**: Remove ticket immediately from UI
- **Rollback**: Restore ticket if API fails
- **Invalidation**: Refetch after success to ensure consistency
