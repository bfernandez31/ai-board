# API Contract: Rollback Transition

**Feature**: Quick Workflow Rollback
**Endpoint**: `POST /api/projects/:projectId/tickets/:id/transition`
**Date**: 2025-10-24

## Overview

This contract extends the existing ticket transition endpoint to support rollback transitions from BUILD to INBOX stage. The endpoint validates rollback eligibility based on job status and atomically resets ticket state.

---

## Endpoint Details

**HTTP Method**: `POST`
**Path**: `/api/projects/:projectId/tickets/:id/transition`
**Authentication**: Required (NextAuth.js session)
**Authorization**: User must own the project

---

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | integer | Yes | Project ID for authorization |
| `id` | integer | Yes | Ticket ID to transition |

### Request Body

```typescript
{
  targetStage: "INBOX"  // Must be INBOX for rollback
}
```

**JSON Schema**:

```json
{
  "type": "object",
  "properties": {
    "targetStage": {
      "type": "string",
      "enum": ["INBOX", "SPECIFY", "PLAN", "BUILD", "VERIFY", "SHIP"],
      "description": "Target stage for transition"
    }
  },
  "required": ["targetStage"]
}
```

**Validation (Zod)**:

```typescript
import { z } from 'zod';

const TransitionRequestSchema = z.object({
  targetStage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']),
});
```

---

## Response

### Success Response (200 OK)

**Condition**: Rollback transition successful

**Body**:

```typescript
{
  id: number;
  stage: "INBOX";
  workflowType: "FULL";
  branch: null;
  version: 1;
  updatedAt: string;  // ISO 8601 timestamp
}
```

**Example**:

```json
{
  "id": 123,
  "stage": "INBOX",
  "workflowType": "FULL",
  "branch": null,
  "version": 1,
  "updatedAt": "2025-10-24T12:34:56.789Z"
}
```

### Error Responses

#### 400 Bad Request - Invalid Rollback Attempt

**Condition**: Rollback blocked due to job status or stage validation

**Body**:

```typescript
{
  error: string;  // Human-readable error message
}
```

**Examples**:

```json
{
  "error": "Cannot rollback: workflow is still running. Wait for completion or cancel the job."
}
```

```json
{
  "error": "Cannot rollback: workflow completed successfully. Rollback only available for failed or cancelled jobs."
}
```

```json
{
  "error": "Rollback only available from BUILD to INBOX stage"
}
```

#### 401 Unauthorized

**Condition**: No valid session

**Body**:

```json
{
  "error": "Unauthorized"
}
```

#### 403 Forbidden

**Condition**: User does not own the project

**Body**:

```json
{
  "error": "Forbidden: You do not have access to this project"
}
```

#### 404 Not Found

**Condition**: Ticket or project does not exist

**Body**:

```json
{
  "error": "Ticket not found"
}
```

#### 500 Internal Server Error

**Condition**: Database transaction failed or unexpected error

**Body**:

```json
{
  "error": "Internal server error"
}
```

---

## Rollback Validation Rules

The endpoint validates the following conditions before executing rollback:

### Rule 1: Stage Validation

- **Current stage MUST be**: `BUILD`
- **Target stage MUST be**: `INBOX`
- **Error if violated**: `"Rollback only available from BUILD to INBOX stage"`

### Rule 2: Job Existence

- **Condition**: Ticket MUST have at least one workflow job
- **Workflow jobs**: Commands NOT starting with `comment-` (excludes AI-BOARD jobs)
- **Error if violated**: `"No workflow job found for this ticket"`

### Rule 3: Job Status

- **Allowed statuses**: `FAILED`, `CANCELLED`
- **Blocked statuses**: `PENDING`, `RUNNING`, `COMPLETED`
- **Error if RUNNING**: `"Cannot rollback: workflow is still running. Wait for completion or cancel the job."`
- **Error if COMPLETED**: `"Cannot rollback: workflow completed successfully. Rollback only available for failed or cancelled jobs."`
- **Error if PENDING**: `"Cannot rollback: workflow is pending. Wait for completion or cancel the job."`

---

## State Changes (Atomic Transaction)

When rollback validation passes, the following changes occur atomically:

1. **Ticket Update**:
   - `stage`: `BUILD` → `INBOX`
   - `workflowType`: `QUICK` → `FULL` (or `FULL` → `FULL`)
   - `branch`: `"{num}-{desc}"` → `null`
   - `version`: `current` → `1`

2. **Job Deletion**:
   - Most recent workflow job (with status `FAILED` or `CANCELLED`) is deleted

**Atomicity Guarantee**: Prisma transaction ensures all-or-nothing execution. If any operation fails, entire transaction is rolled back.

---

## Performance Requirements

| Metric | Target | Measured By |
|--------|--------|-------------|
| API response time | <200ms (p95) | SC-002 |
| Total transaction time | <3s | SC-001 |
| Rollback success rate | 100% for valid requests | SC-003 |
| Validation error rate | 100% for invalid requests | SC-004 |

---

## Examples

### Example 1: Successful Rollback

**Request**:

```http
POST /api/projects/1/tickets/123/transition
Content-Type: application/json
Cookie: next-auth.session-token=...

{
  "targetStage": "INBOX"
}
```

**Preconditions**:
- Ticket 123 exists in project 1
- Ticket stage is `BUILD`
- Most recent workflow job has status `FAILED`

**Response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 123,
  "stage": "INBOX",
  "workflowType": "FULL",
  "branch": null,
  "version": 1,
  "updatedAt": "2025-10-24T12:34:56.789Z"
}
```

### Example 2: Blocked Rollback (Running Job)

**Request**:

```http
POST /api/projects/1/tickets/123/transition
Content-Type: application/json
Cookie: next-auth.session-token=...

{
  "targetStage": "INBOX"
}
```

**Preconditions**:
- Ticket 123 exists in project 1
- Ticket stage is `BUILD`
- Most recent workflow job has status `RUNNING`

**Response**:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Cannot rollback: workflow is still running. Wait for completion or cancel the job."
}
```

### Example 3: Blocked Rollback (Completed Job)

**Request**:

```http
POST /api/projects/1/tickets/123/transition
Content-Type: application/json
Cookie: next-auth.session-token=...

{
  "targetStage": "INBOX"
}
```

**Preconditions**:
- Ticket 123 exists in project 1
- Ticket stage is `BUILD`
- Most recent workflow job has status `COMPLETED`

**Response**:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Cannot rollback: workflow completed successfully. Rollback only available for failed or cancelled jobs."
}
```

---

## Security Considerations

1. **Authentication**: NextAuth.js session required
2. **Authorization**: Project ownership validated via `userId` match
3. **Input Validation**: Zod schema validates request payload
4. **SQL Injection Prevention**: Prisma parameterized queries only
5. **Error Message Safety**: No sensitive data (internal IDs, stack traces) in error responses
6. **Rate Limiting**: Inherited from existing API route (not changed by this feature)

---

## Backward Compatibility

✅ **Existing transitions unchanged**: INBOX → SPECIFY, SPECIFY → PLAN, etc. continue to work
✅ **No breaking changes**: Rollback is a new transition type, doesn't affect existing workflows
✅ **Existing clients unaffected**: Frontend can continue using transition endpoint without changes
✅ **Database schema unchanged**: All fields already exist

---

## Testing Requirements

### Unit Tests (Vitest)

- `canRollbackToInbox()` validation logic
  - Valid rollback (BUILD → INBOX, FAILED job)
  - Invalid stage (SPECIFY → INBOX)
  - Invalid status (BUILD → INBOX, RUNNING job)
  - Invalid status (BUILD → INBOX, COMPLETED job)
  - No job found

### API Contract Tests (Playwright)

- Successful rollback returns 200 with correct response shape
- Blocked rollback (RUNNING job) returns 400 with error message
- Blocked rollback (COMPLETED job) returns 400 with error message
- Unauthorized request returns 401
- Forbidden request (wrong project owner) returns 403
- Not found request returns 404

### E2E Tests (Playwright)

- Drag ticket from BUILD to INBOX with FAILED job → success
- Drag ticket from BUILD to INBOX with RUNNING job → blocked
- Drag ticket from BUILD to INBOX with COMPLETED job → blocked
- Visual feedback shows amber border for rollback-eligible tickets
- Visual feedback shows disabled state for ineligible tickets

---

## Open Questions

None. All contract details resolved during Phase 0 research.
