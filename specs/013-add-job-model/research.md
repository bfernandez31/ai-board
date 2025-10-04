# Research: Add Job Model

**Feature**: 013-add-job-model
**Date**: 2025-10-04
**Status**: Complete

## Research Questions

### 1. Prisma Text Field Best Practices for Unlimited Logs

**Decision**: Use `@db.Text` PostgreSQL type for logs field

**Rationale**:
- PostgreSQL `TEXT` type supports unlimited length (up to 1GB per field)
- More efficient than `VARCHAR` for large content (no length overhead)
- Prisma `String @db.Text` maps directly to PostgreSQL TEXT
- Automatic handling of large content by PostgreSQL storage engine (TOAST)

**Alternatives Considered**:
- `String @db.VarChar`: Rejected - requires explicit length limit
- Separate logging service: Rejected - adds complexity, spec requires inline storage
- File system storage: Rejected - loses ACID guarantees and query capabilities

**Implementation**:
```prisma
logs String @db.Text
```

### 2. Nullable Field Handling in Prisma

**Decision**: Use `String?` syntax for optional fields (branch, commitSha, completedAt, logs)

**Rationale**:
- Prisma `Type?` syntax generates nullable database columns
- Matches clarification: Git metadata can be unavailable at job creation
- TypeScript client generates proper optional types
- Null semantics clearer than empty strings

**Alternatives Considered**:
- Empty strings as defaults: Rejected - null vs empty string ambiguity
- Required with defaults: Rejected - contradicts "unavailable" clarification

**Implementation**:
```prisma
branch     String?   @db.VarChar(200)
commitSha  String?   @db.VarChar(40)
completedAt DateTime?
logs       String?   @db.Text
```

### 3. Index Strategy for Job Queries

**Decision**: Composite index on `[ticketId, status, startedAt]` plus individual indexes

**Rationale**:
- FR-008 requires queries by ticket, status, and time range
- Composite index supports common query pattern: "get jobs for ticket X with status Y ordered by time"
- Individual indexes support partial queries (e.g., "all pending jobs")
- PostgreSQL B-tree indexes efficient for equality and range queries

**Alternatives Considered**:
- Single composite index only: Rejected - doesn't optimize single-field queries
- No indexes: Rejected - violates FR-012 performance requirement
- Full-text index on logs: Rejected - not in spec requirements

**Implementation**:
```prisma
@@index([ticketId])
@@index([status])
@@index([startedAt])
@@index([ticketId, status, startedAt])
```

### 4. Cascade Delete Behavior

**Decision**: Use Prisma `onDelete: Cascade` on ticketId relation

**Rationale**:
- FR-009 and FR-017 require automatic deletion when ticket deleted
- Database-level cascade ensures consistency even if app-level code bypassed
- Prisma generates proper foreign key constraint in migration
- PostgreSQL cascade handles running job cancellation at DB level

**Alternatives Considered**:
- Application-level deletion: Rejected - error-prone, not atomic
- Soft delete: Rejected - spec explicitly requires cascade delete
- Trigger-based: Rejected - Prisma relation handles it declaratively

**Implementation**:
```prisma
ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
```

### 5. Enum vs String for Command Field

**Decision**: Use `String @db.VarChar(50)` instead of enum for command field

**Rationale**:
- Spec lists 5 commands but doesn't prohibit future additions
- String validation can be done in application layer (Zod)
- Avoids database migration for new command types
- More flexible for extensions (e.g., command parameters)

**Alternatives Considered**:
- Prisma enum: Rejected - requires migration for each new command
- Unlimited String: Rejected - spec specifies 50 char limit

**Implementation**:
```prisma
command   String   @db.VarChar(50)
```

**Application-Level Validation** (future ticket):
```typescript
const commandSchema = z.enum(['specify', 'plan', 'task', 'implement', 'clarify']);
```

### 6. Large Log Content Handling

**Decision**: Store inline initially; compression/external storage as future enhancement

**Rationale**:
- FR-018 requires full storage without truncation
- PostgreSQL TOAST automatically compresses large TEXT values
- Inline storage simplifies queries and transactions
- External storage can be added later without schema changes (just move content)

**Alternatives Considered**:
- Immediate external storage: Rejected - premature optimization, adds complexity
- Separate logs table: Rejected - one-to-one relationship adds no value

**Future Enhancement Path**:
1. Add `logsStorageType` enum field (inline, compressed, external)
2. Add `logsExternalUrl` nullable field
3. Migrate large logs to external storage via background job
4. Application layer handles transparent retrieval

### 7. Timeout Configuration Storage

**Decision**: Timeout configuration NOT in Job model (separate ticket/config file)

**Rationale**:
- FR-014 requires configurable timeouts per command type
- Configuration is system-wide, not per-job
- Job model stores timeout occurrence (FR-015), not timeout duration
- Environment variables or config file more appropriate for system config

**Alternatives Considered**:
- `timeoutDuration` field in Job: Rejected - duplicates config across all jobs
- Separate Timeout model: Rejected - over-engineering for 5 static values

**Recommended Approach** (future ticket):
```typescript
// lib/job-config.ts
export const JOB_TIMEOUTS = {
  specify: 5 * 60 * 1000,  // 5 minutes
  plan: 10 * 60 * 1000,    // 10 minutes
  task: 15 * 60 * 1000,    // 15 minutes
  implement: 30 * 60 * 1000, // 30 minutes
  clarify: 5 * 60 * 1000,  // 5 minutes
};
```

## Research Summary

All unknowns resolved. Data model design decisions:

1. ✅ Use PostgreSQL TEXT for unlimited logs with automatic compression
2. ✅ Nullable fields for optional Git metadata and completion data
3. ✅ Composite + individual indexes for query performance
4. ✅ Database-level cascade delete for referential integrity
5. ✅ String field for command (application-level enum validation)
6. ✅ Inline storage for logs (future external storage enhancement)
7. ✅ Timeout config external to model (environment/config file)

**No blockers for Phase 1 design.**
