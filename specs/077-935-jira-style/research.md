# Research: Jira-Style Ticket Numbering System

**Feature**: 077-935-jira-style
**Date**: 2025-10-31
**Purpose**: Resolve technical unknowns and establish implementation patterns

## Research Areas

### 1. PostgreSQL Sequence Function for Thread-Safe Ticket Number Generation

**Question**: How to implement a thread-safe, project-scoped sequence for ticket numbering in PostgreSQL?

**Research Findings**:

**Decision**: Use PostgreSQL custom function with per-project sequences

**Rationale**:
- PostgreSQL sequences are atomic and thread-safe by design
- Custom function can dynamically create and manage per-project sequences
- Named sequences pattern: `ticket_seq_project_{projectId}`
- Function handles sequence creation if not exists, then returns `nextval()`

**Implementation Pattern**:
```sql
-- Create function in migration
CREATE OR REPLACE FUNCTION get_next_ticket_number(project_id INT)
RETURNS INT AS $$
DECLARE
  seq_name TEXT;
  next_num INT;
BEGIN
  seq_name := 'ticket_seq_project_' || project_id;

  -- Create sequence if it doesn't exist
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START WITH 1', seq_name);

  -- Get next value
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_num;

  RETURN next_num;
END;
$$ LANGUAGE plpgsql;
```

**Alternatives Considered**:
1. Application-level max+1 query: Rejected due to race conditions even with transactions
2. Single global sequence with modulo: Rejected due to gaps in project-specific numbering
3. Row-level locks on counter table: Rejected due to contention and deadlock risks

**Thread-Safety Guarantee**: PostgreSQL sequences use non-transactional counters with atomic operations, preventing race conditions even under high concurrency.

---

### 2. Project Key Generation Strategy

**Question**: How to generate and validate unique 3-character project keys?

**Research Findings**:

**Decision**: Derive keys from project name with collision handling

**Rationale**:
- User-friendly: Keys reflect project name (e.g., "Mobile App" → "MOB")
- Automatic generation reduces friction during project creation
- Manual override option for custom keys

**Implementation Pattern**:
```typescript
// Key generation logic
function generateProjectKey(name: string, existingKeys: string[]): string {
  // 1. Extract first 3 characters, uppercase, alphanumeric only
  let baseKey = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 3)
    .padEnd(3, 'X'); // Pad if name is too short

  // 2. Handle collisions by appending digits
  let key = baseKey;
  let suffix = 1;
  while (existingKeys.includes(key)) {
    key = baseKey.substring(0, 2) + suffix.toString();
    suffix++;
  }

  return key;
}
```

**Validation Rules** (Zod schema):
- Exactly 3 characters
- Uppercase alphanumeric only (A-Z, 0-9)
- Unique constraint at database level
- No profanity filter (business decision)

**Alternatives Considered**:
1. Random 3-character codes: Rejected due to lack of memorability
2. User always provides key: Rejected due to poor UX (extra step during project creation)
3. Sequential global codes (PR1, PR2, ...): Rejected due to lack of project identity

---

### 3. Migration Strategy for Existing Tickets

**Question**: How to migrate existing tickets to the new numbering system without breaking foreign key relationships?

**Research Findings**:

**Decision**: Add new fields alongside existing ID, migrate data in single transaction

**Rationale**:
- Internal `id` field remains unchanged (preserves foreign keys)
- New fields `ticketNumber`, `ticketKey` added as NOT NULL with migration data population
- Denormalized `ticketKey` field for query performance

**Migration Steps**:
```sql
BEGIN;

-- 1. Add project key field (assuming already assigned)
ALTER TABLE "Project" ADD COLUMN "key" VARCHAR(3);

-- 2. Add ticket numbering fields (nullable initially)
ALTER TABLE "Ticket" ADD COLUMN "ticketNumber" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN "ticketKey" VARCHAR(20);

-- 3. Populate project keys (from external source or generate)
-- Assume keys are provided via application logic before this migration

-- 4. Create sequence function
CREATE OR REPLACE FUNCTION get_next_ticket_number(project_id INT)
RETURNS INT AS $$
-- [function definition from Research Area 1]
$$ LANGUAGE plpgsql;

-- 5. Populate ticket numbers using ROW_NUMBER() window function
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

-- 6. Populate ticket keys by joining with projects
UPDATE "Ticket" t
SET "ticketKey" = p.key || '-' || t."ticketNumber"
FROM "Project" p
WHERE t.projectId = p.id;

-- 7. Make fields NOT NULL and add constraints
ALTER TABLE "Project" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "Project" ADD CONSTRAINT "Project_key_key" UNIQUE ("key");

ALTER TABLE "Ticket" ALTER COLUMN "ticketNumber" SET NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "ticketKey" SET NOT NULL;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketKey_key" UNIQUE ("ticketKey");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_projectId_ticketNumber_key" UNIQUE ("projectId", "ticketNumber");

-- 8. Create indexes for performance
CREATE INDEX "Ticket_ticketKey_idx" ON "Ticket"("ticketKey");
CREATE INDEX "Project_key_idx" ON "Project"("key");

-- 9. Initialize sequences with current max values
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

COMMIT;
```

**Alternatives Considered**:
1. Create new ticket table and migrate data: Rejected due to foreign key complexity (Comments, Jobs)
2. Keep ID as primary identifier: Rejected due to poor UX (global IDs less memorable)
3. Gradual migration (new tickets only): Rejected due to inconsistent UX (some tickets without keys)

**Risk Mitigation**:
- Full transaction ensures atomic migration (all-or-nothing)
- Downtime required for migration execution (application should be stopped)
- Backup database before migration
- Test migration on staging environment first

---

### 4. Denormalized Ticket Key Performance

**Question**: Should ticket keys be computed dynamically or stored as a denormalized field?

**Research Findings**:

**Decision**: Store ticket key as denormalized field with unique index

**Rationale**:
- Query performance: Direct index lookup vs JOIN + concatenation
- Target: <50ms p95 for ticket lookup by key
- Storage cost negligible: ~10-15 bytes per ticket (e.g., "ABC-12345")
- Simplifies API implementation (no JOIN required)

**Performance Analysis**:
- **Denormalized approach**: Single indexed query `SELECT * FROM Ticket WHERE ticketKey = 'ABC-123'`
  - Estimated: 5-20ms with B-tree index
- **Computed approach**: `SELECT * FROM Ticket t JOIN Project p ON t.projectId = p.id WHERE p.key = 'ABC' AND t.ticketNumber = 123`
  - Estimated: 20-50ms with two indexed lookups + JOIN

**Maintenance Trade-off**:
- Denormalized fields require update logic if project key changes
- Decision: Make project key **immutable** after creation (simplifies consistency)
- No update logic needed for ticket keys

**Alternatives Considered**:
1. Computed field (Prisma virtual field): Rejected due to inability to index computed fields in PostgreSQL
2. Composite index on (projectId, ticketNumber) with dynamic lookup: Rejected due to JOIN overhead
3. Full-text search on formatted key: Rejected due to overkill complexity

**Index Strategy**:
- Unique index on `ticketKey` (primary lookup path)
- Unique composite index on `(projectId, ticketNumber)` (data integrity)
- Existing index on `projectId` (foreign key)

---

### 5. API Backward Compatibility

**Question**: How to maintain backward compatibility with existing API endpoints using numeric ticket IDs?

**Research Findings**:

**Decision**: Support both numeric IDs and ticket keys in path parameters

**Rationale**:
- Gradual migration path for API consumers
- Existing endpoints continue to work
- New endpoints use clean key-based URLs

**Implementation Pattern**:
```typescript
// GET /api/projects/:projectId/tickets/:id
// Support both:
//   - /api/projects/1/tickets/42 (numeric ID)
//   - /api/projects/1/tickets/ABC-123 (ticket key)

export async function GET(
  request: Request,
  { params }: { params: { projectId: string; id: string } }
) {
  const ticketIdentifier = params.id;

  // Detect if identifier is numeric or ticket key
  const isNumericId = /^\d+$/.test(ticketIdentifier);

  const ticket = isNumericId
    ? await prisma.ticket.findUnique({ where: { id: parseInt(ticketIdentifier) } })
    : await prisma.ticket.findUnique({ where: { ticketKey: ticketIdentifier } });

  if (!ticket || ticket.projectId !== parseInt(params.projectId)) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  return NextResponse.json(ticket);
}
```

**New Endpoints**:
- `GET /browse/:key` - Primary user-facing endpoint for ticket access
  - Clean URL structure
  - No project ID required (ticket keys are globally unique)
  - Resolves project ownership from ticket key

**URL Strategy**:
- User-facing links: Always use `/browse/ABC-123` format
- Internal API calls: Can use either format
- Frontend redirects: Old numeric URLs redirect to new key-based URLs

**Alternatives Considered**:
1. Separate versioned APIs (/v1, /v2): Rejected due to maintenance burden
2. Breaking change (remove numeric ID support): Rejected due to user impact
3. Accept both in query param (?id=123 or ?key=ABC-123): Rejected due to poor URL design

---

## Best Practices for Ticket Key Systems

**Research Sources**:
- Jira ticket numbering architecture
- GitHub issue numbering (per-repository sequences)
- Linear ticket keys (team-scoped, similar to our project-scoped approach)

**Key Patterns Applied**:

1. **Project-Scoped Sequences**: Each project maintains independent numbering
   - Benefit: Predictable counts, clear project size
   - Implementation: PostgreSQL sequences per project

2. **Denormalized Keys**: Store formatted keys for performance
   - Benefit: Fast lookup, simple queries
   - Trade-off: Slight storage overhead

3. **Immutable Keys**: Once assigned, keys never change
   - Benefit: Stable references in documentation, links
   - Constraint: Project keys immutable after creation

4. **Human-Friendly Keys**: Short, memorable, meaningful
   - Benefit: Easy to communicate ("See ABC-5")
   - Constraint: 3-character limit on keys

5. **Unique Constraints**: Database-level enforcement
   - Benefit: Prevents collisions at source
   - Implementation: Unique constraints on both `ticketKey` and `(projectId, ticketNumber)`

---

## Risk Assessment

### High Priority Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Migration data loss | Low | Critical | Full transaction, staging test, database backup |
| Race condition in sequence generation | Very Low | High | PostgreSQL sequences are atomic by design |
| Project key collisions | Low | Medium | Unique constraint + collision detection logic |
| Test failures due to schema changes | High | Medium | Update tests to use ticketKey instead of ID |

### Medium Priority Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance degradation | Low | Medium | Index on ticketKey, benchmark before/after |
| Foreign key breaks | Very Low | High | Preserve internal ID field, no schema changes to relationships |
| User confusion (ID vs Key) | Medium | Low | Consistent UI updates, display keys prominently |

---

## Implementation Dependencies

**Critical Path**:
1. Database migration (schema changes, sequence function, data population)
2. API updates (ticket creation, lookup endpoints)
3. UI updates (display ticket keys)
4. Test updates (fix assertions)

**Blockers**:
- Migration must complete before any code changes deploy
- Project keys must be assigned/generated before migration runs

**Assumptions**:
- All projects will have unique keys assigned (either auto-generated or provided)
- Downtime acceptable for migration execution
- No concurrent writes during migration window

---

## Success Metrics

**Performance Targets**:
- Ticket lookup by key: <50ms p95
- Ticket creation with number generation: <100ms p95
- Migration execution time: <5 minutes for 10,000 tickets

**Correctness Targets**:
- Zero race conditions in ticket number generation (validated via concurrent stress test)
- Zero ticket key collisions (enforced by unique constraint)
- 100% data integrity post-migration (all tickets have valid keys)

**User Experience Targets**:
- All ticket references use keys (not IDs) in UI
- Clean URLs (`/browse/ABC-123`) resolve correctly
- Existing bookmarks/links work with redirects
