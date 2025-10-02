# Data Model: Add SPECIFY Stage to Kanban Workflow

**Date**: 2025-10-02
**Feature**: 006-specify-add-specify

## Overview

This document defines the data model changes required to add the SPECIFY stage between INBOX and PLAN in the kanban workflow. The changes are minimal and focused on enum updates with zero impact on existing ticket data.

---

## Entities

### Stage (Enum - Modified)

**Description**: Workflow stage enum representing the sequential kanban process.

**Current Definition** (`prisma/schema.prisma`):
```prisma
enum Stage {
  INBOX
  PLAN
  BUILD
  VERIFY
  SHIP
}
```

**New Definition** (with SPECIFY added):
```prisma
enum Stage {
  INBOX
  SPECIFY  // ← NEW: Added between INBOX and PLAN
  PLAN
  BUILD
  VERIFY
  SHIP
}
```

**Values**:
| Value | Order | Description |
|-------|-------|-------------|
| INBOX | 0 | Initial stage for new tickets (default) |
| **SPECIFY** | **1** | **New specification stage before planning** |
| PLAN | 2 | Planning stage (order changed from 1 → 2) |
| BUILD | 3 | Implementation stage (order changed from 2 → 3) |
| VERIFY | 4 | Testing/verification stage (order changed from 3 → 4) |
| SHIP | 5 | Deployment/shipped stage (order changed from 4 → 5) |

**Migration Impact**:
- ✅ Non-destructive change (adding enum value)
- ✅ Existing tickets retain current stage values
- ✅ Default value (INBOX) unchanged
- ✅ No data migration (UPDATE statements) required

---

### Ticket (Model - Unchanged Structure)

**Description**: Work item tracked through the kanban workflow.

**Current Definition** (`prisma/schema.prisma`):
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
```

**No Schema Changes Required**:
- `stage` field already references Stage enum
- Default remains `INBOX` (no change to ticket creation behavior)
- Existing indexes on `stage` automatically include SPECIFY after migration
- Version field continues to support optimistic concurrency control

**Behavioral Changes**:
- Tickets in INBOX can now transition to SPECIFY (new valid transition)
- Tickets cannot skip SPECIFY when moving from INBOX to PLAN (new validation)
- Existing tickets in PLAN/BUILD/VERIFY/SHIP remain in their current stages

---

## State Transitions

### Valid Transitions (Forward-Only Sequential)

The workflow enforces strict sequential progression. Tickets can only move to the immediately next stage.

```
INBOX → SPECIFY ✅ (new valid transition)
  SPECIFY → PLAN ✅ (new valid transition)
    PLAN → BUILD ✅ (existing, unchanged)
      BUILD → VERIFY ✅ (existing, unchanged)
        VERIFY → SHIP ✅ (existing, unchanged)
          SHIP → [terminal] (no further transitions)
```

**Transition Rules**:
1. **Forward-Only**: Cannot move backwards (e.g., PLAN → SPECIFY ❌)
2. **Sequential**: Cannot skip stages (e.g., INBOX → PLAN ❌)
3. **Single-Step**: Can only move to immediately next stage
4. **Terminal**: SHIP is final stage (no transitions out)

### Invalid Transitions (Examples)

| From | To | Reason | Error Message |
|------|--------|--------|---------------|
| INBOX | PLAN | Skips SPECIFY | "Cannot transition from INBOX to PLAN. Tickets must progress sequentially through stages." |
| INBOX | BUILD | Skips SPECIFY and PLAN | "Cannot transition from INBOX to BUILD. Tickets must progress sequentially through stages." |
| SPECIFY | INBOX | Backwards movement | "Cannot transition from SPECIFY to INBOX. Tickets must progress sequentially through stages." |
| PLAN | SPECIFY | Backwards movement | "Cannot transition from PLAN to SPECIFY. Tickets must progress sequentially through stages." |
| PLAN | VERIFY | Skips BUILD | "Cannot transition from PLAN to VERIFY. Tickets must progress sequentially through stages." |
| SHIP | VERIFY | Backwards from terminal | "Cannot transition from SHIP to VERIFY. Tickets must progress sequentially through stages." |

---

## Validation Rules

### Database-Level Validation

**Enum Constraint**:
```sql
-- Enforced by PostgreSQL enum type
-- Only values: INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP are valid
```

**Type Safety**:
- Prisma client generates TypeScript types matching enum
- Compile-time type checking prevents invalid stage values
- Runtime validation via Zod schema in API routes

### Application-Level Validation

**Sequential Transition Validation** (`lib/stage-validation.ts`):
```typescript
// Validates that toStage is the immediately next stage after fromStage
export function isValidTransition(fromStage: Stage, toStage: Stage): boolean {
  const nextStage = getNextStage(fromStage);
  return nextStage === toStage;
}

// Returns the next valid stage in sequence, or null if terminal
export function getNextStage(currentStage: Stage): Stage | null {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  if (currentIndex === -1 || currentIndex === STAGE_ORDER.length - 1) {
    return null;
  }
  return STAGE_ORDER[currentIndex + 1];
}
```

**Stage Order** (updated to include SPECIFY):
```typescript
const STAGE_ORDER: Stage[] = [
  Stage.INBOX,
  Stage.SPECIFY,  // ← NEW: Inserted at index 1
  Stage.PLAN,
  Stage.BUILD,
  Stage.VERIFY,
  Stage.SHIP,
];
```

**API Validation** (`app/api/tickets/[id]/route.ts`):
```typescript
// Zod schema validates stage is valid enum value
const UpdateStageSchema = z.object({
  stage: z.nativeEnum(Stage),  // Automatically includes SPECIFY after enum update
  version: z.number().int().positive(),
});

// Business logic validates sequential transition
if (!isValidTransition(currentStage, newStage)) {
  return NextResponse.json({
    error: 'Invalid stage transition',
    message: `Cannot transition from ${currentStage} to ${newStage}...`
  }, { status: 400 });
}
```

---

## Migration Strategy

### Prisma Migration

**Generated Migration SQL**:
```sql
-- AlterEnum
-- Add 'SPECIFY' value to Stage enum before 'PLAN'
ALTER TYPE "Stage" ADD VALUE 'SPECIFY' BEFORE 'PLAN';
```

**Migration Command**:
```bash
npx prisma migrate dev --name add_specify_stage
```

**Migration Properties**:
- ✅ **Atomic**: Single SQL statement, database remains consistent
- ✅ **Non-blocking**: No table locks, no downtime required
- ✅ **Reversible**: Can be rolled back if needed (before deployment)
- ✅ **Zero Data Loss**: Existing ticket stages unchanged

### Data Integrity Verification

**Pre-Migration Checks**:
```sql
-- Verify all tickets have valid current stages
SELECT stage, COUNT(*) FROM "Ticket" GROUP BY stage;

-- Expected output:
-- INBOX: N
-- PLAN: M
-- BUILD: O
-- VERIFY: P
-- SHIP: Q
```

**Post-Migration Checks**:
```sql
-- Verify enum includes SPECIFY
SELECT enum_range(NULL::Stage);
-- Expected: {INBOX,SPECIFY,PLAN,BUILD,VERIFY,SHIP}

-- Verify all tickets retained their stages (no SPECIFY tickets yet)
SELECT stage, COUNT(*) FROM "Ticket" GROUP BY stage;
-- Expected: Same counts as pre-migration (SPECIFY: 0)

-- Verify new tickets default to INBOX
INSERT INTO "Ticket" (title, description) VALUES ('Test', 'Test');
SELECT stage FROM "Ticket" WHERE title = 'Test';
-- Expected: INBOX
```

**Rollback Strategy** (if issues detected before deployment):
```sql
-- Remove SPECIFY value (only if no tickets have stage=SPECIFY)
-- WARNING: Cannot remove if any tickets use the value
ALTER TYPE "Stage" RENAME TO "Stage_old";
CREATE TYPE "Stage" AS ENUM ('INBOX', 'PLAN', 'BUILD', 'VERIFY', 'SHIP');
ALTER TABLE "Ticket" ALTER COLUMN "stage" TYPE "Stage" USING stage::text::"Stage";
DROP TYPE "Stage_old";
```

---

## Indexes

**Existing Indexes** (unchanged):
```prisma
@@index([stage])       // Composite index on stage column
@@index([updatedAt])   // Composite index on updatedAt column
```

**Impact of SPECIFY Addition**:
- Stage index automatically includes SPECIFY enum value
- No index rebuild required (PostgreSQL handles enum additions efficiently)
- Query performance unchanged

---

## Type Definitions

### TypeScript Types (Generated by Prisma)

**Stage Enum**:
```typescript
// Auto-generated by Prisma Client
export enum Stage {
  INBOX = 'INBOX',
  SPECIFY = 'SPECIFY',  // ← NEW
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  SHIP = 'SHIP',
}
```

**Ticket Model Type**:
```typescript
// Auto-generated by Prisma Client
export type Ticket = {
  id: number;
  title: string;
  description: string;
  stage: Stage;  // References updated Stage enum
  version: number;
  createdAt: Date;
  updatedAt: Date;
};
```

### Zod Validation Schemas

**Stage Schema**:
```typescript
// Already exists, automatically updated when Stage enum changes
import { Stage } from '@prisma/client';

const stageSchema = z.nativeEnum(Stage);
// Validates: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP'
```

---

## Relationships

No relationship changes. Ticket model has no foreign keys or relations to other models.

---

## Summary of Changes

| Component | Change Type | Impact |
|-----------|-------------|--------|
| **Stage enum** | Add SPECIFY value | New valid stage between INBOX and PLAN |
| **STAGE_ORDER array** | Insert SPECIFY at index 1 | Updates sequential validation logic |
| **Ticket model** | None | Structure unchanged, behavior updated via validation |
| **Database migration** | ALTER TYPE enum | Non-destructive, zero downtime |
| **Existing tickets** | None | All tickets retain current stages |
| **New tickets** | None | Still default to INBOX |
| **Indexes** | None | Automatically updated to include SPECIFY |
| **TypeScript types** | Regenerated | Prisma client includes SPECIFY in enum |
| **Validation rules** | Updated | New transitions allowed/blocked |

---

## Acceptance Criteria

✅ **Database Schema**:
- [ ] Prisma schema updated with SPECIFY enum value
- [ ] Migration generated successfully
- [ ] Migration applied to test database without errors
- [ ] Enum includes SPECIFY in correct position (index 1)

✅ **Data Integrity**:
- [ ] All existing tickets retain original stages (verified with pre/post counts)
- [ ] New tickets default to INBOX (verified with insert test)
- [ ] No tickets in SPECIFY stage immediately after migration (verified with query)

✅ **Type Safety**:
- [ ] Prisma client regenerated with SPECIFY enum value
- [ ] TypeScript compilation succeeds with updated types
- [ ] Zod schemas validate SPECIFY as valid stage

✅ **Validation Logic**:
- [ ] INBOX → SPECIFY transition allowed (isValidTransition returns true)
- [ ] SPECIFY → PLAN transition allowed (isValidTransition returns true)
- [ ] INBOX → PLAN transition blocked (isValidTransition returns false)
- [ ] SPECIFY → INBOX transition blocked (isValidTransition returns false)
- [ ] All other existing transitions unchanged

---

**Next Steps**: Implementation tasks will be generated in Phase 2 (/tasks command) based on this data model and the contracts defined in Phase 1.
