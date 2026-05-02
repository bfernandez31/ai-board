# Project Endpoints

## Project Endpoints

### GET /api/projects

Fetch all projects for the authenticated user with shipping status, ordered by most recent activity.

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
      "lastActivityAt": "2025-01-15T14:05:00.000Z",
      "ticketCount": 12,
      "lastShippedTicket": {
        "id": 42,
        "ticketKey": "ABC-5",
        "title": "Add user authentication",
        "updatedAt": "2025-01-14T16:20:00.000Z"
      },
      "healthScore": {
        "globalScore": 82,
        "securityScore": 90,
        "complianceScore": 78,
        "testsScore": null,
        "specSyncScore": 65,
        "qualityGate": 88,
        "reviewQualityScore": 75
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
      "lastActivityAt": "2025-01-10T08:15:00.000Z",
      "ticketCount": 5,
      "lastShippedTicket": null,
      "healthScore": null
    }
  ]
}
```

**Fields**:
- `lastActivityAt`: ISO 8601 timestamp of the project's most recent activity, computed as `MAX(project.updatedAt, latest ticket.updatedAt, latest job.startedAt)`. Falls back to `project.updatedAt` when the project has no tickets or jobs.
- `ticketCount`: Total number of tickets across all stages
- `lastShippedTicket`: Most recent ticket in SHIP stage (null if no shipped tickets)
  - `id`: Ticket ID
  - `ticketKey`: Unique ticket identifier (e.g., "ABC-5")
  - `title`: Ticket title
  - `updatedAt`: When ticket was moved to SHIP stage (used for relative time display)
- `healthScore`: Cached aggregate health score (null if no scan has ever completed)
  - `globalScore`: Overall score 0–100, or null if no modules have been scanned
  - `securityScore`, `complianceScore`, `testsScore`, `specSyncScore`, `qualityGate`, `reviewQualityScore`: Individual module scores 0–100, or null if that module has never been scanned

**Ordering**:
- Results are sorted by `lastActivityAt` descending (most recently active first)
- Ties on `lastActivityAt` are broken by `id` descending for deterministic ordering
- Sorting is performed server-side in `lib/db/projects.ts` using the helpers in `lib/db/projects-activity.ts` (`computeLastActivityAt`, `sortProjectsByActivity`); ticket and job max-timestamps are aggregated with two `groupBy` queries and merged in memory

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
  "updatedAt": "2025-01-15T10:30:00.000Z",
  "config": {
    "version": 1,
    "project": { "name": "ai-board", "language": "typescript", "framework": "nextjs" },
    "runtime": { "manager": "bun" },
    "services": [{ "type": "postgres", "version": "16" }],
    "commands": { "install": "bun install" },
    "agent": { "cli": "claude-code" }
  },
  "configSyncedAt": "2026-04-02T12:00:00.000Z",
  "defaultBranch": "main",
  "specifyModel": "claude-opus-4-7",
  "planModel": "claude-opus-4-7",
  "implementModel": "claude-sonnet-4-6",
  "quickImplModel": "claude-sonnet-4-6",
  "verifyModel": "claude-sonnet-4-6"
}
```

`config` and `configSyncedAt` are `null` when no config has been synced. `defaultBranch` defaults to `"main"` and is auto-updated during config sync. Per-stage model fields are `null` for pre-existing projects without explicit configuration (resolves to `claude-opus-4-7` at dispatch time).

**Errors**:
- `401`: Not authenticated
- `403`: User is neither project owner nor member
- `404`: Project not found

### POST /api/projects/:projectId/config/sync

Fetch `.ai-board/config.yml` from the project's GitHub repository, validate it, and store the parsed result in the database.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member

**Path Parameters**:
- `projectId` (number, required): Project ID

**Request Body**: None

**Response** (200 OK — synced successfully):
```json
{
  "config": {
    "version": 1,
    "project": { "name": "my-app", "language": "typescript", "framework": "nextjs" },
    "runtime": { "manager": "bun" },
    "services": [{ "type": "postgres", "version": "14" }],
    "commands": { "install": "bun install" },
    "agent": { "cli": "claude-code" }
  },
  "syncedAt": "2026-04-02T12:00:00.000Z",
  "warnings": []
}
```

Unknown fields cause a `400` validation error — the config is rejected and not stored. Warnings are reserved for other non-blocking notices; callers should surface any warning messages returned on success.

**Errors**:
- `400`: Invalid config YAML — body contains `{ "error": "Config validation failed", "code": "VALIDATION_ERROR", "details": [...] }`
- `401`: Not authenticated
- `404`: Project not found or no access; also returned when no `.ai-board/config.yml` exists in the repository (`"code": "CONFIG_NOT_FOUND"`)
- `502`: GitHub API error — body contains `{ "error": "Failed to fetch config from GitHub", "code": "GITHUB_ERROR" }`

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
  "clarificationPolicy": "CONSERVATIVE",
  "specifyModel": "claude-opus-4-7",
  "planModel": "claude-opus-4-7",
  "implementModel": "claude-sonnet-4-6",
  "quickImplModel": "claude-sonnet-4-6",
  "verifyModel": "claude-sonnet-4-6"
}
```

**Validation**:
- `name`: Optional, string
- `key`: Optional, 3-character uppercase alphanumeric string (immutable after creation, validation only)
- `description`: Optional, string or null
- `deploymentUrl`: Optional, string or null (valid URL format)
- `clarificationPolicy`: Optional, enum (AUTO|CONSERVATIVE|PRAGMATIC|INTERACTIVE)
- `specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel`: Optional, nullable — must be one of the whitelisted Claude model IDs (`claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`) or `null` to clear; rejected with `INVALID_MODEL_ID` otherwise

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
- `400`: Invalid request body, URL format, clarification policy enum, or `INVALID_MODEL_ID` (unknown model ID supplied for a model field)
- `401`: Not authenticated
- `403`: User is not project owner (members cannot update project settings)
- `404`: Project not found

### POST /api/projects/:projectId/model-config/apply-smart-defaults

Apply the cost-conscious smart default model set to all 5 per-stage model fields atomically.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member (`verifyProjectAccess`)

**Path Parameters**:
- `projectId` (number, required): Project ID

**Request Body**: None

**Smart defaults applied**:
| Stage | Model |
|-------|-------|
| SPECIFY | `claude-opus-4-7` |
| PLAN | `claude-opus-4-7` |
| IMPLEMENT | `claude-sonnet-4-6` |
| QUICK-IMPL | `claude-sonnet-4-6` |
| VERIFY | `claude-sonnet-4-6` |

**Response** (200 OK):
```json
{
  "specifyModel": "claude-opus-4-7",
  "planModel": "claude-opus-4-7",
  "implementModel": "claude-sonnet-4-6",
  "quickImplModel": "claude-sonnet-4-6",
  "verifyModel": "claude-sonnet-4-6"
}
```

Operation is idempotent — calling it twice produces the same result.

**Errors**:
- `401`: Not authenticated
- `404`: Project not found or no access

### POST /api/projects/import

Import a GitHub repository as a new ai-board project.

**Authentication**: Required (session)
**Authorization**: User must have `repo` scope on their GitHub token and admin access on the target repository

**Request Body**:
```json
{
  "githubOwner": "octocat",
  "githubRepo": "my-app",
  "name": "My App",
  "description": "My awesome app"
}
```

| Field | Required | Default |
|-------|----------|---------|
| `githubOwner` | Yes | — |
| `githubRepo` | Yes | — |
| `name` | No | Repository name |
| `description` | No | Repository description or `""` |

**Response** (201 Created — config present):
```json
{
  "project": {
    "id": 5,
    "name": "My App",
    "key": "MYA",
    "githubOwner": "octocat",
    "githubRepo": "my-app",
    "hasConfig": true
  },
  "redirectTo": "/projects/5"
}
```

**Response** (201 Created — no config):
```json
{
  "project": {
    "id": 5,
    "name": "My App",
    "key": "MYA",
    "githubOwner": "octocat",
    "githubRepo": "my-app",
    "hasConfig": false
  },
  "redirectTo": "/projects/5/setup"
}
```

**Errors**:
- `400`: `{ "error": "Validation error", "code": "VALIDATION_ERROR" }`
- `401`: Not authenticated
- `403` (quota): `{ "error": "Project limit reached...", "code": "PLAN_LIMIT" }`
- `403` (no admin): `{ "error": "You need admin access to this repository to import it.", "code": "INSUFFICIENT_PERMISSIONS" }`
- `403` (no scope): `{ "error": "GitHub token lacks repo scope", "code": "MISSING_SCOPE" }`
- `409` (duplicate repo): `{ "error": "This repository is already linked to project \"Existing Project\" (KEY-123).", "code": "DUPLICATE_REPO" }`
- `409` (other conflict): `{ "error": "A conflict occurred while creating the project. Please try again.", "code": "CONFLICT" }`
- `502`: GitHub API error

## Project Setup Endpoints

Endpoints for the project onboarding setup flow. All session-authenticated endpoints require project ownership (not just membership). The status callback endpoint uses workflow Bearer token authentication.

### POST /api/projects/:projectId/setup/jobs

Create a setup job and dispatch the onboarding workflow or the retro-spec workflow. The `command` field selects which workflow is dispatched.

**Authentication**: Session (owner-only)
**Authorization**: `verifyProjectOwnership`

**Request Body** (onboard):
```json
{ "agent": "CLAUDE" }
```

**Request Body** (retro-spec):
```json
{
  "agent": "CLAUDE",
  "command": "RETRO_SPEC",
  "depth": "STANDARD",
  "docUrl": "https://docs.example.com/api",
  "context": "Optional business context"
}
```

| Field | Type | Required |
|-------|------|----------|
| `agent` | `"CLAUDE"` \| `"CODEX"` | Yes |
| `command` | `"ONBOARD"` \| `"RETRO_SPEC"` | No (default: `"ONBOARD"`) |
| `depth` | `"QUICK"` \| `"STANDARD"` \| `"COMPREHENSIVE"` | Required when `command === "RETRO_SPEC"` |
| `docUrl` | string (HTTPS URL only, max 2000) | No |
| `context` | string | No |

When `docUrl` is provided, the workflow attempts to fetch that URL during retro-spec generation. Redirects are followed, and an unreachable URL does not block generation.

**Pre-flight checks by command**:
- `ONBOARD`: project ownership, `configSyncedAt` is null, no active ONBOARD job, credential exists
- `RETRO_SPEC`: project ownership, `configSyncedAt` is set, no active RETRO_SPEC job, credential exists

Active-job check is scoped by command type — ONBOARD and RETRO_SPEC jobs do not block each other.

**Response** (201 Created):
```json
{
  "id": 1,
  "projectId": 5,
  "agent": "CLAUDE",
  "command": "RETRO_SPEC",
  "status": "PENDING",
  "depth": "STANDARD",
  "createdAt": "2026-04-08T12:00:00.000Z"
}
```

**Errors**:
- `400`: `VALIDATION_ERROR` — invalid body, missing `depth` for RETRO_SPEC, or `docUrl` that is not a valid URL
- `401`: Not authenticated
- `403`: `FORBIDDEN` — not project owner
- `404`: `PROJECT_NOT_FOUND`
- `409`: `ALREADY_CONFIGURED` — `configSyncedAt` is set (ONBOARD only)
- `409`: `NOT_CONFIGURED` — `configSyncedAt` is null (RETRO_SPEC only)
- `409`: `JOB_ACTIVE` — a job of the same command type is PENDING or RUNNING
- `409`: `CREDENTIAL_MISSING` — owner lacks credential for the agent's provider
- `500`: `DISPATCH_FAILED` — workflow dispatch failed (job marked FAILED)

---

### GET /api/projects/:projectId/setup/jobs

Fetch the latest setup job for polling and page load. Supports optional filtering by command type.

**Authentication**: Session (owner-only)
**Authorization**: `verifyProjectOwnership`

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `command` | `"ONBOARD"` \| `"RETRO_SPEC"` | Optional — filters by job type. When omitted, returns the latest job of any type. |

**Response** (200 OK):
```json
{
  "job": {
    "id": 1,
    "projectId": 5,
    "agent": "CLAUDE",
    "command": "RETRO_SPEC",
    "status": "RUNNING",
    "depth": "STANDARD",
    "docUrl": "https://docs.example.com/api",
    "workflowRunId": 12345678,
    "errorMessage": null,
    "artifactSummary": null,
    "startedAt": "2026-04-08T12:00:05.000Z",
    "completedAt": null,
    "createdAt": "2026-04-08T12:00:00.000Z"
  },
  "configSyncedAt": "2026-04-08T10:00:00.000Z"
}
```

When no job exists: `{ "job": null, "configSyncedAt": null }`.

**Errors**: `401`, `403` (not owner), `404` (project not found)

---

### PATCH /api/projects/:projectId/setup/jobs/:jobId/status

Update setup job status from the onboarding or retro-spec workflow.

**Authentication**: Workflow Bearer token (`Authorization: Bearer <WORKFLOW_API_TOKEN>`)

**Request Body**:
```json
{
  "status": "RUNNING",
  "workflowRunId": 12345678,
  "errorMessage": null,
  "artifactSummary": null
}
```

| Field | Type | Required |
|-------|------|----------|
| `status` | `"RUNNING"` \| `"COMPLETED"` \| `"FAILED"` | Yes |
| `workflowRunId` | integer | No |
| `errorMessage` | string (max 2000) | No |
| `artifactSummary` | object | No |

**State transitions**:

| From | Allowed To |
|------|-----------|
| PENDING | RUNNING |
| RUNNING | COMPLETED, FAILED |
| COMPLETED | COMPLETED (idempotent) |
| FAILED | FAILED (idempotent) |

**Side effects**:
- `RUNNING`: sets `startedAt` and `workflowRunId` (first-write-wins)
- `COMPLETED` (ONBOARD jobs): sets `completedAt`, awaits `syncProjectConfig()`; if sync fails (non-success outcome or thrown exception), returns 200 with `configSyncError` (and `configSyncErrorCode` for non-throwing failures)
- `COMPLETED` (RETRO_SPEC jobs): sets `completedAt` only — no config sync (specs are committed to the repo by the workflow)
- `FAILED`: sets `completedAt`, persists `errorMessage`

**Response** (200 OK):
```json
{ "id": 1, "status": "COMPLETED", "completedAt": "2026-04-08T12:01:30.000Z" }
```

**Response** (200 OK — config sync failed, ONBOARD only):
```json
{ "id": 1, "status": "COMPLETED", "completedAt": "2026-04-08T12:01:30.000Z", "configSyncError": "Token expired", "configSyncErrorCode": "GITHUB_ERROR" }
```

> `configSyncErrorCode` is present when `syncProjectConfig()` returns a non-success outcome (one of `VALIDATION_ERROR`, `CONFIG_NOT_FOUND`, `GITHUB_ERROR`, `YAML_PARSE_ERROR`). It is absent when the failure was an unexpected thrown exception.

**Errors**: `400` (`VALIDATION_ERROR` or `INVALID_TRANSITION`), `401` (invalid token), `404` (job/project not found)

---

### GET /api/projects/:projectId/setup/credential-check

Check whether the project owner has a valid credential for a given agent's provider.

**Authentication**: Session (owner-only)
**Authorization**: `verifyProjectOwnership`

**Query Parameters**:

| Param | Type | Required |
|-------|------|----------|
| `agent` | `"CLAUDE"` \| `"CODEX"` \| `"MISTRAL"` \| `"GEMINI"` | Yes |

**Agent-to-provider mapping**: `CLAUDE` → `ANTHROPIC`, `CODEX` → `OPENAI`, `MISTRAL` → `MISTRAL`, `GEMINI` → `GOOGLE`

**Response** (200 OK — credential present):
```json
{ "hasCredential": true, "provider": "ANTHROPIC" }
```

**Response** (200 OK — credential missing):
```json
{ "hasCredential": false, "provider": "ANTHROPIC", "settingsUrl": "/settings/credentials" }
```

**Errors**: `400` (`VALIDATION_ERROR` — missing/invalid `agent`), `401`, `403` (not owner)

---


## GitHub Endpoints

### GET /api/github/auth-status

Check whether the current user has a GitHub account with `repo` scope.

**Authentication**: Required (session)

**Response** (200 OK):
```json
{
  "hasGitHubAccount": true,
  "hasRepoScope": true
}
```

`hasRepoScope` is `false` when the token exists but was issued before `repo` scope was requested. `hasGitHubAccount` is `false` when the user has no linked GitHub account.

**Errors**:
- `401`: Not authenticated

### GET /api/github/repos

List GitHub repositories accessible to the authenticated user.

**Authentication**: Required (session)

**Query Parameters**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `per_page` | number | 30 | Items per page (max 100) |
| `sort` | string | `"pushed"` | Sort: `pushed`, `updated`, `full_name` |
| `type` | string | `"all"` | Filter: `all`, `owner`, `member` |
| `org` | string | — | Filter by organization login |
| `q` | string | — | Search query (uses GitHub Search API) |

**Response** (200 OK):
```json
{
  "repos": [
    {
      "id": 123456,
      "name": "my-app",
      "fullName": "octocat/my-app",
      "owner": "octocat",
      "ownerAvatar": "https://avatars.githubusercontent.com/u/1?v=4",
      "description": "My awesome app",
      "isPrivate": false,
      "pushedAt": "2026-03-28T12:00:00Z",
      "hasAdminAccess": true,
      "isAlreadyImported": false,
      "existingProjectId": null
    }
  ],
  "totalCount": 42,
  "page": 1,
  "perPage": 30,
  "hasNextPage": true
}
```

**Fields**:
- `hasAdminAccess`: `true` when the user has admin permission on the repository
- `isAlreadyImported`: `true` when the repository is already linked to an ai-board project
- `existingProjectId`: project ID when `isAlreadyImported` is `true`, otherwise `null`

**Errors**:
- `401`: Not authenticated
- `403`: `{ "error": "GitHub token lacks repo scope", "code": "MISSING_SCOPE" }`
- `429`: `{ "error": "GitHub rate limit exceeded. Resets at {time}.", "code": "RATE_LIMITED", "resetAt": "..." }`
- `502`: GitHub API error

### GET /api/github/orgs

List organizations the authenticated user belongs to.

**Authentication**: Required (session)

**Response** (200 OK):
```json
{
  "orgs": [
    {
      "login": "my-org",
      "avatarUrl": "https://avatars.githubusercontent.com/u/2?v=4"
    }
  ]
}
```

**Errors**:
- `401`: Not authenticated
- `403`: `{ "error": "GitHub token lacks repo scope", "code": "MISSING_SCOPE" }`


## Project Outcome Endpoints

### GET /api/projects/:projectId/outcomes

List immutable delivery outcomes for a project with optional filters. Powers analytics queries over shipped tickets.

**Authentication**: Required (session)
**Authorization**: Must be project owner or member (`verifyProjectAccess`)

**Path Parameters**:
- `projectId` (number, required): Project ID

**Query Parameters** (all optional, validated via Zod):

| Param | Type | Default | Notes |
|---|---|---|---|
| `frictionFree` | `'true' \| 'false'` | unset | Filter by `TicketOutcome.frictionFree` |
| `partial` | `'true' \| 'false'` | unset | Filter by `TicketOutcome.partial` |
| `domain` | string | unset | Returns outcomes whose `domains` array contains this top-level path segment (case-sensitive) |
| `workflowType` | `'FULL' \| 'QUICK' \| 'CLEAN'` | unset | |
| `since` | ISO-8601 date | unset | `shippedAt >= since` |
| `until` | ISO-8601 date | unset | `shippedAt < until` |
| `limit` | integer (1–500) | 100 | |
| `cursor` | integer | unset | `TicketOutcome.id` — returns rows with `id < cursor`, ordered `id DESC` |

All filters AND together. Pagination is cursor-based by `id` (descending) — callers stop when `nextCursor === null`.

**Response** (200 OK):
```json
{
  "outcomes": [
    {
      "id": 42,
      "ticketId": 1234,
      "ticketKey": "AIB-742",
      "projectId": 7,
      "workflowType": "FULL",
      "shippedAt": "2026-04-25T14:30:21.000Z",
      "capturedAt": "2026-04-25T14:31:02.000Z",
      "ruleSetVersion": 1,
      "totalCostUsd": 1.7234,
      "totalDurationMs": 482000,
      "totalInputTokens": 51234,
      "totalOutputTokens": 8421,
      "totalThinkingTokens": 1200,
      "totalCacheReadTokens": 91234,
      "totalCacheCreationTokens": 12345,
      "toolsUsed": ["Edit", "Read", "Bash", "Grep"],
      "pipelineJobCount": 4,
      "frictionJobCount": 0,
      "totalJobCount": 4,
      "jobCountByPrefix": { "specify": 1, "plan": 1, "implement": 1, "verify": 1 },
      "qualityScore": 88,
      "filesTouched": ["app/api/foo.ts"],
      "linesAdded": 142,
      "linesRemoved": 38,
      "testCodeRatio": 0.41,
      "domains": ["app", "lib", "tests"],
      "domainFileCounts": { "app": 1, "lib": 1, "tests": 1 },
      "touchedDbSchema": false,
      "touchedTests": true,
      "touchedCi": false,
      "frictionFree": true,
      "partial": false,
      "partialReason": null
    }
  ],
  "nextCursor": 41,
  "totalReturned": 100
}
```

`ticketKey` is denormalised in the list response by joining to `Ticket` (avoids N+1 in dashboards). The endpoint is read-only — no write methods are exposed.

**Errors**:
- `400`: `{ "error": "...", "code": "VALIDATION_ERROR" }` (e.g., `limit > 500`, malformed `since`)
- `401`: `UNAUTHENTICATED`
- `403`: `ACCESS_DENIED`
- `404`: Project not found

**Performance**: SC-003 budget — fraction-frictionFree returns < 1 s per project, supported by the composite index `(projectId, frictionFree)`. List ordering is supported by `(projectId, shippedAt DESC)`.

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

