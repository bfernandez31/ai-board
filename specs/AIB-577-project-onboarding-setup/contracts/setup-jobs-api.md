# API Contract: Setup Jobs

**Base path**: `/api/projects/[projectId]/setup/jobs`

## POST /api/projects/:projectId/setup/jobs

Create a new setup job and dispatch the onboarding workflow.

**Auth**: Session (owner-only via `verifyProjectOwnership`)

### Request Body

```json
{
  "agent": "CLAUDE" | "CODEX"
}
```

**Validation** (Zod):
```typescript
const createSetupJobSchema = z.object({
  agent: z.enum(['CLAUDE', 'CODEX']),
});
```

### Pre-flight Checks (in order)

1. Verify project ownership
2. Verify `configSyncedAt` is null (not already configured)
3. Verify no active setup job (PENDING or RUNNING)
4. Verify owner has credential for selected agent's provider

### Success Response (201)

```json
{
  "id": 1,
  "projectId": 5,
  "agent": "CLAUDE",
  "status": "PENDING",
  "createdAt": "2026-04-08T12:00:00.000Z"
}
```

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid body (missing/bad agent) |
| 401 | `UNAUTHORIZED` | Not authenticated |
| 403 | `FORBIDDEN` | Not project owner |
| 404 | `PROJECT_NOT_FOUND` | Project doesn't exist |
| 409 | `ALREADY_CONFIGURED` | Project `configSyncedAt` is already set |
| 409 | `JOB_ACTIVE` | A setup job is PENDING or RUNNING |
| 409 | `CREDENTIAL_MISSING` | Owner lacks credential for the selected agent's provider |
| 500 | `DISPATCH_FAILED` | Workflow dispatch failed (job marked FAILED) |

---

## GET /api/projects/:projectId/setup/jobs

Get the latest setup job for the project (for polling and initial page load).

**Auth**: Session (owner-only via `verifyProjectOwnership`)

### Success Response (200)

```json
{
  "job": {
    "id": 1,
    "projectId": 5,
    "agent": "CLAUDE",
    "status": "RUNNING",
    "workflowRunId": 12345678,
    "errorMessage": null,
    "artifactSummary": null,
    "startedAt": "2026-04-08T12:00:05.000Z",
    "completedAt": null,
    "createdAt": "2026-04-08T12:00:00.000Z"
  },
  "configSyncedAt": null
}
```

When no setup job exists:
```json
{
  "job": null,
  "configSyncedAt": null
}
```

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `UNAUTHORIZED` | Not authenticated |
| 403 | `FORBIDDEN` | Not project owner |
| 404 | `PROJECT_NOT_FOUND` | Project doesn't exist |

---

## PATCH /api/projects/:projectId/setup/jobs/:jobId/status

Update setup job status from the onboarding workflow.

**Auth**: Workflow Bearer token (`validateWorkflowAuth`)

### Request Body

```json
{
  "status": "RUNNING" | "COMPLETED" | "FAILED",
  "workflowRunId": 12345678,
  "errorMessage": "Optional error details",
  "artifactSummary": { "files": [] }
}
```

**Validation** (Zod):
```typescript
const setupJobStatusUpdateSchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED']),
  workflowRunId: z.number().int().positive().optional(),
  errorMessage: z.string().max(2000).optional(),
  artifactSummary: z.record(z.unknown()).optional(),
});
```

### State Transitions

| From | Allowed To |
|------|-----------|
| PENDING | RUNNING |
| RUNNING | COMPLETED, FAILED |
| COMPLETED | COMPLETED (idempotent) |
| FAILED | FAILED (idempotent) |

### Side Effects

- **RUNNING**: Set `startedAt` if null, set `workflowRunId` if null (first-write-wins)
- **COMPLETED**: Set `completedAt`, trigger `syncProjectConfig()` (non-blocking)
- **FAILED**: Set `completedAt`, persist `errorMessage`

### Success Response (200)

```json
{
  "id": 1,
  "status": "COMPLETED",
  "completedAt": "2026-04-08T12:01:30.000Z"
}
```

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid body |
| 400 | `INVALID_TRANSITION` | State machine violation |
| 401 | `UNAUTHORIZED` | Invalid workflow token |
| 404 | `NOT_FOUND` | Job or project not found |

---

## GET /api/projects/:projectId/setup/credential-check

Check if the project owner has a valid credential for a given agent's provider.

**Auth**: Session (owner-only via `verifyProjectOwnership`)

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `agent` | `CLAUDE` \| `CODEX` | Yes | Agent to check credential for |

### Success Response (200)

```json
{
  "hasCredential": true,
  "provider": "ANTHROPIC"
}
```

Or when missing:
```json
{
  "hasCredential": false,
  "provider": "ANTHROPIC",
  "settingsUrl": "/settings/credentials"
}
```

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Missing or invalid `agent` param |
| 401 | `UNAUTHORIZED` | Not authenticated |
| 403 | `FORBIDDEN` | Not project owner |
