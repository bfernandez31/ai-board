# Data Model: Inline Ticket Editing

**Feature**: 007-enable-inline-editing
**Date**: 2025-10-02

## Overview
This feature modifies the existing Ticket model's title and description fields via a PATCH API. No schema changes required—the Ticket model already has all necessary fields including the version field for optimistic concurrency control.

---

## Existing Entity: Ticket

### Schema (No Changes)
```prisma
model Ticket {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(100)      // Editable via PATCH
  description String   @db.VarChar(1000)     // Editable via PATCH
  stage       Stage    @default(INBOX)       // NOT editable in this feature
  version     Int      @default(1)           // Used for concurrency control
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([stage])
  @@index([updatedAt])
}
```

### Field Details

| Field | Type | Constraints | Editable | Purpose |
|-------|------|-------------|----------|---------|
| `id` | Int | Primary key, auto-increment | ❌ | Unique identifier |
| `title` | String | VARCHAR(100), NOT NULL | ✅ | Ticket title (inline editable) |
| `description` | String | VARCHAR(1000), NOT NULL | ✅ | Ticket description (inline editable) |
| `stage` | Stage | Enum, default INBOX | ❌ | Current workflow stage (not in scope) |
| `version` | Int | Default 1, NOT NULL | ✅ | Optimistic lock version (auto-incremented) |
| `createdAt` | DateTime | Default now() | ❌ | Creation timestamp |
| `updatedAt` | DateTime | Auto-updated | ❌ | Last modification timestamp |

---

## Validation Rules

### Title Validation
```typescript
// lib/validations/ticket.ts
import { z } from 'zod';

export const titleSchema = z
  .string()
  .trim()
  .min(1, { message: "Title cannot be empty" })
  .max(100, { message: "Title must be 100 characters or less" });
```

**Rules**:
- ✅ Required (minimum 1 character after trimming)
- ✅ Maximum 100 characters
- ✅ Whitespace-only values rejected
- ✅ Trimmed before validation

**Error Messages**:
- Empty: "Title cannot be empty"
- Too long: "Title must be 100 characters or less"

### Description Validation
```typescript
// lib/validations/ticket.ts
export const descriptionSchema = z
  .string()
  .trim()
  .min(1, { message: "Description cannot be empty" })
  .max(1000, { message: "Description must be 1000 characters or less" });
```

**Rules**:
- ✅ Required (minimum 1 character after trimming)
- ✅ Maximum 1000 characters
- ✅ Whitespace-only values rejected
- ✅ Trimmed before validation

**Warning Threshold**:
- Display warning indicator when length > 900 characters (90% of max)

**Error Messages**:
- Empty: "Description cannot be empty"
- Too long: "Description must be 1000 characters or less"

### Version Validation
```typescript
// lib/validations/ticket.ts
export const versionSchema = z
  .number()
  .int({ message: "Version must be an integer" })
  .positive({ message: "Version must be positive" });
```

**Rules**:
- ✅ Must be a positive integer
- ✅ Used for optimistic concurrency control
- ✅ Automatically incremented on successful update

---

## PATCH Request Schema

### Request Body
```typescript
// lib/validations/ticket.ts
export const patchTicketSchema = z.object({
  title: titleSchema.optional(),
  description: descriptionSchema.optional(),
  version: versionSchema,
}).refine(
  (data) => data.title !== undefined || data.description !== undefined,
  { message: "At least one field (title or description) must be provided" }
);

export type PatchTicketInput = z.infer<typeof patchTicketSchema>;
```

**Fields**:
- `title` (optional): New title value (validated if present)
- `description` (optional): New description value (validated if present)
- `version` (required): Current version number for optimistic locking

**Constraints**:
- At least one of `title` or `description` must be provided
- Version must match current database value for update to succeed

### Response Schema
```typescript
// lib/validations/ticket.ts
export const ticketResponseSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  stage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TicketResponse = z.infer<typeof ticketResponseSchema>;
```

**Success Response (200 OK)**:
```json
{
  "id": 123,
  "title": "Updated title",
  "description": "Updated description",
  "stage": "INBOX",
  "version": 2,
  "createdAt": "2025-10-02T10:00:00.000Z",
  "updatedAt": "2025-10-02T10:05:00.000Z"
}
```

---

## Error Responses

### 400 Bad Request (Validation Error)
```json
{
  "error": "Validation failed",
  "issues": [
    {
      "path": ["title"],
      "message": "Title must be 100 characters or less"
    }
  ]
}
```

**Triggers**:
- Title or description exceeds max length
- Empty or whitespace-only values
- Invalid version number
- Neither title nor description provided

### 404 Not Found
```json
{
  "error": "Ticket not found"
}
```

**Triggers**:
- Ticket with specified ID does not exist

### 409 Conflict (Concurrent Modification)
```json
{
  "error": "Conflict: Ticket was modified by another user",
  "currentVersion": 3
}
```

**Triggers**:
- Version mismatch (concurrent edit detected)
- Prisma update returns `null` (WHERE clause not matched)

### 500 Internal Server Error
```json
{
  "error": "Failed to update ticket"
}
```

**Triggers**:
- Database connection failure
- Unexpected server error

---

## State Transitions

### Version Increment Flow
```
Initial State:
  version = 1

User A reads ticket (version 1)
  → Opens modal, sees title and description

User A edits title
  → Local state updated (optimistic)
  → PATCH request sent with version = 1

Server processes:
  → Validates input
  → WHERE id = X AND version = 1
  → UPDATE title, version = version + 1
  → Returns updated ticket with version = 2

User A receives response:
  → Local state confirmed
  → Toast: "Ticket updated"
  → Board refreshes
```

### Conflict Detection Flow
```
Initial State:
  version = 1

User A reads ticket (version 1)
User B reads ticket (version 1)

User B saves first:
  → PATCH with version = 1
  → Database updates: version = 2
  → User B succeeds

User A saves second:
  → PATCH with version = 1
  → Database check: WHERE id = X AND version = 1
  → No rows matched (current version is 2)
  → Prisma returns null
  → Server returns 409 Conflict

User A receives 409:
  → Rollback optimistic update
  → Toast: "Conflict: Ticket was modified by another user"
  → Suggest refresh
```

---

## TypeScript Interfaces

### Client-Side Types
```typescript
// types/ticket.ts
export interface Ticket {
  id: number;
  title: string;
  description: string;
  stage: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PatchTicketPayload {
  title?: string;
  description?: string;
  version: number;
}

export interface TicketEditState {
  isEditingTitle: boolean;
  isEditingDescription: boolean;
  titleValue: string;
  descriptionValue: string;
  isSaving: boolean;
  error: string | null;
}
```

---

## Database Migration

### Required Changes
**None.** The existing Ticket model already supports all required fields:
- `title` VARCHAR(100) ✅
- `description` VARCHAR(1000) ✅
- `version` Int ✅

### Verification
Run `prisma studio` to verify schema:
```bash
npx prisma studio
# Navigate to Ticket model
# Verify fields: id, title, description, stage, version, createdAt, updatedAt
```

---

## Indexing Strategy

### Existing Indexes (Sufficient)
```prisma
@@index([stage])      // Supports board queries by stage
@@index([updatedAt])  // Supports sorting by recency
```

**No new indexes required** for inline editing feature.

### Query Performance
```sql
-- PATCH query (uses primary key)
UPDATE Ticket
SET title = ?, description = ?, version = version + 1
WHERE id = ? AND version = ?;
-- Performance: O(1) lookup via primary key index
```

---

## Summary

### Design Decisions
- ✅ **No schema changes**: Existing Ticket model fully supports feature
- ✅ **Optimistic locking**: Version field prevents lost updates
- ✅ **Client-side validation**: Zod schemas enforce constraints
- ✅ **Server-side validation**: Re-validate all inputs (defense in depth)
- ✅ **Database constraints**: VARCHAR limits enforced at schema level

### Constitutional Compliance
- ✅ **TypeScript-First**: All schemas and types explicitly defined
- ✅ **Security-First**: Input validation via Zod, parameterized queries via Prisma
- ✅ **Database Integrity**: Version-based concurrency, no schema changes needed

**Ready for**: Contract generation and quickstart test creation (Phase 1 continuation).
