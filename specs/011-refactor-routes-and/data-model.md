# Data Model: Refactor Routes and APIs to Require Project Context

**Feature**: 011-refactor-routes-and
**Date**: 2025-10-03
**Status**: Complete

## Overview

This feature does NOT introduce new data models. It refactors existing routes and APIs to enforce project context, using the existing `Project` and `Ticket` models.

## Existing Models (No Changes)

### Project
```prisma
model Project {
  id          Int      @id @default(autoincrement())
  name        String   @db.VarChar(100)
  description String   @db.VarChar(1000)
  githubOwner String   @db.VarChar(100)
  githubRepo  String   @db.VarChar(100)
  tickets     Ticket[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([githubOwner, githubRepo])
  @@index([githubOwner, githubRepo])
}
```

**Purpose**: Container for organizing tickets by GitHub repository
**Key Attributes**:
- `id`: Primary key used in URLs (`/projects/{id}/board`)
- `githubOwner`, `githubRepo`: Unique identifier for the project
- `tickets`: One-to-many relationship with Ticket model

**Validation Rules** (for this feature):
- `id` must be a positive integer
- Project must exist before processing ticket operations

---

### Ticket
```prisma
model Ticket {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(100)
  description String   @db.VarChar(1000)
  stage       Stage    @default(INBOX)
  version     Int      @default(1)
  projectId   Int
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([stage])
  @@index([updatedAt])
  @@index([projectId])
}
```

**Purpose**: Work item belonging to a project
**Key Attributes**:
- `id`: Primary key (ticket identifier)
- `projectId`: Foreign key to Project (REQUIRED, indexed)
- `version`: Optimistic concurrency control
- `stage`: Current workflow stage

**Validation Rules** (enforced by this feature):
- Ticket MUST belong to the project specified in the URL
- All queries MUST filter by `projectId`
- Updates/deletes MUST verify `projectId` matches URL

---

## Database Query Changes

This feature modifies how we query the existing models, NOT the schema itself.

### Before Refactor
```typescript
// Queries ALL tickets (no project scoping)
await prisma.ticket.findMany({ orderBy: { updatedAt: 'desc' } });

// Creates ticket with implicit default project
await prisma.ticket.create({ data: { title, description, stage: 'INBOX', projectId: defaultProjectId } });

// Updates ticket without project validation
await prisma.ticket.update({ where: { id: ticketId }, data: { stage: newStage } });
```

### After Refactor
```typescript
// Queries tickets filtered by project
await prisma.ticket.findMany({
  where: { projectId },
  orderBy: { updatedAt: 'desc' }
});

// Creates ticket with explicit project from URL
await prisma.ticket.create({
  data: { title, description, stage: 'INBOX', projectId }
});

// Updates ticket with project validation
await prisma.ticket.update({
  where: { id: ticketId, projectId },  // Composite WHERE prevents cross-project access
  data: { stage: newStage }
});
```

---

## No Migrations Required

- ✅ `Project` model already exists (created in feature 010)
- ✅ `Ticket.projectId` foreign key already exists (created in feature 010)
- ✅ Indexes on `projectId` already exist
- ✅ Cascade delete already configured

**This feature only changes HOW we query the data, not the schema itself.**

---

## Validation Logic

### Project Existence Validation
```typescript
// Validate project exists before processing requests
const project = await prisma.project.findUnique({
  where: { id: projectId },
  select: { id: true }  // Minimal select for performance
});

if (!project) {
  return NextResponse.json(
    { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
    { status: 404 }
  );
}
```

### Cross-Project Access Prevention
```typescript
// Verify ticket belongs to project
const ticket = await prisma.ticket.findFirst({
  where: {
    id: ticketId,
    projectId: projectId  // Must match URL project
  }
});

if (!ticket) {
  // Distinguish between 404 (ticket doesn't exist) and 403 (wrong project)
  const exists = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, projectId: true }
  });

  if (!exists) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
```

---

## State Transitions

No changes to ticket state transitions. The existing stage validation logic remains:

```typescript
enum Stage {
  INBOX
  SPECIFY
  PLAN
  BUILD
  VERIFY
  SHIP
}

// Sequential transitions only (unchanged)
INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP
```

The only change: All stage updates now require `projectId` validation.

---

## Relationships

```
Project (1) ──────< (N) Ticket
   │                      │
   └─ id (PK)            └─ projectId (FK, indexed)

URL Structure:
/projects/{Project.id}/board
/api/projects/{Project.id}/tickets
/api/projects/{Project.id}/tickets/{Ticket.id}
```

**Invariant**: Every ticket operation MUST specify a project. Tickets cannot exist without a project (enforced by NOT NULL foreign key).

---

## Performance Implications

### Query Performance
- **Before**: `SELECT * FROM tickets` (full table scan)
- **After**: `SELECT * FROM tickets WHERE projectId = ?` (index scan)
- **Impact**: ✅ FASTER with index (existing `@@index([projectId])`)

### Additional Queries
- **New**: Project existence check per request
- **Cost**: ~5-10ms per request (indexed lookup)
- **Acceptable**: MVP performance requirements met

### Future Optimization
- Cache project existence in Redis (if needed)
- Pre-validate project in middleware (if performance becomes critical)

---

## Error Scenarios

| Scenario | Status Code | Error Message |
|----------|-------------|---------------|
| Invalid `projectId` format (non-numeric) | 400 | "Invalid project ID" |
| Project does not exist | 404 | "Project not found" |
| Ticket does not exist | 404 | "Ticket not found" |
| Ticket belongs to different project | 403 | "Forbidden" |
| Database error | 500 | "Internal server error" |

---

## Summary

**Data Model Changes**: None
**Query Changes**: Add `projectId` filter to all ticket queries
**Validation Added**: Project existence, cross-project access prevention
**Migrations Required**: None
**Performance Impact**: Neutral to positive (better index usage)

**Status**: ✅ Ready for contract generation (Phase 1 continuation)
