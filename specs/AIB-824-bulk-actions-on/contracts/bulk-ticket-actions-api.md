# API Contract: Bulk ticket actions

## Scope

Project-scoped endpoints for bulk operations on INBOX tickets only.

Base path: `/api/projects/{projectId}/tickets/bulk`

All endpoints:

- Require authenticated owner or project member access.
- Validate `projectId` as a positive integer route param.
- Re-read all selected tickets server-side and fail atomically if any ticket is missing, outside the project, outside `INBOX`, or otherwise ineligible.
- Return structured error payloads in the form `{ error: string, code?: string, details?: object }`.

## Shared request rules

### `ticketIds`

- Type: `number[]`
- Must contain unique positive integers.
- Minimum length:
  - `1` for delete, agent, and model actions
  - `2` for merge

### Shared blocking error contract

```json
{
  "error": "Bulk action blocked",
  "code": "BULK_ACTION_BLOCKED",
  "details": {
    "blockingTicketId": 42,
    "blockingTicketKey": "AIB-42",
    "reason": "Ticket is no longer in INBOX"
  }
}
```

## 1. Bulk delete

### Endpoint

`POST /api/projects/{projectId}/tickets/bulk/delete`

### Request

```json
{
  "ticketIds": [101, 102, 103]
}
```

### Success response: `200 OK`

```json
{
  "success": true,
  "deletedTicketIds": [101, 102, 103],
  "deletedTicketKeys": ["AIB-101", "AIB-102", "AIB-103"]
}
```

### Error cases

- `400` invalid payload, invalid IDs, duplicate IDs, or empty selection
- `401` unauthorized
- `404` project not found or all selected tickets inaccessible
- `409` `BULK_ACTION_BLOCKED` because one ticket moved or became invalid before confirmation
- `500` cleanup or database failure

## 2. Bulk agent change

### Endpoint

`PATCH /api/projects/{projectId}/tickets/bulk/agent`

### Request

```json
{
  "ticketIds": [101, 102],
  "agent": "CODEX"
}
```

`agent` may also be `null` to clear ticket-level overrides and fall back to the project default.

### Success response: `200 OK`

```json
{
  "success": true,
  "updatedTickets": [
    { "id": 101, "ticketKey": "AIB-101", "agent": "CODEX" },
    { "id": 102, "ticketKey": "AIB-102", "agent": "CODEX" }
  ]
}
```

### Error cases

- `400` invalid `agent` enum or invalid selection
- `401` unauthorized
- `409` `BULK_ACTION_BLOCKED`
- `500` database failure

## 3. Bulk model change

### Endpoint

`PATCH /api/projects/{projectId}/tickets/bulk/model-config`

### Request

This action applies one model choice across the existing ticket-level stage model fields already supported by the product.

```json
{
  "ticketIds": [101, 102],
  "modelId": "claude-sonnet-4-6"
}
```

### Success response: `200 OK`

```json
{
  "success": true,
  "appliedModelId": "claude-sonnet-4-6",
  "updatedTickets": [
    {
      "id": 101,
      "ticketKey": "AIB-101",
      "specifyModel": "claude-sonnet-4-6",
      "planModel": "claude-sonnet-4-6",
      "implementModel": "claude-sonnet-4-6",
      "quickImplModel": "claude-sonnet-4-6",
      "verifyModel": "claude-sonnet-4-6"
    }
  ]
}
```

### Error cases

- `400` invalid model ID or invalid selection
- `401` unauthorized
- `409` `BULK_ACTION_BLOCKED`
- `500` database failure

## 4. Bulk merge

### Endpoint

`POST /api/projects/{projectId}/tickets/bulk/merge`

### Request

```json
{
  "ticketIds": [101, 102, 103],
  "expectedBaseTicketId": 101,
  "title": "Consolidated inbox ticket",
  "description": "Base description...\\n\\n---\\nSource: AIB-102 Related ticket\\n..."
}
```

### Request rules

- `ticketIds.length >= 2`
- `expectedBaseTicketId` must be one of `ticketIds`
- `title.trim().length` must be `1..100`
- `description.trim().length` must be `1..10000`

### Success response: `200 OK`

```json
{
  "success": true,
  "survivor": {
    "id": 101,
    "ticketKey": "AIB-101",
    "title": "Consolidated inbox ticket",
    "description": "Base description...\\n\\n---\\nSource: AIB-102 Related ticket\\n...",
    "attachments": [],
    "stage": "INBOX"
  },
  "deletedSourceTicketIds": [102, 103]
}
```

### Error cases

- `400` validation failure, including title/description limits
- `401` unauthorized
- `409` `BULK_ACTION_BLOCKED` if any source ticket changed eligibility or if `expectedBaseTicketId` no longer matches the oldest selected ticket
- `500` database failure

## Client cache expectations

On success, the client should:

- Remove deleted tickets from the flat `queryKeys.projects.tickets(projectId)` cache.
- Replace the survivor ticket entry with the server-returned merged ticket payload.
- Clear selection state and close the active bulk dialog.

On failure, the client should:

- Roll back any optimistic cache edits.
- Preserve selection state so the user can retry or cancel.
- Surface `details.blockingTicketKey` when present.
