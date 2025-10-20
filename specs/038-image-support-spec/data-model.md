# Data Model: Image Attachments for Tickets

**Feature**: Image Attachments for Tickets
**Date**: 2025-10-20
**Database**: PostgreSQL 14+ via Prisma 6.x ORM

## Overview

This document defines the data model extensions required for image attachment functionality. The implementation uses a JSON field on the existing Ticket model to store attachment metadata, while actual image files are stored in the GitHub repository.

## Entity Definitions

### TicketAttachment (Embedded Type)

**Purpose**: Represents metadata for a single image attachment (uploaded file or external URL)

**Storage**: Embedded in Ticket.attachments JSON field (not a separate table)

**TypeScript Interface**:
```typescript
interface TicketAttachment {
  type: 'uploaded' | 'external';
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string; // ISO 8601 timestamp
}
```

**Field Definitions**:

| Field | Type | Required | Description | Validation Rules |
|-------|------|----------|-------------|------------------|
| `type` | Enum | Yes | Attachment source | Must be "uploaded" or "external" |
| `url` | String | Yes | GitHub path or external URL | Max 500 chars, valid URL format |
| `filename` | String | Yes | Original filename or alt text | Max 200 chars, no path separators |
| `mimeType` | String | Yes | MIME type of image | Must be image/* (validated against allowlist) |
| `sizeBytes` | Integer | Yes | File size in bytes | Range: 0 - 10485760 (10MB) |
| `uploadedAt` | String | Yes | Upload timestamp | ISO 8601 format (e.g., "2025-10-20T14:30:00.000Z") |

**Examples**:

Uploaded image:
```json
{
  "type": "uploaded",
  "url": "ticket-assets/123/mockup-dashboard.png",
  "filename": "mockup-dashboard.png",
  "mimeType": "image/png",
  "sizeBytes": 2457600,
  "uploadedAt": "2025-10-20T14:30:00.000Z"
}
```

External URL:
```json
{
  "type": "external",
  "url": "https://figma.com/file/abc123/design.png",
  "filename": "Figma design mockup",
  "mimeType": "image/png",
  "sizeBytes": 0,
  "uploadedAt": "2025-10-20T14:30:00.000Z"
}
```

### Ticket (Modified Entity)

**Existing Model**: Already defined in `prisma/schema.prisma`

**New Field**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `attachments` | Json | No | `[]` | Array of TicketAttachment objects |

**Prisma Schema Change**:
```prisma
model Ticket {
  // ... existing fields (id, title, description, stage, etc.)

  attachments Json?    @default("[]")  // NEW: JSON array of attachment metadata

  // ... existing relations (project, jobs, etc.)
}
```

**Constraints**:
- JSON structure validated by Zod schema at application level
- Max 5 attachments per ticket (application-level validation)
- Total attachments JSON size should not exceed 5KB (5 attachments * ~1KB metadata each)

**Migration SQL**:
```sql
-- Add attachments column to Ticket table
ALTER TABLE "Ticket" ADD COLUMN "attachments" JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN "Ticket"."attachments" IS 'JSON array of TicketAttachment objects (max 5 items)';
```

## Validation Rules

### TicketAttachment Schema (Zod)

```typescript
import { z } from 'zod';

export const TicketAttachmentSchema = z.object({
  type: z.enum(['uploaded', 'external']),
  url: z.string().url().max(500),
  filename: z.string().min(1).max(200),
  mimeType: z.string().regex(/^image\/(jpeg|png|gif|webp|svg\+xml)$/),
  sizeBytes: z.number().int().min(0).max(10485760), // 10MB
  uploadedAt: z.string().datetime(), // ISO 8601
});

export const TicketAttachmentsArraySchema = z
  .array(TicketAttachmentSchema)
  .max(5, 'Maximum 5 images per ticket');

export type TicketAttachment = z.infer<typeof TicketAttachmentSchema>;
```

### Validation Flow

1. **Client Upload**:
   - Validate file size ≤10MB before upload
   - Validate file type matches allowlist (JPEG, PNG, GIF, WebP, SVG)
   - Validate max 5 files before submission

2. **Server Processing** (`POST /api/projects/[projectId]/tickets`):
   - Parse multipart form data with `formidable`
   - Validate each file:
     - MIME type check (from Content-Type header)
     - Magic byte signature verification (file-type library)
     - Size validation ≤10MB
   - Extract markdown image URLs from description:
     - Regex match `![alt](url)` patterns
     - Validate URLs are absolute HTTPS
   - Create TicketAttachment objects:
     - Uploaded files: commit to GitHub, store relative path
     - External URLs: store URL directly
   - Validate final attachments array:
     - Total count ≤5
     - Each attachment passes TicketAttachmentSchema
   - Store attachments JSON in Ticket.attachments field

3. **Read Operations**:
   - Retrieve ticket from database
   - Parse `attachments` JSON field
   - Validate with TicketAttachmentsArraySchema (defensive programming)
   - Type cast to `TicketAttachment[]` for TypeScript safety

## State Transitions

### Attachment Lifecycle

```
[User Selects Files]
        ↓
[Client Validation] (size, type, count)
        ↓
[POST /api/projects/[id]/tickets]
        ↓
[Server Validation] (MIME + magic bytes)
        ↓
[GitHub Commit] → ticket-assets/[id]/[filename]
        ↓
[Database Insert] → Ticket.attachments JSON
        ↓
[INBOX Stage]
        ↓
[Transition to SPECIFY]
        ↓
[Workflow Downloads External URLs]
        ↓
[Claude Receives imageContext]
        ↓
[Workflow Moves Images] → specs/[branch]/assets/
        ↓
[Cleanup] → Delete ticket-assets/[id]/
        ↓
[SPECIFY Stage Complete]
```

### Error Scenarios

**GitHub Commit Fails**:
- Do not insert ticket into database
- Return error to user: "Failed to upload images to repository"
- User must retry upload

**Database Insert Fails** (after successful GitHub commit):
- Execute compensating transaction:
  - Delete committed images from GitHub (`ticket-assets/[id]/`)
  - Log error with context (user ID, image paths)
- Return error to user: "Failed to create ticket"
- User must retry creation

**External URL Download Fails** (during specify workflow):
- Log warning in GitHub Actions
- Continue workflow with remaining images
- Claude receives URL in `imageContext` but cannot view content

**Image Move Fails** (during specify workflow):
- Images remain in `ticket-assets/[id]/` on main branch
- Feature branch lacks images
- Manual intervention required (support ticket)
- Future retry will detect existing images and skip move

## Relationships

### Ticket → Attachments (Embedded)

- **Cardinality**: 1 Ticket → 0..5 Attachments (embedded JSON)
- **Cascade Behavior**: Delete ticket → attachments deleted (JSON field)
- **Integrity**: Application-level (Zod validation, no database constraint)

### Attachment → GitHub File (External)

- **Cardinality**: 1 Attachment → 0..1 GitHub File (uploaded type only)
- **Storage**: GitHub repository at path specified in `attachment.url`
- **Lifecycle**:
  - Created: When ticket created with uploaded images
  - Moved: During specify workflow (main → feature branch)
  - Deleted: When ticket-assets cleanup occurs (main branch only)
  - Retained: On feature branch even if ticket deleted (audit trail)

## Indexes

No new database indexes required. Ticket table already has indexes on:
- `id` (primary key)
- `projectId` (foreign key, existing)
- `stage` (existing)

JSON field queries are rare (attachments retrieved with full ticket), so no GIN index needed.

## Migration Strategy

### Step 1: Create Migration

```bash
npx prisma migrate dev --name add_ticket_attachments
```

This generates:
- `prisma/migrations/[timestamp]_add_ticket_attachments/migration.sql`
- Updates `prisma/schema.prisma`

### Step 2: Apply to Development Database

```bash
npx prisma migrate dev
```

### Step 3: Verify Schema

```bash
npx prisma studio
```

Check Ticket table has `attachments` column with default `[]`.

### Step 4: Deploy to Production

```bash
npx prisma migrate deploy
```

Runs automatically in Vercel deployment via build command.

### Rollback Plan

If migration fails or needs rollback:

```sql
-- Rollback migration
ALTER TABLE "Ticket" DROP COLUMN "attachments";
```

Then mark migration as rolled back:
```bash
npx prisma migrate resolve --rolled-back [timestamp]_add_ticket_attachments
```

## Performance Considerations

**JSON Field Size**:
- 5 attachments * ~1KB metadata each = ~5KB per ticket
- Acceptable overhead for PostgreSQL (JSONB is efficiently stored)
- No impact on existing queries (column is nullable)

**Query Performance**:
- Attachments always retrieved with full ticket (no additional query)
- No joins required (embedded JSON)
- No filtering needed on attachment fields (use ticket filters)

**Storage Growth**:
- GitHub repository size increases with image uploads
- Estimate: 100 tickets/day * 5 images * 5MB avg = 2.5GB/day
- Requires repository size monitoring and cleanup strategy
- Mitigate: Compress images before upload (future enhancement)

## Testing Strategy

**Unit Tests** (`tests/unit/ticket-attachment-schema.test.ts`):
- Validate Zod schema accepts valid attachments
- Validate Zod schema rejects invalid attachments (size, type, count)
- Test edge cases (empty array, null, malformed JSON)

**Integration Tests** (`tests/api/tickets.spec.ts`):
- Test ticket creation with uploaded images
- Test ticket creation with external URL references
- Test validation errors (file too large, too many images)
- Test GitHub commit failure handling (rollback)

**E2E Tests** (`tests/e2e/ticket-creation.spec.ts`):
- Test drag-and-drop image upload flow
- Test clipboard paste flow
- Test markdown URL extraction
- Test image preview display
- Test remove image before submission

## Security Considerations

**Input Validation**:
- Multi-layer validation (MIME type + magic bytes + Zod schema)
- Prevents malicious file uploads (malware, executables disguised as images)
- Prevents path traversal attacks (filename validation)

**Data Integrity**:
- JSON structure validated on every read operation
- Zod schema ensures type safety at runtime
- Prisma JSON type prevents SQL injection

**Access Control**:
- Image upload requires authenticated session (NextAuth)
- Project ownership validated before ticket creation
- GitHub API uses authenticated token (GITHUB_TOKEN env var)

**Sensitive Data**:
- No PII or secrets stored in attachment metadata
- GitHub paths are relative (no absolute paths exposed)
- External URLs visible to users (intentional feature)
