# Contract: Setup Jobs API For Real Onboarding

**Base path**: `/api/projects/:projectId/setup/jobs`

This feature keeps the AIB-577 setup-job API surface intact and extends it additively.

## POST `/api/projects/:projectId/setup/jobs`

Creates a setup job and dispatches the onboarding workflow.

### Request

```json
{
  "agent": "CLAUDE" | "CODEX"
}
```

### Success `201`

```json
{
  "id": 12,
  "projectId": 7,
  "agent": "CLAUDE",
  "status": "PENDING",
  "createdAt": "2026-04-08T12:00:00.000Z"
}
```

### Errors

- `409 CREDENTIAL_MISSING`
- `409 ALREADY_CONFIGURED`
- `409 JOB_ACTIVE`
- `500 DISPATCH_FAILED`

## GET `/api/projects/:projectId/setup/jobs`

Returns the latest setup job plus current config-sync state for polling and initial setup-page render.

### Success `200`

```json
{
  "job": {
    "id": 12,
    "projectId": 7,
    "agent": "CLAUDE",
    "status": "COMPLETED",
    "workflowRunId": 123456,
    "partial": true,
    "commitSha": "abc123def456abc123def456abc123def456abcd",
    "errorCode": null,
    "errorMessage": null,
    "logs": "Guidance generation failed after config creation...",
    "artifactSummary": {
      "created": [{ "path": ".ai-board/config.yml", "kind": "config" }],
      "preserved": [{ "path": "CLAUDE.md", "kind": "guidance", "reason": "existing file preserved" }],
      "missing": [{ "path": ".ai-board/memory/constitution.md", "kind": "constitution", "reason": "guidance generation failed" }]
    },
    "startedAt": "2026-04-08T12:00:03.000Z",
    "completedAt": "2026-04-08T12:01:22.000Z",
    "createdAt": "2026-04-08T12:00:00.000Z"
  },
  "configSyncedAt": "2026-04-08T12:01:25.000Z"
}
```

### Compatibility

- Existing consumers can ignore the new `partial`, `commitSha`, `errorCode`, and `logs` fields.
- Existing `status`, `errorMessage`, and `artifactSummary` fields remain unchanged.

## PATCH `/api/projects/:projectId/setup/jobs/:jobId/status`

Workflow callback endpoint. Auth remains workflow Bearer token.

### Request Body

```json
{
  "status": "RUNNING" | "COMPLETED" | "FAILED",
  "workflowRunId": 123456,
  "partial": true,
  "commitSha": "abc123def456abc123def456abc123def456abcd",
  "errorCode": "GUIDANCE_GENERATION_FAILED",
  "errorMessage": "Guidance generation failed after deterministic outputs were prepared",
  "logs": "tail of workflow logs",
  "artifactSummary": {
    "created": [],
    "preserved": [],
    "missing": []
  }
}
```

### Field Rules

- `workflowRunId` is valid on `RUNNING` and first-write-wins.
- `partial` is valid only with `status = COMPLETED`.
- `commitSha` is valid on successful or partial terminal callbacks.
- `errorCode` is required for terminal failures and optional for partial terminal callbacks where the missing phase should still be identified.
- `artifactSummary` must distinguish `created`, `preserved`, and `missing`.

### Failure Categories

- `DISPATCH_FAILED`
- `CONFIGURATION_GENERATION_FAILED`
- `GUIDANCE_GENERATION_FAILED`
- `COMMIT_FAILED`

### Success `200`

```json
{
  "id": 12,
  "status": "COMPLETED",
  "completedAt": "2026-04-08T12:01:22.000Z"
}
```

## UI Contract Notes

- `status = COMPLETED` plus `partial = true` means the project is usable but guidance is incomplete.
- `status = FAILED` means onboarding did not produce a usable repository update.
- `commitSha` should be shown when present.
- `artifactSummary` is the source of truth for created, preserved, and missing artifact groups.
