# Data Model: Add required projectId foreign key to Ticket model

**Feature**: 010-add-required-projectid
**Date**: 2025-10-03

## Entity Overview

This feature modifies the Ticket entity to establish a required relationship with Project entity.

## Entities

### Ticket (Modified)

**Description**: Represents a work item or task on the board. Every ticket MUST belong to exactly one project.

**Fields**:
- `id`: Integer, auto-increment primary key
- `title`: String (max 100 chars), required
- `description`: String (max 1000 chars), required
- `stage`: Enum (INBOX|SPECIFY|PLAN|BUILD|VERIFY|SHIP), default INBOX
- `version`: Integer, default 1, for optimistic locking
- **`projectId`: Integer, required, foreign key to Project.id** ← NEW FIELD
- `createdAt`: Timestamp, auto-set on creation
- `updatedAt`: Timestamp, auto-updated on modification

**Relationships**:
- **Belongs to one Project** (via `projectId`) ← NEW RELATIONSHIP
  - Cascade delete: When project deleted, all its tickets deleted
  - Required: Cannot create ticket without valid project reference

**Indexes**:
- Primary: `id`
- Foreign key: `projectId` (for efficient project-scoped queries) ← NEW INDEX
- Existing: `stage`, `updatedAt`

**Validation Rules**:
- `projectId` must reference existing Project.id
- Cannot be null or undefined
- Foreign key constraint enforced at database level

**State Transitions**: (unchanged)
- Stage can transition between any enum values
- Version increments on each update

### Project (Unchanged, for reference)

**Description**: Represents a GitHub repository/project context that contains tickets.

**Fields**:
- `id`: Integer, auto-increment primary key
- `name`: String (max 100 chars), required
- `description`: String (max 1000 chars), required
- `githubOwner`: String (max 100 chars), required
- `githubRepo`: String (max 100 chars), required
- `createdAt`: Timestamp, auto-set on creation
- `updatedAt`: Timestamp, auto-updated on modification

**Relationships**:
- **Has many Tickets** (inverse of Ticket.project) ← MODIFIED RELATIONSHIP
  - When project deleted, cascade deletes all tickets

**Constraints**:
- Unique: `[githubOwner, githubRepo]` pair
- Index: `[githubOwner, githubRepo]` for lookups

## Relationship Diagram

```
┌─────────────────┐         ┌─────────────────┐
│    Project      │         │     Ticket      │
├─────────────────┤         ├─────────────────┤
│ id (PK)         │◄────┐   │ id (PK)         │
│ name            │     │   │ title           │
│ description     │     │   │ description     │
│ githubOwner     │     │   │ stage           │
│ githubRepo      │     │   │ version         │
│ createdAt       │     └───│ projectId (FK)  │ ← NEW
│ updatedAt       │         │ createdAt       │
└─────────────────┘         │ updatedAt       │
                            └─────────────────┘

Relationship: 1 Project → Many Tickets
Constraint: onDelete: Cascade (deleting project deletes all tickets)
```

## Schema Changes

### Before (Current)
```prisma
model Ticket {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(100)
  description String   @db.VarChar(1000)
  stage       Stage    @default(INBOX)
  version     Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([stage])
  @@index([updatedAt])
}

model Project {
  id          Int      @id @default(autoincrement())
  name        String   @db.VarChar(100)
  description String   @db.VarChar(1000)
  githubOwner String   @db.VarChar(100)
  githubRepo  String   @db.VarChar(100)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([githubOwner, githubRepo])
  @@index([githubOwner, githubRepo])
}
```

### After (Target)
```prisma
model Ticket {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(100)
  description String   @db.VarChar(1000)
  stage       Stage    @default(INBOX)
  version     Int      @default(1)
  projectId   Int                                                    // ← NEW
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)  // ← NEW
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([stage])
  @@index([updatedAt])
  @@index([projectId])                                              // ← NEW
}

model Project {
  id          Int      @id @default(autoincrement())
  name        String   @db.VarChar(100)
  description String   @db.VarChar(1000)
  githubOwner String   @db.VarChar(100)
  githubRepo  String   @db.VarChar(100)
  tickets     Ticket[]                                              // ← NEW
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([githubOwner, githubRepo])
  @@index([githubOwner, githubRepo])
}
```

## Migration Impact

**Database Operations**:
1. Add `projectId` column to `Ticket` table (INTEGER NOT NULL)
2. Add foreign key constraint: `Ticket.projectId` → `Project.id` with CASCADE DELETE
3. Add index on `Ticket.projectId`
4. Add relation field to Project model (no DB change, Prisma-only)

**Data Migration**:
- Development: Database reset (drop all data, recreate schema, run seed)
- Production: N/A (no production deployment yet)

**Breaking Changes**:
- All existing Ticket records will be deleted (acceptable for MVP)
- Ticket creation now requires `projectId` parameter
- API/UI changes deferred to next feature (out of scope)

## Query Patterns

### New Capabilities Enabled

**Get all tickets for a project**:
```typescript
const tickets = await prisma.ticket.findMany({
  where: { projectId: 1 }
});
```

**Get project with all tickets**:
```typescript
const project = await prisma.project.findUnique({
  where: { id: 1 },
  include: { tickets: true }
});
```

**Cascade delete verification**:
```typescript
// Deleting project automatically deletes all tickets
await prisma.project.delete({ where: { id: 1 } });
// All tickets with projectId=1 are now deleted
```

### Performance Characteristics

- **Project-scoped ticket queries**: O(log n) with index on projectId
- **Cascade delete**: Single transaction, atomic operation
- **Foreign key validation**: Enforced at database level (no application overhead)

## Validation & Constraints

**Database-Level Constraints**:
- `NOT NULL` constraint on `projectId`
- Foreign key constraint to `Project.id`
- Cascade delete on project removal
- Index on `projectId` for query performance

**Application-Level Validation** (Prisma generated):
- TypeScript compiler enforces `projectId` required field
- Prisma client throws error if creating ticket without `projectId`
- Type-safe query results include `project` relation

## Backwards Compatibility

**Breaking Changes**:
- Existing code that creates tickets without `projectId` will fail compilation (TypeScript error)
- Existing database records will be deleted during migration reset

**Migration Path**:
1. Update schema
2. Run `npx prisma migrate reset` (drops database)
3. Update seed.ts to create project before tickets
4. Run seed to populate fresh data
5. Regenerate Prisma client (`npx prisma generate`)

**Future-Proofing**:
- Relationship structure supports multi-project in future
- Current implementation uses single default project (id=1)
- API/UI changes deferred (allows incremental rollout)
