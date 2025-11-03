# API Endpoints Reference

Complete REST API documentation with authentication, request/response formats, and error handling.

## Authentication

All API endpoints require authentication via NextAuth.js session cookies except where noted.

**Authentication Header**: Session cookie (set automatically by NextAuth.js)
**Unauthenticated**: 401 Unauthorized
**Unauthorized Access**: 403 Forbidden (user is neither project owner nor member)

**Authorization Pattern**:
- All project-scoped endpoints validate "owner OR member" access
- Owner check performed first for performance (no database join needed)
- Member check performed via ProjectMember table join if not owner
- Non-members receive 403 Forbidden (API) or 404 Not Found (pages)

**Workflow Endpoints**: Require Bearer token authentication
```
Authorization: Bearer <WORKFLOW_API_TOKEN>
```

## Base URL

**Development**: `http://localhost:3000`
**Production**: `https://ai-board.vercel.app` (example)

## Project Endpoints

### GET /api/projects

Fetch all projects for the authenticated user with shipping status.

**Authentication**: Required (session)
**Authorization**: Returns projects owned by or accessible to the user (owner OR member)

**Response** (200 OK):
```json
{
  "projects": [
    {
      "id": 1,
      "name": "AI Board Development",
      "key": "ABC",
      "description": "Project management tool",
      "deploymentUrl": "https://ai-board.vercel.app",
      "githubOwner": "bfernandez31",
      "githubRepo": "ai-board",
      "userId": "user-abc123",
      "clarificationPolicy": "AUTO",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z",
      "ticketCount": 12,
      "lastShippedTicket": {
        "id": 42,
        "ticketKey": "ABC-5",
        "title": "Add user authentication",
        "updatedAt": "2025-01-14T16:20:00.000Z"
      }
    },
    {
      "id": 2,
      "name": "Mobile App",
      "key": "MOB",
      "description": null,
      "deploymentUrl": null,
      "githubOwner": "company",
      "githubRepo": "mobile-app",
      "userId": "user-abc123",
      "clarificationPolicy": "CONSERVATIVE",
      "createdAt": "2025-01-05T00:00:00.000Z",
      "updatedAt": "2025-01-10T08:15:00.000Z",
      "ticketCount": 5,
      "lastShippedTicket": null
    }
  ]
}
```

**Fields**:
- `ticketCount`: Total number of tickets across all stages
- `lastShippedTicket`: Most recent ticket in SHIP stage (null if no shipped tickets)
  - `id`: Ticket ID
  - `ticketKey`: Unique ticket identifier (e.g., "ABC-5")
  - `title`: Ticket title
  - `updatedAt`: When ticket was moved to SHIP stage (used for relative time display)

**Frontend Display**:
- Project cards display ticketKey (bold) followed by title
- Full text "ticketKey + title" truncated with ellipsis if too long
- Tooltip on hover shows complete "ticketKey + title" text

**Errors**:
- `401`: Not authenticated
- `500`: Database error

### GET /api/projects/:projectId

Fetch project details including clarification policy.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID

**Response** (200 OK):
```json
{
  "id": 1,
  "name": "AI Board Development",
  "key": "ABC",
  "description": "Project management tool",
  "deploymentUrl": "https://ai-board.vercel.app",
  "githubOwner": "bfernandez31",
  "githubRepo": "ai-board",
  "userId": "user-abc123",
  "clarificationPolicy": "AUTO",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Errors**:
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Project not found

### PATCH /api/projects/:projectId

Update project details including clarification policy.

**Authentication**: Required (session)
**Authorization**: Must be project owner (owner-only action)

**Path Parameters**:
- `projectId` (number, required): Project ID

**Request Body**:
```json
{
  "name": "Updated Project Name",
  "key": "UPD",
  "description": "Updated description",
  "deploymentUrl": "https://my-app.vercel.app",
  "clarificationPolicy": "CONSERVATIVE"
}
```

**Validation**:
- `name`: Optional, string
- `key`: Optional, 3-character uppercase alphanumeric string (immutable after creation, validation only)
- `description`: Optional, string or null
- `deploymentUrl`: Optional, string or null (valid URL format)
- `clarificationPolicy`: Optional, enum (AUTO|CONSERVATIVE|PRAGMATIC|INTERACTIVE)

**Response** (200 OK):
```json
{
  "id": 1,
  "name": "Updated Project Name",
  "key": "ABC",
  "deploymentUrl": "https://my-app.vercel.app",
  "clarificationPolicy": "CONSERVATIVE",
  ...
}
```

**Note**: Project key is immutable after creation and cannot be changed via PATCH.

**Errors**:
- `400`: Invalid request body, URL format, or clarification policy enum
- `401`: Not authenticated
- `403`: User is not project owner (members cannot update project settings)
- `404`: Project not found

## Ticket Endpoints

### GET /api/projects/:projectId/tickets

Fetch all tickets for a project.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID

**Query Parameters**:
- `stage` (optional): Filter by stage (INBOX|SPECIFY|PLAN|BUILD|VERIFY|SHIP)

**Response** (200 OK):
```json
{
  "tickets": [
    {
      "id": 42,
      "ticketNumber": 5,
      "ticketKey": "ABC-5",
      "title": "Add login feature",
      "description": "Implement user authentication",
      "stage": "SPECIFY",
      "projectId": 1,
      "branch": "042-add-login-feature",
      "workflowType": "FULL",
      "clarificationPolicy": null,
      "attachments": [],
      "version": 3,
      "createdAt": "2025-01-10T14:00:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

**Errors**:
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Project not found

### POST /api/projects/:projectId/tickets

Create a new ticket.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID

**Request Body**:
```json
{
  "title": "Fix login bug",
  "description": "Login button doesn't work on mobile devices"
}
```

**Validation**:
- `title`: Required, 1-100 characters, alphanumeric + basic punctuation
- `description`: Required, 1-2500 characters, all UTF-8 characters allowed

**Response** (201 Created):
```json
{
  "id": 43,
  "ticketNumber": 6,
  "ticketKey": "ABC-6",
  "title": "Fix login bug",
  "description": "Login button doesn't work on mobile devices",
  "stage": "INBOX",
  "projectId": 1,
  "branch": null,
  "workflowType": "FULL",
  "clarificationPolicy": null,
  "attachments": [],
  "version": 1,
  "createdAt": "2025-01-20T09:00:00.000Z",
  "updatedAt": "2025-01-20T09:00:00.000Z"
}
```

**Errors**:
- `400`: Invalid request body (Zod validation errors)
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Project not found
- `500`: Database error

### GET /browse/:key

Fetch ticket by human-readable key (primary user-facing endpoint).

**Authentication**: Required (session)
**Authorization**: Must be project owner or member (resolved via ticket key)

**Path Parameters**:
- `key` (string, required): Ticket key in format "{PROJECT_KEY}-{TICKET_NUMBER}" (e.g., "ABC-123")

**Response** (200 OK):
```json
{
  "id": 42,
  "ticketNumber": 5,
  "ticketKey": "ABC-5",
  "title": "Add login feature",
  "description": "Implement user authentication",
  "stage": "SPECIFY",
  "projectId": 1,
  "branch": "042-add-login-feature",
  "workflowType": "FULL",
  "clarificationPolicy": null,
  "attachments": [],
  "version": 3,
  "project": {
    "id": 1,
    "name": "AI Board Development",
    "key": "ABC",
    "clarificationPolicy": "AUTO"
  },
  "createdAt": "2025-01-10T14:00:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Errors**:
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Ticket not found

**Notes**:
- This is the primary user-facing endpoint for ticket access
- URLs like `/browse/ABC-123` are shareable and stable
- Used for bookmarks, external links, and ticket references

### GET /api/projects/:projectId/tickets/:id

Fetch single ticket with nested project data (legacy endpoint).

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number or string, required): Ticket ID (numeric) or Ticket Key (e.g., "ABC-123")

**Note**: This endpoint supports both internal numeric IDs (for backward compatibility) and human-readable ticket keys. New code should use `/browse/:key` for ticket access.

**Response** (200 OK):
```json
{
  "id": 42,
  "ticketNumber": 5,
  "ticketKey": "ABC-5",
  "title": "Add login feature",
  "description": "Implement user authentication",
  "stage": "SPECIFY",
  "projectId": 1,
  "branch": "042-add-login-feature",
  "workflowType": "FULL",
  "clarificationPolicy": null,
  "attachments": [
    {
      "type": "uploaded",
      "url": "https://res.cloudinary.com/.../screenshot.png",
      "filename": "screenshot.png",
      "mimeType": "image/png",
      "sizeBytes": 204800,
      "uploadedAt": "2025-01-15T10:00:00.000Z",
      "cloudinaryPublicId": "ai-board/tickets/42/screenshot"
    }
  ],
  "version": 3,
  "project": {
    "id": 1,
    "name": "AI Board Development",
    "key": "ABC",
    "clarificationPolicy": "AUTO"
  },
  "createdAt": "2025-01-10T14:00:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Errors**:
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Ticket or project not found

### PATCH /api/projects/:projectId/tickets/:id

Update ticket fields with optimistic concurrency control.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Request Body**:
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "clarificationPolicy": "CONSERVATIVE",
  "version": 3
}
```

**Validation**:
- `title`: Optional, 1-100 characters, alphanumeric + basic punctuation
- `description`: Optional, 1-2500 characters (editable only in INBOX stage)
- `clarificationPolicy`: Optional, enum or null (editable only in INBOX stage)
- `version`: Required for concurrency control

**Response** (200 OK):
```json
{
  "id": 42,
  "ticketNumber": 5,
  "ticketKey": "ABC-5",
  "title": "Updated title",
  "description": "Updated description",
  "clarificationPolicy": "CONSERVATIVE",
  "version": 4,
  ...
}
```

**Errors**:
- `400`: Invalid request body, validation failure, or stage restriction violation
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Ticket or project not found
- `409`: Version conflict (concurrent update detected)

### PATCH /api/projects/:projectId/tickets/:id/branch

Update ticket branch name (workflow-only endpoint).

**Authentication**: Bearer token (WORKFLOW_API_TOKEN)
**Authorization**: Workflow token validation (no project membership check)

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Request Body**:
```json
{
  "branch": "042-add-login-feature"
}
```

**Validation**:
- `branch`: Required, max 200 characters or null

**Response** (200 OK):
```json
{
  "id": 42,
  "branch": "042-add-login-feature",
  "updatedAt": "2025-01-15T10:35:00.000Z"
}
```

**Errors**:
- `400`: Invalid branch name (exceeds 200 characters)
- `401`: Invalid or missing workflow token
- `404`: Ticket or project not found

**Note**: This endpoint does NOT use optimistic concurrency control (no version checking).

### POST /api/projects/:projectId/tickets/:id/deploy

Trigger manual Vercel preview deployment (user-initiated).

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Request Body**: Empty

**Response** (201 Created):
```json
{
  "success": true,
  "jobId": 125,
  "message": "Deploy preview workflow dispatched"
}
```

**Eligibility Requirements**:
- Ticket must be in VERIFY stage
- Ticket must have a branch
- Latest job must have COMPLETED status

**Workflow Behavior**:
- Creates new Job record with command="deploy-preview", status=PENDING
- Clears any existing preview URL in project (single-preview enforcement)
- Dispatches GitHub Actions workflow (deploy-preview.yml)
- Workflow deploys branch to Vercel and updates ticket with preview URL

**Errors**:
- `400`: Ticket not eligible for deployment (wrong stage, no branch, job not completed)
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Ticket or project not found
- `500`: Workflow dispatch error

### PATCH /api/projects/:projectId/tickets/:id/preview-url

Update ticket preview URL (workflow-only endpoint).

**Authentication**: Bearer token (WORKFLOW_API_TOKEN)
**Authorization**: Workflow token validation (no project membership check)

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Request Body**:
```json
{
  "previewUrl": "https://ai-board-080-1490-deploy-preview.vercel.app"
}
```

**Validation**:
- `previewUrl`: Required, max 500 characters, HTTPS-only, Vercel domain pattern
- Pattern: `^https:\/\/[a-z0-9-]+\.vercel\.app$`

**Response** (200 OK):
```json
{
  "id": 42,
  "previewUrl": "https://ai-board-080-1490-deploy-preview.vercel.app",
  "updatedAt": "2025-01-15T10:40:00.000Z"
}
```

**Errors**:
- `400`: Invalid preview URL (non-HTTPS, invalid domain, exceeds 500 characters)
- `401`: Invalid or missing workflow token
- `404`: Ticket or project not found

**Note**: This endpoint does NOT use optimistic concurrency control (no version checking).

### POST /api/projects/:projectId/tickets/:id/transition

Transition ticket to target stage with workflow dispatch.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Request Body**:
```json
{
  "targetStage": "SPECIFY"
}
```

**Validation**:
- `targetStage`: Required, enum (SPECIFY|PLAN|BUILD|VERIFY|SHIP)

**Response** (200 OK):
```json
{
  "success": true,
  "jobId": 123,
  "message": "Workflow dispatched successfully"
}
```

**Transition Logic**:
- **INBOX → SPECIFY**: Creates job, dispatches workflow (specify command)
- **INBOX → BUILD**: Quick-impl mode, creates job, dispatches quick-impl workflow, sets workflowType=QUICK
- **SPECIFY → PLAN**: Validates specify job completed, creates job, dispatches workflow (plan command)
- **PLAN → BUILD**: Validates plan job completed, creates job, dispatches workflow (implement command)
- **BUILD → VERIFY**: Creates job, dispatches verify workflow with workflowType (FULL runs tests, QUICK skips to PR)
- **BUILD → INBOX**: Rollback if job failed/cancelled, resets workflowType to FULL
- **VERIFY → SHIP**: Manual transition (no workflow)

**Errors**:
- `400`: Invalid transition (non-sequential, job not completed, rollback not allowed)
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Ticket or project not found
- `500`: Workflow dispatch error or database error

**Error Response** (Job Not Completed):
```json
{
  "error": "Cannot transition",
  "message": "Cannot transition: workflow is still running",
  "code": "JOB_NOT_COMPLETED",
  "details": {
    "currentStage": "SPECIFY",
    "targetStage": "PLAN",
    "jobStatus": "RUNNING",
    "jobCommand": "specify"
  }
}
```

## Comment Endpoints

### GET /api/projects/:projectId/tickets/:id/comments

Fetch all comments for a ticket.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Response** (200 OK):
```json
{
  "comments": [
    {
      "id": 1,
      "ticketId": 42,
      "userId": "user-abc123",
      "content": "This needs clarification on @[Alice Smith](user-alice) the authentication flow.",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z",
      "user": {
        "id": "user-abc123",
        "name": "Bob Johnson",
        "email": "bob@example.com"
      }
    }
  ]
}
```

**Errors**:
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Ticket or project not found

### POST /api/projects/:projectId/tickets/:id/comments

Create a new comment.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Request Body**:
```json
{
  "content": "Updated the spec based on feedback."
}
```

**Validation**:
- `content`: Required, 1-2000 characters

**Response** (201 Created):
```json
{
  "id": 2,
  "ticketId": 42,
  "userId": "user-abc123",
  "content": "Updated the spec based on feedback.",
  "createdAt": "2025-01-15T11:00:00.000Z",
  "updatedAt": "2025-01-15T11:00:00.000Z",
  "user": {
    "id": "user-abc123",
    "name": "Bob Johnson",
    "email": "bob@example.com"
  }
}
```

**Errors**:
- `400`: Invalid content (empty, too long)
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Ticket or project not found

### POST /api/projects/:projectId/tickets/:id/comments/ai-board

Create AI-BOARD comment (workflow-only endpoint).

**Authentication**: Bearer token (WORKFLOW_API_TOKEN)
**Authorization**: Workflow token validation (no project membership check)

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Request Body**:
```json
{
  "content": "I've updated the specification based on your request.",
  "userId": "ai-board-system-user"
}
```

**Validation**:
- `content`: Required, 1-2000 characters
- `userId`: Must be "ai-board-system-user"

**Response** (201 Created):
```json
{
  "id": 3,
  "ticketId": 42,
  "userId": "ai-board-system-user",
  "content": "I've updated the specification based on your request.",
  "createdAt": "2025-01-15T12:00:00.000Z",
  "updatedAt": "2025-01-15T12:00:00.000Z"
}
```

**Errors**:
- `400`: Invalid content or userId
- `401`: Invalid or missing workflow token
- `404`: Ticket or project not found

### DELETE /api/projects/:projectId/tickets/:id/comments/:commentId

Delete a comment (author only).

**Authentication**: Required (session)
**Authorization**: Must be comment author AND (project owner or member)

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID
- `commentId` (number, required): Comment ID

**Response** (204 No Content)

**Errors**:
- `401`: Not authenticated
- `403`: Not comment author
- `404`: Comment, ticket, or project not found

## Timeline Endpoints

### GET /api/projects/:projectId/tickets/:id/timeline

Fetch unified conversation timeline (comments + job events).

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Response** (200 OK):
```json
{
  "timeline": [
    {
      "type": "comment",
      "timestamp": "2025-01-15T10:00:00.000Z",
      "data": {
        "id": 1,
        "ticketId": 42,
        "userId": "user-abc123",
        "content": "Updated the specification",
        "createdAt": "2025-01-15T10:00:00.000Z",
        "updatedAt": "2025-01-15T10:00:00.000Z",
        "user": {
          "id": "user-abc123",
          "name": "Alice Smith",
          "email": "alice@example.com",
          "image": null
        }
      }
    },
    {
      "type": "job_start",
      "timestamp": "2025-01-15T10:05:00.000Z",
      "data": {
        "id": 123,
        "ticketId": 42,
        "projectId": 1,
        "command": "specify",
        "status": "RUNNING",
        "branch": "042-add-login-feature",
        "startedAt": "2025-01-15T10:05:00.000Z",
        "completedAt": null
      }
    },
    {
      "type": "job_complete",
      "timestamp": "2025-01-15T10:10:00.000Z",
      "data": {
        "id": 123,
        "ticketId": 42,
        "projectId": 1,
        "command": "specify",
        "status": "COMPLETED",
        "branch": "042-add-login-feature",
        "startedAt": "2025-01-15T10:05:00.000Z",
        "completedAt": "2025-01-15T10:10:00.000Z"
      }
    }
  ],
  "mentionedUsers": {
    "user-def456": {
      "id": "user-def456",
      "name": "Bob Johnson",
      "email": "bob@example.com"
    }
  },
  "currentUserId": "user-abc123"
}
```

**Timeline Event Types**:
- `comment`: User comment posted on ticket
- `job_start`: Job entered PENDING or RUNNING state
- `job_complete`: Job reached terminal state (COMPLETED, FAILED, CANCELLED)

**Job Filtering**:
- Includes jobs for stages: SPECIFY, PLAN, BUILD, VERIFY
- Excludes jobs for stage: SHIP (out of scope)
- Jobs ordered chronologically (oldest first)

**Mentioned Users**:
- Map of user ID → user info for @mentions in comments
- Only includes users still in system (deleted users omitted)
- Used by frontend to render mention links

**Errors**:
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Ticket or project not found

## Image Attachment Endpoints

### POST /api/projects/:projectId/tickets/:id/images

Upload image attachment.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Request**: `multipart/form-data`
- `file`: Image file (JPEG, PNG, GIF, WebP, max 10MB)

**Response** (201 Created):
```json
{
  "attachment": {
    "type": "uploaded",
    "url": "https://res.cloudinary.com/.../screenshot.png",
    "filename": "screenshot.png",
    "mimeType": "image/png",
    "sizeBytes": 204800,
    "uploadedAt": "2025-01-15T10:00:00.000Z",
    "cloudinaryPublicId": "ai-board/tickets/42/screenshot"
  }
}
```

**Errors**:
- `400`: Invalid file type, file too large, or max attachments (5) reached
- `401`: Not authenticated
- `403`: User is neither project owner nor member, or ticket in non-editable stage
- `404`: Ticket or project not found
- `413`: Payload too large (>10MB)
- `500`: Cloudinary upload error

### PUT /api/projects/:projectId/tickets/:id/images/:index

Replace image at specific index.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID
- `index` (number, required): Attachment array index (0-4)

**Request**: `multipart/form-data`
- `file`: Image file (JPEG, PNG, GIF, WebP, max 10MB)

**Response** (200 OK):
```json
{
  "attachment": {
    "type": "uploaded",
    "url": "https://res.cloudinary.com/.../new-screenshot.png",
    ...
  }
}
```

**Errors**:
- `400`: Invalid index or file type
- `401`: Not authenticated
- `403`: User is neither project owner nor member, or ticket in non-editable stage
- `404`: Ticket, project, or attachment index not found
- `500`: Cloudinary error

### DELETE /api/projects/:projectId/tickets/:id/images/:index

Delete image at specific index.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID
- `index` (number, required): Attachment array index (0-4)

**Response** (204 No Content)

**Errors**:
- `400`: Invalid index
- `401`: Not authenticated
- `403`: User is neither project owner nor member, or ticket in non-editable stage
- `404`: Ticket, project, or attachment index not found
- `500`: Cloudinary error (logged but doesn't block deletion)

## Job Status Endpoints

### GET /api/projects/:projectId/jobs/status

Fetch all job statuses for a project (polling endpoint).

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID

**Response** (200 OK):
```json
{
  "jobs": [
    {
      "id": 123,
      "ticketId": 42,
      "status": "RUNNING",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    },
    {
      "id": 124,
      "ticketId": 43,
      "status": "COMPLETED",
      "updatedAt": "2025-01-15T10:25:00.000Z"
    }
  ]
}
```

**Errors**:
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Project not found

**Performance**: <100ms p95 (indexed query on projectId)

### PATCH /api/jobs/:id/status

Update job status (workflow-only endpoint).

**Authentication**: Bearer token (WORKFLOW_API_TOKEN)
**Authorization**: Workflow token validation (no project membership check)

**Path Parameters**:
- `id` (number, required): Job ID

**Request Body**:
```json
{
  "status": "COMPLETED"
}
```

**Validation**:
- `status`: Required, enum (RUNNING|COMPLETED|FAILED|CANCELLED)
- State machine transitions enforced

**Response** (200 OK):
```json
{
  "id": 123,
  "status": "COMPLETED",
  "completedAt": "2025-01-15T10:35:00.000Z"
}
```

**Errors**:
- `400`: Invalid status or invalid state transition
- `401`: Invalid or missing workflow token
- `404`: Job not found

**State Machine**:
```
Valid transitions:
- PENDING → RUNNING
- RUNNING → COMPLETED | FAILED | CANCELLED
- Terminal states → same state (idempotent)

Invalid transitions return 400 error
```

## Project Member Endpoints

### GET /api/projects/:projectId/members

Fetch project members for mentions autocomplete.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID

**Response** (200 OK):
```json
{
  "members": [
    {
      "userId": "user-abc123",
      "name": "Alice Smith",
      "email": "alice@example.com",
      "role": "owner"
    },
    {
      "userId": "user-def456",
      "name": "Bob Johnson",
      "email": "bob@example.com",
      "role": "member"
    },
    {
      "userId": "ai-board-system-user",
      "name": "AI-BOARD",
      "email": "ai-board@system.local",
      "role": "member"
    }
  ]
}
```

**Errors**:
- `401`: Not authenticated
- `403`: Not project owner or member
- `404`: Project not found

## Error Response Format

All error responses follow a consistent structure:

```json
{
  "error": "Short error message",
  "message": "Detailed explanation",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_TRANSITION` | Sequential stage transition violated |
| `JOB_NOT_COMPLETED` | Job status blocks transition |
| `MISSING_JOB` | Expected job not found (data integrity issue) |
| `ROLLBACK_NOT_ALLOWED` | Quick-impl rollback conditions not met |
| `VERSION_CONFLICT` | Optimistic concurrency control conflict |
| `INVALID_TOKEN` | Workflow authentication failed |
| `VALIDATION_ERROR` | Zod schema validation failed |

### HTTP Status Codes

| Code | Usage |
|------|-------|
| `200` | Success (GET, PATCH) |
| `201` | Created (POST) |
| `204` | No Content (DELETE) |
| `400` | Bad Request (validation, invalid transition) |
| `401` | Unauthorized (authentication failed) |
| `403` | Forbidden (authorization failed) |
| `404` | Not Found (resource doesn't exist) |
| `409` | Conflict (version mismatch) |
| `413` | Payload Too Large (file upload) |
| `500` | Internal Server Error |

## Rate Limiting

Currently no rate limiting implemented. Future enhancement may add:
- Per-user request limits
- Per-IP request limits
- Workflow endpoint protection

## Pagination

Currently not implemented. All endpoints return complete result sets.

**Future Enhancement**:
- Cursor-based pagination for tickets
- Limit/offset for comments
- Page size configuration
