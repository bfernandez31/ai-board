# API Contract: GET /api/projects/[projectId]/tickets

**Endpoint**: `GET /api/projects/{projectId}/tickets`
**Purpose**: Retrieve all tickets for a specific project, grouped by stage
**Authentication**: None (MVP)
**Authorization**: None (MVP)

---

## Request

### URL Parameters
```typescript
{
  projectId: string  // Must be a valid integer (e.g., "1", "42")
}
```

### Query Parameters
None

### Headers
```
Content-Type: application/json (optional for GET)
```

### Request Body
None (GET request)

---

## Response

### Success Response (200 OK)
```json
{
  "INBOX": [
    {
      "id": 1,
      "title": "Fix authentication bug",
      "description": "Users cannot log in with Google OAuth",
      "stage": "INBOX",
      "version": 1,
      "createdAt": "2025-10-01T10:00:00.000Z",
      "updatedAt": "2025-10-01T10:00:00.000Z"
    },
    {
      "id": 2,
      "title": "Add dark mode",
      "description": "Implement dark mode toggle in settings",
      "stage": "INBOX",
      "version": 1,
      "createdAt": "2025-10-01T11:00:00.000Z",
      "updatedAt": "2025-10-01T11:00:00.000Z"
    }
  ],
  "SPECIFY": [
    {
      "id": 3,
      "title": "Improve search performance",
      "description": "Add Elasticsearch for faster search",
      "stage": "SPECIFY",
      "version": 2,
      "createdAt": "2025-10-01T09:00:00.000Z",
      "updatedAt": "2025-10-01T12:00:00.000Z"
    }
  ],
  "PLAN": [],
  "BUILD": [],
  "VERIFY": [],
  "SHIP": []
}
```

**Response Schema**:
```typescript
{
  [stage in Stage]: Array<{
    id: number;
    title: string;
    description: string;
    stage: Stage;
    version: number;
    createdAt: string;  // ISO 8601 format
    updatedAt: string;  // ISO 8601 format
  }>
}

type Stage = "INBOX" | "SPECIFY" | "PLAN" | "BUILD" | "VERIFY" | "SHIP";
```

**Ordering**: Tickets within each stage are ordered by `updatedAt` descending (most recent first)

---

### Error Responses

#### 400 Bad Request - Invalid Project ID Format
```json
{
  "error": "Invalid project ID",
  "code": "VALIDATION_ERROR"
}
```
**Trigger**: projectId is not a valid integer (e.g., "abc", "1.5", "")

---

#### 404 Not Found - Project Does Not Exist
```json
{
  "error": "Project not found",
  "code": "PROJECT_NOT_FOUND"
}
```
**Trigger**: projectId is a valid integer but no project exists with that ID

---

#### 500 Internal Server Error - Database Error
```json
{
  "error": "Failed to fetch tickets",
  "code": "DATABASE_ERROR"
}
```
**Trigger**: Database connection failure, query timeout, or unexpected error

---

## Validation Rules

1. **Project ID Format**:
   - MUST be a string representing a positive integer
   - MUST NOT contain decimals, letters, or special characters
   - Examples: ✅ "1", "42", "999" | ❌ "0", "-1", "abc", "1.5"

2. **Project Existence**:
   - MUST validate project exists before querying tickets
   - SHOULD return 404 if project not found

3. **Project Scoping**:
   - MUST only return tickets where `ticket.projectId = projectId`
   - MUST NOT leak tickets from other projects

---

## Behavior Specification

### Empty Project
If project exists but has no tickets:
```json
{
  "INBOX": [],
  "SPECIFY": [],
  "PLAN": [],
  "BUILD": [],
  "VERIFY": [],
  "SHIP": []
}
```

### Stage Grouping
- ALL stages MUST be present in response (even if empty)
- Tickets MUST be grouped by their `stage` field
- No ticket should appear in multiple stages

### Performance
- Target response time: <100ms for projects with <1000 tickets
- SHOULD use database indexes on `projectId` and `updatedAt`

---

## Example Requests

### Valid Request
```bash
GET /api/projects/1/tickets HTTP/1.1
Host: localhost:3000
```

### Invalid Project ID
```bash
GET /api/projects/abc/tickets HTTP/1.1
Host: localhost:3000
# Response: 400 Bad Request
```

### Non-Existent Project
```bash
GET /api/projects/999999/tickets HTTP/1.1
Host: localhost:3000
# Response: 404 Not Found
```

---

## Contract Test Requirements

Contract tests MUST verify:

1. ✅ Returns 200 with correct schema for valid project
2. ✅ Returns tickets grouped by stage
3. ✅ Returns 400 for invalid projectId format
4. ✅ Returns 404 for non-existent project
5. ✅ Only returns tickets belonging to specified project (no leaks)
6. ✅ Tickets ordered by updatedAt descending within each stage
7. ✅ All stages present in response (even if empty)

---

## Breaking Changes from Previous API

**Old Endpoint**: `GET /api/tickets`
**New Endpoint**: `GET /api/projects/{projectId}/tickets`

**Migration Impact**:
- All client-side code MUST update API calls
- Response format UNCHANGED (still grouped by stage)
- Old endpoint will be removed after migration

---

## Notes

- This endpoint does NOT require authentication in MVP
- Future: Add user authentication and project membership checks
- Future: Add pagination for large projects (>1000 tickets)
- Future: Add filtering by stage via query parameter

**Status**: ✅ Contract defined, ready for test implementation
