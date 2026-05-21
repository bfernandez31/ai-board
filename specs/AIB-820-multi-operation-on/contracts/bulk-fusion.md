# Contract: Fusion (Merge) INBOX Tickets

`POST /api/projects/[projectId]/tickets/bulk/fusion`

## Auth
- Session OR Bearer token (PAT).
- Caller MUST be project owner OR member.

## Request body
```json
{
  "anchorId": 101,
  "anchorVersion": 3,
  "title": "Add multi-select inbox bar",
  "description": "Anchor body\n\n---\n\n## [AIB-102] Companion ticket\nAbsorbed body...",
  "attachments": [
    { "type": "uploaded", "url": "https://.../a.png", "filename": "a.png", "mimeType": "image/png", "sizeBytes": 1234, "uploadedAt": "2026-05-21T10:00:00Z", "cloudinaryPublicId": "ai-board/tickets/101/a" }
  ],
  "absorbed": [
    { "id": 102, "version": 1 },
    { "id": 103, "version": 2 }
  ]
}
```

### Constraints
- `anchorId`: positive integer; MUST be the lowest id among the selected set (server re-validates).
- `anchorVersion`: positive integer.
- `title`: 1..100 chars.
- `description`: 1..10000 chars (FR-011). Requests with `description.length > 10000` are rejected with 400.
- `attachments`: 0..5 items; each MUST pass `isTicketAttachment`.
- `absorbed`: length 1..49; no duplicate ids; none may equal `anchorId`.
- Total `1 + absorbed.length` ≤ 50.
- All ids (anchor + absorbed) MUST belong to the same `projectId` AND be in `stage = INBOX`.

## Responses

### 200 OK
```json
{
  "anchor": { /* full TicketWithVersion payload for the anchor */ },
  "deletedIds": [102, 103]
}
```

**Semantics**: Atomic — anchor update and absorbed deletes commit together. On any failure, **no** ticket is modified or deleted.

### 400 — Validation
```json
{ "error": "Validation failed", "code": "VALIDATION_ERROR", "issues": [...] }
```
Triggered by: title/description length, attachment shape, absorbed list shape, `1 + absorbed.length > 50`.

### 401 — Unauthorized
### 404 — Project / anchor not found

### 409 — Conflict (atomic rollback)
```json
{
  "error": "Fusion failed — one or more tickets were modified by another user",
  "code": "CONFLICT",
  "conflicting": [102]
}
```
Triggered by ANY of:
- Anchor's current `version` ≠ `anchorVersion`.
- Any absorbed ticket's current `version` ≠ supplied version.
- Any selected ticket's `stage` ≠ `INBOX`.
- Any selected ticket no longer exists.

When 409 is returned, NO database mutation has occurred. The client SHOULD refresh tickets and let the user retry.

### 500 — Internal error

## Side effects on 200
- Anchor row updated: `title`, `description`, `attachments`, `version += 1`.
- Absorbed rows deleted (hard delete — INBOX tickets cannot have soft-delete content per existing model).
- Client cache: anchor replaced with returned payload; absorbed ids removed from cache.
- No notifications (FR-022); single in-session result toast: `"Fused N tickets into <anchor.ticketKey>"`.

## Implementation note
Wrapped in `prisma.$transaction(async (tx) => { ... })`. Use per-id `tx.ticket.updateMany({ where: { id, projectId, version, stage: 'INBOX' }, data: { version: { increment: 1 } } })` style checks followed by `tx.ticket.deleteMany` whose `count` MUST equal `absorbed.length`; otherwise throw to roll back the transaction.
