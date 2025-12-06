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
  "activeCleanupJobId": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Fields**:
- `activeCleanupJobId`: ID of active cleanup job (null if no cleanup in progress)
  - Used by frontend to show cleanup lock banner
  - Lock automatically cleared when cleanup job reaches terminal state

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

Fetch all tickets for a project, grouped by stage.

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

**Sorting Behavior**:
- **INBOX**: Tickets sorted by `ticketNumber` ascending (oldest first, newest last)
- **All Other Stages**: Tickets sorted by `updatedAt` descending (most recently updated first)
- Sorting applied per-stage after grouping

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

### DELETE /api/projects/:projectId/tickets/:id

Delete ticket with GitHub cleanup (permanent deletion).

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Request Body**: Empty

**Response** (204 No Content)

**Deletion Behavior**:
- **Transactional**: All GitHub artifacts must be deleted successfully before database deletion
- **GitHub Cleanup** (in order):
  1. Close all pull requests where head branch matches ticket branch
  2. Delete Git branch from repository
- **Database Cleanup** (cascade):
  1. Delete all associated jobs
  2. Delete all associated comments
  3. Delete ticket record
- **Failure Handling**: If any GitHub operation fails, ticket remains unchanged in database
- **Idempotent Branch Deletion**: If branch already deleted (404 or 422 "reference does not exist"), operation continues successfully

**Validation**:
- Ticket cannot be in SHIP stage (400 error)
- Ticket cannot have PENDING or RUNNING jobs (400 error)

**Errors**:
- `400`: Invalid deletion (SHIP stage or active job)
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Ticket or project not found
- `500`: GitHub API error or database error

**GitHub API Errors**:
- 404 errors (branch/PR not found) are ignored (idempotent operation)
- 422 errors with "reference does not exist" message are ignored (branch already deleted)
- Other GitHub API errors abort the deletion and preserve ticket

**Notes**:
- Pull requests are identified by matching head branch name
- All PRs with matching head branch are closed (handles multiple PRs scenario)
- Workflow artifacts (spec.md, plan.md, tasks.md) are deleted when branch is deleted
- Preview deployments become orphaned (Vercel cleanup is manual)
- TanStack Query optimistic update removes ticket immediately from UI

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
- **VERIFY → PLAN**: Rollback for FULL workflows only:
  1. Validates latest job is COMPLETED, FAILED, or CANCELLED
  2. Clears previewUrl on ticket
  3. Deletes implement job record
  4. Updates ticket stage to PLAN
  5. Dispatches rollback-reset workflow (git reset to pre-BUILD state, preserves spec files)
  6. Creates rollback-reset job to track the git reset operation
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

**Mention Notification Behavior**:
- Automatically extracts @mentions from comment content
- Creates notifications for mentioned project members (owner + members)
- Filters out AI-BOARD self-mentions (no notification created)
- Filters out non-project members (no notification created)
- Uses AI-BOARD user ID as `actorId` in notification records
- Notification creation is non-blocking (errors logged but don't fail comment creation)

**Errors**:
- `400`: Invalid content or userId
- `401`: Invalid or missing workflow token
- `404`: Ticket or project not found

**Note**: Comment creation always succeeds even if notification creation fails (non-blocking pattern)

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

## Notification Endpoints

### GET /api/notifications

Fetch notifications for authenticated user with unread count.

**Authentication**: Required (session)
**Authorization**: User can only access their own notifications

**Query Parameters**:
- `limit` (optional): Maximum notifications to return (default: 5, max: 50)

**Response** (200 OK):
```json
{
  "notifications": [
    {
      "id": 1,
      "actorName": "Alice Smith",
      "actorImage": "https://...",
      "ticketKey": "ABC-42",
      "commentPreview": "Can you review the authentication logic in the login handler...",
      "createdAt": "2025-01-20T14:30:00.000Z",
      "read": false,
      "commentId": 123,
      "projectId": 1
    },
    {
      "id": 2,
      "actorName": "Bob Johnson",
      "actorImage": null,
      "ticketKey": "ABC-38",
      "commentPreview": "Thanks for the feedback! I've updated the spec accordingly.",
      "createdAt": "2025-01-19T10:15:00.000Z",
      "read": true,
      "commentId": 118,
      "projectId": 1
    }
  ],
  "unreadCount": 3,
  "hasMore": false
}
```

**Fields**:
- `actorName`: Display name or email of user who created the mention
- `actorImage`: Avatar URL (null if not available)
- `ticketKey`: Human-readable ticket identifier for navigation
- `commentPreview`: First 80 characters of comment content (truncated with "...")
- `createdAt`: ISO 8601 timestamp of notification creation
- `read`: Boolean indicating if notification has been read
- `commentId`: ID for comment anchor navigation and scroll targeting
- `projectId`: Project ID for navigation URL construction and cross-project detection
- `unreadCount`: Total number of unread notifications for user
- `hasMore`: Boolean indicating if more notifications exist beyond limit

**Navigation Context**:
- `projectId` enables same-project vs cross-project detection
- Same-project: Current window navigation when notification.projectId matches board projectId
- Cross-project: New tab navigation when notification.projectId differs from board projectId
- `commentId` used to construct comment anchor (#comment-{id}) for scroll targeting
- `ticketKey` used to construct navigation URL (/projects/{projectId}?modal=open&ticketKey={ticketKey}&tab=comments#comment-{commentId})

**Errors**:
- `401`: Not authenticated
- `500`: Database error

### PATCH /api/notifications/:id/mark-read

Mark a single notification as read.

**Authentication**: Required (session)
**Authorization**: User can only mark their own notifications as read

**Path Parameters**:
- `id` (number, required): Notification ID

**Request Body**: Empty

**Response** (200 OK):
```json
{
  "success": true
}
```

**Errors**:
- `400`: Invalid notification ID (non-numeric)
- `401`: Not authenticated
- `403`: Notification belongs to another user
- `404`: Notification not found
- `500`: Database error

**Idempotency**: Marking an already-read notification returns 200 OK

**Usage Pattern**:
- Called by notification dropdown before navigation
- Updates `read` to true and sets `readAt` timestamp
- Triggers TanStack Query cache invalidation for notification list
- Supports optimistic updates (UI updates before server confirms)
- Navigation begins immediately after mutation call (non-blocking)

### POST /api/notifications/mark-all-read

Mark all notifications as read for authenticated user.

**Authentication**: Required (session)
**Authorization**: Only affects current user's notifications

**Request Body**: Empty

**Response** (200 OK):
```json
{
  "success": true,
  "count": 5
}
```

**Fields**:
- `count`: Number of notifications marked as read

**Errors**:
- `401`: Not authenticated
- `500`: Database error

**Behavior**:
- Only marks unread notifications (read=false)
- Sets read=true and readAt=current timestamp
- Updates all unread notifications in single transaction
- Returns count of affected notifications

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

### GET /api/projects/:projectId/tickets/:id/jobs

Fetch all jobs for a specific ticket with optional telemetry data.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Query Parameters**:
- `includeStats` (boolean, optional): Include telemetry fields for Stats tab display
  - Default: `false`
  - When `true`, returns full job data with token metrics, cost, duration, model, and tools

**Response** (200 OK) - Without Stats:
```json
{
  "jobs": [
    {
      "id": 123,
      "command": "specify",
      "status": "COMPLETED",
      "completedAt": "2025-01-15T10:30:00.000Z"
    },
    {
      "id": 124,
      "command": "plan",
      "status": "COMPLETED",
      "completedAt": "2025-01-15T10:35:00.000Z"
    }
  ]
}
```

**Response** (200 OK) - With Stats (`?includeStats=true`):
```json
{
  "jobs": [
    {
      "id": 123,
      "command": "specify",
      "status": "COMPLETED",
      "startedAt": "2025-01-15T10:28:00.000Z",
      "completedAt": "2025-01-15T10:30:00.000Z",
      "inputTokens": 25000,
      "outputTokens": 8000,
      "cacheReadTokens": 10000,
      "cacheCreationTokens": 15000,
      "costUsd": 0.45,
      "durationMs": 120000,
      "model": "claude-sonnet-4-20250514",
      "toolsUsed": ["Edit", "Read", "Bash"]
    },
    {
      "id": 124,
      "command": "plan",
      "status": "COMPLETED",
      "startedAt": "2025-01-15T10:33:00.000Z",
      "completedAt": "2025-01-15T10:35:00.000Z",
      "inputTokens": 18000,
      "outputTokens": 6000,
      "cacheReadTokens": 8000,
      "cacheCreationTokens": 0,
      "costUsd": 0.32,
      "durationMs": 90000,
      "model": "claude-sonnet-4-20250514",
      "toolsUsed": ["Read", "Edit", "Grep"]
    }
  ]
}
```

**Fields** (includeStats=true):
- `id`: Job ID
- `command`: Workflow command (specify, plan, implement, etc.)
- `status`: Job status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
- `startedAt`: ISO 8601 timestamp when job started
- `completedAt`: ISO 8601 timestamp when job completed (null if not completed)
- `inputTokens`: Total input tokens consumed (null if not available)
- `outputTokens`: Total output tokens generated (null if not available)
- `cacheReadTokens`: Cache read tokens (null if not available)
- `cacheCreationTokens`: Cache creation tokens (null if not available)
- `costUsd`: Total cost in USD (null if not available)
- `durationMs`: Duration in milliseconds (null if not available)
- `model`: AI model used (null if not available)
- `toolsUsed`: Array of tool names used during execution

**Ordering**:
- Jobs ordered chronologically by `startedAt` (oldest first)
- Consistent ordering for timeline display

**Errors**:
- `400`: Invalid project ID or ticket ID
- `401`: Not authenticated
- `403`: Ticket belongs to different project, or user is neither project owner nor member
- `404`: Project or ticket not found
- `500`: Database error

**Use Cases**:
- Stats tab: Fetch full telemetry data with `?includeStats=true`
- Job status polling: Fetch minimal data without query parameter
- Timeline display: Chronological job history for ticket detail modal

**Performance**: <50ms p95 for typical ticket (1-20 jobs)

### POST /api/projects/:projectId/jobs

Create a new job for a ticket (workflow-only endpoint).

**Authentication**: Bearer token (WORKFLOW_API_TOKEN)
**Authorization**: Workflow token validation (no user session check)

**Path Parameters**:
- `projectId` (number, required): Project ID

**Request Body**:
```json
{
  "ticketId": 42,
  "command": "iterate",
  "branch": "AIB-42-fix-validation"
}
```

**Validation**:
- `ticketId`: Required, positive integer, must belong to projectId
- `command`: Required, string (1-50 chars), e.g., "iterate", "comment-verify"
- `branch`: Optional, string (uses ticket branch if not provided)

**Response** (201 Created):
```json
{
  "id": 125,
  "ticketId": 42,
  "projectId": 3,
  "command": "iterate",
  "status": "PENDING",
  "branch": "AIB-42-fix-validation",
  "startedAt": "2025-01-15T10:40:00.000Z"
}
```

**Errors**:
- `400`: Validation failed or ticket doesn't belong to project
- `401`: Invalid or missing workflow token
- `404`: Ticket not found

**Use Cases**:
- AI-BOARD Assistant creates iterate jobs during VERIFY stage
- Workflow orchestration for multi-stage operations
- Internal job creation by GitHub Actions workflows

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

## Telemetry Endpoints

### POST /api/telemetry/v1/logs

OTLP HTTP/JSON endpoint for receiving Claude Code telemetry.

**Authentication**: Bearer token (WORKFLOW_API_TOKEN) via `OTEL_EXPORTER_OTLP_HEADERS`
**Authorization**: Workflow token validation

**Request Body** (OTLP JSON format):
```json
{
  "resourceLogs": [{
    "resource": {
      "attributes": [
        { "key": "job_id", "value": { "stringValue": "123" } },
        { "key": "service.name", "value": { "stringValue": "claude-code" } }
      ]
    },
    "scopeLogs": [{
      "logRecords": [{
        "body": { "stringValue": "claude_code.api_request" },
        "attributes": [
          { "key": "input_tokens", "value": { "stringValue": "1000" } },
          { "key": "output_tokens", "value": { "stringValue": "500" } },
          { "key": "cost_usd", "value": { "stringValue": "0.05" } },
          { "key": "model", "value": { "stringValue": "claude-sonnet-4-5-20250929" } }
        ]
      }]
    }]
  }]
}
```

**Workflow Configuration**:
```yaml
env:
  CLAUDE_CODE_ENABLE_TELEMETRY: "1"
  OTEL_LOGS_EXPORTER: "otlp"
  OTEL_EXPORTER_OTLP_PROTOCOL: "http/json"
  OTEL_EXPORTER_OTLP_ENDPOINT: ${{ vars.APP_URL }}/api/telemetry
  OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Bearer ${{ secrets.WORKFLOW_API_TOKEN }}"
  OTEL_RESOURCE_ATTRIBUTES: "job_id=${{ inputs.job_id }}"
```

**Processing**:
- Extracts `job_id` from resource attributes
- Aggregates metrics from `claude_code.api_request` events (tokens, cost, duration, model)
- Collects tool names from `claude_code.tool_result` events
- Updates corresponding Job record with aggregated metrics

**Response** (200 OK):
```json
{
  "status": "accepted",
  "jobId": 123,
  "metrics": {
    "inputTokens": 15000,
    "outputTokens": 3500,
    "costUsd": 0.125
  }
}
```

**Errors**:
- `400`: Invalid OTLP format
- `401`: Invalid or missing workflow token
- `404`: Job not found (if job_id provided)

**Notes**:
- Telemetry is sent automatically by Claude Code during execution
- Multiple batches may be received for a single job (metrics are aggregated)
- If no job_id in attributes, telemetry is accepted but not stored

## Analytics Endpoints

### GET /api/projects/:projectId/analytics

Fetch aggregated analytics data for project visualization.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID

**Query Parameters**:
- `range` (string, optional): Time range for analytics (7d|30d|90d|all, default: 30d)

**Response** (200 OK):
```json
{
  "overview": {
    "totalCost": 45.67,
    "costTrend": 12.5,
    "successRate": 94.2,
    "avgDuration": 125000,
    "ticketsShipped": 8
  },
  "costOverTime": [
    { "date": "2025-11-20", "cost": 5.23 },
    { "date": "2025-11-21", "cost": 8.45 }
  ],
  "costByStage": [
    { "stage": "BUILD", "cost": 28.45, "percentage": 62.3 },
    { "stage": "SPECIFY", "cost": 10.22, "percentage": 22.4 },
    { "stage": "PLAN", "cost": 4.50, "percentage": 9.8 },
    { "stage": "VERIFY", "cost": 2.50, "percentage": 5.5 }
  ],
  "tokenUsage": {
    "inputTokens": 1250000,
    "outputTokens": 450000,
    "cacheTokens": 380000
  },
  "cacheEfficiency": {
    "totalTokens": 2080000,
    "cacheTokens": 380000,
    "savingsPercentage": 18.3,
    "estimatedSavingsUsd": 3.42
  },
  "topTools": [
    { "tool": "Edit", "count": 245 },
    { "tool": "Read", "count": 189 },
    { "tool": "Bash", "count": 156 }
  ],
  "workflowDistribution": [
    { "type": "FULL", "count": 12, "percentage": 60.0 },
    { "type": "QUICK", "count": 6, "percentage": 30.0 },
    { "type": "CLEAN", "count": 2, "percentage": 10.0 }
  ],
  "velocity": [
    { "week": "2025-W46", "ticketsShipped": 3 },
    { "week": "2025-W47", "ticketsShipped": 5 },
    { "week": "2025-W48", "ticketsShipped": 2 }
  ],
  "timeRange": "30d",
  "generatedAt": "2025-11-28T10:30:00Z",
  "jobCount": 45,
  "hasData": true
}
```

**Fields**:
- `overview`: Summary metrics for the selected time period
  - `totalCost`: Total cost in USD
  - `costTrend`: Percentage change compared to previous equivalent period
  - `successRate`: Percentage of COMPLETED jobs (excludes PENDING/RUNNING)
  - `avgDuration`: Average job duration in milliseconds
  - `ticketsShipped`: Tickets shipped in current month
- `costOverTime`: Daily or weekly cost data points
  - `date`: ISO date (YYYY-MM-DD) or week (YYYY-Www)
  - `cost`: Cost in USD for period
- `costByStage`: Cost breakdown by workflow stage
  - `stage`: SPECIFY, PLAN, BUILD, or VERIFY
  - `cost`: Total cost for stage
  - `percentage`: Percentage of total cost
- `tokenUsage`: Token consumption breakdown
  - `inputTokens`: Total input tokens
  - `outputTokens`: Total output tokens
  - `cacheTokens`: Total cache tokens (read + creation)
- `cacheEfficiency`: Cache performance metrics
  - `totalTokens`: All tokens processed
  - `cacheTokens`: Tokens served from cache
  - `savingsPercentage`: Cache hit rate
  - `estimatedSavingsUsd`: Estimated savings from cache
- `topTools`: Most frequently used AI tools (max 10)
  - `tool`: Tool name (Edit, Read, Bash, Write, Glob, etc.)
  - `count`: Usage frequency
- `workflowDistribution`: Workflow type breakdown
  - `type`: FULL, QUICK, or CLEAN
  - `count`: Number of tickets using this type
  - `percentage`: Percentage of total tickets
- `velocity`: Weekly shipping velocity
  - `week`: ISO week identifier (YYYY-Www)
  - `ticketsShipped`: Tickets shipped that week
- `timeRange`: Applied time range filter
- `generatedAt`: Timestamp when analytics were generated
- `jobCount`: Total jobs included in analysis
- `hasData`: False if no completed jobs with telemetry data

**Data Aggregation**:
- Includes only COMPLETED jobs (excludes PENDING, RUNNING, FAILED, CANCELLED from cost/token calculations)
- Stage derived from job command (specify→SPECIFY, plan→PLAN, implement→BUILD, verify→VERIFY)
- Cost trend compares current period to previous equivalent period
- Granularity auto-adjusts: daily for <30 days, weekly for ≥30 days
- Top tools limited to 10 entries with "Other" aggregation for remaining tools

**Empty State**:
- Returns zero values when no completed jobs exist
- `hasData` field indicates data availability

**Errors**:
- `400`: Invalid time range parameter
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Project not found
- `500`: Database error or aggregation failure

**Performance**: Optimized with database aggregation, <3s for projects with up to 1,000 jobs

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
| `ROLLBACK_NOT_ALLOWED` | Rollback conditions not met (wrong workflow type or job status) |
| `VERSION_CONFLICT` | Optimistic concurrency control conflict |
| `INVALID_TOKEN` | Workflow authentication failed |
| `VALIDATION_ERROR` | Zod schema validation failed |
| `CLEANUP_IN_PROGRESS` | Transitions blocked during cleanup (423) |
| `CLEANUP_ALREADY_RUNNING` | Cleanup workflow already in progress (409) |
| `NO_CHANGES` | No shipped tickets to clean up (400) |

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
| `409` | Conflict (version mismatch, cleanup already running) |
| `413` | Payload Too Large (file upload) |
| `423` | Locked (cleanup in progress, transitions blocked) |
| `500` | Internal Server Error |

## Project Cleanup Endpoints

### POST /api/projects/:projectId/clean

Trigger cleanup workflow for a project.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID

**Request Body**: Empty

**Response** (201 Created):
```json
{
  "ticket": {
    "id": 150,
    "ticketKey": "ABC-42",
    "title": "Clean 2025-01-15",
    "description": "Cleanup of shipped tickets since last cleanup...",
    "stage": "BUILD",
    "workflowType": "CLEAN",
    "branch": null,
    "projectId": 1,
    "createdAt": "2025-01-15T10:00:00.000Z"
  },
  "job": {
    "id": 300,
    "ticketId": 150,
    "command": "clean",
    "status": "PENDING",
    "branch": null,
    "startedAt": "2025-01-15T10:00:00.000Z",
    "projectId": 1
  },
  "analysis": {
    "lastCleanup": {
      "ticketKey": "ABC-30",
      "date": "2025-01-01T00:00:00.000Z"
    },
    "changes": {
      "ticketsShipped": 12,
      "ticketKeys": ["ABC-31", "ABC-32", "..."]
    }
  }
}
```

**Cleanup Process**:
1. Validates no cleanup already in progress
2. Checks if shipped tickets exist since last cleanup
3. Creates cleanup ticket in BUILD stage with workflowType=CLEAN
4. Creates cleanup job with command="clean"
5. Sets project.activeCleanupJobId (enables transition lock)
6. Dispatches cleanup.yml GitHub workflow
7. Returns ticket and job details

**Errors**:
- `400`: No changes to clean (no shipped tickets since last cleanup)
  ```json
  {
    "error": "No changes to clean up",
    "code": "NO_CHANGES",
    "details": {
      "lastCleanupDate": "2025-01-01T00:00:00.000Z",
      "lastCleanupTicket": "ABC-30",
      "message": "No tickets shipped since last cleanup"
    }
  }
  ```
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Project not found
- `409`: Cleanup already in progress
  ```json
  {
    "error": "Cleanup workflow already in progress",
    "code": "CLEANUP_ALREADY_RUNNING",
    "details": {
      "activeJobId": 299,
      "activeJobStatus": "RUNNING"
    }
  }
  ```
- `500`: Workflow dispatch error or database error

**Note**: Workflow dispatch errors are logged but don't fail the request (workflow can be manually triggered).

## Transition Lock Behavior

### HTTP 423 Locked Response

When a project has an active cleanup job, all ticket transition requests return 423:

**Request**: POST /api/projects/:projectId/tickets/:id/transition

**Response** (423 Locked):
```json
{
  "error": "Project cleanup in progress",
  "code": "CLEANUP_IN_PROGRESS",
  "details": {
    "cleanupTicketKey": "ABC-42",
    "jobStatus": "RUNNING",
    "message": "You can still update ticket descriptions, documents, and preview deployments. Transitions will be re-enabled when cleanup completes."
  }
}
```

**Affected Endpoints**:
- POST /api/projects/:projectId/tickets/:id/transition

**Unaffected Endpoints** (still work during cleanup):
- PATCH /api/projects/:projectId/tickets/:id (update title, description)
- POST /api/projects/:projectId/tickets/:id/deploy (trigger preview)
- POST /api/projects/:projectId/tickets/:id/comments (add comments)
- All GET endpoints

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
