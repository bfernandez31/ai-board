# Quickstart: Add required projectId foreign key to Ticket model

**Feature**: 010-add-required-projectid
**Branch**: `010-add-required-projectid`
**Date**: 2025-10-03

## Prerequisites

- Node.js 22.20.0 LTS installed
- PostgreSQL 14+ running locally
- Database connection configured in `.env`

## Quick Validation Steps

### 1. Verify Schema Changes

```bash
# View the Prisma schema
cat prisma/schema.prisma | grep -A 15 "model Ticket"
```

**Expected Output**:
```prisma
model Ticket {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(100)
  description String   @db.VarChar(1000)
  stage       Stage    @default(INBOX)
  version     Int      @default(1)
  projectId   Int                                                    # ← NEW
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)  # ← NEW
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([stage])
  @@index([updatedAt])
  @@index([projectId])                                              # ← NEW
}
```

### 2. Reset Database and Run Migration

```bash
# Reset database (drops all data, recreates schema)
npx prisma migrate reset --skip-seed

# Should create new migration with projectId field
# Confirm migration when prompted
```

**Expected Output**:
```
✔ Applying migration ...
Database reset successful
```

### 3. Verify Seed Script

```bash
# Check seed creates project BEFORE tickets
cat prisma/seed.ts | grep -A 5 "project.create"
```

**Expected Pattern**:
```typescript
// Project created first
const defaultProject = await prisma.project.create({ ... });

// Tickets reference project
await prisma.ticket.create({
  data: { ..., projectId: defaultProject.id }
});
```

### 4. Run Seed

```bash
# Seed database with default project and tickets
npm run db:seed
```

**Expected Output**:
```
✓ Seeded default project: ai-board
✓ Seeded 6 tickets
```

### 5. Verify Foreign Key Constraint

```bash
# Connect to PostgreSQL and check constraint
psql $DATABASE_URL -c "\d \"Ticket\""
```

**Expected Output** (includes):
```
Foreign-key constraints:
    "Ticket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON DELETE CASCADE

Indexes:
    "Ticket_projectId_idx" btree ("projectId")
```

### 6. Test Required Field Validation

```bash
# Run Prisma Studio to test manually
npx prisma studio
```

**Manual Test**:
1. Open Ticket model
2. Attempt to create ticket without projectId
3. **Expected**: Validation error preventing creation

### 7. Test Cascade Delete

```typescript
// In Prisma REPL or test script:
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Create test project with tickets
const project = await prisma.project.create({
  data: {
    name: 'Test',
    description: 'Test',
    githubOwner: 'test',
    githubRepo: 'test',
    tickets: {
      create: [
        { title: 'T1', description: 'Test', stage: 'INBOX' },
        { title: 'T2', description: 'Test', stage: 'INBOX' }
      ]
    }
  }
});

console.log('Created project:', project.id);

// Verify tickets exist
const before = await prisma.ticket.count({ where: { projectId: project.id } });
console.log('Tickets before delete:', before); // Should be 2

// Delete project (should cascade delete tickets)
await prisma.project.delete({ where: { id: project.id } });

// Verify tickets deleted
const after = await prisma.ticket.count({ where: { projectId: project.id } });
console.log('Tickets after delete:', after); // Should be 0 ✅
```

### 8. Test Project-Scoped Queries

```typescript
// Query tickets for specific project
const tickets = await prisma.ticket.findMany({
  where: { projectId: 1 }
});

console.log('Tickets for project 1:', tickets.length);

// Query project with tickets
const projectWithTickets = await prisma.project.findUnique({
  where: { id: 1 },
  include: { tickets: true }
});

console.log('Project tickets:', projectWithTickets.tickets.length);
```

**Expected**: Queries return only tickets belonging to specified project

### 9. Run E2E Tests

```bash
# Run Playwright tests
npm run test:e2e
```

**Expected**:
- All existing board tests pass
- Tickets displayed belong to default project
- No breaking changes in UI

### 10. Type Check

```bash
# Verify TypeScript compilation
npm run type-check
```

**Expected**:
```
✓ No type errors found
```

## Success Criteria Checklist

- [x] Prisma schema includes `projectId` field on Ticket
- [x] Foreign key constraint exists: `Ticket.projectId` → `Project.id`
- [x] Cascade delete configured (`onDelete: Cascade`)
- [x] Index exists on `Ticket.projectId`
- [x] Seed creates default project BEFORE tickets
- [x] All tickets have valid `projectId` after seed
- [x] Cannot create ticket without `projectId` (validation error)
- [x] Deleting project deletes all associated tickets
- [x] Project-scoped queries filter correctly
- [x] TypeScript compilation passes
- [x] E2E tests pass

## Common Issues & Troubleshooting

### Issue: Migration fails with "column already exists"
**Solution**: Drop and recreate database
```bash
npx prisma migrate reset --force
```

### Issue: Seed fails with "foreign key violation"
**Solution**: Ensure seed creates project BEFORE tickets
```typescript
// Correct order:
const project = await prisma.project.create({ ... });
await prisma.ticket.create({ data: { projectId: project.id, ... } });
```

### Issue: Old tickets without projectId
**Solution**: Database reset clears all data (acceptable for MVP)
```bash
npx prisma migrate reset
npm run db:seed
```

### Issue: TypeScript errors on ticket creation
**Solution**: Add `projectId` to all ticket creation calls
```typescript
// Before: ❌
await prisma.ticket.create({ data: { title: 'Test', description: 'Test' } });

// After: ✅
await prisma.ticket.create({
  data: { title: 'Test', description: 'Test', projectId: 1 }
});
```

## Next Steps

After validating this feature:
1. ✅ Schema foundation complete
2. ➡️ Next feature: Update API routes to accept/filter by projectId
3. ➡️ Future: Update UI to display project context
4. ➡️ Future: Multi-project support (project selector)

## Performance Validation

```sql
-- Verify index is used (run in psql)
EXPLAIN ANALYZE
SELECT * FROM "Ticket" WHERE "projectId" = 1;

-- Expected plan includes:
-- Index Scan using "Ticket_projectId_idx"
```

**Performance Target**: <100ms for project-scoped ticket queries (achieved via index)
