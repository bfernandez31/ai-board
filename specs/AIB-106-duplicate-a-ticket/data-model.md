# Data Model: Duplicate Ticket Feature

**Branch**: `AIB-106-duplicate-a-ticket` | **Date**: 2025-12-12

## Overview

This feature does not introduce new data models. It reuses the existing `Ticket` model for the duplicated ticket.

## Existing Entity: Ticket

The duplicate operation creates a new `Ticket` record with values copied from a source ticket.

### Prisma Schema (existing)

```prisma
model Ticket {
  id                  Int                  @id @default(autoincrement())
  title               String               @db.VarChar(100)
  description         String               @db.VarChar(2500)
  stage               Stage                @default(INBOX)
  version             Int                  @default(1)
  projectId           Int
  ticketNumber        Int
  ticketKey           String               @unique @db.VarChar(20)
  branch              String?              @db.VarChar(200)
  previewUrl          String?              @db.VarChar(500)
  autoMode            Boolean              @default(false)
  workflowType        WorkflowType         @default(FULL)
  attachments         Json?                @default("[]")
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @default(now()) @updatedAt
  clarificationPolicy ClarificationPolicy?
  comments            Comment[]
  jobs                Job[]
  notifications       Notification[]
  project             Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, ticketNumber])
  @@index([projectId])
  @@index([stage])
  @@index([updatedAt])
  @@index([projectId, workflowType])
  @@index([ticketKey])
}
```

## Field Mapping: Source → Duplicate

| Source Field | Duplicate Value | Notes |
|--------------|-----------------|-------|
| `title` | `"Copy of " + truncate(title, 92)` | Prefix added, truncate to stay within 100 chars |
| `description` | Copy verbatim | No modification |
| `clarificationPolicy` | Copy if set, else null | Preserves ticket-level override |
| `attachments` | Copy JSON array | Reference same URLs |
| `stage` | `INBOX` | Always start in INBOX |
| `version` | `1` | New ticket starts at version 1 |
| `projectId` | Same as source | Duplicate within same project |
| `ticketNumber` | Generated (sequence) | New unique number |
| `ticketKey` | Generated (`{PROJECT_KEY}-{ticketNumber}`) | New unique key |
| `branch` | `null` | No branch until workflow runs |
| `previewUrl` | `null` | No preview for new ticket |
| `autoMode` | `false` | Default for new tickets |
| `workflowType` | `FULL` | Default, user can change via quick-impl |
| `createdAt` | `now()` | New timestamp |
| `updatedAt` | `now()` | New timestamp |

## Existing Entity: TicketAttachment (JSON)

Stored in `Ticket.attachments` as JSON array.

### TypeScript Interface (existing)

```typescript
interface TicketAttachment {
  type: 'uploaded' | 'external';
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;  // ISO 8601
  cloudinaryPublicId?: string;  // Only for uploaded images
}
```

### Attachment Duplication

Attachments are copied by reference:
- Same `url` values are used (no re-upload)
- `uploadedAt` is preserved from source (reflects original upload time)
- All other fields copied verbatim

## Validation Rules

### Title Validation
- Max length: 100 characters
- "Copy of " prefix is 8 characters
- If `"Copy of " + sourceTitle` exceeds 100 chars:
  - Truncate sourceTitle to 92 characters
  - Result: `"Copy of " + sourceTitle.substring(0, 92)`

### Attachment Validation
- Max 5 attachments per ticket (existing constraint)
- Duplication preserves all attachments (up to 5)
- No re-validation needed since source was already validated

## Database Operations

### Read (Source Ticket)
```sql
SELECT id, title, description, clarificationPolicy, attachments, projectId
FROM "Ticket"
WHERE id = :sourceTicketId AND projectId = :projectId
```

### Write (Duplicate Ticket)
```sql
INSERT INTO "Ticket" (
  title, description, stage, version, projectId, ticketNumber, ticketKey,
  branch, previewUrl, autoMode, workflowType, attachments, clarificationPolicy,
  createdAt, updatedAt
) VALUES (
  :prefixedTitle, :description, 'INBOX', 1, :projectId, :newTicketNumber, :newTicketKey,
  NULL, NULL, false, 'FULL', :attachments, :clarificationPolicy,
  NOW(), NOW()
)
RETURNING *
```

## State Transitions

No new state transitions. The duplicate ticket starts in `INBOX` stage and follows standard workflow transitions.

```
[Source Ticket: Any Stage] --duplicate--> [New Ticket: INBOX]
```
