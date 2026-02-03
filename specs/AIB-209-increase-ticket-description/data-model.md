# Data Model: Increase Ticket Description Limit

**Feature Branch**: `AIB-209-increase-ticket-description`
**Date**: 2026-02-03

## Entity Changes

### Ticket

**Change Type**: Column modification (non-breaking)

| Field | Before | After | Notes |
|-------|--------|-------|-------|
| `description` | `VARCHAR(2500)` | `VARCHAR(10000)` | 4x capacity increase |

**No new fields added.**
**No relationship changes.**
**No validation rule changes (only limit adjustment).**

## Current Schema (Before)

```prisma
model Ticket {
  id                  Int                  @id @default(autoincrement())
  title               String               @db.VarChar(100)
  description         String               @db.VarChar(2500)  // ← CHANGE THIS
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
  closedAt            DateTime?
  // ... relations omitted
}
```

## Target Schema (After)

```prisma
model Ticket {
  // ... unchanged fields ...
  description         String               @db.VarChar(10000)  // ← UPDATED
  // ... unchanged fields ...
}
```

## Migration SQL (Expected)

```sql
-- Prisma will generate something similar to:
ALTER TABLE "Ticket" ALTER COLUMN "description" TYPE VARCHAR(10000);
```

**Performance Note**: PostgreSQL VARCHAR expansion is a metadata-only operation. No table rewrite required. Operation is instant regardless of table size.

## Validation Alignment

The Zod schemas in `lib/validations/ticket.ts` must be updated to match:

| Schema | Current | Target |
|--------|---------|--------|
| `DescriptionFieldSchema` | `.max(2500, ...)` | `.max(10000, ...)` |
| `CreateTicketSchema` refinement | `<= 2500` | `<= 10000` |
| `descriptionSchema` (PATCH) | `.max(2500, ...)` | `.max(10000, ...)` |
| Error messages | "2500 characters" | "10000 characters" |

## State Transitions

No state transition changes. The `description` field does not affect ticket workflow states.

## Indexes

No index changes required. The `description` field is not indexed (full-text search not implemented).

## Backward Compatibility

- **Existing data**: All existing tickets with descriptions under 2500 characters remain valid
- **API compatibility**: No breaking changes to request/response formats
- **Client compatibility**: Existing clients will work without changes (they just gain ability to send longer descriptions)
