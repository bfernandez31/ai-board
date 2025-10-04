# API Contract: PATCH /api/projects/[projectId]/tickets/[id]

**Endpoint**: `PATCH /api/projects/{projectId}/tickets/{id}`
**Purpose**: Update a ticket's stage, title, or description within the specified project
**Authentication**: None (MVP)
**Authorization**: None (MVP)

---

## Request

### URL Parameters
```typescript
{
  projectId: string  // Must be a valid integer (e.g., "1", "42")
  id: string         // Ticket ID, must be a valid integer
}
```

### Query Parameters
None

### Headers
```
Content-Type: application/json
```

### Request Body (Stage Update)
```json
{
  "stage": "SPECIFY",
  "version": 1
}
```

### Request Body (Inline Edit)
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "version": 1
}
```

**Request Schemas**:

**Stage Update Schema**:
```typescript
{
  stage: Stage;        // Required: "INBOX" | "SPECIFY" | "PLAN" | "BUILD" | "VERIFY" | "SHIP"
  version: number;     // Required: Current version for optimistic locking
}
```

**Inline Edit Schema**:
```typescript
{
  title?: string;      // Optional, 1-100 characters
  description?: string; // Optional, 1-1000 characters
  version: number;     // Required: Current version for optimistic locking
}
```

**Validation Rules**:
- Cannot update both `stage` AND `title`/`description` in same request
- `version` MUST match current ticket version (optimistic concurrency control)
- Stage transitions MUST be sequential (INBOX→SPECIFY→PLAN→BUILD→VERIFY→SHIP)

---

## Response

### Success Response (200 OK) - Stage Update
```json
{
  "id": 42,
  "stage": "SPECIFY",
  "version": 2,
  "updatedAt": "2025-10-03T14:35:00.000Z"
}
```

### Success Response (200 OK) - Inline Edit
```json
{
  "id": 42,
  "title": "Updated title",
  "description": "Updated description",
  "stage": "INBOX",
  "version": 2,
  "createdAt": "2025-10-03T14:30:00.000Z",
  "updatedAt": "2025-10-03T14:35:00.000Z"
}
```

**Response Behavior**:
- `version` is ALWAYS incremented by 1
- `updatedAt` is ALWAYS set to current timestamp
- Stage update returns minimal fields (id, stage, version, updatedAt)
- Inline edit returns full ticket object

---

### Error Responses

#### 400 Bad Request - Invalid Project ID Format
```json
{
  "error": "Invalid project ID",
  "code": "VALIDATION_ERROR"
}
```
**Trigger**: projectId is not a valid integer

---

#### 400 Bad Request - Invalid Ticket ID Format
```json
{
  "error": "Invalid ticket ID",
  "message": "Ticket ID must be a number"
}
```
**Trigger**: ticket id is not a valid integer

---

#### 400 Bad Request - Mixed Update Type
```json
{
  "error": "Invalid request",
  "message": "Cannot update stage and title/description in the same request"
}
```
**Trigger**: Request body contains both `stage` and `title`/`description`

---

#### 400 Bad Request - Invalid Stage Transition
```json
{
  "error": "Invalid stage transition",
  "message": "Cannot transition from INBOX to BUILD. Tickets must progress sequentially through stages."
}
```
**Trigger**: Attempting to skip stages (e.g., INBOX→BUILD)

---

#### 400 Bad Request - Validation Error
```json
{
  "error": "Validation failed",
  "issues": [
    {
      "code": "too_big",
      "maximum": 100,
      "path": ["title"],
      "message": "String must contain at most 100 character(s)"
    }
  ]
}
```
**Trigger**: Title or description exceeds length limits

---

#### 403 Forbidden - Ticket Belongs to Different Project
```json
{
  "error": "Forbidden"
}
```
**Trigger**: Ticket exists but `ticket.projectId` ≠ URL `projectId`

---

#### 404 Not Found - Project Not Found
```json
{
  "error": "Project not found",
  "code": "PROJECT_NOT_FOUND"
}
```
**Trigger**: Project with given ID doesn't exist

---

#### 404 Not Found - Ticket Not Found
```json
{
  "error": "Ticket not found"
}
```
**Trigger**: Ticket with given ID doesn't exist (and no cross-project conflict)

---

#### 409 Conflict - Version Mismatch
```json
{
  "error": "Conflict: Ticket was modified by another user",
  "currentVersion": 3
}
```
**Trigger**: Request `version` doesn't match database `version` (ticket was updated concurrently)

---

#### 500 Internal Server Error - Database Error
```json
{
  "error": "Internal server error"
}
```
**Trigger**: Database connection failure or unexpected error

---

## Validation Rules

1. **Project ID Format**:
   - MUST be a string representing a positive integer

2. **Ticket ID Format**:
   - MUST be a string representing a positive integer

3. **Project Existence**:
   - SHOULD validate project exists (returns 404 if not)

4. **Ticket Ownership**:
   - MUST verify `ticket.projectId = projectId` from URL
   - MUST return 403 if ticket belongs to different project
   - MUST return 404 if ticket doesn't exist

5. **Version Validation**:
   - MUST check `request.version = ticket.version` before update
   - MUST return 409 if versions don't match
   - MUST increment version atomically with update

6. **Stage Transition Validation**:
   - MUST validate sequential transitions only
   - MUST return 400 for invalid transitions
   - Valid: INBOX→SPECIFY, SPECIFY→PLAN, etc.
   - Invalid: INBOX→BUILD, VERIFY→INBOX, etc.

7. **Field Validation**:
   - Title: Max 100 characters, trimmed
   - Description: Max 1000 characters, trimmed

8. **Request Type Validation**:
   - MUST reject requests with both `stage` and `title`/`description`
   - MUST require at least one of: `stage` OR `title`/`description`

---

## Behavior Specification

### Optimistic Concurrency Control
This endpoint implements optimistic locking:
1. Client reads ticket with `version: 1`
2. Client sends update with `version: 1`
3. Server updates only if current version still `1`
4. Server increments version to `2` atomically
5. If version mismatch, return 409 with current version

### Stage Transitions
Tickets MUST progress sequentially through stages:
```
INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP
```
Cannot skip stages or move backwards.

### Cross-Project Protection
Even if ticket ID is valid, update MUST fail with 403 if ticket belongs to different project:
```typescript
// URL: /api/projects/1/tickets/42
// If ticket 42 belongs to project 2, return 403
```

### Trimming
Title and description MUST be trimmed before saving.

---

## Example Requests

### Valid Stage Update
```bash
PATCH /api/projects/1/tickets/42 HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "stage": "SPECIFY",
  "version": 1
}
```
**Response**: 200 OK with updated ticket

---

### Valid Inline Edit
```bash
PATCH /api/projects/1/tickets/42 HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "title": "Updated title",
  "version": 1
}
```
**Response**: 200 OK with updated ticket

---

### Version Conflict
```bash
PATCH /api/projects/1/tickets/42 HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "stage": "SPECIFY",
  "version": 1
}
```
**If ticket.version is now 2**: 409 Conflict

---

### Cross-Project Access
```bash
PATCH /api/projects/1/tickets/42 HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "stage": "SPECIFY",
  "version": 1
}
```
**If ticket 42 belongs to project 2**: 403 Forbidden

---

### Invalid Transition
```bash
PATCH /api/projects/1/tickets/42 HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "stage": "BUILD",
  "version": 1
}
```
**If current stage is INBOX**: 400 Bad Request

---

## Contract Test Requirements

Contract tests MUST verify:

1. ✅ Returns 200 for valid stage update
2. ✅ Returns 200 for valid inline edit
3. ✅ Increments version on successful update
4. ✅ Returns 400 for invalid projectId format
5. ✅ Returns 400 for invalid ticketId format
6. ✅ Returns 400 for mixed update (stage + title)
7. ✅ Returns 400 for invalid stage transition
8. ✅ Returns 400 for title/description too long
9. ✅ Returns 403 for ticket in different project
10. ✅ Returns 404 for non-existent project
11. ✅ Returns 404 for non-existent ticket
12. ✅ Returns 409 for version mismatch
13. ✅ Trims title and description
14. ✅ Updates persist in database

---

## Breaking Changes from Previous API

**Old Endpoint**: `PATCH /api/tickets/{id}`
**New Endpoint**: `PATCH /api/projects/{projectId}/tickets/{id}`

**Migration Impact**:
- All client-side code MUST update API calls
- Request body format UNCHANGED
- Response format UNCHANGED
- New validation: Cross-project access prevention (403)
- Old endpoint will be removed after migration

---

## Notes

- Optimistic locking prevents lost updates in concurrent scenarios
- Sequential stage transitions enforce workflow discipline
- Cross-project validation prevents accidental data leaks
- This endpoint does NOT require authentication in MVP
- Future: Add user authentication and ownership checks

**Status**: ✅ Contract defined, ready for test implementation
