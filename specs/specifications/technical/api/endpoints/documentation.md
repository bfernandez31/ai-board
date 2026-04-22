# Documentation, Comparison & Constitution Endpoints

## Documentation Endpoints

Documentation endpoints provide read and write access to workflow documentation files (spec.md, plan.md, tasks.md, summary.md) stored in the `specs/{branch}/` directory of the GitHub repository.

### GET /api/projects/:projectId/tickets/:id/spec

Fetch spec.md content for a ticket.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Response** (200 OK):
```json
{
  "content": "# Feature Specification\n\n...",
  "metadata": {
    "path": "specs/042-add-login-feature/spec.md",
    "branch": "042-add-login-feature",
    "sha": "a1b2c3d4e5f6",
    "size": 4567
  }
}
```

**Branch Resolution**:
- **SHIP stage**: Fetches from the repository's default branch
- **All other stages**: Fetches from ticket's feature branch

**Errors**:
- `400`: Invalid project or ticket ID
- `401`: Not authenticated
- `403`: User is neither project owner nor member, or ticket belongs to different project
- `404`: Project, ticket, or spec.md file not found
- `500`: GitHub API error

### GET /api/projects/:projectId/tickets/:id/plan

Fetch plan.md content for a ticket.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Response** (200 OK):
```json
{
  "content": "# Implementation Plan\n\n...",
  "metadata": {
    "path": "specs/042-add-login-feature/plan.md",
    "branch": "042-add-login-feature",
    "sha": "b2c3d4e5f6a1",
    "size": 8901
  }
}
```

**Branch Resolution**:
- **SHIP stage**: Fetches from the repository's default branch
- **All other stages**: Fetches from ticket's feature branch

**Errors**:
- `400`: Invalid project or ticket ID
- `401`: Not authenticated
- `403`: User is neither project owner nor member, or ticket belongs to different project
- `404`: Project, ticket, or plan.md file not found
- `500`: GitHub API error

### GET /api/projects/:projectId/tickets/:id/tasks

Fetch tasks.md content for a ticket.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Response** (200 OK):
```json
{
  "content": "# Tasks: Add Login Feature\n\n...",
  "metadata": {
    "path": "specs/042-add-login-feature/tasks.md",
    "branch": "042-add-login-feature",
    "sha": "c3d4e5f6a1b2",
    "size": 3456
  }
}
```

**Branch Resolution**:
- **SHIP stage**: Fetches from the repository's default branch
- **All other stages**: Fetches from ticket's feature branch

**Errors**:
- `400`: Invalid project or ticket ID
- `401`: Not authenticated
- `403`: User is neither project owner nor member, or ticket belongs to different project
- `404`: Project, ticket, or tasks.md file not found
- `500`: GitHub API error

### GET /api/projects/:projectId/tickets/:id/summary

Fetch summary.md content for a ticket (read-only).

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Response** (200 OK):
```json
{
  "content": "# Implementation Summary\n\n## Changes Made\n...",
  "metadata": {
    "path": "specs/042-add-login-feature/summary.md",
    "branch": "042-add-login-feature",
    "sha": "d4e5f6a1b2c3",
    "size": 2345
  }
}
```

**Branch Resolution**:
- **SHIP stage**: Fetches from the repository's default branch
- **All other stages**: Fetches from ticket's feature branch

**Availability**:
- Only available for FULL workflow tickets with completed implement job
- Returns 404 for QUICK workflow type
- Returns 404 if implement job has not completed

**Summary Content**:
- Implementation details and changes made during BUILD stage
- Key architectural decisions
- Files modified or created
- Generated automatically by workflow during implement step

**Errors**:
- `400`: Invalid project or ticket ID
- `401`: Not authenticated
- `403`: User is neither project owner nor member, or ticket belongs to different project
- `404`: Project, ticket, or summary.md file not found (includes tickets without implement job or non-FULL workflows)
- `500`: GitHub API error

**Note**: Unlike spec.md, plan.md, and tasks.md, the summary.md file is read-only and cannot be edited through the UI or API.

### POST /api/projects/:projectId/docs

Commit and push edited documentation content to a ticket's feature branch.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member (via `verifyProjectAccess`)

**Path Parameters**:
- `projectId` (number, required): Project ID

**Request Body** (`editDocumentationSchema`):
```json
{
  "ticketId": 42,
  "docType": "spec",
  "content": "# Updated Spec\n\nContent...",
  "commitMessage": "docs: clarify acceptance criteria"
}
```

**Fields**:
- `ticketId` (number, required): Positive integer identifying the ticket
- `docType` (string, required): One of `spec`, `plan`, `tasks` — `summary` is read-only
- `content` (string, required): Full markdown content, 1 byte to 1MB
- `commitMessage` (string, optional): Custom commit message, max 500 characters; defaults to `"docs: update {docType}.md for ticket #{ticketId}"`

**Stage-Based Edit Permissions**:
- `SPECIFY` stage: only `spec` is editable
- `PLAN` stage: only `plan` and `tasks` are editable
- All other stages (`INBOX`, `BUILD`, `VERIFY`, `SHIP`): editing is not allowed (403)

**Response** (200 OK):
```json
{
  "success": true,
  "commitSha": "abc123def456abc123def456abc123def456abcd",
  "updatedAt": "2026-01-02T14:30:00.000Z",
  "message": "spec.md updated successfully"
}
```

**File Path**: `specs/{ticketBranch}/{docType}.md`

**Errors**:
- `400`: Invalid project ID, validation error (body fails schema), or invalid markdown syntax
- `403`: User lacks project access, ticket belongs to a different project, or ticket stage does not allow editing the requested `docType`
- `404`: Ticket not found or ticket has no branch assigned
- `409`: Merge conflict — another user modified the same file concurrently
- `500`: GitHub API error or internal server error

### GET /api/projects/:projectId/docs/diff

Fetch the diff for a specific commit affecting a documentation file on a ticket's feature branch.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member (via `verifyProjectAccess`)

**Path Parameters**:
- `projectId` (number, required): Project ID

**Query Parameters**:
- `ticketId` (number, required): Ticket ID
- `docType` (string, required): Document type — `spec`, `plan`, `tasks`, or `summary`
- `sha` (string, required): Full 40-character commit SHA

**Response** (200 OK):
```json
{
  "sha": "abc123def456abc123def456abc123def456abcd",
  "files": [
    {
      "filename": "specs/042-add-login-feature/spec.md",
      "status": "modified",
      "additions": 15,
      "deletions": 3,
      "patch": "@@ -1,3 +1,6 @@\n ..."
    }
  ]
}
```

**File Path**: `specs/{ticketBranch}/{docType}.md`

**Errors**:
- `400`: Invalid project ID, missing/invalid query parameters, or malformed SHA
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Ticket not found, ticket has no branch, or commit not found in repository
- `500`: GitHub integration not configured or GitHub API error

### GET /api/projects/:projectId/docs/history

Fetch commit history for a documentation file on a ticket's feature branch.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member (via `verifyProjectAccess`)

**Path Parameters**:
- `projectId` (number, required): Project ID

**Query Parameters**:
- `ticketId` (number, required): Ticket ID
- `docType` (string, required): Document type — `spec`, `plan`, `tasks`, or `summary`

**Response** (200 OK):
```json
{
  "commits": [
    {
      "sha": "abc123def456abc123def456abc123def456abcd",
      "author": {
        "name": "Claude Agent",
        "email": "agent@example.com",
        "date": "2026-01-02T14:30:00.000Z"
      },
      "message": "docs: update spec.md",
      "url": "https://github.com/owner/repo/commit/abc123..."
    }
  ]
}
```

**Branch Resolution**:
- **SHIP stage**: Fetches history from the repository's default branch
- **All other stages**: Fetches history from the ticket's feature branch

**File Path**: `specs/{ticketBranch}/{docType}.md` (uses original branch name even for SHIP tickets)

**Errors**:
- `400`: Invalid project ID or missing/invalid query parameters
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Ticket not found, ticket has no branch, or branch/file not found in repository
- `500`: GitHub integration not configured or GitHub API error


## Comparison Endpoints

Comparison endpoints provide access to structured ticket comparison data stored in the database. Comparisons are generated by the `/compare` command, which analyzes code quality across competing ticket implementations.

A ticket discovers comparisons it participates in via two paths: as a `ComparisonParticipant` (compared ticket) or as the `sourceTicketId` on the `ComparisonRecord` (the ticket that triggered `/compare`).

### GET /api/projects/:projectId/tickets/:id/comparisons

Fetch paginated list of comparisons for a ticket.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member (via `verifyTicketAccess`)

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Query Parameters**:
- `limit` (number, optional): Maximum results to return (default: 20, max: 50)

**Response** (200 OK):
```json
{
  "comparisons": [
    {
      "id": 1,
      "generatedAt": "2026-01-02T14:30:00.000Z",
      "sourceTicketKey": "AIB-123",
      "participantTicketKeys": ["AIB-124", "AIB-125"],
      "winnerTicketKey": "AIB-125",
      "summary": "AIB-125 has better code quality...",
      "overallRecommendation": "Ship AIB-125"
    }
  ],
  "total": 2,
  "limit": 10
}
```

**Errors**:
- `400`: Invalid project or ticket ID
- `404`: Ticket not found or user has no access

### GET /api/projects/:projectId/tickets/:id/comparisons/check

Quick check if a ticket has any comparisons (used for UI button visibility).

**Authentication**: Required (session)
**Authorization**: Must be project owner or member (via `verifyTicketAccess`)

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID

**Response** (200 OK):
```json
{
  "hasComparisons": true,
  "count": 3,
  "latestComparisonId": 42
}
```

**Fields**:
- `hasComparisons`: Whether any comparisons exist for this ticket
- `count`: Total number of comparisons
- `latestComparisonId`: ID of most recent comparison (null if none)

**Performance**: <300ms (optimized for quick UI checks, cached by TanStack Query with 30s stale time)

### GET /api/projects/:projectId/tickets/:id/comparisons/:comparisonId

Fetch full comparison detail with enriched data.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member (via `verifyTicketAccess`). Returns 404 if ticket is not a participant or source of the comparison.

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Ticket ID
- `comparisonId` (number, required): Comparison record ID

**Response** (200 OK):
```json
{
  "id": 1,
  "generatedAt": "2026-01-02T14:30:00.000Z",
  "sourceTicketKey": "AIB-123",
  "winnerTicketId": 5,
  "winnerTicketKey": "AIB-125",
  "summary": "AIB-125 demonstrates superior code quality...",
  "overallRecommendation": "Ship AIB-125, close AIB-124",
  "keyDifferentiators": ["Better test coverage", "Proper error handling"],
  "participants": [
    {
      "ticketId": 5,
      "ticketKey": "AIB-125",
      "title": "Feature implementation",
      "rank": 1,
      "score": 92,
      "rankRationale": "Best constitution compliance, highest test ratio",
      "workflowType": "FULL",
      "agent": "CLAUDE",
      "quality": {
        "state": "available",
        "value": 85
      },
      "qualityBreakdown": {
        "state": "available",
        "value": {
          "dimensions": [
            { "name": "Compliance", "agentId": "compliance", "score": 90, "weight": 0.30, "weightedScore": 27 },
            { "name": "Bug Detection", "agentId": "bug-detection", "score": 80, "weight": 0.30, "weightedScore": 24 },
            { "name": "Product Contract Sync", "agentId": "product-contract-sync", "score": 82, "weight": 0.20, "weightedScore": 16.4 },
            { "name": "Edge Cases & Failure Modes", "agentId": "edge-cases-failure-modes", "score": 85, "weight": 0.15, "weightedScore": 12.75 },
            { "name": "Historical Context", "agentId": "historical-context", "score": 88, "weight": 0.05, "weightedScore": 4.4 }
          ],
          "threshold": "Good",
          "computedAt": "2025-01-15T10:30:00.000Z"
        }
      },
      "telemetry": {
        "state": "available",
        "value": {
          "inputTokens": 12000,
          "outputTokens": 5000,
          "totalTokens": 17000,
          "durationMs": 45000,
          "costUsd": 0.15,
          "jobCount": 3,
          "primaryModel": "claude-sonnet-4-6"
        }
      },
      "metrics": {
        "linesAdded": 150,
        "linesRemoved": 20,
        "linesChanged": 170,
        "filesChanged": 5,
        "testFilesChanged": 2,
        "changedFiles": ["src/api.ts", "tests/api.test.ts"],
        "bestValueFlags": { "linesChanged": false, "filesChanged": true, "testFilesChanged": true }
      }
    }
  ],
  "decisionPoints": [
    {
      "id": 1,
      "title": "State Management",
      "verdictTicketId": 5,
      "verdictSummary": "TanStack Query preferred over useState",
      "rationale": "Provides caching, refetching, and loading states out of the box",
      "participantApproaches": [
        { "ticketId": 5, "ticketKey": "AIB-125", "summary": "Uses TanStack Query with custom hooks" }
      ],
      "displayOrder": 0
    }
  ],
  "complianceRows": [
    {
      "principleKey": "typescript-first",
      "principleName": "TypeScript-First Development",
      "displayOrder": 0,
      "assessments": [
        { "participantTicketId": 5, "participantTicketKey": "AIB-125", "status": "pass", "notes": "Strict types throughout" }
      ]
    }
  ]
}
```

**Enrichment States**: Quality, telemetry, and nested fields use a three-state pattern:
- `available`: Data exists with a `value`
- `pending`: Job exists but data not yet computed (e.g., verify job running)
- `unavailable`: No relevant job exists

**Telemetry aggregation**: Values are summed across all COMPLETED jobs per participant (`inputTokens`, `outputTokens`, `totalTokens`, `durationMs`, `costUsd`). `jobCount` is the count of completed jobs. `primaryModel` is the model from the job with the highest total token consumption. Failed and cancelled jobs are excluded.

**Quality breakdown**: Present only for FULL workflow tickets that have completed VERIFY and have populated `qualityScoreDetails`. The `breakdown` field itself follows the three-state pattern.

**Errors**:
- `400`: Invalid project, ticket, or comparison ID
- `404`: Ticket not found, user has no access, or comparison not associated with this ticket

### POST /api/projects/:projectId/tickets/:id/comparisons

Persist a structured comparison record from a workflow-generated JSON artifact.

**Authentication**: Workflow token (Bearer)
**Authorization**: Workflow-only — same pattern as job status updates

**Path Parameters**:
- `projectId` (number, required): Project ID
- `id` (number, required): Source ticket ID (the ticket that triggered `/compare`)

**Request Body**:
```json
{
  "compareRunKey": "cmp_AIB-123_AIB-124-AIB-125_20260321T143000Z",
  "projectId": 3,
  "sourceTicketKey": "AIB-123",
  "participantTicketKeys": ["AIB-124", "AIB-125"],
  "markdownPath": "specs/AIB-123-feature/comparisons/20260321-143000-vs-AIB-124-AIB-125.md",
  "report": {
    "metadata": {
      "generatedAt": "2026-03-21T14:30:00.000Z",
      "sourceTicket": "AIB-123",
      "comparedTickets": ["AIB-124", "AIB-125"],
      "filePath": "20260321-143000-vs-AIB-124-AIB-125.md"
    },
    "summary": "AIB-125 demonstrates stronger implementation...",
    "recommendation": "Ship AIB-125",
    "alignment": { "overall": 88, "dimensions": {}, "isAligned": true },
    "implementation": { "AIB-124": { "..." : "..." }, "AIB-125": { "..." : "..." } },
    "compliance": { "AIB-124": { "..." : "..." }, "AIB-125": { "..." : "..." } },
    "warnings": []
  }
}
```

**Validation**:
- `projectId` must match route parameter
- `sourceTicketKey` is resolved to its database ID server-side
- `markdownPath` must end with `report.metadata.filePath` and start with `specs/{branch}/comparisons/`
- `participantTicketKeys` must be unique and resolve to tickets in the same project (source ticket may be included as a participant)
- `report.metadata.comparedTickets` order must match resolved participant ticket keys

**Response** (201 Created):
```json
{
  "comparisonId": 1,
  "compareRunKey": "cmp_AIB-123_AIB-124-AIB-125_20260321T143000Z",
  "status": "created"
}
```

**Response** (200 OK — duplicate):
```json
{
  "comparisonId": 1,
  "compareRunKey": "cmp_AIB-123_AIB-124-AIB-125_20260321T143000Z",
  "status": "duplicate"
}
```

Idempotency is handled inside a database transaction: if a record with the same `(projectId, sourceTicketKey, compareRunKey)` already exists, the existing record is returned with `status: "duplicate"`.

**Lenient Parsing**: The `report` sub-objects apply sensible defaults for missing fields (e.g., `changedFiles` defaults to `[]`, numeric metrics default to `0`, `hasData` defaults to `false`). This allows workflow-generated payloads to omit fields that have no data without triggering validation errors. The `telemetry` field is optional (defaults to `{}`) — telemetry data is already stored in the jobs table and enriched server-side at read time.

**Errors**:
- `400`: Validation failure (mismatched scope, invalid participants, malformed payload). Zod validation errors include field-level detail in the `error` field (e.g., `"report.telemetry.AIB-123.cacheReadTokens: Required"`)
- `401`: Missing or invalid workflow token
- `404`: Source ticket or participant not found in project
- `500`: Internal persistence error

## Project-Level Comparison Endpoints

Project-level comparison endpoints serve the Comparisons Hub page, providing paginated history, detail views, candidate listing, and comparison launch capabilities at the project scope (as opposed to the ticket-scoped endpoints above).

### GET /api/projects/:projectId/comparisons

Fetch paginated list of all comparisons for a project.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member (via `verifyProjectAccess`)

**Path Parameters**:
- `projectId` (number, required): Project ID

**Query Parameters**:
- `page` (number, optional): Page number, positive integer (default: 1)
- `pageSize` (number, optional): Items per page, positive integer (default: 10, max: 50)

**Response** (200 OK):
```json
{
  "comparisons": [
    {
      "id": 1,
      "generatedAt": "2026-03-27T14:30:00.000Z",
      "sourceTicketId": 10,
      "sourceTicketKey": "AIB-123",
      "winnerTicketId": 12,
      "winnerTicketKey": "AIB-125",
      "winnerTicketTitle": "Feature implementation",
      "winnerScore": 87.5,
      "participantTicketIds": [11, 12],
      "participantTicketKeys": ["AIB-124", "AIB-125"],
      "summary": "AIB-125 demonstrates superior code quality...",
      "overallRecommendation": "Ship AIB-125",
      "keyDifferentiators": ["Better test coverage", "Proper error handling"],
      "markdownPath": "specs/AIB-123-feature/comparisons/20260327-143000-vs-AIB-124-AIB-125.md"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 25,
  "totalPages": 3
}
```

**Pagination**: Offset-based. `skip = (page - 1) * pageSize`. Results ordered by `generatedAt DESC`, then `id DESC`.

**Errors**:
- `400`: Invalid project ID or pagination parameters
- `401`: Not authenticated
- `404`: Project not found or user has no access

### GET /api/projects/:projectId/comparisons/:comparisonId

Fetch full comparison detail at project scope.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member (via `verifyProjectAccess`)

**Path Parameters**:
- `projectId` (number, required): Project ID
- `comparisonId` (number, required): Comparison record ID

**Response** (200 OK): Same shape as the ticket-scoped `GET /api/projects/:projectId/tickets/:id/comparisons/:comparisonId` endpoint — includes participants with enriched telemetry, quality, metrics, plus decision points and compliance rows.

**Errors**:
- `400`: Invalid project ID or comparison ID
- `401`: Not authenticated
- `404`: Project not found, user has no access, or comparison not found in this project

### GET /api/projects/:projectId/comparisons/candidates

List VERIFY-stage tickets eligible for comparison launch.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member (via `verifyProjectAccess`)

**Path Parameters**:
- `projectId` (number, required): Project ID

**Response** (200 OK):
```json
{
  "candidates": [
    {
      "id": 5,
      "ticketKey": "AIB-125",
      "title": "Feature implementation",
      "branch": "AIB-125-feature-implementation",
      "stage": "VERIFY",
      "workflowType": "FULL",
      "agent": "CLAUDE",
      "qualityScore": 85,
      "updatedAt": "2026-03-27T10:00:00.000Z",
      "hasActiveJob": false
    }
  ]
}
```

**Fields**:
- `qualityScore`: Latest quality score if available, null otherwise
- `hasActiveJob`: Whether the ticket has an active (PENDING/RUNNING) AI-BOARD job

**Errors**:
- `400`: Invalid project ID
- `401`: Not authenticated
- `404`: Project not found or user has no access

### POST /api/projects/:projectId/comparisons/launch

Launch a new comparison workflow for selected VERIFY-stage tickets.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member (via `verifyProjectAccess`). Also requires authenticated user identity (via `requireAuth`) for workflow dispatch.

**Path Parameters**:
- `projectId` (number, required): Project ID

**Request Body**:
```json
{
  "ticketIds": [5, 6, 7]
}
```

**Validation**:
- `ticketIds`: Array of positive integers, minimum 2, maximum 5, all unique
- All tickets must exist in the specified project
- All tickets must be in VERIFY stage
- No ticket can have an active (PENDING/RUNNING) AI-BOARD job

**Response** (202 Accepted):
```json
{
  "jobId": 42,
  "commentId": 123,
  "projectId": 3,
  "sourceTicketId": 5,
  "sourceTicketKey": "AIB-125",
  "selectedTicketIds": [5, 6, 7],
  "selectedTicketKeys": ["AIB-125", "AIB-126", "AIB-127"],
  "status": "PENDING",
  "commentContent": "...",
  "createdAt": "2026-03-27T14:30:00.000Z"
}
```

**Side Effects**:
- Creates a Job record with command `compare`
- Creates a Comment on the source ticket with the comparison request
- Dispatches a GitHub workflow (`speckit.yml`) with the comparison parameters

**Errors**:
- `400`: Invalid project ID, malformed body, fewer than 2 or more than 5 tickets, or duplicate ticket IDs
- `401`: Not authenticated
- `404`: Project not found, user has no access, or ticket not found in project
- `409`: Ticket not in VERIFY stage, or ticket already has an active AI-BOARD job
- `500`: Internal error or workflow dispatch failure


## Constitution Endpoints

### GET /api/projects/:projectId/constitution

Fetch constitution content from project repository.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID

**Response** (200 OK):
```json
{
  "content": "# Project Constitution\n\n## Development Principles...",
  "exists": true
}
```

**Test Environment Response**:
```json
{
  "content": "# Test Project Constitution\n\nThis is a mock constitution for testing...",
  "exists": true
}
```

**Errors**:
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Project not found or constitution file doesn't exist
- `500`: GitHub API error

### PUT /api/projects/:projectId/constitution

Update constitution content in project repository.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID

**Request Body**:
```json
{
  "content": "# Updated Constitution\n\n## New Principles..."
}
```

**Validation**:
- `content`: Required, non-empty string, valid markdown syntax

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Constitution updated successfully"
}
```

**Test Environment Response**:
```json
{
  "success": true,
  "message": "Constitution updated (test mode - changes not persisted)"
}
```

**Errors**:
- `400`: Invalid content (empty or invalid markdown)
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Project not found
- `500`: GitHub API error or commit failed

### GET /api/projects/:projectId/constitution/history

Fetch commit history for constitution file.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID

**Response** (200 OK):
```json
{
  "commits": [
    {
      "sha": "abc123def456...",
      "message": "Update testing requirements",
      "author": "Alice Smith",
      "date": "2025-01-15T10:30:00.000Z",
      "url": "https://github.com/owner/repo/commit/abc123..."
    }
  ]
}
```

**Test Environment Response**:
```json
{
  "commits": [
    {
      "sha": "mock-sha-1",
      "message": "Initial constitution",
      "author": "Test User",
      "date": "2025-01-01T00:00:00.000Z",
      "url": "https://github.com/test/repo/commit/mock-sha-1"
    }
  ]
}
```

**Errors**:
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Project not found or constitution file has no history
- `500`: GitHub API error

### GET /api/projects/:projectId/constitution/diff

Fetch diff for a specific commit.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID

**Query Parameters**:
- `sha` (string, required): Commit SHA to fetch diff for

**Response** (200 OK):
```json
{
  "diff": {
    "additions": [
      "## New Testing Requirements",
      "- All features must have E2E tests"
    ],
    "deletions": [
      "## Old Testing Section"
    ],
    "unchanged": [
      "# Project Constitution",
      "## Development Principles"
    ]
  }
}
```

**Test Environment Response**:
```json
{
  "diff": {
    "additions": ["+ Added line for testing"],
    "deletions": ["- Removed line for testing"],
    "unchanged": ["# Test Constitution"]
  }
}
```

**Errors**:
- `400`: Missing or invalid SHA parameter
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Project not found, commit not found, or no diff available
- `500`: GitHub API error

