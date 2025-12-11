# Data Model: Duplicate a Ticket

**Date**: 2025-12-11
**Feature**: AIB-105-duplicate-a-ticket

## Entity Summary

**No new entities required.** This feature uses existing entities from the Prisma schema.

## Existing Entities Used

### Ticket (source and target)

The duplicate operation reads from a source ticket and creates a new target ticket.

| Field | Type | Copied | Notes |
|-------|------|--------|-------|
| id | Int | ❌ | Auto-generated for new ticket |
| title | String(100) | ✅ | Prefixed with "Copy of ", truncated if needed |
| description | String(2500) | ✅ | Exact copy |
| stage | Stage | ❌ | Always set to `INBOX` |
| version | Int | ❌ | Starts at 1 |
| projectId | Int | ✅ | Same project as source |
| ticketNumber | Int | ❌ | Auto-generated via sequence |
| ticketKey | String | ❌ | Generated from project key + ticketNumber |
| branch | String | ❌ | Set to null (new ticket has no branch) |
| previewUrl | String | ❌ | Set to null |
| autoMode | Boolean | ❌ | Set to false (default) |
| workflowType | WorkflowType | ❌ | Set to FULL (default) |
| attachments | Json | ✅ | Same references copied |
| clarificationPolicy | ClarificationPolicy | ✅ | Same value or null |
| createdAt | DateTime | ❌ | Auto-set to now |
| updatedAt | DateTime | ❌ | Auto-set to now |

### TicketAttachment (JSON structure within Ticket.attachments)

```typescript
interface TicketAttachment {
  type: 'uploaded' | 'external';
  url: string;                    // Cloudinary URL or external URL
  filename: string;               // Original or descriptive filename
  mimeType: string;               // e.g., 'image/png'
  sizeBytes: number;              // File size (0 for external)
  uploadedAt: string;             // ISO datetime string
  cloudinaryPublicId?: string;    // Only for uploaded images
}
```

**Copy Behavior**: The entire `attachments` JSON array is copied as-is. URLs reference the same Cloudinary assets.

## State Transitions

No state machine changes. The duplicate operation:
1. Reads source ticket (any stage)
2. Creates new ticket (always in INBOX)

```
Source Ticket (any stage) --duplicate--> New Ticket (INBOX)
```

## Validation Rules

From existing `CreateTicketSchema` and `lib/validations/ticket.ts`:

| Field | Rule | Applied During Duplicate |
|-------|------|-------------------------|
| title | 1-100 chars, alphanumeric + special chars | ✅ Title truncation ensures compliance |
| description | 1-2500 chars | ✅ Direct copy always valid |
| clarificationPolicy | ClarificationPolicy enum or null | ✅ Direct copy always valid |
| attachments | Max 5 items, valid TicketAttachment[] | ✅ Direct copy always valid |

## Database Operations

### Read Operation (source ticket)

```sql
SELECT id, title, description, clarificationPolicy, attachments, projectId
FROM Ticket
WHERE id = :sourceTicketId AND projectId = :projectId
```

### Write Operation (new ticket)

Uses existing `createTicket()` function from `lib/db/tickets.ts`:

```sql
-- Get next ticket number (via sequence)
SELECT nextval('ticket_number_seq_<projectId>')

-- Insert new ticket
INSERT INTO Ticket (
  title,
  description,
  stage,
  projectId,
  ticketNumber,
  ticketKey,
  clarificationPolicy,
  attachments,
  createdAt,
  updatedAt
) VALUES (
  'Copy of <original_title>',
  :sourceDescription,
  'INBOX',
  :projectId,
  :nextTicketNumber,
  '<PROJECT_KEY>-<ticketNumber>',
  :sourceClarificationPolicy,
  :sourceAttachments,
  NOW(),
  NOW()
)
```

## Relationships

No new relationships. Duplicate ticket:
- Belongs to same Project as source
- Has no Jobs initially
- Has no Comments initially
- Has no Notifications initially

## Indexes

No new indexes required. Existing indexes sufficient:
- `@@index([projectId])` - for fetching source ticket
- `@@index([ticketKey])` - for unique ticket key generation
