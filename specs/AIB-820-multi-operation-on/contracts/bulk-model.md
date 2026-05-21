# Contract: Bulk Change Per-Stage Model Override on INBOX Tickets

`POST /api/projects/[projectId]/tickets/bulk/model`

## Auth
- Session OR Bearer token (PAT).
- Caller MUST be project owner OR member.

## Request body
```json
{
  "stage": "implementModel",
  "model": "claude-opus-4-7",
  "tickets": [
    { "id": 101, "version": 3 },
    { "id": 102, "version": 1 }
  ]
}
```

### Constraints
- `stage`: one of `"specifyModel" | "planModel" | "implementModel" | "quickImplModel" | "verifyModel"` (`STAGE_MODEL_KEYS`).
- `model`: valid Claude model id per `isClaudeModelId`, or `null` to clear the override.
- `tickets` length: 1..50.

## Responses

### 200 OK
```json
{
  "affected": [
    {
      "ticketId": 101,
      "version": 4,
      "specifyModel": null,
      "planModel": null,
      "implementModel": "claude-opus-4-7",
      "quickImplModel": null,
      "verifyModel": null
    }
  ],
  "skipped": [
    { "ticketId": 102, "reason": "VERSION_CONFLICT" }
  ]
}
```

### 400 — Validation
```json
{ "error": "Unknown model ID. Allowed: ...", "code": "INVALID_MODEL_ID", "issues": [...] }
```
Triggered by: model not in allow-list (FR-023), invalid `stage`, empty/oversize tickets list.

### 401, 404, 500 — same as bulk-delete.md

## Skipped reasons
- `NOT_FOUND`, `NOT_IN_INBOX`, `VERSION_CONFLICT`.

## Side effects
- The chosen stage field on each affected ticket is set to `model` (or cleared when `null`); the other four stage-model fields are untouched.
- Client invalidates `queryKeys.projects.tickets(projectId)`.
- No notifications (FR-022).

## Notes
- Validation reuses `claudeModelIdSchema` from `app/lib/schemas/model-config.ts` to keep the allow-list source-of-truth single.
- A future "Apply to all stages" toggle (per spec D7 reviewer note) would extend the payload to `stages: StageModelKey[]` without breaking existing callers — backwards-compatible.
