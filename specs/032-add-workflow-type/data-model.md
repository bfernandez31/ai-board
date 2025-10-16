# Data Model: Add Workflow Type Field

**Feature**: 032-add-workflow-type
**Date**: 2025-01-16

## Schema Changes

### New Enum: WorkflowType

**Definition**:
```prisma
enum WorkflowType {
  FULL   // Normal workflow: INBOX → SPECIFY → PLAN → BUILD
  QUICK  // Quick implementation: INBOX → BUILD
}
```

**Purpose**: Represents how a ticket was initially implemented

**Values**:
- `FULL`: Ticket followed complete workflow with specification and planning
- `QUICK`: Ticket used quick-implementation path bypassing spec/plan stages

**Storage**: PostgreSQL enum type (stored as integer internally, 1 byte)

---

### Updated Model: Ticket

**New Field**:
```prisma
model Ticket {
  // ... existing fields ...
  workflowType WorkflowType @default(FULL)
  // ... existing fields ...
}
```

**Field Specifications**:
- **Name**: `workflowType`
- **Type**: `WorkflowType` enum
- **Nullable**: NO (NOT NULL constraint)
- **Default**: `FULL`
- **Immutability**: Set once during first BUILD transition, unchanged thereafter (enforced at application level)

**Rationale**:
- NOT NULL ensures all tickets have valid workflow type (no undefined states)
- DEFAULT FULL ensures backward compatibility (existing tickets get sensible default)
- Immutability prevents accidental changes while allowing manual admin corrections

---

### New Index

**Definition**:
```prisma
model Ticket {
  // ... existing indexes ...
  @@index([projectId, workflowType])
}
```

**Purpose**: Enable efficient filtering by workflow type within a project

**Query Patterns Supported**:
```sql
-- Future feature: Filter board by workflow type
SELECT * FROM "Ticket"
WHERE "projectId" = $1 AND "workflowType" = $2;

-- Analytics: Count quick-impl vs full workflow tickets
SELECT "workflowType", COUNT(*)
FROM "Ticket"
WHERE "projectId" = $1
GROUP BY "workflowType";
```

**Performance Impact**:
- Index size: ~5 bytes per row (4-byte int + 1-byte enum)
- Query speedup: O(n) → O(log n) for filtered queries
- Write overhead: ~1ms per ticket creation/update (negligible)

---

## Migration Strategy

### Migration File: `[timestamp]_add_workflow_type.sql`

**Operations** (in order):

1. **Create Enum Type**:
```sql
CREATE TYPE "WorkflowType" AS ENUM ('FULL', 'QUICK');
```

2. **Add Column with Default**:
```sql
ALTER TABLE "Ticket"
ADD COLUMN "workflowType" "WorkflowType" NOT NULL DEFAULT 'FULL';
```

3. **Create Index**:
```sql
CREATE INDEX "Ticket_projectId_workflowType_idx"
ON "Ticket"("projectId", "workflowType");
```

**Idempotency Checks**:
```sql
-- Check if enum exists before creating
DO $$ BEGIN
  CREATE TYPE "WorkflowType" AS ENUM ('FULL', 'QUICK');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
```

**Rollback Operations**:
```sql
-- Drop in reverse order
DROP INDEX IF EXISTS "Ticket_projectId_workflowType_idx";
ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "workflowType";
DROP TYPE IF EXISTS "WorkflowType";
```

---

## Data Integrity Rules

### Constraints

1. **NOT NULL Constraint**: Every ticket MUST have a workflow type
   - Enforced at database level
   - Default value FULL ensures no null values

2. **Enum Constraint**: workflowType MUST be FULL or QUICK
   - Enforced by PostgreSQL enum type
   - Invalid values rejected at insert/update

3. **Immutability Constraint**: workflowType should not change after initial setting
   - Enforced at application level (lib/workflows/transition.ts)
   - Database allows updates for admin corrections (manual override)

### Validation Rules

**Application-Level Validation**:
```typescript
// In lib/workflows/transition.ts
if (isQuickImpl && !ticket.workflowType) {
  // Set workflowType only if not already set
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { workflowType: 'QUICK' }
  });
}
```

**No User Input Validation Needed**:
- Workflow type determined programmatically (isQuickImpl flag)
- No user-facing form field for workflowType
- Enum constraint prevents invalid values

---

## Relationships

### Existing Relationships (Unchanged)

```
Ticket
  ├── belongsTo Project (via projectId)
  ├── hasMany Job (via ticketId)
  └── (no direct relation to WorkflowType - it's a field, not a relation)
```

**WorkflowType as Field, Not Relation**:
- workflowType is an enum field, not a foreign key
- No separate WorkflowType table
- No JOIN queries needed

---

## State Transitions

### Ticket Lifecycle with workflowType

**Initial State**:
```
Ticket created → workflowType = FULL (default)
Stage = INBOX
```

**Full Workflow Path**:
```
INBOX → SPECIFY → PLAN → BUILD
  ↓         ↓        ↓       ↓
FULL     FULL     FULL    FULL (unchanged)
```

**Quick-Impl Path**:
```
INBOX → BUILD
  ↓       ↓
FULL   QUICK (set during transition)
```

**Subsequent Transitions**:
```
BUILD → VERIFY → SHIP
  ↓        ↓       ↓
QUICK   QUICK   QUICK (immutable, unchanged)
```

**Rollback Scenario**:
```
VERIFY → SPECIFY (rollback to create spec)
   ↓          ↓
QUICK     QUICK (immutable, unchanged)
```

### workflowType Setting Logic

**Trigger**: INBOX → BUILD transition (quick-impl detected)

**Condition**: `isQuickImpl = true` in `lib/workflows/transition.ts`

**Action**:
```typescript
await prisma.$transaction([
  prisma.job.create({ command: 'quick-impl', ... }),
  prisma.ticket.update({
    where: { id },
    data: { workflowType: 'QUICK' }
  })
]);
```

**Guarantee**: Atomic update - both Job and workflowType set together or neither

---

## Migration Impact Analysis

### Affected Tables

| Table | Impact | Downtime Required |
|-------|--------|------------------|
| Ticket | Add column, add index | No (backward compatible) |
| (new) WorkflowType enum | Create new type | No (DDL operation) |
| Job | None | No |
| Project | None | No |

### Data Volume Estimate

**Current State**:
- ~100 existing tickets
- All will receive workflowType=FULL

**Future State** (6 months estimate):
- ~500 total tickets
- ~15% quick-impl (75 tickets with workflowType=QUICK)
- ~85% full workflow (425 tickets with workflowType=FULL)

### Storage Impact

**Per Ticket**:
- workflowType field: 1 byte (enum)
- Index entry: 5 bytes (4-byte int projectId + 1-byte enum)
- **Total**: 6 bytes per ticket

**For 500 Tickets**:
- Field storage: 500 bytes (0.5 KB)
- Index storage: 2.5 KB
- **Total**: 3 KB (negligible)

---

## Backward Compatibility

### Pre-Migration Code

**Before migration, existing code works**:
```typescript
// Board query (pre-migration)
const tickets = await prisma.ticket.findMany({
  where: { projectId },
  select: {
    id: true,
    title: true,
    // ... existing fields, NO workflowType
  }
});
// ✅ Works - workflowType not required
```

### Post-Migration Code

**After migration, new code includes workflowType**:
```typescript
// Board query (post-migration)
const tickets = await prisma.ticket.findMany({
  where: { projectId },
  select: {
    id: true,
    title: true,
    workflowType: true,  // ← NEW
    // ... existing fields
  }
});
// ✅ Works - workflowType available
```

**Gradual Rollout**:
1. Deploy migration (adds workflowType=FULL to all tickets)
2. Deploy application code (reads workflowType, defaults to FULL if missing)
3. Verify badge appears correctly
4. No rollback needed (backward compatible)

---

## Testing Data Model Changes

### Unit Tests

**Test Enum Creation**:
```typescript
test('WorkflowType enum has correct values', () => {
  const validValues = ['FULL', 'QUICK'];
  expect(WorkflowType).toHaveMembers(validValues);
});
```

**Test Default Value**:
```typescript
test('Ticket.workflowType defaults to FULL', async () => {
  const ticket = await prisma.ticket.create({
    data: { title: 'Test', projectId: 1 }
  });
  expect(ticket.workflowType).toBe('FULL');
});
```

### Integration Tests

**Test Migration**:
```typescript
test('Migration adds workflowType to existing tickets', async () => {
  // Run migration
  await prisma.$executeRaw`...migration SQL...`;

  // Verify all tickets have workflowType=FULL
  const tickets = await prisma.ticket.findMany();
  expect(tickets.every(t => t.workflowType === 'FULL')).toBe(true);
});
```

**Test Index Performance**:
```typescript
test('Index improves query performance', async () => {
  // Create 1000 test tickets
  // Measure query time with/without index
  // Expect >50% speedup
});
```

---

## Summary

**Schema Changes**:
- ✅ Add WorkflowType enum (FULL, QUICK)
- ✅ Add Ticket.workflowType field (NOT NULL, DEFAULT FULL)
- ✅ Add index on (projectId, workflowType)

**Migration Safety**:
- ✅ Backward compatible (default value)
- ✅ Zero downtime (DDL + default value)
- ✅ Rollback safe (drop operations)

**Data Integrity**:
- ✅ NOT NULL constraint (no undefined states)
- ✅ Enum constraint (only valid values)
- ✅ Application-level immutability (set once)

**Performance Impact**:
- ✅ Minimal storage overhead (6 bytes/ticket)
- ✅ Index enables future filtering (O(log n) queries)
- ✅ Migration completes in <100ms for 100 tickets
