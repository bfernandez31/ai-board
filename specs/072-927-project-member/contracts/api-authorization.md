# API Authorization Contracts

**Feature**: Project Member Authorization
**Branch**: `072-927-project-member`
**Date**: 2025-10-29

## Overview

This document specifies the authorization contracts for all project-scoped API endpoints. All endpoints transition from **owner-only** to **owner OR member** authorization, except member management which remains **owner-only**.

---

## Common Authorization Headers

All API requests MUST include authentication via NextAuth session cookie:

```
Cookie: next-auth.session-token=<session-token>
```

**Test Mode** (NODE_ENV !== 'production'):
```
X-Test-User-Id: <user-id>
```

---

## Authorization Behavior Matrix

| Scenario | Owner Request | Member Request | Non-Member Request |
|----------|--------------|----------------|-------------------|
| **Board Page** (`GET /projects/:id/board`) | 200 OK | 200 OK | 404 Not Found |
| **API Endpoints** (`/api/projects/:id/**`) | 200/201 OK | 200/201 OK | 403 Forbidden |
| **Member Management** (`/api/projects/:id/members`) | 200/201 OK | 403 Forbidden | 403 Forbidden |

---

## Affected Endpoints

### 1. GET /projects/:projectId/board (SSR Page)

**Authorization**: Owner OR Member

**Request**:
```http
GET /projects/123/board HTTP/1.1
Cookie: next-auth.session-token=<token>
```

**Response** (Authorized):
```http
HTTP/1.1 200 OK
Content-Type: text/html

<html><!-- Board page HTML --></html>
```

**Response** (Unauthorized):
```http
HTTP/1.1 404 Not Found
Content-Type: text/html

<html><!-- 404 page --></html>
```

**Authorization Logic**:
- Check if user is project owner (`Project.userId`)
- OR check if user is project member (`ProjectMember.userId`)
- Return 404 if neither (don't reveal project existence)

**Test Scenarios**:
- ✅ Owner can access board
- ✅ Member can access board
- ❌ Non-member receives 404

---

### 2. GET /api/projects/:projectId

**Authorization**: Owner OR Member

**Request**:
```http
GET /api/projects/123 HTTP/1.1
Cookie: next-auth.session-token=<token>
```

**Response** (Authorized):
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 123,
  "name": "My Project",
  "description": "Project description",
  "githubOwner": "owner",
  "githubRepo": "repo",
  "clarificationPolicy": "AUTO"
}
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Authorization Logic**:
- Validate project access via `verifyProjectAccess(projectId)`
- Return project data if owner OR member
- Return 403 if neither

**Test Scenarios**:
- ✅ Owner can get project
- ✅ Member can get project
- ❌ Non-member receives 403

---

### 3. GET /api/projects/:projectId/tickets

**Authorization**: Owner OR Member

**Request**:
```http
GET /api/projects/123/tickets HTTP/1.1
Cookie: next-auth.session-token=<token>
```

**Query Parameters** (optional):
- `stage` (string): Filter by stage (INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP)
- `workflowType` (string): Filter by workflow type (FULL, QUICK)

**Response** (Authorized):
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "tickets": [
    {
      "id": 1,
      "title": "Fix login bug",
      "description": "Users cannot log in",
      "stage": "INBOX",
      "projectId": 123,
      "workflowType": "FULL",
      "createdAt": "2025-10-29T10:00:00Z",
      "updatedAt": "2025-10-29T10:00:00Z"
    }
  ]
}
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Authorization Logic**:
- Validate project access via `verifyProjectAccess(projectId)`
- Query tickets where `projectId` matches
- Return tickets if owner OR member

**Test Scenarios**:
- ✅ Owner can list tickets
- ✅ Member can list tickets
- ✅ Member sees same tickets as owner (no filtering)
- ❌ Non-member receives 403

---

### 4. POST /api/projects/:projectId/tickets

**Authorization**: Owner OR Member

**Request**:
```http
POST /api/projects/123/tickets HTTP/1.1
Content-Type: application/json
Cookie: next-auth.session-token=<token>

{
  "title": "Fix login bug",
  "description": "Users cannot log in with email"
}
```

**Response** (Authorized):
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": 1,
  "title": "Fix login bug",
  "description": "Users cannot log in with email",
  "stage": "INBOX",
  "projectId": 123,
  "workflowType": "FULL",
  "version": 1,
  "createdAt": "2025-10-29T10:00:00Z",
  "updatedAt": "2025-10-29T10:00:00Z"
}
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Validation** (Zod schema):
```typescript
{
  title: z.string().min(1).max(100).regex(/^[a-zA-Z0-9\s.,?!\-:;'"()\[\]{}\/\\@#$%&*+=_~`|]+$/),
  description: z.string().min(1).max(2500).regex(/^[a-zA-Z0-9\s.,?!\-:;'"()\[\]{}\/\\@#$%&*+=_~`|]+$/),
  clarificationPolicy: z.enum(['AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE']).optional()
}
```

**Authorization Logic**:
- Validate project access via `verifyProjectAccess(projectId)`
- Create ticket with `projectId` from URL parameter
- Return ticket if owner OR member

**Test Scenarios**:
- ✅ Owner can create ticket
- ✅ Member can create ticket
- ✅ Ticket `projectId` matches URL parameter (no injection)
- ❌ Non-member receives 403

---

### 5. GET /api/projects/:projectId/tickets/:id

**Authorization**: Owner OR Member (via project)

**Request**:
```http
GET /api/projects/123/tickets/1 HTTP/1.1
Cookie: next-auth.session-token=<token>
```

**Response** (Authorized):
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 1,
  "title": "Fix login bug",
  "description": "Users cannot log in",
  "stage": "INBOX",
  "projectId": 123,
  "branch": null,
  "workflowType": "FULL",
  "version": 1,
  "attachments": [],
  "createdAt": "2025-10-29T10:00:00Z",
  "updatedAt": "2025-10-29T10:00:00Z"
}
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Authorization Logic**:
- Validate ticket access via `verifyTicketAccess(ticketId)`
- Returns ticket if parent project is accessible (owner OR member)

**Test Scenarios**:
- ✅ Owner can get ticket
- ✅ Member can get ticket
- ❌ Non-member receives 403
- ❌ Ticket from different project receives 403 (no cross-project access)

---

### 6. PATCH /api/projects/:projectId/tickets/:id

**Authorization**: Owner OR Member (via project)

**Request**:
```http
PATCH /api/projects/123/tickets/1 HTTP/1.1
Content-Type: application/json
Cookie: next-auth.session-token=<token>

{
  "title": "Fix critical login bug",
  "version": 1
}
```

**Request Body** (all fields optional):
```typescript
{
  title?: string,           // Max 100 chars, validated regex
  description?: string,     // Max 2500 chars, validated regex
  stage?: Stage,            // Enum: INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP
  branch?: string | null,   // Max 200 chars
  autoMode?: boolean,
  version: number           // Required for optimistic concurrency control
}
```

**Response** (Authorized):
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 1,
  "title": "Fix critical login bug",
  "description": "Users cannot log in",
  "stage": "INBOX",
  "projectId": 123,
  "version": 2,
  "updatedAt": "2025-10-29T10:05:00Z"
}
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Response** (Version Conflict):
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "error": "Ticket version conflict",
  "currentVersion": 3
}
```

**Authorization Logic**:
- Validate ticket access via `verifyTicketAccess(ticketId)`
- Update ticket if parent project is accessible (owner OR member)

**Test Scenarios**:
- ✅ Owner can update ticket
- ✅ Member can update ticket
- ✅ Version conflict returns 409 (optimistic concurrency control)
- ❌ Non-member receives 403

---

### 7. DELETE /api/projects/:projectId/tickets/:id

**Authorization**: Owner OR Member (via project)

**Request**:
```http
DELETE /api/projects/123/tickets/1 HTTP/1.1
Cookie: next-auth.session-token=<token>
```

**Response** (Authorized):
```http
HTTP/1.1 204 No Content
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Authorization Logic**:
- Validate ticket access via `verifyTicketAccess(ticketId)`
- Delete ticket if parent project is accessible (owner OR member)
- Cascade deletes comments, jobs, attachments

**Test Scenarios**:
- ✅ Owner can delete ticket
- ✅ Member can delete ticket
- ✅ Cascade deletes work correctly
- ❌ Non-member receives 403

---

### 8. POST /api/projects/:projectId/tickets/:id/transition

**Authorization**: Owner OR Member (via project)

**Request**:
```http
POST /api/projects/123/tickets/1/transition HTTP/1.1
Content-Type: application/json
Cookie: next-auth.session-token=<token>

{
  "targetStage": "SPECIFY"
}
```

**Request Body**:
```typescript
{
  targetStage: Stage  // Enum: SPECIFY, PLAN, BUILD, VERIFY, SHIP (not INBOX)
}
```

**Response** (Authorized):
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "ticket": {
    "id": 1,
    "stage": "SPECIFY",
    "updatedAt": "2025-10-29T10:10:00Z"
  },
  "job": {
    "id": 1,
    "ticketId": 1,
    "command": "specify",
    "status": "PENDING",
    "startedAt": "2025-10-29T10:10:00Z"
  }
}
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Response** (Invalid Transition):
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Cannot transition from SHIP to INBOX"
}
```

**Authorization Logic**:
- Validate ticket access via `verifyTicketAccess(ticketId)`
- Create Job and dispatch workflow if owner OR member
- Workflow validates branch access (GitHub token auth)

**Test Scenarios**:
- ✅ Owner can transition ticket
- ✅ Member can transition ticket
- ✅ Job created with PENDING status
- ✅ Workflow dispatched to GitHub Actions
- ❌ Non-member receives 403
- ❌ Invalid transition returns 400

---

### 9. PATCH /api/projects/:projectId/tickets/:id/branch

**Authorization**: Owner OR Member (via project)

**Request**:
```http
PATCH /api/projects/123/tickets/1/branch HTTP/1.1
Content-Type: application/json
Cookie: next-auth.session-token=<token>

{
  "branch": "020-fix-login-bug"
}
```

**Request Body**:
```typescript
{
  branch: string | null  // Max 200 chars, or null to clear
}
```

**Response** (Authorized):
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 1,
  "branch": "020-fix-login-bug",
  "updatedAt": "2025-10-29T10:15:00Z"
}
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Authorization Logic**:
- Validate ticket access via `verifyTicketAccess(ticketId)`
- Update branch field if owner OR member
- Does NOT use version field (no optimistic concurrency control)

**Test Scenarios**:
- ✅ Owner can update branch
- ✅ Member can update branch
- ✅ Branch can be set to null (clear)
- ❌ Non-member receives 403

---

### 10. GET /api/projects/:projectId/tickets/:id/comments

**Authorization**: Owner OR Member (via project → ticket)

**Request**:
```http
GET /api/projects/123/tickets/1/comments HTTP/1.1
Cookie: next-auth.session-token=<token>
```

**Response** (Authorized):
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "comments": [
    {
      "id": 1,
      "ticketId": 1,
      "userId": "user123",
      "content": "This bug affects all users",
      "createdAt": "2025-10-29T10:20:00Z",
      "updatedAt": "2025-10-29T10:20:00Z",
      "user": {
        "id": "user123",
        "name": "Alice",
        "email": "alice@example.com"
      }
    }
  ]
}
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Authorization Logic**:
- Validate ticket access via `verifyTicketAccess(ticketId)`
- Return comments if parent project is accessible (owner OR member)

**Test Scenarios**:
- ✅ Owner can list comments
- ✅ Member can list comments
- ❌ Non-member receives 403

---

### 11. POST /api/projects/:projectId/tickets/:id/comments

**Authorization**: Owner OR Member (via project → ticket)

**Request**:
```http
POST /api/projects/123/tickets/1/comments HTTP/1.1
Content-Type: application/json
Cookie: next-auth.session-token=<token>

{
  "content": "I can reproduce this bug on Chrome"
}
```

**Request Body**:
```typescript
{
  content: string  // Max 2000 chars, supports Markdown and @mentions
}
```

**Response** (Authorized):
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": 2,
  "ticketId": 1,
  "userId": "user456",
  "content": "I can reproduce this bug on Chrome",
  "createdAt": "2025-10-29T10:25:00Z",
  "updatedAt": "2025-10-29T10:25:00Z",
  "user": {
    "id": "user456",
    "name": "Bob",
    "email": "bob@example.com"
  }
}
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Special Behavior**: @ai-board Mention Detection

If comment contains `@ai-board` mention:
1. Check AI-BOARD availability (valid stage, no running jobs)
2. Create Job with `command: "comment-{stage}"` and `status: PENDING`
3. Dispatch AI-BOARD workflow to GitHub Actions
4. Return comment with job info

**Authorization Logic**:
- Validate ticket access via `verifyTicketAccess(ticketId)`
- Create comment with authenticated user as author
- Comment visible to all project members

**Test Scenarios**:
- ✅ Owner can create comment
- ✅ Member can create comment
- ✅ @ai-board mention triggers workflow (if available)
- ❌ Non-member receives 403

---

### 12. PATCH /api/projects/:projectId/tickets/:id/comments/:commentId

**Authorization**: Owner OR Member (via project → ticket → comment)

**Request**:
```http
PATCH /api/projects/123/tickets/1/comments/2 HTTP/1.1
Content-Type: application/json
Cookie: next-auth.session-token=<token>

{
  "content": "Updated: This bug affects Chrome and Firefox"
}
```

**Request Body**:
```typescript
{
  content: string  // Max 2000 chars
}
```

**Response** (Authorized):
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 2,
  "ticketId": 1,
  "userId": "user456",
  "content": "Updated: This bug affects Chrome and Firefox",
  "createdAt": "2025-10-29T10:25:00Z",
  "updatedAt": "2025-10-29T10:30:00Z"
}
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Authorization Logic**:
- Validate comment access via project → ticket → comment chain
- Allow edit if user has project access (owner OR member)
- Note: Comment author validation is informational only (any project member can edit)

**Test Scenarios**:
- ✅ Owner can update any comment
- ✅ Member can update any comment
- ❌ Non-member receives 403

---

### 13. DELETE /api/projects/:projectId/tickets/:id/comments/:commentId

**Authorization**: Owner OR Member (via project → ticket → comment)

**Request**:
```http
DELETE /api/projects/123/tickets/1/comments/2 HTTP/1.1
Cookie: next-auth.session-token=<token>
```

**Response** (Authorized):
```http
HTTP/1.1 204 No Content
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Authorization Logic**:
- Validate comment access via project → ticket → comment chain
- Allow delete if user has project access (owner OR member)
- Note: Comment author validation is informational only (any project member can delete)

**Test Scenarios**:
- ✅ Owner can delete any comment
- ✅ Member can delete any comment
- ❌ Non-member receives 403

---

### 14. POST /api/projects/:projectId/tickets/:id/comments/ai-board

**Authorization**: Workflow Token (not session-based)

**Request**:
```http
POST /api/projects/123/tickets/1/comments/ai-board HTTP/1.1
Content-Type: application/json
Authorization: Bearer <workflow-token>

{
  "content": "I've analyzed the ticket and added suggestions to the spec."
}
```

**Request Headers**:
```
Authorization: Bearer <WORKFLOW_API_TOKEN>
```

**Response** (Authorized):
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": 3,
  "ticketId": 1,
  "userId": "ai-board-system-user",
  "content": "I've analyzed the ticket and added suggestions to the spec.",
  "createdAt": "2025-10-29T10:35:00Z"
}
```

**Response** (Unauthorized):
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Invalid workflow token"
}
```

**Authorization Logic**:
- Validate workflow token (Bearer auth, not session)
- Create comment as AI-BOARD system user (`ai-board-system-user`)
- No project membership check (workflow acts as system)

**Test Scenarios**:
- ✅ Valid workflow token can post AI-BOARD comment
- ❌ Invalid token receives 401
- ❌ Session auth receives 401 (must use Bearer token)

---

### 15. GET /api/projects/:projectId/tickets/:id/timeline

**Authorization**: Owner OR Member (via project → ticket)

**Request**:
```http
GET /api/projects/123/tickets/1/timeline HTTP/1.1
Cookie: next-auth.session-token=<token>
```

**Response** (Authorized):
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "events": [
    {
      "type": "created",
      "timestamp": "2025-10-29T10:00:00Z",
      "user": { "name": "Alice" },
      "data": { "title": "Fix login bug" }
    },
    {
      "type": "comment",
      "timestamp": "2025-10-29T10:20:00Z",
      "user": { "name": "Bob" },
      "data": { "content": "This bug affects all users" }
    }
  ]
}
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Authorization Logic**:
- Validate ticket access via `verifyTicketAccess(ticketId)`
- Return timeline if parent project is accessible (owner OR member)

**Test Scenarios**:
- ✅ Owner can view timeline
- ✅ Member can view timeline
- ❌ Non-member receives 403

---

### 16. POST /api/projects/:projectId/tickets/:id/images

**Authorization**: Owner OR Member (via project → ticket)

**Request**:
```http
POST /api/projects/123/tickets/1/images HTTP/1.1
Content-Type: multipart/form-data
Cookie: next-auth.session-token=<token>

------WebKitFormBoundary
Content-Disposition: form-data; name="image"; filename="screenshot.png"
Content-Type: image/png

<binary image data>
------WebKitFormBoundary--
```

**Response** (Authorized):
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "url": "https://res.cloudinary.com/.../screenshot.png",
  "publicId": "ai-board/ticket-1/screenshot",
  "attachmentIndex": 0
}
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Authorization Logic**:
- Validate ticket access via `verifyTicketAccess(ticketId)`
- Upload to Cloudinary if parent project is accessible (owner OR member)

**Test Scenarios**:
- ✅ Owner can upload images
- ✅ Member can upload images
- ❌ Non-member receives 403

---

### 17. DELETE /api/projects/:projectId/tickets/:id/images/:attachmentIndex

**Authorization**: Owner OR Member (via project → ticket)

**Request**:
```http
DELETE /api/projects/123/tickets/1/images/0 HTTP/1.1
Cookie: next-auth.session-token=<token>
```

**Response** (Authorized):
```http
HTTP/1.1 204 No Content
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Authorization Logic**:
- Validate ticket access via `verifyTicketAccess(ticketId)`
- Delete from Cloudinary if parent project is accessible (owner OR member)

**Test Scenarios**:
- ✅ Owner can delete images
- ✅ Member can delete images
- ❌ Non-member receives 403

---

### 18. GET /api/projects/:projectId/jobs/status

**Authorization**: Owner OR Member

**Request**:
```http
GET /api/projects/123/jobs/status HTTP/1.1
Cookie: next-auth.session-token=<token>
```

**Response** (Authorized):
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jobs": [
    {
      "id": 1,
      "ticketId": 1,
      "status": "RUNNING",
      "updatedAt": "2025-10-29T10:40:00Z"
    }
  ]
}
```

**Response** (Unauthorized):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Authorization Logic**:
- Validate project access via `verifyProjectAccess(projectId)`
- Return all jobs for project if owner OR member
- Used by client-side polling (2-second interval)

**Test Scenarios**:
- ✅ Owner can poll job status
- ✅ Member can poll job status
- ❌ Non-member receives 403

---

### 19. POST /api/projects/:projectId/members (Owner-Only)

**Authorization**: Owner ONLY (NOT members)

**Request**:
```http
POST /api/projects/123/members HTTP/1.1
Content-Type: application/json
Cookie: next-auth.session-token=<token>

{
  "userId": "user789",
  "role": "member"
}
```

**Request Body**:
```typescript
{
  userId: string,          // User ID to add as member
  role?: string            // Default: "member" (unused in v1)
}
```

**Response** (Authorized - Owner):
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": 1,
  "projectId": 123,
  "userId": "user789",
  "role": "member",
  "createdAt": "2025-10-29T10:45:00Z"
}
```

**Response** (Unauthorized - Member):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Only project owner can manage members"
}
```

**Response** (Unauthorized - Non-Member):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden"
}
```

**Authorization Logic**:
- Validate project ownership via `verifyProjectOwnership(projectId)`
- Only owner can add members (NOT project members)
- Unique constraint prevents duplicate memberships

**Test Scenarios**:
- ✅ Owner can add members
- ❌ Member receives 403 (cannot add other members)
- ❌ Non-member receives 403
- ❌ Duplicate membership returns 409 Conflict

---

### 20. DELETE /api/projects/:projectId/members/:memberId (Owner-Only)

**Authorization**: Owner ONLY (NOT members)

**Request**:
```http
DELETE /api/projects/123/members/1 HTTP/1.1
Cookie: next-auth.session-token=<token>
```

**Response** (Authorized - Owner):
```http
HTTP/1.1 204 No Content
```

**Response** (Unauthorized - Member):
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Only project owner can manage members"
}
```

**Authorization Logic**:
- Validate project ownership via `verifyProjectOwnership(projectId)`
- Only owner can remove members (NOT project members)

**Test Scenarios**:
- ✅ Owner can remove members
- ❌ Member receives 403 (cannot remove other members)
- ❌ Non-member receives 403

---

## Summary Table

| Endpoint | Owner | Member | Non-Member | Authorization Helper |
|----------|-------|--------|-----------|---------------------|
| GET `/projects/:id/board` | ✅ 200 | ✅ 200 | ❌ 404 | `verifyProjectAccess()` |
| GET `/api/projects/:id` | ✅ 200 | ✅ 200 | ❌ 403 | `verifyProjectAccess()` |
| GET `/api/projects/:id/tickets` | ✅ 200 | ✅ 200 | ❌ 403 | `verifyProjectAccess()` |
| POST `/api/projects/:id/tickets` | ✅ 201 | ✅ 201 | ❌ 403 | `verifyProjectAccess()` |
| GET `/api/projects/:id/tickets/:tid` | ✅ 200 | ✅ 200 | ❌ 403 | `verifyTicketAccess()` |
| PATCH `/api/projects/:id/tickets/:tid` | ✅ 200 | ✅ 200 | ❌ 403 | `verifyTicketAccess()` |
| DELETE `/api/projects/:id/tickets/:tid` | ✅ 204 | ✅ 204 | ❌ 403 | `verifyTicketAccess()` |
| POST `/api/projects/:id/tickets/:tid/transition` | ✅ 200 | ✅ 200 | ❌ 403 | `verifyTicketAccess()` |
| PATCH `/api/projects/:id/tickets/:tid/branch` | ✅ 200 | ✅ 200 | ❌ 403 | `verifyTicketAccess()` |
| GET `/api/projects/:id/tickets/:tid/comments` | ✅ 200 | ✅ 200 | ❌ 403 | `verifyTicketAccess()` |
| POST `/api/projects/:id/tickets/:tid/comments` | ✅ 201 | ✅ 201 | ❌ 403 | `verifyTicketAccess()` |
| PATCH `/api/projects/:id/tickets/:tid/comments/:cid` | ✅ 200 | ✅ 200 | ❌ 403 | `verifyTicketAccess()` |
| DELETE `/api/projects/:id/tickets/:tid/comments/:cid` | ✅ 204 | ✅ 204 | ❌ 403 | `verifyTicketAccess()` |
| POST `/api/projects/:id/tickets/:tid/comments/ai-board` | N/A | N/A | N/A | Workflow token auth |
| GET `/api/projects/:id/tickets/:tid/timeline` | ✅ 200 | ✅ 200 | ❌ 403 | `verifyTicketAccess()` |
| POST `/api/projects/:id/tickets/:tid/images` | ✅ 201 | ✅ 201 | ❌ 403 | `verifyTicketAccess()` |
| DELETE `/api/projects/:id/tickets/:tid/images/:idx` | ✅ 204 | ✅ 204 | ❌ 403 | `verifyTicketAccess()` |
| GET `/api/projects/:id/jobs/status` | ✅ 200 | ✅ 200 | ❌ 403 | `verifyProjectAccess()` |
| **POST `/api/projects/:id/members`** | ✅ 201 | ❌ 403 | ❌ 403 | **`verifyProjectOwnership()`** |
| **DELETE `/api/projects/:id/members/:mid`** | ✅ 204 | ❌ 403 | ❌ 403 | **`verifyProjectOwnership()`** |

**Legend**:
- ✅ = Request succeeds with indicated status code
- ❌ = Request fails with indicated status code
- **Bold** = Owner-only endpoint (no member access)

---

## Implementation Checklist

### Authorization Helper Updates

- [ ] Create `verifyProjectAccess(projectId)` in `lib/db/auth-helpers.ts`
- [ ] Create `verifyTicketAccess(ticketId)` in `lib/db/auth-helpers.ts`
- [ ] Keep `verifyProjectOwnership(projectId)` for owner-only endpoints
- [ ] Add deprecation comments to old helpers (for future removal)

### Endpoint Updates (22 total)

**Board Page (1)**:
- [ ] `app/projects/[projectId]/board/page.tsx` → `verifyProjectAccess()`

**Project Endpoints (2)**:
- [ ] `app/api/projects/[projectId]/route.ts` GET → `verifyProjectAccess()`
- [ ] `app/api/projects/[projectId]/jobs/status/route.ts` GET → `verifyProjectAccess()`

**Ticket Endpoints (5)**:
- [ ] `app/api/projects/[projectId]/tickets/route.ts` GET/POST → `verifyProjectAccess()`
- [ ] `app/api/projects/[projectId]/tickets/[id]/route.ts` GET/PATCH/DELETE → `verifyTicketAccess()`
- [ ] `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` POST → `verifyTicketAccess()`
- [ ] `app/api/projects/[projectId]/tickets/[id]/branch/route.ts` PATCH → `verifyTicketAccess()`

**Comment Endpoints (4)**:
- [ ] `app/api/projects/[projectId]/tickets/[id]/comments/route.ts` GET/POST → `verifyTicketAccess()`
- [ ] `app/api/projects/[projectId]/tickets/[id]/comments/[commentId]/route.ts` PATCH/DELETE → `verifyTicketAccess()`
- [ ] `app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts` POST → Workflow token auth (no change)

**Image Endpoints (2)**:
- [ ] `app/api/projects/[projectId]/tickets/[id]/images/route.ts` POST → `verifyTicketAccess()`
- [ ] `app/api/projects/[projectId]/tickets/[id]/images/[attachmentIndex]/route.ts` DELETE → `verifyTicketAccess()`

**Timeline Endpoint (1)**:
- [ ] `app/api/projects/[projectId]/tickets/[id]/timeline/route.ts` GET → `verifyTicketAccess()`

**Member Management Endpoints (2)** - Owner-only:
- [ ] `app/api/projects/[projectId]/members/route.ts` POST/DELETE → `verifyProjectOwnership()` (no change)

### Test Updates

**Unit Tests**:
- [ ] Create `tests/unit/auth-helpers.test.ts` (Vitest)
  - Test `verifyProjectAccess()` for owner, member, non-member
  - Test `verifyTicketAccess()` for owner, member, non-member

**API Contract Tests**:
- [ ] Create `tests/api/project-member-auth.spec.ts` (Playwright)
  - Test all 22 endpoints for owner access (backward compatibility)
  - Test all 20 member-accessible endpoints for member access
  - Test all 22 endpoints reject non-member access
  - Test 2 owner-only endpoints reject member access

**E2E Tests**:
- [ ] Create `tests/e2e/board-member-access.spec.ts` (Playwright)
  - Test member can access board page
  - Test member sees same tickets as owner
- [ ] Extend `tests/e2e/ticket-crud.spec.ts` (Playwright)
  - Add member scenarios to existing ticket CRUD tests

---

## References

- Feature Specification: `specs/072-927-project-member/spec.md`
- Data Model: `specs/072-927-project-member/data-model.md`
- Existing Auth Helpers: `lib/db/auth-helpers.ts`
- Constitution: `.specify/memory/constitution.md` (Principle IV: Security-First Design)
