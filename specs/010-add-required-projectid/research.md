# Research: Add required projectId foreign key to Ticket model

**Feature**: 010-add-required-projectid
**Date**: 2025-10-03

## Research Questions

### 1. Prisma Foreign Key Implementation
**Question**: How to add a required foreign key field to an existing model with cascade delete?

**Decision**: Use Prisma schema relation syntax with `@relation` decorator and `onDelete: Cascade`

**Rationale**:
- Prisma provides declarative relationship syntax
- `onDelete: Cascade` ensures child tickets are automatically deleted when parent project is removed
- TypeScript types automatically generated for type-safe queries
- Database constraints enforced at PostgreSQL level

**Implementation Pattern**:
```prisma
model Ticket {
  id        Int      @id @default(autoincrement())
  projectId Int
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
}

model Project {
  id      Int      @id @default(autoincrement())
  tickets Ticket[]
}
```

**Alternatives Considered**:
- Manual SQL foreign key: Rejected (violates constitution, bypasses Prisma type safety)
- Optional foreign key: Rejected (requirement specifies required field)
- Soft delete instead of cascade: Rejected (not in scope, can be added later)

### 2. Migration Strategy for Existing Data
**Question**: How to add a required field to existing Ticket records?

**Decision**: Use database reset (`npx prisma migrate reset`) for development

**Rationale**:
- This is a foundational schema change early in development
- No production data exists yet (MVP stage)
- Clean slate ensures all tickets have valid projectId from the start
- Simpler than writing data migration scripts

**Implementation Steps**:
1. Add projectId field to Ticket model
2. Run `npx prisma migrate reset` (drops DB, recreates, runs seed)
3. Update seed.ts to create default project first
4. Seed creates tickets with projectId reference

**Alternatives Considered**:
- Two-step migration (optional field → backfill → required): Rejected (unnecessary complexity for MVP)
- Manual data migration script: Rejected (no production data to preserve)

### 3. Index Strategy
**Question**: What indexes are needed for efficient project-scoped queries?

**Decision**: Single index on Ticket.projectId

**Rationale**:
- Foreign key queries will filter tickets by projectId frequently
- Index improves `WHERE projectId = ?` query performance
- PostgreSQL automatically creates index on foreign key columns in some cases, but explicit index ensures consistency
- Single-column index sufficient (no composite key needed yet)

**Performance Impact**:
- Query time: O(log n) instead of O(n) for project filtering
- Write overhead: Minimal (single indexed column)
- Disk space: Negligible for expected scale

**Alternatives Considered**:
- Composite index [projectId, stage]: Rejected (premature optimization, can add later if query patterns require it)
- No explicit index: Rejected (performance requirement specifies efficient queries)

### 4. Seed Data Pattern
**Question**: How to ensure seed data creates entities in correct order?

**Decision**: Create Project first, then reference its ID in Ticket creation

**Rationale**:
- Foreign key constraint requires referenced project to exist
- Sequential creation ensures referential integrity
- Default project pattern (id=1, name='ai-board') provides known reference for seed tickets

**Implementation Pattern**:
```typescript
// seed.ts
const defaultProject = await prisma.project.create({
  data: { name: 'ai-board', description: '...', ... }
});

await prisma.ticket.createMany({
  data: [
    { title: '...', projectId: defaultProject.id },
    // ... more tickets
  ]
});
```

**Alternatives Considered**:
- Nested create: Rejected (less explicit, harder to reference project in multiple tickets)
- Hardcoded project ID: Rejected (fragile, breaks if autoincrement changes)

### 5. Testing Strategy
**Question**: How to verify foreign key constraint and cascade delete behavior?

**Decision**: Database-level tests for constraints, E2E tests for user flows

**Test Coverage**:
1. **Constraint Test**: Attempt to create ticket without projectId (should fail)
2. **Cascade Test**: Delete project, verify all tickets deleted
3. **Query Test**: Filter tickets by projectId, verify only matching tickets returned
4. **Seed Test**: Run seed, verify project created before tickets

**Testing Approach**:
- Use Playwright test database isolation
- Each test resets database state
- Tests verify PostgreSQL constraints, not just application logic

**Alternatives Considered**:
- Unit tests only: Rejected (misses database constraint enforcement)
- Manual testing: Rejected (violates TDD constitutional requirement)

## Summary

All technical decisions align with constitutional principles:
- **TypeScript-First**: Prisma generates type-safe client code
- **Database Integrity**: Migrations enforce schema changes, constraints enforce rules
- **TDD**: Tests written before migration
- **Security**: Foreign key prevents orphaned data

No unresolved NEEDS CLARIFICATION items remain. Ready for Phase 1 (Design & Contracts).
