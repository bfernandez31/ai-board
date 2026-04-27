# API Contract: Backfill Endpoints

**Feature**: AIB-742
**Scope**: Operator-facing endpoints to start a per-project backfill and inspect its progress. Auth: project-owner only (operators).

## Common

- All endpoints under `app/api/projects/[projectId]/backfill-outcomes/...`.
- Authorization: `verifyProjectOwnership(projectId)` for the POST trigger; `verifyProjectAccess(projectId)` for the GET status (members can observe).
- Response shape: `application/json`. Standard error envelope.

## 1. POST `/api/projects/[projectId]/backfill-outcomes`

**Purpose**: Start a per-project backfill. The endpoint dispatches `.github/workflows/backfill-outcomes.yml` with the project ID and returns immediately.

### Auth
`verifyProjectOwnership(projectId)` — only the project owner can trigger backfill (cost concern: external API budget).

### Path params
| Param | Type | Notes |
|---|---|---|
| `projectId` | integer | |

### Request body
```json
{
  "resume": true
}
```
| Field | Type | Default | Notes |
|---|---|---|---|
| `resume` | boolean | `true` | When `true`, picks up from existing `BackfillProgress.lastProcessedTicketId`. When `false`, resets the cursor to start from the newest ticket. Resetting does NOT delete existing outcome rows — those are still skipped by the unique-constraint guard. |

### Behavior
1. Validate `projectId` exists; verify ownership.
2. Find or create `BackfillProgress` for the project. If `status === IN_PROGRESS`, return 409 (cannot start while one is running — protects the rate budget).
3. If `resume === false` AND a row exists, set `lastProcessedTicketId = null`, `ticketsProcessed = 0`, `status = IN_PROGRESS`, increment `version`.
4. If creating new, write a fresh `BackfillProgress` with `status = IN_PROGRESS`.
5. Dispatch `.github/workflows/backfill-outcomes.yml` via Octokit `actions.createWorkflowDispatch` with inputs `{ project_id, resume_cursor }`. Pattern: same as `lib/workflows/dispatch-rollback-reset.ts`.
6. Return 202.

### Response 202 Accepted
```json
{
  "projectId": 7,
  "status": "IN_PROGRESS",
  "startedAt": "2026-04-26T10:11:12.000Z",
  "workflowRunUrl": "https://github.com/anthropics/ai-board/actions/runs/12345"
}
```

### Response 409 Conflict
- A backfill is already running for this project.
- `{ error: "Backfill already in progress for this project", code: "BACKFILL_IN_PROGRESS" }`.

### Response 403
- Caller is not the project owner.
- `{ error: "Project owner only", code: "OWNERSHIP_REQUIRED" }`.

### Response 500 + cleanup
- If workflow dispatch fails after the `BackfillProgress` row was created, mark `status = FAILED`, set `lastError`, return 500.
- This follows the constitution's external-call-after-DB-mutation rule: never report success to the caller when the dispatch failed; record consistent state in the DB.

---

## 2. GET `/api/projects/[projectId]/backfill-outcomes/status`

**Purpose**: Return current `BackfillProgress` for the project. Operators poll this to see progress.

### Auth
`verifyProjectAccess(projectId)`.

### Path params
| Param | Type | Notes |
|---|---|---|
| `projectId` | integer | |

### Response 200
```json
{
  "status": "IN_PROGRESS",
  "ticketsProcessed": 42,
  "ticketsRemaining": 78,
  "ticketsWithPartial": 3,
  "lastProcessedTicketId": 1234,
  "startedAt": "2026-04-26T10:11:12.000Z",
  "updatedAt": "2026-04-26T10:25:33.000Z",
  "completedAt": null,
  "lastError": null
}
```

`ticketsRemaining` is computed at request time as:
```
COUNT(*) FROM Ticket
  WHERE projectId = X
    AND stage = 'SHIP'
    AND id NOT IN (SELECT ticketId FROM TicketOutcome WHERE projectId = X)
```

### Response 200 — no backfill ever started
```json
{
  "status": "NEVER_STARTED",
  "ticketsRemaining": 700
}
```
`status: "NEVER_STARTED"` is a sentinel returned when no `BackfillProgress` row exists. The other fields are absent.

### Response 403 / 401 — same envelope as outcome-api.md

---

## 3. Internal callback: workflow → app

The backfill workflow does NOT need a per-ticket callback. It writes outcomes directly to the database from inside the workflow runner's environment (the runner has DATABASE_URL access via existing `WORKFLOW_API_TOKEN` + `APP_URL` — same pattern as test setup in CI).

**Alternative** if the workflow runner cannot reach DATABASE_URL directly: a thin internal endpoint `POST /api/internal/outcomes` (workflow-token-authenticated, like `PATCH /api/jobs/:id/status`) that accepts a single DerivedOutcome and persists it. This keeps DB access centralised in the app server.

The choice between direct DB access and an internal API is a Phase 2 implementation detail (decided based on whether the workflow runner has stable DATABASE_URL access). **For this contract, both forms produce the same observable behavior**: outcome rows appear in the table and `BackfillProgress` advances.

## Error code registry (this contract)

| Code | HTTP | Meaning |
|---|---|---|
| `BACKFILL_IN_PROGRESS` | 409 | Another backfill run is already active |
| `OWNERSHIP_REQUIRED` | 403 | Only the project owner can start a backfill |
| `BACKFILL_DISPATCH_FAILED` | 500 | Workflow dispatch failed; `BackfillProgress` left in `FAILED` state for resume |
| `VALIDATION_ERROR` | 400 | Body validation failed |
