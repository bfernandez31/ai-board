# Contract: Bulk Delete INBOX Tickets

`POST /api/projects/[projectId]/tickets/bulk/delete`

## Auth
- Session OR Bearer token (PAT).
- Caller MUST be project owner OR member (`verifyProjectAccess(projectId, request)`).

## Request body
```json
{
  "tickets": [
    { "id": 101, "version": 3 },
    { "id": 102, "version": 1 }
  ]
}
```

### Constraints
- `tickets` length: 1..50.
- `tickets[].id`: positive integer.
- `tickets[].version`: positive integer.

## Responses

### 200 OK
```json
{
  "affected": [101],
  "skipped": [
    { "ticketId": 102, "reason": "VERSION_CONFLICT" }
  ],
  "prsClosed": 0
}
```

**Semantics**: Best-effort. Per-ticket failures populate `skipped`; successful peers are still committed and listed in `affected`. INBOX tickets have no branches by default, so `prsClosed` is typically `0`.

### 400 — Validation
```json
{ "error": "Validation failed", "code": "VALIDATION_ERROR", "issues": [...] }
```
Triggered by: empty `tickets`, `tickets.length > 50`, malformed ids/versions.

### 401 — Unauthorized
```json
{ "error": "Unauthorized", "code": "AUTH_ERROR" }
```

### 404 — Project not found
```json
{ "error": "Project not found" }
```
Returned when the project does not exist OR the caller is not a member/owner (anti-enumeration).

### 500 — Internal error
```json
{ "error": "Failed to delete tickets", "code": "DATABASE_ERROR" }
```

## Skipped reasons
| `reason` | When |
|----------|------|
| `NOT_FOUND` | id does not belong to this project |
| `NOT_IN_INBOX` | ticket stage transitioned out of INBOX between selection and execution |
| `VERSION_CONFLICT` | `version` mismatch |
| `ACTIVE_JOB` | a PENDING/RUNNING job exists for this ticket (shouldn't happen for INBOX in practice) |
| `GITHUB_ERROR` | branch cleanup failed (branch present, GH API failed) |

## Side effects
- Deleted tickets removed from DB.
- For any ticket with a `branch`, GitHub cleanup runs (`deleteBranchAndPRs`).
- Client invalidates `queryKeys.projects.tickets(projectId)`.
- No notifications emitted (FR-022).
