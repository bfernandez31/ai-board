# Quickstart Guide: Jira-Style Ticket Numbering System

**Feature**: 077-935-jira-style
**Audience**: Developers implementing this feature
**Estimated Reading Time**: 10 minutes

## Overview

This guide provides a step-by-step implementation path for the Jira-style ticket numbering system. Follow these steps in order to ensure a smooth rollout.

---

## Prerequisites

Before starting implementation, ensure:

- [ ] Local development environment running (`bun run dev`)
- [ ] PostgreSQL database accessible
- [ ] Prisma CLI installed (`prisma` command available)
- [ ] Access to staging environment for testing migration
- [ ] Database backup strategy in place

---

## Implementation Phases

### Phase 1: Database Schema Changes (Estimated: 2 hours)

#### Step 1.1: Update Prisma Schema

**File**: `prisma/schema.prisma`

Add new fields to `Project` model:

```prisma
model Project {
  // ... existing fields
  key String @db.VarChar(6) @unique  // 3-6 characters
  // ... rest of model

  @@index([key])
}
```

Add new fields to `Ticket` model:

```prisma
model Ticket {
  // ... existing fields
  ticketNumber Int
  ticketKey String @db.VarChar(20) @unique
  // ... rest of model

  @@unique([projectId, ticketNumber])
  @@index([ticketKey])
}
```

#### Step 1.2: Generate Migration

```bash
npx prisma migrate dev --name jira_style_numbering --create-only
```

This creates a migration file in `prisma/migrations/`.

#### Step 1.3: Edit Migration SQL

**File**: `prisma/migrations/YYYYMMDDHHMMSS_jira_style_numbering/migration.sql`

Replace the auto-generated content with the complete migration script:

<details>
<summary>View complete migration SQL (click to expand)</summary>

```sql
-- Jira-Style Ticket Numbering Migration
-- This migration adds project keys and ticket numbering fields

BEGIN;

-- Phase 1: Add columns as nullable
ALTER TABLE "Project" ADD COLUMN "key" VARCHAR(6);  -- 3-6 characters
ALTER TABLE "Ticket" ADD COLUMN "ticketNumber" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN "ticketKey" VARCHAR(20);

-- Phase 2: Create sequence function
CREATE OR REPLACE FUNCTION get_next_ticket_number(project_id INT)
RETURNS INT AS $$
DECLARE
  seq_name TEXT;
  next_num INT;
BEGIN
  seq_name := 'ticket_seq_project_' || project_id;
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START WITH 1', seq_name);
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_num;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- Phase 3: Populate project keys
-- Strategy: Generate from first 3 chars of name, handle collisions
DO $$
DECLARE
  project RECORD;
  base_key TEXT;
  final_key TEXT;
  counter INT;
BEGIN
  FOR project IN SELECT id, name FROM "Project" ORDER BY id LOOP
    -- Generate base key from name
    base_key := UPPER(LEFT(REGEXP_REPLACE(project.name, '[^A-Za-z0-9]', '', 'g'), 3));

    -- Pad if too short
    IF LENGTH(base_key) < 3 THEN
      base_key := RPAD(base_key, 3, 'X');
    END IF;

    -- Handle collisions
    final_key := base_key;
    counter := 1;
    WHILE EXISTS (SELECT 1 FROM "Project" WHERE "key" = final_key) LOOP
      final_key := LEFT(base_key, 2) || counter;
      counter := counter + 1;
    END LOOP;

    -- Assign key
    UPDATE "Project" SET "key" = final_key WHERE id = project.id;
  END LOOP;
END $$;

-- Phase 4: Populate ticket numbers and keys
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

-- Phase 5: Add constraints
ALTER TABLE "Project" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "ticketNumber" SET NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "ticketKey" SET NOT NULL;

ALTER TABLE "Project" ADD CONSTRAINT "Project_key_key" UNIQUE ("key");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketKey_key" UNIQUE ("ticketKey");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_projectId_ticketNumber_key" UNIQUE ("projectId", "ticketNumber");

-- Phase 6: Create indexes
CREATE INDEX "Project_key_idx" ON "Project"("key");
CREATE INDEX "Ticket_ticketKey_idx" ON "Ticket"("ticketKey");

-- Phase 7: Initialize sequences with current max values
DO $$
DECLARE
  project RECORD;
  seq_name TEXT;
  max_num INT;
BEGIN
  FOR project IN SELECT id FROM "Project" LOOP
    seq_name := 'ticket_seq_project_' || project.id;
    SELECT COALESCE(MAX("ticketNumber"), 0) INTO max_num
    FROM "Ticket"
    WHERE "projectId" = project.id;
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START WITH %s', seq_name, max_num + 1);
  END LOOP;
END $$;

COMMIT;
```

</details>

#### Step 1.4: Test Migration on Local Database

```bash
# Backup local database first
pg_dump ai_board_dev > backup_$(date +%Y%m%d).sql

# Run migration
npx prisma migrate dev

# Verify migration succeeded
npx prisma studio
```

**Verification Checklist**:
- [ ] All projects have `key` field populated
- [ ] All tickets have `ticketNumber` field populated
- [ ] All tickets have `ticketKey` field populated (format: `KEY-NUM`)
- [ ] No duplicate ticket keys
- [ ] Sequences created for all projects

---

### Phase 2: API Layer Updates (Estimated: 4 hours)

#### Step 2.1: Update Zod Schemas

**File**: `app/lib/schemas/project.ts`

```typescript
export const projectKeySchema = z
  .string()
  .min(3, 'Project key must be at least 3 characters')
  .max(6, 'Project key must be at most 6 characters')
  .regex(/^[A-Z0-9]{3,6}$/, 'Project key must be 3-6 uppercase alphanumeric characters')
  .transform((val) => val.toUpperCase());

export const projectCreateSchema = z.object({
  // ... existing fields
  key: projectKeySchema.optional(),
});
```

**File**: `app/lib/schemas/ticket.ts`

```typescript
export const ticketKeySchema = z
  .string()
  .regex(/^[A-Z0-9]{3}-\d+$/, 'Invalid ticket key format');

export const ticketResponseSchema = z.object({
  id: z.number(),
  ticketNumber: z.number().positive(),
  ticketKey: ticketKeySchema,
  // ... existing fields
});
```

#### Step 2.2: Create Ticket Sequence Helper

**File**: `app/lib/db/ticket-sequence.ts`

```typescript
import { prisma } from '@/app/lib/db/prisma';

export async function getNextTicketNumber(projectId: number): Promise<number> {
  const result = await prisma.$queryRaw<{ get_next_ticket_number: number }[]>`
    SELECT get_next_ticket_number(${projectId}) as get_next_ticket_number
  `;

  if (!result || result.length === 0) {
    throw new Error('Failed to generate ticket number');
  }

  return result[0].get_next_ticket_number;
}
```

#### Step 2.3: Update Ticket Creation Endpoint

**File**: `app/api/projects/[projectId]/tickets/route.ts`

```typescript
import { getNextTicketNumber } from '@/app/lib/db/ticket-sequence';

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  // ... existing auth and validation

  const projectId = parseInt(params.projectId);

  // Fetch project to get key
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { key: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Generate ticket number
  const ticketNumber = await getNextTicketNumber(projectId);
  const ticketKey = `${project.key}-${ticketNumber}`;

  // Create ticket
  const ticket = await prisma.ticket.create({
    data: {
      ...validatedData,
      projectId,
      ticketNumber,
      ticketKey,
    },
  });

  return NextResponse.json(ticket, { status: 201 });
}
```

#### Step 2.4: Create Browse Endpoint

**File**: `app/api/ticket/[key]/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db/prisma';
import { getServerSession } from 'next-auth';
import { ticketKeySchema } from '@/app/lib/schemas/ticket';

export async function GET(request: Request, { params }: { params: { key: string } }) {
  // Validate session
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate ticket key format
  const parseResult = ticketKeySchema.safeParse(params.key);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid ticket key format', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  // Fetch ticket with project
  const ticket = await prisma.ticket.findUnique({
    where: { ticketKey: params.key },
    include: { project: true },
  });

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  // Verify user has access (owner or member)
  const hasAccess = await prisma.project.findFirst({
    where: {
      id: ticket.projectId,
      OR: [
        { userId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
  });

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(ticket);
}
```

#### Step 2.5: Update Existing Ticket Endpoint (Support Both ID and Key)

**File**: `app/api/projects/[projectId]/tickets/[id]/route.ts`

```typescript
export async function GET(
  request: Request,
  { params }: { params: { projectId: string; id: string } }
) {
  // ... existing auth

  const projectId = parseInt(params.projectId);
  const identifier = params.id;

  // Detect if identifier is numeric or ticket key
  const isNumericId = /^\d+$/.test(identifier);

  const ticket = isNumericId
    ? await prisma.ticket.findUnique({ where: { id: parseInt(identifier) } })
    : await prisma.ticket.findUnique({ where: { ticketKey: identifier } });

  if (!ticket || ticket.projectId !== projectId) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  return NextResponse.json(ticket);
}
```

---

### Phase 3: Frontend Updates (Estimated: 3 hours)

#### Step 3.1: Update Ticket Card Component

**File**: `components/board/ticket-card.tsx`

Change ticket display from ID to ticketKey:

```typescript
// Before:
<div className="text-sm text-gray-500">#{ticket.id}</div>

// After:
<div className="text-sm font-mono text-gray-600">{ticket.ticketKey}</div>
```

#### Step 3.2: Update Ticket Detail Page

**File**: `app/ticket/[key]/page.tsx` (NEW)

```typescript
import { TicketDetail } from '@/components/board/ticket-detail';

export default async function BrowseTicketPage({ params }: { params: { key: string } }) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ticket/${params.key}`, {
    headers: { cookie: request.headers.get('cookie') || '' },
  });

  if (!response.ok) {
    return <div>Ticket not found</div>;
  }

  const ticket = await response.json();

  return <TicketDetail ticket={ticket} />;
}
```

#### Step 3.3: Update Ticket Links

**File**: `components/board/ticket-card.tsx`

Update link href to use ticket key:

```typescript
// Before:
<Link href={`/projects/${projectId}/tickets/${ticket.id}`}>

// After:
<Link href={`/ticket/${ticket.ticketKey}`}>
```

---

### Phase 4: Test Updates (Estimated: 2 hours)

**Per user request**: Only fix existing tests, no new tests added.

#### Step 4.1: Update Ticket Creation Tests

**File**: `tests/e2e/ticket-creation.spec.ts`

Update assertions to expect `ticketNumber` and `ticketKey`:

```typescript
// Before:
expect(ticket.id).toBeDefined();

// After:
expect(ticket.id).toBeDefined();
expect(ticket.ticketNumber).toBe(1); // First ticket in project
expect(ticket.ticketKey).toMatch(/^[A-Z0-9]{3}-1$/);
```

#### Step 4.2: Update Ticket Lookup Tests

**File**: `tests/integration/ticket-lookup.spec.ts`

Add test cases for ticket key lookup:

```typescript
test('should retrieve ticket by ticket key', async () => {
  // Create ticket
  const ticket = await createTicket(request, projectId, {
    title: '[e2e] Test Ticket',
    description: 'Test description',
  });

  // Lookup by key
  const response = await request.get(`/api/ticket/${ticket.ticketKey}`);
  expect(response.status).toBe(200);

  const retrieved = await response.json();
  expect(retrieved.ticketKey).toBe(ticket.ticketKey);
});
```

---

### Phase 5: Deployment (Estimated: 1 hour)

#### Step 5.1: Staging Deployment

1. **Deploy to staging**:
   ```bash
   git push origin feature/077-935-jira-style
   ```

2. **Run migration on staging database**:
   ```bash
   # SSH into staging server or use database client
   psql -h staging-db.example.com -U user -d ai_board_staging

   # Run migration SQL (from migration file)
   \i prisma/migrations/YYYYMMDDHHMMSS_jira_style_numbering/migration.sql
   ```

3. **Verify staging**:
   - [ ] All projects have keys
   - [ ] All tickets have keys
   - [ ] Create new ticket → receives sequential number
   - [ ] Access ticket via `/ticket/KEY-NUM` URL
   - [ ] Old URLs redirect correctly

#### Step 5.2: Production Deployment

**IMPORTANT**: This requires downtime for migration execution.

1. **Schedule maintenance window** (recommended: 30 minutes)

2. **Pre-deployment checklist**:
   - [ ] Backup production database
   - [ ] Test migration on staging (completed)
   - [ ] Notify users of downtime
   - [ ] Prepare rollback plan

3. **Execute production migration**:
   ```bash
   # Stop application
   vercel --prod down

   # Run migration
   psql -h prod-db.example.com -U user -d ai_board_prod
   \i prisma/migrations/YYYYMMDDHHMMSS_jira_style_numbering/migration.sql

   # Deploy code
   git push origin main
   vercel --prod

   # Verify deployment
   curl https://ai-board.vercel.app/api/projects/1/tickets
   ```

4. **Post-deployment verification**:
   - [ ] All existing tickets visible with keys
   - [ ] Create new ticket → receives correct sequential number
   - [ ] Browse endpoint works
   - [ ] No errors in logs

---

## Rollback Plan

If issues are discovered post-deployment:

### Step 1: Revert Code

```bash
git revert <commit-hash>
git push origin main
```

### Step 2: Rollback Database (if necessary)

**WARNING**: This will lose data for tickets created after migration.

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

-- Drop function
DROP FUNCTION IF EXISTS get_next_ticket_number(INT);

COMMIT;
```

### Step 3: Restore from Backup (if rollback fails)

```bash
pg_restore -h prod-db.example.com -U user -d ai_board_prod backup_YYYYMMDD.sql
```

---

## Troubleshooting

### Issue: Migration fails with "sequence already exists"

**Solution**: The migration is idempotent. Re-running it should skip existing sequences.

If not, manually drop sequences:

```sql
DROP SEQUENCE IF EXISTS ticket_seq_project_1;
DROP SEQUENCE IF EXISTS ticket_seq_project_2;
-- ... repeat for all projects
```

---

### Issue: Duplicate ticket keys after migration

**Solution**: This indicates a bug in the numbering logic. Investigate and fix:

```sql
-- Find duplicates
SELECT "ticketKey", COUNT(*)
FROM "Ticket"
GROUP BY "ticketKey"
HAVING COUNT(*) > 1;

-- Manually reassign numbers (example for project 1)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY createdAt, id) AS new_num
  FROM "Ticket"
  WHERE projectId = 1
)
UPDATE "Ticket" t
SET "ticketNumber" = n.new_num,
    "ticketKey" = (SELECT key FROM "Project" WHERE id = 1) || '-' || n.new_num
FROM numbered n
WHERE t.id = n.id;
```

---

### Issue: Sequence out of sync (new ticket gets duplicate number)

**Solution**: Reset sequence to max value:

```sql
-- Find max ticket number for project
SELECT MAX("ticketNumber") FROM "Ticket" WHERE projectId = 1;

-- Reset sequence (replace 1 with project ID, 10 with max + 1)
ALTER SEQUENCE ticket_seq_project_1 RESTART WITH 10;
```

---

## Performance Benchmarks

After deployment, verify performance targets:

```bash
# Test ticket creation
curl -X POST https://ai-board.vercel.app/api/projects/1/tickets \
  -H "Content-Type: application/json" \
  -d '{"title": "Benchmark test", "description": "Performance test"}'

# Measure response time (should be <100ms p95)

# Test ticket lookup by key
curl https://ai-board.vercel.app/api/ticket/ABC-123

# Measure response time (should be <50ms p95)
```

---

## Success Criteria

- [ ] All existing tickets migrated with valid ticket keys
- [ ] New tickets receive sequential numbers per project
- [ ] No race conditions in ticket number generation
- [ ] All tests passing (updated for new fields)
- [ ] Performance targets met (<50ms p95 lookup, <100ms p95 creation)
- [ ] Zero critical bugs reported in first week
- [ ] User feedback positive on ticket key usability

---

## Next Steps

After successful deployment:

1. Monitor error logs for any issues
2. Gather user feedback on ticket key UX
3. Consider future enhancements (see `contracts/api-contracts.md` Future API Enhancements)
4. Add comprehensive test coverage (deferred per user request)
5. Document ticket key system in user-facing help documentation

---

## Support

For questions or issues during implementation:

- Review detailed design: `specs/077-935-jira-style/data-model.md`
- Review API contracts: `specs/077-935-jira-style/contracts/api-contracts.md`
- Review research: `specs/077-935-jira-style/research.md`
