# API Contract: POST /api/projects/[projectId]/tickets

**Endpoint**: `POST /api/projects/{projectId}/tickets`
**Purpose**: Create a new ticket in the specified project
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
Content-Type: application/json
```

### Request Body
```json
{
  "title": "Implement user authentication",
  "description": "Add email/password login with JWT tokens"
}
```

**Request Schema**:
```typescript
{
  title: string;       // Required, 1-100 characters
  description: string; // Required, 1-1000 characters
}
```

**Validation Rules**:
- `title`: REQUIRED, non-empty string, max 100 characters, trimmed
- `description`: REQUIRED, non-empty string, max 1000 characters, trimmed

---

## Response

### Success Response (201 Created)
```json
{
  "id": 42,
  "title": "Implement user authentication",
  "description": "Add email/password login with JWT tokens",
  "stage": "INBOX",
  "version": 1,
  "createdAt": "2025-10-03T14:30:00.000Z",
  "updatedAt": "2025-10-03T14:30:00.000Z"
}
```

**Response Schema**:
```typescript
{
  id: number;
  title: string;
  description: string;
  stage: "INBOX";      // Always INBOX for new tickets
  version: number;     // Always 1 for new tickets
  createdAt: string;   // ISO 8601 format
  updatedAt: string;   // ISO 8601 format
}
```

**Behavior**:
- New tickets ALWAYS created in `INBOX` stage
- New tickets ALWAYS start with `version: 1`
- `projectId` is implicitly set from URL parameter (not in request body)

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

#### 400 Bad Request - Validation Error (Missing Fields)
```json
{
  "error": "title: Required; description: Required",
  "code": "VALIDATION_ERROR",
  "details": {
    "fieldErrors": {
      "title": ["Required"],
      "description": ["Required"]
    },
    "formErrors": []
  }
}
```
**Trigger**: Missing required fields

---

#### 400 Bad Request - Validation Error (Title Too Long)
```json
{
  "error": "title: String must contain at most 100 character(s)",
  "code": "VALIDATION_ERROR",
  "details": {
    "fieldErrors": {
      "title": ["String must contain at most 100 character(s)"]
    },
    "formErrors": []
  }
}
```
**Trigger**: Title exceeds 100 characters

---

#### 400 Bad Request - Validation Error (Description Too Long)
```json
{
  "error": "description: String must contain at most 1000 character(s)",
  "code": "VALIDATION_ERROR",
  "details": {
    "fieldErrors": {
      "description": ["String must contain at most 1000 character(s)"]
    },
    "formErrors": []
  }
}
```
**Trigger**: Description exceeds 1000 characters

---

#### 404 Not Found - Project Does Not Exist
```json
{
  "error": "Project not found",
  "code": "PROJECT_NOT_FOUND"
}
```
**Trigger**: projectId is valid but project doesn't exist

---

#### 500 Internal Server Error - Database Error
```json
{
  "error": "Failed to create ticket",
  "code": "DATABASE_ERROR"
}
```
**Trigger**: Database connection failure, foreign key violation, or unexpected error

---

## Validation Rules

1. **Project ID Format**:
   - MUST be a string representing a positive integer
   - MUST NOT contain decimals, letters, or special characters

2. **Project Existence**:
   - MUST validate project exists before creating ticket
   - SHOULD return 404 if project not found

3. **Title Validation**:
   - MUST be present
   - MUST be non-empty after trimming
   - MUST NOT exceed 100 characters
   - SHOULD trim leading/trailing whitespace before saving

4. **Description Validation**:
   - MUST be present
   - MUST be non-empty after trimming
   - MUST NOT exceed 1000 characters
   - SHOULD trim leading/trailing whitespace before saving

5. **Automatic Fields**:
   - `stage` MUST be set to "INBOX"
   - `version` MUST be set to 1
   - `projectId` MUST be set from URL parameter
   - `createdAt` and `updatedAt` MUST be set by database

---

## Behavior Specification

### Trimming
Input values MUST be trimmed before validation:
```typescript
title: "  Fix bug  " → "Fix bug"
description: "\n\nAdd feature\n" → "Add feature"
```

### Stage Assignment
All new tickets MUST start in `INBOX` stage. No way to create ticket in different stage.

### Project Assignment
`projectId` is derived from URL, NOT from request body. If client sends `projectId` in body, it MUST be ignored.

### Uniqueness
No uniqueness constraints. Multiple tickets can have the same title/description.

---

## Example Requests

### Valid Request
```bash
POST /api/projects/1/tickets HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "title": "Add dark mode",
  "description": "Implement dark mode toggle in user settings"
}
```

**Response**: 201 Created

---

### Missing Fields
```bash
POST /api/projects/1/tickets HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "title": "Add dark mode"
}
```

**Response**: 400 Bad Request (missing description)

---

### Invalid Project
```bash
POST /api/projects/999999/tickets HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "title": "Add dark mode",
  "description": "Implement dark mode toggle"
}
```

**Response**: 404 Not Found

---

## Side Effects

1. **Database Insert**: Creates new row in `tickets` table
2. **Cache Invalidation**: Revalidates `/projects/{projectId}/board` path
3. **Timestamp Updates**: Sets `createdAt` and `updatedAt` to current time

---

## Contract Test Requirements

Contract tests MUST verify:

1. ✅ Returns 201 with correct schema for valid request
2. ✅ Created ticket has `stage: "INBOX"` and `version: 1`
3. ✅ Created ticket has `projectId` matching URL parameter
4. ✅ Returns 400 for missing title
5. ✅ Returns 400 for missing description
6. ✅ Returns 400 for title > 100 characters
7. ✅ Returns 400 for description > 1000 characters
8. ✅ Returns 400 for invalid projectId format
9. ✅ Returns 404 for non-existent project
10. ✅ Trims whitespace from title and description
11. ✅ Ticket is queryable via GET /api/projects/{projectId}/tickets

---

## Breaking Changes from Previous API

**Old Endpoint**: `POST /api/tickets`
**New Endpoint**: `POST /api/projects/{projectId}/tickets`

**Migration Impact**:
- All client-side code MUST update API calls
- Request body format UNCHANGED
- Response format UNCHANGED
- Old endpoint will be removed after migration

---

## Notes

- This endpoint does NOT require authentication in MVP
- Future: Add user authentication and project membership checks
- Future: Allow specifying assignee
- Future: Support file attachments

**Status**: ✅ Contract defined, ready for test implementation
