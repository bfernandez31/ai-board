# Data Model: Jira-Style Ticket Numbering System

**Feature**: 077-935-jira-style
**Date**: 2025-10-31
**Status**: Design Phase

## Overview

This document defines the database schema changes required to implement Jira-style ticket numbering. The design preserves backward compatibility by retaining internal numeric IDs while adding project-scoped numbering fields.

## Schema Changes

### Project Model

**New Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `key` | `String` | `@db.VarChar(6)`, `NOT NULL`, `@unique` | Unique 3-6 character project identifier (e.g., "ABC", "MOB", "MOBILE", "BACKEND") |

**Indexes**:
- Unique index on `key` (automatically created by `@unique`)
- Additional B-tree index for query optimization

**Validation Rules**:
- Length: 3-6 characters (minimum 3, maximum 6)
- Format: Uppercase alphanumeric only (`[A-Z0-9]{3,6}`)
- Uniqueness: Enforced at database level
- Immutability: Cannot be changed after project creation (application-level enforcement)

**Prisma Schema Update**:
```prisma
model Project {
  id                  Int                 @id @default(autoincrement())
  name                String              @db.VarChar(100)
  description         String              @db.VarChar(1000)
  githubOwner         String              @db.VarChar(100)
  githubRepo          String              @db.VarChar(100)
  userId              String
  deploymentUrl       String?             @db.VarChar(500)
  key                 String              @db.VarChar(6) @unique  // NEW (3-6 characters)
  createdAt           DateTime            @default(now())
  updatedAt           DateTime
  clarificationPolicy ClarificationPolicy @default(AUTO)
  user                User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  tickets             Ticket[]
  members             ProjectMember[]

  @@unique([githubOwner, githubRepo])
  @@index([githubOwner, githubRepo])
  @@index([userId])
  @@index([key])  // NEW: Performance index
}
```

---

### Ticket Model

**New Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `ticketNumber` | `Int` | `NOT NULL` | Sequential number within project (1, 2, 3, ...) |
| `ticketKey` | `String` | `@db.VarChar(20)`, `NOT NULL`, `@unique` | Composite identifier: `{PROJECT_KEY}-{TICKET_NUMBER}` (e.g., "ABC-123") |

**Existing Fields** (unchanged):
- `id`: Internal auto-increment ID preserved for foreign key relationships
- All other fields remain the same

**Indexes**:
- Unique index on `ticketKey` (primary lookup path)
- Unique composite index on `(projectId, ticketNumber)` (data integrity)
- Existing indexes on `id`, `projectId`, `stage`, etc. remain unchanged

**Validation Rules**:
- `ticketNumber`: Positive integer, unique per project
- `ticketKey`: Format `{KEY}-{NUM}` where KEY is 3 uppercase alphanumeric chars and NUM is positive integer
- `ticketKey` globally unique across all projects
- `(projectId, ticketNumber)` combination unique

**Prisma Schema Update**:
```prisma
model Ticket {
  id                  Int                  @id @default(autoincrement())
  title               String               @db.VarChar(100)
  description         String               @db.VarChar(2500)
  stage               Stage                @default(INBOX)
  version             Int                  @default(1)
  projectId           Int
  ticketNumber        Int                  // NEW
  ticketKey           String               @db.VarChar(20) @unique  // NEW
  branch              String?              @db.VarChar(200)
  autoMode            Boolean              @default(false)
  workflowType        WorkflowType         @default(FULL)
  attachments         Json?                @default("[]")
  createdAt           DateTime             @default(now())
  updatedAt           DateTime
  clarificationPolicy ClarificationPolicy?
  comments            Comment[]
  jobs                Job[]
  project             Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, ticketNumber])  // NEW: Enforce unique numbering per project
  @@index([projectId])
  @@index([stage])
  @@index([updatedAt])
  @@index([projectId, workflowType])
  @@index([ticketKey])  // NEW: Performance index for key lookups
}
```

---

## Database Functions

### Ticket Number Generation Function

**Purpose**: Thread-safe generation of sequential ticket numbers per project

**Implementation**:
```sql
CREATE OR REPLACE FUNCTION get_next_ticket_number(project_id INT)
RETURNS INT AS $$
DECLARE
  seq_name TEXT;
  next_num INT;
BEGIN
  -- Construct sequence name based on project ID
  seq_name := 'ticket_seq_project_' || project_id;

  -- Create sequence if it doesn't exist (idempotent)
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START WITH 1', seq_name);

  -- Get next value from sequence
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_num;

  RETURN next_num;
END;
$$ LANGUAGE plpgsql;
```

**Usage in Application**:
```typescript
// In ticket creation API route
const ticketNumber = await prisma.$queryRaw<{ get_next_ticket_number: number }[]>`
  SELECT get_next_ticket_number(${projectId}) as get_next_ticket_number
`;

const ticket = await prisma.ticket.create({
  data: {
    projectId,
    ticketNumber: ticketNumber[0].get_next_ticket_number,
    ticketKey: `${project.key}-${ticketNumber[0].get_next_ticket_number}`,
    // ... other fields
  },
});
```

**Thread-Safety Guarantee**:
- PostgreSQL sequences use atomic operations (non-transactional)
- Multiple concurrent calls to `nextval()` will never return duplicate values
- No application-level locking required

**Sequence Lifecycle**:
- Sequences created on-demand (first ticket in project)
- Sequences persist across database restarts
- Sequences not deleted when projects deleted (gaps acceptable)

---

## Relationships

**No changes to existing relationships**:
- `Ticket.id` remains the foreign key target for `Comment` and `Job` models
- `Project` to `Ticket` one-to-many relationship unchanged
- All cascade delete behaviors preserved

**Why Preserve Internal IDs**:
- Avoids breaking foreign key constraints
- No migration complexity for related tables
- Internal IDs remain stable regardless of user-facing key changes

---

## Migration Strategy

### Phase 1: Schema Changes (Non-Breaking)

```sql
-- Add new columns as nullable initially
ALTER TABLE "Project" ADD COLUMN "key" VARCHAR(6);  -- 3-6 characters
ALTER TABLE "Ticket" ADD COLUMN "ticketNumber" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN "ticketKey" VARCHAR(20);
```

### Phase 2: Data Population

```sql
-- Populate project keys (application logic or manual assignment)
-- Example: Generate from name
UPDATE "Project" SET "key" = UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z0-9]', '', 'g'), 3));

-- Handle collisions manually or with application logic

-- Populate ticket numbers using window function
WITH numbered_tickets AS (
  SELECT
    id,
    projectId,
    ROW_NUMBER() OVER (PARTITION BY projectId ORDER BY createdAt, id) AS ticket_num
  FROM "Ticket"
)
UPDATE "Ticket" t
SET "ticketNumber" = nt.ticket_num
FROM numbered_tickets nt
WHERE t.id = nt.id;

-- Populate ticket keys
UPDATE "Ticket" t
SET "ticketKey" = p.key || '-' || t."ticketNumber"
FROM "Project" p
WHERE t.projectId = p.id;
```

### Phase 3: Constraints and Indexes

```sql
-- Make columns NOT NULL
ALTER TABLE "Project" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "ticketNumber" SET NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "ticketKey" SET NOT NULL;

-- Add unique constraints
ALTER TABLE "Project" ADD CONSTRAINT "Project_key_key" UNIQUE ("key");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketKey_key" UNIQUE ("ticketKey");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_projectId_ticketNumber_key" UNIQUE ("projectId", "ticketNumber");

-- Create indexes
CREATE INDEX "Project_key_idx" ON "Project"("key");
CREATE INDEX "Ticket_ticketKey_idx" ON "Ticket"("ticketKey");
```

### Phase 4: Initialize Sequences

```sql
-- Create sequences with current max values
DO $$
DECLARE
  project RECORD;
  seq_name TEXT;
  max_num INT;
BEGIN
  FOR project IN SELECT id FROM "Project" LOOP
    seq_name := 'ticket_seq_project_' || project.id;

    -- Get max ticket number for this project
    SELECT COALESCE(MAX("ticketNumber"), 0) INTO max_num
    FROM "Ticket"
    WHERE "projectId" = project.id;

    -- Create sequence starting at max + 1
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START WITH %s', seq_name, max_num + 1);
  END LOOP;
END $$;
```

**Migration Characteristics**:
- **Atomic**: Entire migration wrapped in single transaction
- **Downtime**: Application must be stopped during migration
- **Reversible**: Rollback removes new columns (data loss for newly created tickets)
- **Duration**: ~1-2 seconds per 1000 tickets (depends on dataset size)

---

## Validation Rules (Zod Schemas)

### Project Key Schema

```typescript
import { z } from 'zod';

export const projectKeySchema = z
  .string()
  .min(3, 'Project key must be at least 3 characters')
  .max(6, 'Project key must be at most 6 characters')
  .regex(/^[A-Z0-9]{3,6}$/, 'Project key must be 3-6 uppercase alphanumeric characters (A-Z, 0-9)')
  .transform((val) => val.toUpperCase());

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  githubOwner: z.string().min(1).max(100),
  githubRepo: z.string().min(1).max(100),
  key: projectKeySchema.optional(), // Optional: auto-generate if not provided
  // ... other fields
});
```

### Ticket Key Schema

```typescript
export const ticketKeySchema = z
  .string()
  .regex(
    /^[A-Z0-9]{3}-\d+$/,
    'Ticket key must be in format KEY-NUM (e.g., ABC-123)'
  );

export const ticketResponseSchema = z.object({
  id: z.number(),
  ticketNumber: z.number().positive(),
  ticketKey: ticketKeySchema,
  title: z.string(),
  description: z.string(),
  // ... other fields
});
```

---

## Query Patterns

### Lookup by Ticket Key (Primary Path)

```typescript
// GET /ticket/:key
const ticket = await prisma.ticket.findUnique({
  where: { ticketKey: 'ABC-123' },
  include: { project: true },
});
```

**Performance**: O(1) with B-tree index, expected <50ms p95

### Lookup by Internal ID (Backward Compatibility)

```typescript
// GET /api/projects/:projectId/tickets/:id
const ticket = await prisma.ticket.findUnique({
  where: { id: 42 },
});
```

**Performance**: O(1) with primary key index, expected <20ms p95

### List Tickets by Project

```typescript
// GET /api/projects/:projectId/tickets
const tickets = await prisma.ticket.findMany({
  where: { projectId: 1 },
  orderBy: { ticketNumber: 'asc' }, // Ordered by project-scoped number
  select: { ticketKey: true, title: true, stage: true },
});
```

**Performance**: O(n) with projectId index, expected <100ms p95 for 1000 tickets

---

## State Transitions

**No Changes**: Ticket stage transitions remain unchanged. New fields do not affect workflow.

**Invariants**:
- `ticketKey` immutable after ticket creation
- `ticketNumber` immutable after ticket creation
- `project.key` immutable after project creation

---

## Error Cases

### Ticket Creation Errors

| Error Condition | HTTP Status | Error Message | Handling |
|-----------------|-------------|---------------|----------|
| Invalid project key format | 400 | "Project key must be 3 uppercase alphanumeric characters" | Client validation + server validation |
| Duplicate project key | 409 | "Project key already exists" | Unique constraint violation, suggest alternative |
| Sequence function failure | 500 | "Failed to generate ticket number" | Retry logic, log error |
| Duplicate ticket key | 500 | "Ticket key collision detected" | Should never occur due to sequence, log critical error |

### Lookup Errors

| Error Condition | HTTP Status | Error Message | Handling |
|-----------------|-------------|---------------|----------|
| Ticket key not found | 404 | "Ticket not found" | Return empty result |
| Invalid ticket key format | 400 | "Invalid ticket key format (expected KEY-NUM)" | Client validation |
| Unauthorized access | 403 | "Forbidden" | Project ownership check |

---

## Rollback Plan

**If Migration Fails**:
1. Restore database from backup
2. Revert schema changes
3. Restart application

**If Issues Discovered Post-Migration**:
1. Create new migration to remove new columns
2. Data loss: Tickets created after migration lose `ticketKey` (fallback to `id`)
3. Revert API changes to use `id` exclusively

**Rollback SQL**:
```sql
BEGIN;

-- Drop constraints
ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_ticketKey_key";
ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_projectId_ticketNumber_key";
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_key_key";

-- Drop indexes
DROP INDEX IF EXISTS "Project_key_idx";
DROP INDEX IF EXISTS "Ticket_ticketKey_idx";

-- Drop columns
ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "ticketKey";
ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "ticketNumber";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "key";

-- Drop sequences (optional, for cleanup)
-- Note: This requires dynamic SQL to drop all project sequences
-- Omitted for brevity, can be added if needed

COMMIT;
```

---

## Future Considerations

**Potential Enhancements** (out of scope for this feature):

1. **Project Key Renaming**: Allow changing project key with cascade update to ticket keys
   - Complexity: Update all ticket keys atomically
   - Trade-off: Breaks URL stability

2. **Ticket Key Aliases**: Support multiple keys per ticket (e.g., during project merge)
   - Complexity: Additional `TicketKeyAlias` table
   - Benefit: Flexible ticket references

3. **Custom Numbering Schemes**: Allow non-sequential numbering (e.g., by year)
   - Complexity: Configurable sequence logic
   - Benefit: Organizational preferences

4. **Archived Ticket Numbers**: Reuse numbers from deleted tickets
   - Complexity: Reclaim gaps in sequences
   - Benefit: Cleaner numbering
   - Risk: User confusion (deleted ticket #5, new ticket #5)
