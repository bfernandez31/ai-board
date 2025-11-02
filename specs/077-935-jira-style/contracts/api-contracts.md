# API Contracts: Jira-Style Ticket Numbering System

**Feature**: 077-935-jira-style
**Date**: 2025-10-31
**Version**: 1.0.0

## Overview

This document defines the API contract changes for the Jira-style ticket numbering system. All endpoints follow RESTful conventions and return JSON responses.

---

## New Endpoints

### GET /ticket/:key

**Purpose**: Retrieve ticket by ticket key (primary user-facing endpoint)

**Path Parameters**:
| Parameter | Type | Format | Description |
|-----------|------|--------|-------------|
| `key` | string | `{KEY}-{NUM}` | Ticket key (e.g., "ABC-123") |

**Request Example**:
```http
GET /ticket/ABC-123 HTTP/1.1
Cookie: next-auth.session-token=...
```

**Success Response** (200 OK):
```json
{
  "id": 42,
  "ticketNumber": 5,
  "ticketKey": "ABC-123",
  "title": "Fix login bug",
  "description": "Users cannot login after password reset",
  "stage": "BUILD",
  "projectId": 1,
  "branch": "077-fix-login-bug",
  "autoMode": false,
  "workflowType": "FULL",
  "version": 3,
  "attachments": [],
  "createdAt": "2025-10-15T10:30:00Z",
  "updatedAt": "2025-10-20T14:20:00Z",
  "clarificationPolicy": null,
  "project": {
    "id": 1,
    "name": "Mobile App",
    "key": "MOB",
    "githubOwner": "acme",
    "githubRepo": "mobile-app"
  }
}
```

**Error Responses**:

**404 Not Found** - Ticket does not exist:
```json
{
  "error": "Ticket not found"
}
```

**400 Bad Request** - Invalid ticket key format:
```json
{
  "error": "Invalid ticket key format",
  "details": "Expected format: KEY-NUM (e.g., ABC-123)"
}
```

**403 Forbidden** - User does not have access to project:
```json
{
  "error": "Forbidden"
}
```

**Authorization**:
- User must be authenticated (NextAuth session)
- User must be project owner or member (resolved from ticket key)

**Performance Target**: <50ms p95

---

## Modified Endpoints

### POST /api/projects/:projectId/tickets

**Purpose**: Create new ticket with automatic ticket number and key generation

**Changes**:
- **NEW**: Automatically generates `ticketNumber` using PostgreSQL sequence
- **NEW**: Automatically generates `ticketKey` from project key + ticket number
- **REMOVED**: `id` field from request body (always auto-generated)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | number | Project ID |

**Request Body**:
```json
{
  "title": "Fix login bug",
  "description": "Users cannot login after password reset",
  "stage": "INBOX",
  "clarificationPolicy": null
}
```

**Success Response** (201 Created):
```json
{
  "id": 42,
  "ticketNumber": 5,
  "ticketKey": "ABC-5",
  "title": "Fix login bug",
  "description": "Users cannot login after password reset",
  "stage": "INBOX",
  "projectId": 1,
  "branch": null,
  "autoMode": false,
  "workflowType": "FULL",
  "version": 1,
  "attachments": [],
  "createdAt": "2025-10-31T10:00:00Z",
  "updatedAt": "2025-10-31T10:00:00Z",
  "clarificationPolicy": null
}
```

**Error Responses**:

**400 Bad Request** - Invalid input:
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "title",
      "message": "Title is required"
    }
  ]
}
```

**500 Internal Server Error** - Sequence generation failure:
```json
{
  "error": "Failed to generate ticket number",
  "details": "Database sequence error"
}
```

**Performance Target**: <100ms p95

---

### GET /api/projects/:projectId/tickets/:id

**Purpose**: Retrieve single ticket (supports both numeric ID and ticket key)

**Changes**:
- **NEW**: `:id` parameter accepts both numeric ID and ticket key
- **NEW**: Response includes `ticketNumber` and `ticketKey` fields

**Path Parameters**:
| Parameter | Type | Format | Description |
|-----------|------|--------|-------------|
| `projectId` | number | Integer | Project ID |
| `id` | string | Numeric or `{KEY}-{NUM}` | Ticket ID or ticket key |

**Request Examples**:
```http
GET /api/projects/1/tickets/42 HTTP/1.1
GET /api/projects/1/tickets/ABC-123 HTTP/1.1
```

**Success Response** (200 OK):
```json
{
  "id": 42,
  "ticketNumber": 5,
  "ticketKey": "ABC-123",
  "title": "Fix login bug",
  "description": "Users cannot login after password reset",
  "stage": "BUILD",
  "projectId": 1,
  "branch": "077-fix-login-bug",
  "autoMode": false,
  "workflowType": "FULL",
  "version": 3,
  "attachments": [],
  "createdAt": "2025-10-15T10:30:00Z",
  "updatedAt": "2025-10-20T14:20:00Z",
  "clarificationPolicy": null
}
```

**Error Responses**: Same as before (404, 403)

**Backward Compatibility**: Numeric IDs continue to work without changes

**Performance Target**: <50ms p95 (both lookup methods)

---

### GET /api/projects/:projectId/tickets

**Purpose**: List all tickets for a project

**Changes**:
- **NEW**: Response includes `ticketNumber` and `ticketKey` for each ticket
- **NEW**: Can optionally sort by `ticketNumber` (default remains `updatedAt`)

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `orderBy` | string | `updatedAt` | Sort field: `updatedAt`, `createdAt`, `ticketNumber` |
| `order` | string | `desc` | Sort order: `asc`, `desc` |

**Request Example**:
```http
GET /api/projects/1/tickets?orderBy=ticketNumber&order=asc HTTP/1.1
```

**Success Response** (200 OK):
```json
{
  "tickets": [
    {
      "id": 40,
      "ticketNumber": 1,
      "ticketKey": "ABC-1",
      "title": "First ticket",
      "stage": "SHIP",
      "createdAt": "2025-10-01T10:00:00Z",
      "updatedAt": "2025-10-10T15:00:00Z"
    },
    {
      "id": 41,
      "ticketNumber": 2,
      "ticketKey": "ABC-2",
      "title": "Second ticket",
      "stage": "VERIFY",
      "createdAt": "2025-10-02T11:00:00Z",
      "updatedAt": "2025-10-20T14:00:00Z"
    },
    {
      "id": 42,
      "ticketNumber": 3,
      "ticketKey": "ABC-3",
      "title": "Third ticket",
      "stage": "BUILD",
      "createdAt": "2025-10-03T09:00:00Z",
      "updatedAt": "2025-10-25T16:00:00Z"
    }
  ],
  "total": 3
}
```

**Performance Target**: <100ms p95 for 1000 tickets

---

### PATCH /api/projects/:projectId/tickets/:id

**Purpose**: Update ticket fields

**Changes**:
- **IMMUTABLE**: `ticketNumber` and `ticketKey` cannot be updated (read-only after creation)
- **NO CHANGE**: `:id` parameter only accepts numeric ID (not ticket key) for update operations

**Request Body** (fields marked as read-only rejected):
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "version": 3
}
```

**Error Response** (400 Bad Request) - Attempt to update immutable fields:
```json
{
  "error": "Validation failed",
  "details": "ticketNumber and ticketKey are immutable"
}
```

**Performance Target**: <100ms p95

---

### POST /api/projects (Project Creation)

**Purpose**: Create new project with auto-generated or custom project key

**Changes**:
- **NEW**: `key` field in request body (optional)
- **NEW**: Auto-generate key from project name if not provided
- **NEW**: Response includes generated `key`

**Request Body**:
```json
{
  "name": "Mobile Application",
  "description": "iOS and Android mobile app",
  "githubOwner": "acme",
  "githubRepo": "mobile-app",
  "key": "MOB"
}
```

**Request Body** (auto-generated key):
```json
{
  "name": "Mobile Application",
  "description": "iOS and Android mobile app",
  "githubOwner": "acme",
  "githubRepo": "mobile-app"
}
```

**Success Response** (201 Created):
```json
{
  "id": 1,
  "name": "Mobile Application",
  "description": "iOS and Android mobile app",
  "githubOwner": "acme",
  "githubRepo": "mobile-app",
  "key": "MOB",
  "userId": "user-123",
  "deploymentUrl": null,
  "clarificationPolicy": "AUTO",
  "createdAt": "2025-10-31T10:00:00Z",
  "updatedAt": "2025-10-31T10:00:00Z"
}
```

**Success Response** (auto-generated key):
```json
{
  "key": "MOB",
  ...
}
```

**Error Responses**:

**400 Bad Request** - Invalid key format:
```json
{
  "error": "Validation failed",
  "details": "Project key must be 3 uppercase alphanumeric characters"
}
```

**409 Conflict** - Duplicate key:
```json
{
  "error": "Project key already exists",
  "suggestion": "MOB is taken. Try: MO1, MO2, or customize"
}
```

**Performance Target**: <150ms p95

---

### GET /api/projects/:projectId

**Purpose**: Retrieve project details

**Changes**:
- **NEW**: Response includes `key` field

**Success Response** (200 OK):
```json
{
  "id": 1,
  "name": "Mobile Application",
  "description": "iOS and Android mobile app",
  "githubOwner": "acme",
  "githubRepo": "mobile-app",
  "key": "MOB",
  "userId": "user-123",
  "deploymentUrl": "https://app.acme.com",
  "clarificationPolicy": "AUTO",
  "createdAt": "2025-10-15T10:00:00Z",
  "updatedAt": "2025-10-20T14:00:00Z"
}
```

**Performance Target**: <50ms p95

---

## Validation Schemas (Zod)

### Ticket Key Validation

```typescript
import { z } from 'zod';

export const ticketKeySchema = z
  .string()
  .regex(/^[A-Z0-9]{3}-\d+$/, 'Invalid ticket key format (expected KEY-NUM)');
```

### Project Key Validation

```typescript
export const projectKeySchema = z
  .string()
  .min(3, 'Project key must be at least 3 characters')
  .max(6, 'Project key must be at most 6 characters')
  .regex(/^[A-Z0-9]{3,6}$/, 'Project key must be 3-6 uppercase alphanumeric characters')
  .transform((val) => val.toUpperCase());
```

### Ticket Creation Request

```typescript
export const ticketCreateSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(2500),
  stage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']).default('INBOX'),
  clarificationPolicy: z
    .enum(['AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE'])
    .nullable()
    .optional(),
});
```

### Ticket Response

```typescript
export const ticketResponseSchema = z.object({
  id: z.number(),
  ticketNumber: z.number().positive(),
  ticketKey: ticketKeySchema,
  title: z.string(),
  description: z.string(),
  stage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']),
  projectId: z.number(),
  branch: z.string().nullable(),
  autoMode: z.boolean(),
  workflowType: z.enum(['FULL', 'QUICK']),
  version: z.number(),
  attachments: z.array(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  clarificationPolicy: z
    .enum(['AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE'])
    .nullable(),
});
```

---

## Error Handling

### Standard Error Response Format

All errors follow this structure:

```typescript
{
  error: string;        // Human-readable error message
  code?: string;        // Optional error code (e.g., "DUPLICATE_KEY")
  details?: unknown;    // Optional additional context
}
```

### HTTP Status Codes

| Code | Usage | Example |
|------|-------|---------|
| 200 | Successful GET/PATCH request | Ticket retrieved |
| 201 | Successful POST request (resource created) | Ticket created with key ABC-5 |
| 400 | Invalid request body or parameters | Invalid ticket key format |
| 403 | User not authorized to access resource | User not project owner or member |
| 404 | Resource not found | Ticket key does not exist |
| 409 | Conflict with existing resource | Duplicate project key |
| 500 | Server error | Database connection failed |

---

## Authorization

All endpoints require authentication and authorization:

1. **Authentication**: NextAuth session cookie required
2. **Project Access**: User must be project owner or member
3. **Ticket Access**: Verified via parent project ownership

**Authorization Flow**:
```
Request → Session validation → Extract userId
       → Resolve projectId from ticket key (if applicable)
       → Verify userId is project owner OR member
       → Proceed with operation OR return 403
```

---

## Backward Compatibility

### Legacy Endpoints (Preserved)

All existing endpoints continue to work:

- `GET /api/projects/:projectId/tickets/:id` with numeric ID
- `PATCH /api/projects/:projectId/tickets/:id` with numeric ID
- `DELETE /api/projects/:projectId/tickets/:id` with numeric ID

### Migration Path for Clients

**Phase 1** (Immediate, post-migration):
- All responses include both `id` and `ticketKey`
- Clients can continue using numeric IDs

**Phase 2** (Gradual migration):
- Update client code to use `ticketKey` for display
- Update client code to use `/ticket/:key` for navigation
- Keep using numeric IDs for API calls (optional)

**Phase 3** (Future):
- Clients fully migrate to ticket keys
- Numeric ID endpoints remain for backward compatibility (no deprecation planned)

---

## Performance Targets

| Endpoint | Target (p95) | Rationale |
|----------|--------------|-----------|
| GET /ticket/:key | <50ms | Single indexed query on ticketKey |
| POST /api/projects/:projectId/tickets | <100ms | Sequence generation + insert |
| GET /api/projects/:projectId/tickets/:id | <50ms | Single indexed query (ID or key) |
| GET /api/projects/:projectId/tickets | <100ms | Filtered query with pagination |

**Load Testing**: Target 100 concurrent requests with no degradation

---

## Future API Enhancements (Out of Scope)

1. **Batch Ticket Creation**: `POST /api/projects/:projectId/tickets/batch`
   - Create multiple tickets with sequential numbers
   - Use case: Import from external systems

2. **Ticket Key Search**: `GET /api/search?q=ABC-123`
   - Global ticket key search across all accessible projects
   - Use case: Quick ticket lookup from any page

3. **Project Key Availability**: `GET /api/projects/keys/available?key=MOB`
   - Check if project key is available before creating project
   - Use case: Client-side validation

4. **Ticket Key Aliases**: `POST /api/projects/:projectId/tickets/:id/aliases`
   - Add alternative keys for a ticket
   - Use case: Project merges, historical references
