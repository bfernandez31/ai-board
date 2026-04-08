# API Contracts: Project Setup Flow

## GET `/api/projects/:projectId/setup`

Returns the current setup state for the project.

**Authentication**: required  
**Authorization**:
- Owner: full visibility, `viewerCanManage = true`
- Collaborator/member: read-only visibility, `viewerCanManage = false`
- Non-member: `404`/access denied via existing project access rules

### Response `200`

```json
{
  "projectId": 7,
  "setupRequired": true,
  "viewerCanManage": true,
  "selectedAgentOptions": ["CLAUDE", "CODEX"],
  "credentialReadiness": {
    "CLAUDE": {
      "provider": "ANTHROPIC",
      "ready": true,
      "readinessStatus": "READY",
      "message": "Anthropic credential is ready."
    },
    "CODEX": {
      "provider": "OPENAI",
      "ready": false,
      "readinessStatus": "MISSING",
      "message": "No OpenAI credential configured. Please add your OpenAI key in Settings → AI Credentials."
    }
  },
  "latestAttempt": {
    "id": 14,
    "selectedAgent": "CLAUDE",
    "status": "RUNNING",
    "createdAt": "2026-04-08T12:00:00.000Z",
    "startedAt": "2026-04-08T12:00:02.000Z",
    "completedAt": null,
    "elapsedSeconds": 34,
    "resultMessage": "Initializing AI Board files",
    "failureCode": null,
    "failureMessage": null,
    "artifactSummary": null
  }
}
```

### Errors

| Status | Condition |
|--------|-----------|
| `401` | Unauthenticated |
| `404` | Project not found or inaccessible |

---

## POST `/api/projects/:projectId/setup/attempts`

Creates a new setup attempt and dispatches the onboarding workflow.

**Authentication**: required  
**Authorization**: owner only

### Request

```json
{
  "selectedAgent": "CODEX"
}
```

### Validation

- `selectedAgent` is required and must be one of `CLAUDE` or `CODEX`
- setup must still be required (`project.configSyncedAt == null`)
- no other active attempt may exist for the project
- owner must have a usable credential for the selected agent/provider

### Response `201`

```json
{
  "attempt": {
    "id": 15,
    "selectedAgent": "CODEX",
    "status": "PENDING",
    "createdAt": "2026-04-08T12:05:00.000Z",
    "startedAt": null,
    "completedAt": null,
    "elapsedSeconds": null,
    "resultMessage": null,
    "failureCode": null,
    "failureMessage": null,
    "artifactSummary": null
  }
}
```

### Errors

| Status | Condition | Body |
|--------|-----------|------|
| `400` | Invalid body | `{ "error": "Validation failed" }` |
| `403` | Caller is not the project owner | `{ "error": "Forbidden" }` |
| `409` | Active attempt already exists | `{ "error": "Setup is already in progress.", "code": "ACTIVE_ATTEMPT_EXISTS" }` |
| `409` | Setup no longer required because config is already synced | `{ "error": "Project setup is already complete.", "code": "SETUP_NOT_REQUIRED" }` |
| `422` | Selected agent lacks usable owner credential | `{ "error": "No OpenAI credential configured...", "code": "CREDENTIAL_NOT_READY" }` |
| `502` | Workflow dispatch failed | `{ "error": "Failed to dispatch onboarding workflow.", "code": "WORKFLOW_DISPATCH_FAILED" }` |

---

## PATCH `/api/projects/:projectId/setup/attempts/:attemptId`

Workflow callback endpoint for onboarding progress and completion.

**Authentication**: workflow bearer token (`WORKFLOW_API_TOKEN`)  
**Authorization**: workflow-authenticated only

### Request

```json
{
  "status": "COMPLETED",
  "workflowRunId": 123456789,
  "message": "Created AI Board setup files",
  "artifactSummary": {
    "created": [".ai-board/config.yml"],
    "preserved": [".github/workflows/ci.yml"],
    "notes": ["Reused existing test commands"]
  }
}
```

### Accepted Statuses

- `PENDING`
- `RUNNING`
- `COMPLETED`
- `FAILED`

### Callback Rules

- The `attemptId` must belong to the `projectId` in the route.
- Older attempts may update their own records for audit history, but only the latest relevant attempt controls the current setup surface.
- `COMPLETED` triggers `syncProjectConfig()` before the project is considered onboarded.
- If config sync fails after a `COMPLETED` callback, the response should be non-successful and the attempt must persist a failure message so the UI remains in setup-required state.

### Response `200`

```json
{
  "attemptId": 15,
  "status": "COMPLETED",
  "completedAt": "2026-04-08T12:07:10.000Z",
  "setupRequired": false
}
```

### Errors

| Status | Condition | Body |
|--------|-----------|------|
| `401` | Missing or invalid workflow token | `{ "error": "Unauthorized" }` |
| `404` | Attempt not found for project | `{ "error": "Setup attempt not found" }` |
| `409` | Callback is stale or superseded by a newer active attempt | `{ "error": "Stale callback", "code": "STALE_ATTEMPT" }` |
| `502` | Config sync failed after completion | `{ "error": "Setup completed but configuration sync failed.", "code": "CONFIG_SYNC_FAILED" }` |

---

## Page Contract: `/projects/:projectId`

Server-side entry contract:

- If `configSyncedAt` is present, redirect to `/projects/:projectId/board`
- If setup is still required, redirect to `/projects/:projectId/setup`

This route should not render an intermediate shell.
