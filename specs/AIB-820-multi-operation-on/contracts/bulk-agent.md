# Contract: Bulk Change Agent on INBOX Tickets

`POST /api/projects/[projectId]/tickets/bulk/agent`

## Auth
- Session OR Bearer token (PAT).
- Caller MUST be project owner OR member.

## Request body
```json
{
  "agent": "CODEX",
  "tickets": [
    { "id": 101, "version": 3 },
    { "id": 102, "version": 1 }
  ]
}
```

### Constraints
- `agent`: one of `"CLAUDE" | "CODEX" | "MISTRAL" | "GEMINI" | null`. `null` clears the override (inherit project default).
- `tickets` length: 1..50.

## Responses

### 200 OK
```json
{
  "affected": [
    { "ticketId": 101, "version": 4, "agent": "CODEX" }
  ],
  "skipped": [
    { "ticketId": 102, "reason": "VERSION_CONFLICT" }
  ]
}
```

**Semantics**: Best-effort. Each successful update bumps `version` by 1; the new value is returned so the client can update its cache without a refetch.

### 400 — Validation
```json
{ "error": "Validation failed", "code": "VALIDATION_ERROR", "issues": [...] }
```
Triggered by: invalid agent enum, empty/oversize tickets list.

### 401, 404, 500 — same as bulk-delete.md

## Skipped reasons
- `NOT_FOUND`, `NOT_IN_INBOX`, `VERSION_CONFLICT` (as in bulk-delete; no `ACTIVE_JOB`/`GITHUB_ERROR` since this is field-only).

## Side effects
- `Ticket.agent` set for each affected ticket.
- Client invalidates `queryKeys.projects.tickets(projectId)`.
- No notifications (FR-022).
