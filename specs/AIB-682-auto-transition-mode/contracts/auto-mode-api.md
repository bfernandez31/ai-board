# Contract: Auto-mode Toggle API

## Endpoint

`PATCH /api/projects/[projectId]/tickets/[id]/auto-mode`

Toggle the `autoMode` flag on a ticket. When enabling on a ticket with no running workflow job, the server also dispatches the next stage transition in the same request.

## Authentication & Authorization

- Authenticated NextAuth session required.
- `verifyProjectAccess(projectId)` — owner OR member (same authorization as the existing `/transition` endpoint — FR-002).
- 401 if unauthenticated; 403 if user has no access to the project.

## Path Parameters

| Name | Type | Description |
|---|---|---|
| `projectId` | `number` | Project ID |
| `id` | `number \| string` | Ticket ID (numeric) or ticket key (e.g. `"AIB-123"`) |

## Request Body

```json
{ "enabled": true }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `enabled` | `boolean` | yes | Target state of `autoMode` |

Validation: `z.object({ enabled: z.boolean() })`.

## Responses

### 200 OK — Enabled successfully (with or without immediate dispatch)

```json
{
  "autoMode": true,
  "ticketId": 42,
  "stage": "SPECIFY",
  "jobId": 1234
}
```

- `jobId` is present only when an immediate dispatch occurred (FR-010).
- `jobId` is absent when a workflow job was already running on the ticket at the time of enable (FR-011).

### 200 OK — Disabled successfully

```json
{ "autoMode": false, "ticketId": 42, "stage": "SPECIFY" }
```

Any running job is untouched (FR-014).

### 400 Bad Request

Returned for any of:
- Zod validation failure (`enabled` missing or not a boolean).
- Attempt to enable on an ineligible ticket (QUICK workflow, or stage ∈ {BUILD, VERIFY, SHIP, CLOSED}) — FR-001/003/004.
- Downstream `executeTicketTransition` returning a 400 (e.g., invalid next stage).

```json
{ "error": "Auto-mode is only available on FULL-workflow tickets in INBOX, SPECIFY, or PLAN.", "code": "AUTO_MODE_INELIGIBLE" }
```

### 401 Unauthorized

```json
{ "error": "Unauthorized" }
```

### 403 Forbidden

```json
{ "error": "Forbidden" }
```

### 404 Not Found

```json
{ "error": "Ticket not found" }
```

### 409 Conflict

Returned when an underlying optimistic-concurrency check fails during immediate dispatch (re-raised from `executeTicketTransition`):

```json
{ "error": "Ticket was modified by another request. Please refresh and try again." }
```

### 500 Internal Server Error

Returned when enabling succeeded (DB write persisted) but the follow-up dispatch failed and **could not** be rolled back cleanly (FR-021 fallback). Concrete body includes:

```json
{
  "error": "Auto-mode dispatch failed; auto-mode reverted to off.",
  "code": "AUTO_MODE_DISPATCH_FAILED"
}
```

Normal behavior (FR-021) is that a dispatch failure reverts `autoMode` and returns an upstream-mapped 400/500 with a descriptive `code`.

## Idempotency

- Enabling on a ticket already `autoMode=true` returns 200 with current state and `jobId: null` (no re-dispatch).
- Disabling on a ticket already `autoMode=false` returns 200 with current state (no-op).

## Rate Limiting

Not explicitly rate-limited beyond NextAuth session throttling. Constitution-level quota enforcement (usage banner) is not affected by this endpoint because job creation reuses the existing `executeTicketTransition` path, which already honors quota.

## Side Effects

| Case | Side effects |
|---|---|
| Enable, no running job | `autoMode=true` persisted; new PENDING Job created; GitHub workflow dispatched; on dispatch failure → `autoMode=false` + error response |
| Enable, running job present | `autoMode=true` persisted; no Job touched |
| Disable | `autoMode=false` persisted; no Job touched |

## Cache Invalidation (client)

Client `useAutoMode` hook invalidates TanStack query keys:
- `['tickets', projectId]`
- `['jobs', projectId]` (only when `jobId` is returned, so freshly-dispatched job shows up)
