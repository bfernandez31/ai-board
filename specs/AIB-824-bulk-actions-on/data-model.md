# Data Model: Bulk actions on INBOX tickets

## Overview

This feature does not introduce new Prisma models. It adds transient board-state entities on the client and new transactional mutation shapes on top of the existing `Ticket` table.

## Existing persisted entity: `Ticket`

Source of truth: `prisma/schema.prisma`

### Relevant fields

| Field | Type | Notes for this feature |
|-------|------|------------------------|
| `id` | `Int` | Primary identifier for selection and bulk mutation payloads. |
| `projectId` | `Int` | All selected tickets must belong to one project. |
| `ticketNumber` | `Int` | Stable oldest-first ordering for INBOX and merge survivor choice. |
| `ticketKey` | `String(20)` | Shown in selection UI, blocking errors, and merge provenance sections. |
| `title` | `String(100)` | Merge title must remain within this limit. |
| `description` | `String(10000)` | Merge description must remain within this limit. |
| `stage` | `Stage` | Must be `INBOX` for every selected ticket and for every merge source. |
| `version` | `Int` | Existing optimistic concurrency field; may remain unchanged for bulk endpoints if eligibility is re-read in the transaction. |
| `attachments` | `Json` | Merge carries forward the union of source attachments. |
| `agent` | `Agent?` | Bulk agent update target field. |
| `specifyModel` | `String(50)?` | Bulk model update field. |
| `planModel` | `String(50)?` | Bulk model update field. |
| `implementModel` | `String(50)?` | Bulk model update field. |
| `quickImplModel` | `String(50)?` | Bulk model update field. |
| `verifyModel` | `String(50)?` | Bulk model update field. |
| `createdAt` / `updatedAt` | `DateTime` | Used for auditability and UI refresh after bulk actions. |

### Relationships

| Relation | Impact |
|----------|--------|
| `project` | Access checks remain project-scoped through owner/member membership. |
| `jobs` | Bulk delete and merge must reject or cleanly handle active-job tickets using the same guard logic as current deletion paths. |
| `comments`, `notifications`, `outcome`, `analyses`, `calibration` | Merge and delete behavior must rely on Prisma relation cleanup rules already attached to the `Ticket` record. |

## New transient entity: `InboxTicketSelection`

Client-only state owned by the board.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `selectedTicketIds` | `number[]` | Ordered set of selected INBOX ticket IDs. |
| `selectionAnchorId` | `number \| null` | Last non-range selection anchor used for Shift+select. |
| `inboxVisibleOrder` | `number[]` | Ticket IDs in the current rendered INBOX order used for contiguous range selection and merge preview ordering. |
| `isSelectionMode` | `boolean` | Derived from whether `selectedTicketIds.length > 0`. |
| `eligibleActions` | object | Derived booleans for `canMerge`, `canDelete`, `canChangeAgent`, `canChangeModel`, based on selection size and ticket eligibility. |

### Validation rules

- Only tickets currently rendered in the `INBOX` column can enter `selectedTicketIds`.
- `selectionAnchorId` must be one of the currently selected or recently toggled INBOX tickets.
- `canMerge` is true only when at least two tickets are selected.

### State transitions

1. Empty selection -> first checkbox click enters selection mode and sets the anchor.
2. Selection mode -> Cmd/Ctrl+checkbox toggles one ticket without opening the modal.
3. Selection mode -> Shift+checkbox selects the contiguous range in the current visible INBOX order.
4. Selection mode -> Escape or Cancel clears `selectedTicketIds` and `selectionAnchorId`.

## New transient entity: `BulkActionRequest`

Shared request shape concept across bulk endpoints.

### Common fields

| Field | Type | Description |
|-------|------|-------------|
| `ticketIds` | `number[]` | Unique selected ticket IDs. |
| `projectId` | route param | Project scope enforced by route and DB validation. |

### Validation rules

- Minimum `ticketIds.length` is `1` for delete/agent/model and `2` for merge.
- Every ticket must belong to the route project and still be in `INBOX`.
- Duplicate ticket IDs are invalid.
- Selection changes caused by deleted/moved/inaccessible tickets fail the whole request.

## New transient entity: `BulkMergeDraft`

Editable client/server contract for merge preview submission.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `ticketIds` | `number[]` | Selected source ticket IDs including the survivor. |
| `expectedBaseTicketId` | `number` | Ticket ID the client preview identified as the oldest selected ticket. |
| `title` | `string` | User-editable final title for the survivor, max 100 chars. |
| `description` | `string` | User-editable merged description, max 10,000 chars. |
| `previewOrder` | `number[]` | Optional client-side ordering metadata if the implementation wants server diagnostics. |

### Validation rules

- `title.trim().length` must be `1..100`.
- `description.trim().length` must be `1..10000`.
- `expectedBaseTicketId` must equal the oldest surviving selected ticket on the server.
- Source tickets must all still be in `INBOX`.

### Mutation outcome

- Survivor ticket keeps its original `id`, `ticketNumber`, and `ticketKey`.
- Survivor ticket updates `title`, `description`, `attachments`, and `updatedAt`.
- Source tickets other than the survivor are deleted in the same transaction.

## Derived merge description structure

The prefilled description should be assembled as:

1. Base ticket description first.
2. One clearly separated section per non-base ticket.
3. Each section includes the source `ticketKey` and `title`.
4. Empty source descriptions omit body text but still keep the heading for provenance.

## No schema migration

No new table, enum, or column is required. Existing ticket fields and relation rules are sufficient for bulk update and merge semantics.
