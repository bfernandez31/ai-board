# Data Model

## Documents in This Section

- [Core Models](./core-models.md) — Project, Ticket, Job, User, Token, Subscription, Usage, Credential, and related entities
- [Comparison Models](./comparison-models.md) — Ticket and project comparison entities
- [Health Models](./health-models.md) — Health scan result entities
- [Enums](./enums.md) — Domain and core enums (stage, status, workflow type, etc.)
- [Relationships & Indexes](./relationships-and-indexes.md) — Cross-model relationships diagram and indexing strategy

## Prisma Schema Overview

Complete database schema with relationships, constraints, and indexes.


## TypeScript Types

### Search Types

```typescript
interface SearchResult {
  id: number;
  ticketKey: string;
  title: string;
  stage: Stage;
}

interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
}
```

**Purpose**: Ticket search functionality in header

**Usage**:
- Used by `/api/projects/:projectId/tickets/search` endpoint
- Consumed by `useTicketSearch` hook and `TicketSearch` component
- Results limited to essential fields for performance

**Fields**:
- `id`: Ticket ID for modal navigation
- `ticketKey`: Human-readable identifier (e.g., "ABC-42")
- `title`: Ticket title for display
- `stage`: Current workflow stage
- `totalCount`: Number of results (capped at API limit)

**Validation**:
- Query must be minimum 2 characters
- Limit defaults to 10, maximum 50
- Results ordered by relevance (key > title > description)

## Data Types

### JSON Fields

**Ticket.attachments**:
```typescript
interface TicketAttachment {
  type: 'uploaded' | 'external';
  url: string;                   // Cloudinary HTTPS URL
  filename: string;              // Original filename
  mimeType: string;              // image/jpeg, image/png, etc.
  sizeBytes: number;             // File size
  uploadedAt: string;            // ISO 8601 timestamp
  cloudinaryPublicId?: string;   // For deletion
}

type Attachments = TicketAttachment[];  // Max 5 items
```

### String Length Constraints

| Field | Max Length | Database Type |
|-------|------------|---------------|
| Ticket.title | 100 | VARCHAR(100) |
| Ticket.description | 10000 | TEXT |
| Ticket.branch | 200 | VARCHAR(200) |
| Job.command | 50 | VARCHAR(50) |
| Job.branch | 200 | VARCHAR(200) |
| Job.commitSha | 40 | VARCHAR(40) |
| Job.logs | Unlimited | TEXT |
| Job.model | 50 | VARCHAR(50) |
| Project.specifyModel | 50 | VARCHAR(50) |
| Project.planModel | 50 | VARCHAR(50) |
| Project.implementModel | 50 | VARCHAR(50) |
| Project.quickImplModel | 50 | VARCHAR(50) |
| Project.verifyModel | 50 | VARCHAR(50) |
| Ticket.specifyModel | 50 | VARCHAR(50) |
| Ticket.planModel | 50 | VARCHAR(50) |
| Ticket.implementModel | 50 | VARCHAR(50) |
| Ticket.quickImplModel | 50 | VARCHAR(50) |
| Ticket.verifyModel | 50 | VARCHAR(50) |
| Comment.content | 2000 | TEXT |

### Character Validation

**Ticket.title**:
- Allowed: letters (a-z, A-Z), numbers (0-9), spaces, basic punctuation (`. , ? ! - : ; ' " ( ) [ ] { } / \ @ # $ % & * + = _ ~ \` |`)
- Rejected: Emojis, extended Unicode

**Ticket.description**:
- Allowed: All UTF-8 characters (including emojis, Chinese, Arabic, Japanese, etc.)
- No restrictions on character sets

**Comment.content**:
- Allowed: All printable UTF-8 characters
- Markdown formatting supported

## Migration Strategy

### Version Control
- All schema changes tracked in `prisma/migrations/`
- Migration naming: `{timestamp}_{description}/migration.sql`
- Applied via `npx prisma migrate deploy` in workflows

### Backward Compatibility
- Additive changes preferred (new columns nullable or with defaults)
- Enum additions supported (no removals)
- Indexes added without downtime (PostgreSQL supports concurrent index creation)

### Test Data
- Seed script: `prisma/seed.ts`
- Reserved projects: 1-2 for tests, 3 for development
- Test user: `test@e2e.local` (never deleted)
