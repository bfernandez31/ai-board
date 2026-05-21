# Data Model: Multi-Ticket Bulk Operations on Inbox (AIB-820)

**Date**: 2026-05-21
**Spec**: [spec.md](./spec.md)

## Database Schema Changes

**None.** The feature uses only existing `Ticket` fields (`id`, `title`, `description`, `stage`, `version`, `projectId`, `ticketKey`, `agent`, `specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel`, `attachments`). No new tables, columns, indexes, or migrations are required.

## Transient (Client-Side) Entities

### SelectionSet
Client-side `Set<number>` of ticket ids currently checked by the user.

| Field | Type | Notes |
|-------|------|-------|
| `ids` | `Set<number>` | Ticket ids currently selected. Always a subset of the INBOX column. |
| `lastClickedTicketId` | `number \| null` | Tracks the anchor for shift-click range selection. Updated on every checkbox click. |

**Lifecycle**:
- Initialised empty on `Board` mount.
- Cleared on successful bulk mutation (`onSuccess` of bulk hooks).
- Cleared when no INBOX ticket remains in the set after a refetch.
- Preserved across polling refetches as long as the underlying tickets still satisfy `stage === 'INBOX'`.
- NOT persisted to URL, localStorage, or any server.

**Invariants**:
- `ids.size <= 50` enforced at the call sites (Select All toggle, checkbox toggler).
- Every id in `ids` MUST currently belong to an INBOX ticket; otherwise filtered out on next render (FR-014 client mirror).

### FusionDraft
In-modal editable state for a pending fusion. Discarded on cancel; committed only via the atomic fusion request.

| Field | Type | Notes |
|-------|------|-------|
| `anchorId` | `number` | Lowest id of the selected set. |
| `title` | `string` (≤ 100 chars) | Pre-populated from anchor; editable. |
| `description` | `string` (≤ 10000 chars) | Concatenation of all selected descriptions in ascending-id order; editable. May exceed 10000 in-modal — Save blocked until trimmed. |
| `attachments` | `TicketAttachment[]` | Union of all selected tickets' attachments (anchor first, then ascending id), deduped by URL, clipped to 5. |
| `absorbed` | `Array<{id: number, version: number}>` | Non-anchor selected tickets. Will be deleted on save. |
| `anchorVersion` | `number` | Anchor's current version (for optimistic concurrency). |
| `clippedAttachmentCount` | `number` | Count of attachments dropped to satisfy the 5-image cap. Surfaced in UI banner. |

## Request / Response Entities

### BulkDeleteRequest
```ts
{
  tickets: Array<{ id: number; version: number }>;  // 1..50
}
```

### BulkDeleteResponse (200)
```ts
{
  affected: number[];                                 // deleted ticket ids
  skipped: Array<{
    ticketId: number;
    reason: 'NOT_IN_INBOX' | 'NOT_FOUND' | 'VERSION_CONFLICT' | 'ACTIVE_JOB' | 'GITHUB_ERROR' | 'FORBIDDEN';
  }>;
  prsClosed: number;                                  // sum across all deleted tickets
}
```

### BulkAgentRequest
```ts
{
  agent: 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI' | null;   // null = inherit project default
  tickets: Array<{ id: number; version: number }>;            // 1..50
}
```

### BulkAgentResponse (200)
```ts
{
  affected: Array<{ ticketId: number; version: number; agent: Agent | null }>;
  skipped: Array<{
    ticketId: number;
    reason: 'NOT_IN_INBOX' | 'NOT_FOUND' | 'VERSION_CONFLICT';
  }>;
}
```

### BulkModelRequest
```ts
{
  stage: 'specifyModel' | 'planModel' | 'implementModel' | 'quickImplModel' | 'verifyModel';
  model: string | null;                                       // valid Claude model id, or null to clear
  tickets: Array<{ id: number; version: number }>;            // 1..50
}
```
Validation: when non-null, `model` MUST pass `isClaudeModelId` (same allow-list as `ticketModelOverrideSchema`).

### BulkModelResponse (200)
```ts
{
  affected: Array<{
    ticketId: number;
    version: number;
    specifyModel: string | null;
    planModel: string | null;
    implementModel: string | null;
    quickImplModel: string | null;
    verifyModel: string | null;
  }>;
  skipped: Array<{
    ticketId: number;
    reason: 'NOT_IN_INBOX' | 'NOT_FOUND' | 'VERSION_CONFLICT';
  }>;
}
```

### FusionRequest
```ts
{
  anchorId: number;
  anchorVersion: number;
  title: string;                                        // 1..100
  description: string;                                  // 1..10000
  attachments: TicketAttachment[];                      // 0..5
  absorbed: Array<{ id: number; version: number }>;     // 1..49 (anchor excluded)
}
```
Validation:
- `title.length` in [1, 100]
- `description.length` in [1, 10000]
- `attachments.length` ≤ 5; each item passes `isTicketAttachment` type guard
- `absorbed` non-empty, no duplicate ids, none equals `anchorId`
- Total `1 + absorbed.length` ≤ 50

### FusionResponse (200)
```ts
{
  anchor: TicketWithVersion;                            // updated anchor (full payload)
  deletedIds: number[];                                 // absorbed ticket ids that were removed
}
```

### FusionResponse (409)
```ts
{
  error: 'Fusion failed — one or more tickets were modified by another user';
  code: 'CONFLICT';
  conflicting: number[];                                // ids whose version no longer matches
}
```

## State Transitions

**No new ticket-level state transitions.** Bulk operations preserve the INBOX stage:
- Bulk delete: ticket row removed entirely (same as single-ticket DELETE).
- Bulk agent / model: field-level update; stage stays INBOX.
- Fusion: anchor updated in place (stage stays INBOX); absorbed tickets removed.

**Version bump**: every successful field update increments `version` by 1 (Prisma `version: { increment: 1 }`). Fusion bumps the anchor's version exactly once.

## Validation Rules Summary

| Field | Rule | Source |
|-------|------|--------|
| `tickets.length` | 1..50 | FR-004 |
| `tickets[].id` | positive int | implicit |
| `tickets[].version` | positive int | optimistic concurrency |
| `agent` (bulk-agent) | `Agent` enum or `null` | spec D9 |
| `stage` (bulk-model) | one of `STAGE_MODEL_KEYS` | reuses existing keys |
| `model` (bulk-model) | `isClaudeModelId(model)` or `null` | FR-023, reuses `ticketModelOverrideSchema` |
| `title` (fusion) | 1..100 | matches `Ticket.title` `@db.VarChar(100)` |
| `description` (fusion) | 1..10000 | matches `Ticket.description` `@db.VarChar(10000)` (FR-011) |
| `attachments` (fusion) | 0..5, each `isTicketAttachment` | matches existing per-ticket cap |
| `absorbed.length` (fusion) | ≥ 1 | FR-008 |
| `anchorId ∉ absorbed.map(a => a.id)` | true | structural |

## Constraint Mirroring (Constitution IV)

All Zod constraints above match `prisma/schema.prisma` Ticket model:
- `title` Zod `max(100)` ↔ Prisma `@db.VarChar(100)`
- `description` Zod `max(10000)` ↔ Prisma `@db.VarChar(10000)`
- `agent` Zod `nativeEnum(Agent)` ↔ Prisma `Agent` enum
- `specifyModel`/`planModel`/`implementModel`/`quickImplModel`/`verifyModel` Zod `max(50)` ↔ Prisma `@db.VarChar(50)` (already enforced by `claudeModelIdSchema` which restricts to the known short ids)
