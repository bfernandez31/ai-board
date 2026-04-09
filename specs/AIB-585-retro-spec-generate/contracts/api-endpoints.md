# API Contracts: AIB-585 Retro-Spec Generate

## Modified Endpoints

### POST `/api/projects/:projectId/setup/jobs`

Extended to support retro-spec job creation alongside onboard jobs.

**Request Body** (retro-spec):
```json
{
  "agent": "CLAUDE",
  "command": "RETRO_SPEC",
  "depth": "STANDARD",
  "docUrl": "https://docs.example.com/api",
  "context": "This project uses a custom auth system described in the docs"
}
```

**Request Body** (onboard, unchanged):
```json
{
  "agent": "CLAUDE"
}
```

When `command` is omitted, defaults to `"ONBOARD"` for backward compatibility.

**Validation Changes**:
- `command`: optional enum `"ONBOARD" | "RETRO_SPEC"`, defaults to `"ONBOARD"`
- `depth`: required when `command === "RETRO_SPEC"`, enum `"QUICK" | "STANDARD" | "COMPREHENSIVE"`
- `docUrl`: optional string, max 2000 chars, valid URL format
- `context`: optional string

**Precondition Changes**:
- ONBOARD: `configSyncedAt` MUST be null (unchanged)
- RETRO_SPEC: `configSyncedAt` MUST be set (project must be onboarded first)
- Active job check scoped by `command` type

**Response** (201 Created):
```json
{
  "id": 42,
  "projectId": 1,
  "agent": "CLAUDE",
  "command": "RETRO_SPEC",
  "status": "PENDING",
  "depth": "STANDARD",
  "createdAt": "2026-04-09T12:00:00.000Z"
}
```

**Error Responses**:
- `400`: Invalid depth, missing depth for RETRO_SPEC, invalid docUrl
- `401`: Not authenticated
- `403`: Not project owner
- `404`: Project not found
- `409 CREDENTIAL_MISSING`: AI credential not configured
- `409 JOB_ACTIVE`: Active retro-spec job already exists
- `409 NOT_CONFIGURED`: Project not yet onboarded (configSyncedAt is null) — only for RETRO_SPEC
- `409 ALREADY_CONFIGURED`: Project already configured — only for ONBOARD (unchanged)
- `500 DISPATCH_FAILED`: Workflow dispatch failed

---

### GET `/api/projects/:projectId/setup/jobs`

Extended to support filtering by command type.

**Query Parameters** (new):
- `command`: optional `"ONBOARD" | "RETRO_SPEC"` — filters by job type

**Response** (unchanged structure, new fields):
```json
{
  "job": {
    "id": 42,
    "projectId": 1,
    "agent": "CLAUDE",
    "command": "RETRO_SPEC",
    "status": "RUNNING",
    "depth": "STANDARD",
    "docUrl": "https://docs.example.com/api",
    "workflowRunId": 12345678,
    "errorMessage": null,
    "artifactSummary": null,
    "startedAt": "2026-04-09T12:00:05.000Z",
    "completedAt": null,
    "createdAt": "2026-04-09T12:00:00.000Z"
  },
  "configSyncedAt": "2026-04-08T10:00:00.000Z"
}
```

When `command` query param is provided, returns the latest job of that type. When omitted, returns the latest job of any type (backward compatible).

---

### PATCH `/api/projects/:projectId/setup/jobs/:jobId/status`

No API contract changes. The endpoint already handles all SetupJobStatus transitions.

**Behavior change**: On COMPLETED status, the route checks `job.command`:
- `ONBOARD`: triggers `syncProjectConfig()` (unchanged)
- `RETRO_SPEC`: no config sync needed (specs are committed to the repo by the workflow)

---

## New Endpoints

None. All retro-spec functionality is served through the existing setup jobs endpoints with the `command` discriminator.
