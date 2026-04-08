# API Contract: Setup Job Endpoints

**Feature Branch**: `AIB-572-project-onboarding-setup`

## POST /api/projects/[projectId]/setup

Dispatch the onboarding workflow for a project.

### Request

**Auth**: Session (NextAuth) — project owner only
**Guard**: `verifyProjectOwnership(projectId)`

```json
{
  "agent": "CLAUDE" | "CODEX"
}
```

### Responses

**201 Created** — Setup job created and workflow dispatched
```json
{
  "id": 1,
  "projectId": 5,
  "selectedAgent": "CLAUDE",
  "status": "PENDING",
  "createdAt": "2026-04-08T12:00:00Z"
}
```

**400 Bad Request** — Invalid agent value
```json
{
  "error": "Invalid agent selection",
  "code": "VALIDATION_ERROR"
}
```

**403 Forbidden** — Not project owner
```json
{
  "error": "Only the project owner can initiate setup",
  "code": "FORBIDDEN"
}
```

**409 Conflict** — Setup already in progress
```json
{
  "error": "A setup job is already pending or running",
  "code": "SETUP_IN_PROGRESS"
}
```

**409 Conflict** — Project already configured
```json
{
  "error": "Project already has a synced configuration",
  "code": "ALREADY_CONFIGURED"
}
```

**424 Failed Dependency** — Missing credential for selected agent
```json
{
  "error": "No Anthropic credential configured. Add one in Settings → Credentials.",
  "code": "MISSING_CREDENTIAL"
}
```

### Behavior

1. Validate request body with Zod schema
2. Verify caller is project owner
3. Check project does not already have `configSyncedAt` set
4. Check no active SetupJob exists (status PENDING or RUNNING)
5. Verify credential exists for selected agent's provider via `getOwnerCredential()`
6. Create SetupJob record with PENDING status
7. Dispatch `onboard.yml` workflow via Octokit
8. If dispatch fails, delete the SetupJob record and return 500
9. Return created SetupJob

---

## GET /api/projects/[projectId]/setup

Get the latest setup job status for a project.

### Request

**Auth**: Session (NextAuth) — project owner only
**Guard**: `verifyProjectOwnership(projectId)`

No request body.

### Responses

**200 OK** — Setup job found
```json
{
  "id": 1,
  "projectId": 5,
  "selectedAgent": "CLAUDE",
  "status": "RUNNING",
  "isPartial": false,
  "completedFiles": [],
  "errorMessage": null,
  "workflowRunId": 12345678,
  "startedAt": "2026-04-08T12:00:05Z",
  "completedAt": null,
  "createdAt": "2026-04-08T12:00:00Z"
}
```

**200 OK** — No setup job exists (project may need setup or already configured)
```json
{
  "setupJob": null,
  "hasConfig": false
}
```

**403 Forbidden** — Not project owner
```json
{
  "error": "Only the project owner can view setup status",
  "code": "FORBIDDEN"
}
```

### Behavior

1. Verify caller is project owner
2. Query latest SetupJob for projectId (ordered by createdAt DESC, limit 1)
3. Also return whether project has `configSyncedAt` set (for redirect logic)
4. Return setup job or null

---

## GET /api/projects/[projectId]/setup/credential-check

Check credential availability for a given agent.

### Request

**Auth**: Session (NextAuth) — project owner only
**Query**: `?agent=CLAUDE` or `?agent=CODEX`

### Responses

**200 OK** — Credential check result
```json
{
  "available": true,
  "provider": "ANTHROPIC",
  "readinessStatus": "READY"
}
```

**200 OK** — No credential
```json
{
  "available": false,
  "provider": "ANTHROPIC",
  "guidance": "Add an Anthropic API key or OAuth token in Settings → Credentials to use Claude Code."
}
```

### Behavior

1. Verify caller is project owner
2. Map agent to provider via `AGENT_PROVIDER_MAP`
3. Query UserCredential for the owner + provider with READY status
4. Return availability and guidance if missing

---

## PATCH /api/jobs/[id]/status (Extended)

Existing endpoint extended to handle SetupJob status callbacks from the onboard workflow.

### Additional Fields (for setup jobs)

```json
{
  "status": "COMPLETED",
  "isPartial": true,
  "completedFiles": [".ai-board/config.yml", ".gitignore"],
  "setupJobId": 1
}
```

**Note**: The workflow callback uses a `setupJobId` field to identify this as a setup job update. Alternatively, a separate callback endpoint could be created at `/api/projects/[projectId]/setup/callback`. Design decision deferred to implementation — either approach works.
