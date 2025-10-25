# API Contract: Stage-Based Ticket Editing Restrictions

**Feature**: Restricted Ticket Editing by Stage
**Date**: 2025-10-24
**Version**: 1.0.0

## Overview

This document specifies the API contract changes for stage-based editing restrictions on ticket description and clarificationPolicy fields. The contract extends existing PATCH endpoint behavior without introducing new endpoints.

## Endpoint Modifications

### PATCH `/api/projects/[projectId]/tickets/[id]`

**Existing Behavior**: Update ticket fields (title, description, stage, branch, autoMode, clarificationPolicy) with optimistic concurrency control.

**New Validation Rule**: Reject description and clarificationPolicy updates when ticket stage is not INBOX.

#### Request

**URL Parameters**:
- `projectId` (string, required): Project ID (positive integer as string)
- `id` (string, required): Ticket ID (positive integer as string)

**Headers**:
- `Content-Type`: `application/json`
- `Cookie`: Session cookie (NextAuth authentication)

**Body Schema** (unchanged):
```typescript
{
  title?: string;              // Optional: 1-100 characters with allowed character restrictions
  description?: string;        // Optional: 1-1000 characters (NEW: requires stage=INBOX)
  stage?: Stage;               // Optional: INBOX | SPECIFY | PLAN | BUILD | VERIFY | SHIP
  branch?: string | null;      // Optional: Max 200 characters
  autoMode?: boolean;          // Optional: true | false
  clarificationPolicy?: ClarificationPolicy | null;  // Optional: AUTO | CONSERVATIVE | PRAGMATIC | INTERACTIVE (NEW: requires stage=INBOX)
  version: number;             // Required: Positive integer for optimistic concurrency control
}
```

#### Success Response

**Status**: `200 OK`

**Body** (unchanged):
```json
{
  "id": 123,
  "title": "Updated Title",
  "description": "Updated description",
  "stage": "INBOX",
  "version": 2,
  "projectId": 1,
  "branch": "051-feature-branch",
  "autoMode": false,
  "clarificationPolicy": "AUTO",
  "workflowType": "FULL",
  "createdAt": "2025-10-24T12:00:00.000Z",
  "updatedAt": "2025-10-24T12:05:00.000Z",
  "jobId": 456  // Optional: included if stage transition triggered workflow
}
```

#### Error Responses

##### 400 Bad Request - Stage Validation Error (NEW)

**Condition**: Request attempts to update `description` or `clarificationPolicy` when ticket `stage` is not `INBOX`.

**Body**:
```json
{
  "error": "Description and clarification policy can only be updated in INBOX stage",
  "code": "INVALID_STAGE_FOR_EDIT"
}
```

**Client Handling**:
- Display error toast with message
- Rollback optimistic update via TanStack Query `onError`
- Do NOT retry request

##### 400 Bad Request - Validation Error (existing)

**Condition**: Invalid request body (e.g., description > 1000 characters, invalid stage enum)

**Body**:
```json
{
  "error": "Validation failed",
  "issues": [
    {
      "path": ["description"],
      "message": "Description must be 1000 characters or less"
    }
  ]
}
```

##### 409 Conflict - Version Mismatch (existing)

**Condition**: Another user modified the ticket (version mismatch)

**Body**:
```json
{
  "error": "Conflict: Ticket was modified by another user",
  "currentVersion": 3
}
```

**Client Handling**:
- Display conflict error toast
- Refetch latest ticket data
- User manually resolves conflict

##### 403 Forbidden (existing)

**Condition**: Ticket belongs to different project than `projectId` in URL

**Body**:
```json
{
  "error": "Forbidden"
}
```

##### 404 Not Found (existing)

**Condition**: Ticket or project does not exist

**Body**:
```json
{
  "error": "Ticket not found"
}
```

OR

```json
{
  "error": "Project not found",
  "code": "PROJECT_NOT_FOUND"
}
```

##### 401 Unauthorized (existing)

**Condition**: No valid session cookie (user not authenticated)

**Body**:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_ERROR"
}
```

##### 500 Internal Server Error (existing)

**Condition**: Unexpected server error

**Body**:
```json
{
  "error": "Internal server error"
}
```

## Validation Rules

### Stage-Based Edit Restrictions (NEW)

**Rule**: `description` and `clarificationPolicy` fields can only be updated when `ticket.stage === 'INBOX'`.

**Enforcement Order**:
1. Authentication check (session validation)
2. Project ownership check
3. Request body parsing and Zod validation
4. Ticket existence check
5. Version conflict check (optimistic concurrency control)
6. **Stage validation check (NEW)** ← Added here
7. Database update transaction

**Implementation**:
```typescript
// Check if updating restricted fields in non-INBOX stage
if ((description !== undefined || clarificationPolicy !== undefined)
    && currentTicket.stage !== 'INBOX') {
  return NextResponse.json(
    {
      error: 'Description and clarification policy can only be updated in INBOX stage',
      code: 'INVALID_STAGE_FOR_EDIT'
    },
    { status: 400 }
  );
}
```

### Allowed Updates by Stage

| Field | INBOX Stage | SPECIFY | PLAN | BUILD | VERIFY | SHIP |
|-------|-------------|---------|------|-------|--------|------|
| `title` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `description` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `clarificationPolicy` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `stage` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `branch` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `autoMode` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Request Examples

### Valid Request - Update Description in INBOX

```http
PATCH /api/projects/1/tickets/123
Content-Type: application/json
Cookie: next-auth.session-token=...

{
  "description": "Updated description with more details",
  "version": 1
}
```

**Response**: `200 OK` (success)

### Invalid Request - Update Description in SPECIFY

```http
PATCH /api/projects/1/tickets/123
Content-Type: application/json
Cookie: next-auth.session-token=...

{
  "description": "Attempting to update in SPECIFY stage",
  "version": 2
}
```

**Response**: `400 Bad Request`
```json
{
  "error": "Description and clarification policy can only be updated in INBOX stage",
  "code": "INVALID_STAGE_FOR_EDIT"
}
```

### Valid Request - Update Title in Non-INBOX Stage

```http
PATCH /api/projects/1/tickets/123
Content-Type: application/json
Cookie: next-auth.session-token=...

{
  "title": "Updated title is allowed in any stage",
  "version": 2
}
```

**Response**: `200 OK` (success) - Title updates are NOT restricted by this feature

### Invalid Request - Update Policy in BUILD

```http
PATCH /api/projects/1/tickets/456
Content-Type: application/json
Cookie: next-auth.session-token=...

{
  "clarificationPolicy": "PRAGMATIC",
  "version": 5
}
```

**Response**: `400 Bad Request`
```json
{
  "error": "Description and clarification policy can only be updated in INBOX stage",
  "code": "INVALID_STAGE_FOR_EDIT"
}
```

### Valid Request - Update Multiple Fields in INBOX

```http
PATCH /api/projects/1/tickets/789
Content-Type: application/json
Cookie: next-auth.session-token=...

{
  "title": "New title",
  "description": "New description",
  "clarificationPolicy": "CONSERVATIVE",
  "autoMode": true,
  "version": 3
}
```

**Response**: `200 OK` (success) - All fields allowed in INBOX

## Client-Side Integration

### TanStack Query Mutation Hook

**Hook**: `useUpdateTicket(projectId: number)`

**Usage**:
```typescript
const updateTicket = useUpdateTicket(projectId);

// Client checks stage before attempting update
if (ticket.stage === 'INBOX') {
  updateTicket.mutate({
    ticketId: ticket.id,
    updates: { description: newDescription },
    version: ticket.version,
  });
} else {
  // Show disabled/read-only UI
}
```

**Error Handling**:
- `onError` callback receives 400 error
- Optimistic update automatically rolled back
- Error toast displayed to user
- No retry attempted (stage validation is deterministic)

### Optimistic Update Behavior

**Scenario**: User edits description in INBOX, another user transitions to SPECIFY

**Timeline**:
1. User A sees ticket in INBOX (version: 1)
2. User A types description update (optimistic update applied to cache)
3. User B transitions ticket to SPECIFY (version: 2)
4. User A clicks save
5. API returns 400 (stage validation fails)
6. TanStack Query rolls back User A's optimistic update
7. Real-time polling (2s interval) fetches new stage
8. User A sees ticket is now in SPECIFY with read-only description

## Backward Compatibility

### Breaking Changes

**None** for valid use cases:
- Existing clients updating description in INBOX stage continue to work
- Existing clients updating title/branch/autoMode in any stage continue to work

**New Validation** (may break existing invalid use cases):
- Clients attempting to update description in non-INBOX stages now receive 400 errors
- This is the intended behavior and considered a bug fix, not a breaking change

### Migration Path

**No migration required**: Feature adds server-side validation for a business rule that should have been enforced from the start. Clients should already handle 400 validation errors gracefully.

## Security Considerations

### Server-Side Enforcement

**Critical**: Stage validation MUST be enforced server-side. Client-side checks alone are insufficient (can be bypassed via direct API calls).

**Implementation**: Validation occurs in API route handler before Prisma transaction, ensuring atomic rejection at request boundary.

### Authorization

**Unchanged**: Existing `verifyProjectOwnership()` middleware continues to enforce:
- User authentication (session validation)
- Project ownership (user has access to project)

Stage-based restrictions are an additional business rule, not an authentication concern.

## Testing Contract

### Unit Tests (Vitest)

Test validation utility function:
- `canEditDescriptionAndPolicy('INBOX')` → `true`
- `canEditDescriptionAndPolicy('SPECIFY')` → `false`
- All other stages → `false`

### Integration Tests (Playwright)

Test API contract:
- PATCH with description in INBOX → 200 OK
- PATCH with description in SPECIFY → 400 error with correct code
- PATCH with policy in BUILD → 400 error with correct code
- PATCH with title in SPECIFY → 200 OK (title not restricted)
- Version conflict takes precedence over stage validation (existing behavior)

### E2E Tests (Playwright)

Test full workflow:
- Edit description in INBOX → save → success
- Transition to SPECIFY → attempt edit → 400 error
- Transition back to INBOX → edit enabled again

## Versioning

**API Version**: No version change required (backward compatible validation enhancement)
**Error Code**: `INVALID_STAGE_FOR_EDIT` (new error code for client detection)
**Schema Version**: No change (uses existing fields)

## Conclusion

This API contract extends existing PATCH endpoint behavior with a new server-side validation rule: description and clarificationPolicy updates are rejected when ticket stage is not INBOX. The contract is backward compatible for valid use cases and integrates seamlessly with existing optimistic concurrency control (version field) and client-side state management (TanStack Query with optimistic updates).
