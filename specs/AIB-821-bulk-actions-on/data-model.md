# Data Model: Bulk Actions on INBOX Tickets (AIB-821)

## Persistent Schema Changes

### 1. `Ticket.creatorId` (new column)

```prisma
model Ticket {
  ...
  creatorId String? @db.VarChar(255)
  creator   User?   @relation("TicketCreator", fields: [creatorId], references: [id], onDelete: SetNull)
  ...
  @@index([creatorId])
}

model User {
  ...
  ticketsCreated Ticket[] @relation("TicketCreator")
}
```

- **Type**: nullable `String` (User.id). Nullable because legacy rows have no recorded creator.
- **Backfill**: none — legacy rows remain NULL; the bulk-merge/delete notification logic skips NULL creators (FR-029 fires only when known).
- **Write path**: populated by every ticket-creation code path (`lib/db/tickets.ts:475 createTicket`, `lib/db/tickets.ts:602 duplicateTicket`, `lib/db/tickets.ts:662 fullCloneTicket`, MCP `create_ticket`, inbox-analysis ticket spawner). Each takes the actor's `userId` from the API auth layer and forwards it.
- **`onDelete: SetNull`**: if a user is deleted, surviving tickets retain history (project-level) but lose creator attribution. Notifications for already-sent FR-029 events still reference the now-deleted user via `actorId` (existing `notificationsCreated` relation).

### 2. `Notification` model extension

```prisma
enum NotificationType {
  MENTION
  TICKET_DELETED
  TICKET_MERGED
}

model Notification {
  id                 Int               @id @default(autoincrement())
  recipientId        String
  actorId            String
  commentId          Int?              // was: Int (NOT NULL) — now nullable
  ticketId           Int?              // was: Int (NOT NULL) — now nullable; SetNull on source-ticket delete
  type               NotificationType  @default(MENTION)
  mergedIntoTicketId Int?              // populated when type = TICKET_MERGED, FK to surviving base ticket
  read               Boolean           @default(false)
  readAt             DateTime?
  createdAt          DateTime          @default(now())
  deletedAt          DateTime?

  recipient        User     @relation("NotificationRecipient", fields: [recipientId], references: [id], onDelete: Cascade)
  actor            User     @relation("NotificationActor", fields: [actorId], references: [id], onDelete: Cascade)
  comment          Comment? @relation(fields: [commentId], references: [id], onDelete: Cascade)
  ticket           Ticket?  @relation("NotificationTicket", fields: [ticketId], references: [id], onDelete: SetNull)
  mergedIntoTicket Ticket?  @relation("NotificationMergedInto", fields: [mergedIntoTicketId], references: [id], onDelete: SetNull)
  ...
}

model Ticket {
  ...
  notifications              Notification[] @relation("NotificationTicket")
  mergedIntoNotifications    Notification[] @relation("NotificationMergedInto")
}
```

- **`commentId` nullable**: enables non-mention notifications (TICKET_DELETED, TICKET_MERGED have no source comment).
- **`ticketId` becomes SetNull on delete**: a TICKET_DELETED notification survives the cascade after the source ticket is hard-deleted, so the recipient can still see "AIB-12 was deleted by Alice" in their feed. The notification row's `ticketId` becomes NULL but the human-readable `ticketKey` is captured at notification-render time (see UI changes below) or we add a `ticketKeySnapshot String? @db.VarChar(20)` column. **Decision**: add `ticketKeySnapshot` — avoids a stale-FK lookup in the notifications API.
- **`mergedIntoTicketId`**: a TICKET_MERGED notification points to the surviving base ticket. The recipient clicks it and lands on the base ticket — they can see their content was rolled in.
- **`type` default `MENTION`**: backfills cleanly for legacy mention rows.

### 3. Migration ordering (single Prisma migration)

`prisma/migrations/<ts>_bulk_actions_inbox/migration.sql`:
1. `ALTER TABLE "Ticket" ADD COLUMN "creatorId" VARCHAR(255);`
2. `CREATE INDEX "Ticket_creatorId_idx" ON "Ticket"("creatorId");`
3. `ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL;`
4. `CREATE TYPE "NotificationType" AS ENUM ('MENTION', 'TICKET_DELETED', 'TICKET_MERGED');`
5. `ALTER TABLE "Notification" ADD COLUMN "type" "NotificationType" NOT NULL DEFAULT 'MENTION';`
6. `ALTER TABLE "Notification" ADD COLUMN "mergedIntoTicketId" INTEGER;`
7. `ALTER TABLE "Notification" ADD COLUMN "ticketKeySnapshot" VARCHAR(20);`
8. `ALTER TABLE "Notification" ALTER COLUMN "commentId" DROP NOT NULL;`
9. `ALTER TABLE "Notification" ALTER COLUMN "ticketId" DROP NOT NULL;`
10. Drop the existing `Notification_ticketId_fkey` and recreate with `ON DELETE SET NULL`.
11. Add the `mergedIntoTicketId` FK with `ON DELETE SET NULL`.

This is a forward-compatible migration: existing notification rows get `type = 'MENTION'` and require no application changes to read.

## Ephemeral / Transient Entities

### A. Selection (client state)

Owned by the `useBulkSelection` hook in `components/board/hooks/use-bulk-selection.ts`.

```ts
interface BulkSelectionState {
  selectedIds: Set<number>;   // ticket ids currently selected (INBOX only)
  anchorId: number | null;    // most recently clicked id, used as shift+click range anchor
  isSelectMode: boolean;      // true when selectedIds.size > 0 OR user just entered mode
}
```

- **Lifecycle**: lives only in React state. Cleared on (a) Escape, (b) Cancel in `BulkActionBar`, (c) `selectedIds.size === 0` after a toggle, (d) successful destructive action (Delete, Merge), (e) project navigation (component unmount), (f) full page refresh.
- **Validation rules**:
  - `selectedIds.size <= 50` enforced at every mutation: action buttons disable beyond this with tooltip "Select at most 50 tickets per bulk action".
  - All ids in `selectedIds` MUST be present in the current INBOX ticket list; ids no longer in INBOX are removed by an effect on ticket-list change.
  - `anchorId`, if non-null, MUST be in `selectedIds` after the most recent click that set it.

### B. Bulk Delete Request (transient)

```ts
interface BulkDeleteRequest {
  ticketIds: number[];                     // 1..50, unique, all INBOX, all in projectId
  expectedVersions: Record<number, number>; // id → version captured at last fetch
}
```

- **Validation**: `ticketIds.length >= 1 && <= 50`; every id must have an entry in `expectedVersions`.
- **Server preconditions** (FR-027, FR-028): every ticket exists, belongs to `projectId`, is in `INBOX`, and matches `expectedVersions[id]`.

### C. Bulk Merge Request (transient)

```ts
interface BulkMergeRequest {
  baseTicketId: number;                    // smallest id in selection (FR-016)
  sourceTicketIds: number[];               // selection minus base; length >= 1, baseTicketId not in this list
  title: string;                           // 1..100 chars (titleSchema)
  description: string;                     // 1..10000 chars (descriptionSchema)
  expectedVersions: Record<number, number>; // base + sources, all required
}
```

- **Server-side derivation rules** (defense in depth — client computes these for preview, server re-validates):
  - `baseTicketId === min(selection)`.
  - The default prefilled description is `base.description + sources.sort((a,b)=>a.id-b.id).map(s => '\n\n---\n\n## From <s.ticketKey>: <s.title>\n<s.description>').join('')`. Client may edit freely; server validates only length and content rules, not equality to the prefill.
  - Attachments after merge: `concat(base.attachments, ...sources.sort.attachments)` preserving `TicketAttachment[]` shape from `app/lib/types/ticket.ts:9`.
- **State transition**: base ticket's `version` is incremented by 1 in the transaction; source tickets are hard-deleted.

### D. Bulk Field Update Request (transient)

```ts
interface BulkAgentRequest {
  ticketIds: number[];                     // 1..50, unique, all INBOX
  agent: Agent | null;                     // single agent enum value or null to clear
}

interface BulkModelRequest {
  ticketIds: number[];                     // 1..50, unique, all INBOX
  model: string | null;                    // single model name, max 50 chars, or null to clear
}
```

- Both updates bump `version` by 1 on every affected row but do NOT require an `expectedVersions` map — the only conflict mode that matters is stage drift, which the `where: { stage: 'INBOX' }` filter catches.
- `BulkModelRequest.model` writes to all five fields: `specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel`.

## Ticket Field Touchpoints by Operation

| Field | Bulk Delete | Bulk Merge (base) | Bulk Merge (source) | Bulk Agent | Bulk Model |
|---|---|---|---|---|---|
| `id`, `ticketKey`, `ticketNumber` | row removed | preserved | row removed | preserved | preserved |
| `title` | — | overwritten with edited | — | preserved | preserved |
| `description` | — | overwritten with edited | — | preserved | preserved |
| `attachments` | — | concat(base, ...sources) | — | preserved | preserved |
| `version` | — | +1 | — | +1 | +1 |
| `updatedAt` | — | now() | — | now() | now() |
| `stage`, `workflowType`, `autoMode`, `clarificationPolicy`, `branch`, `previewUrl` | — | preserved | — | preserved | preserved |
| `agent` | — | preserved | — | overwritten | preserved |
| `specifyModel`/`planModel`/`implementModel`/`quickImplModel`/`verifyModel` | — | preserved | — | preserved | all 5 overwritten with same value |
| `creatorId` | — | preserved | — | preserved | preserved |

Cascade effects from hard-delete (`Comment`, `Job`, `Notification.ticketId → SetNull`, `TicketAnalysis`, `TicketOutcome`, etc.) match the existing `prisma.ticket.delete` behavior in `lib/tickets/deletion.ts:102`.

## Validation Rules Summary

- **Selection cap**: 1..50 ids per request (FR-008). Server returns 400 `BULK_LIMIT_EXCEEDED` if violated.
- **Merge floor**: 2..50 ids; `sourceTicketIds.length >= 1`. Server returns 400 `BULK_MERGE_REQUIRES_TWO` if violated.
- **Cross-project**: server returns 403 `FORBIDDEN_CROSS_PROJECT` if any id resolves to a ticket whose `projectId` doesn't match the URL path.
- **Stage drift / deleted**: server returns 409 `BULK_CONFLICT_STAGE_DRIFT` with `conflictingIds: number[]` if any id is missing or not INBOX.
- **Version mismatch**: server returns 409 `BULK_CONFLICT_VERSION` with `conflictingIds: number[]` and `currentVersions: Record<number, number>` if any expected version doesn't match.
- **Title length** (merge): 1..100 chars, regex `ALLOWED_CHARS_PATTERN` from `lib/validations/ticket.ts:32`. 400 `VALIDATION_ERROR`.
- **Description length** (merge): 1..10000 chars. 400 `VALIDATION_ERROR`.
- **Model length** (bulk model): 1..50 chars. 400 `VALIDATION_ERROR`.
- **Agent enum** (bulk agent): one of `Agent` enum or null. 400 `VALIDATION_ERROR`.
