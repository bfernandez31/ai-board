# Data Model: Close Ticket Feature

**Feature**: AIB-148-copy-of-close
**Date**: 2026-01-06

## Entity Changes

### Stage Enum Extension

**Current Definition** (`prisma/schema.prisma`):
```prisma
enum Stage {
  INBOX
  SPECIFY
  PLAN
  BUILD
  VERIFY
  SHIP
}
```

**Updated Definition**:
```prisma
enum Stage {
  INBOX
  SPECIFY
  PLAN
  BUILD
  VERIFY
  SHIP
  CLOSED
}
```

**TypeScript Enum** (`lib/stage-transitions.ts`):
```typescript
export enum Stage {
  INBOX = 'INBOX',
  SPECIFY = 'SPECIFY',
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  SHIP = 'SHIP',
  CLOSED = 'CLOSED',
}
```

---

### Ticket Model Extension

**Current Fields** (relevant subset):
```prisma
model Ticket {
  id          Int       @id @default(autoincrement())
  stage       Stage     @default(INBOX)
  version     Int       @default(1)
  updatedAt   DateTime  @updatedAt
  // ... other fields
}
```

**New Field**:
```prisma
model Ticket {
  // ... existing fields
  closedAt    DateTime?
}
```

**Field Specification**:
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| closedAt | DateTime | Yes | null | Timestamp when ticket was closed (only set when stage=CLOSED) |

---

## State Machine Updates

### Valid Transitions

**Current**:
```
INBOX → SPECIFY (normal)
INBOX → BUILD (quick-impl)
SPECIFY → PLAN
PLAN → BUILD
BUILD → VERIFY
BUILD → INBOX (rollback, QUICK workflow only)
VERIFY → SHIP (manual)
VERIFY → PLAN (rollback, FULL workflow only)
SHIP → (none, terminal)
```

**Added**:
```
VERIFY → CLOSED (close operation)
CLOSED → (none, terminal)
```

### Terminal States

**Current**: SHIP only
**Updated**: SHIP, CLOSED

**Implementation**:
```typescript
export function isTerminalStage(stage: Stage): boolean {
  return stage === Stage.SHIP || stage === Stage.CLOSED;
}
```

---

## Validation Rules

### Close Transition Validation

| Rule | Condition | Error |
|------|-----------|-------|
| Stage Check | ticket.stage === 'VERIFY' | 400: "Can only close tickets in VERIFY stage" |
| No Active Jobs | No PENDING/RUNNING jobs for ticket | 400: "Cannot close ticket with active jobs" |
| Cleanup Lock | Project not locked for cleanup | 423: "Project cleanup in progress" |

### Data Integrity

| Constraint | Enforcement |
|------------|-------------|
| closedAt only set when stage=CLOSED | Application logic in close endpoint |
| closedAt immutable after set | No update path exists (terminal state) |
| Version increment on close | Optimistic concurrency control |

---

## Indexes

No new indexes required. Existing indexes on `stage` and `projectId` are sufficient for:
- Filtering CLOSED tickets from board display
- Including CLOSED tickets in search

---

## Migration Script

**Migration Name**: `add_closed_stage_and_closedAt`

```prisma
-- AlterEnum
ALTER TYPE "Stage" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "closedAt" TIMESTAMP(3);
```

**Rollback**:
```sql
-- Update any CLOSED tickets back to VERIFY (data preservation)
UPDATE "Ticket" SET stage = 'VERIFY', "closedAt" = NULL WHERE stage = 'CLOSED';

-- Remove enum value (requires recreating enum in PostgreSQL)
-- Note: Enum value removal requires careful migration
```

---

## Relationship Diagram

```
                    ┌─────────────┐
                    │   Project   │
                    └──────┬──────┘
                           │ 1:N
                           ▼
                    ┌─────────────┐
                    │   Ticket    │
                    │─────────────│
                    │ stage: Stage│
                    │ closedAt?   │◄─── NEW FIELD
                    └──────┬──────┘
                           │ 1:N
                           ▼
                    ┌─────────────┐
                    │    Job      │
                    └─────────────┘
```

---

## Query Patterns

### Board Display (exclude CLOSED)
```typescript
const tickets = await prisma.ticket.findMany({
  where: {
    projectId,
    stage: { not: 'CLOSED' },  // Filter out closed tickets
  },
});
```

### Search (include CLOSED)
```typescript
const tickets = await prisma.ticket.findMany({
  where: {
    projectId,
    OR: [
      { ticketKey: { contains: query, mode: 'insensitive' } },
      { title: { contains: query, mode: 'insensitive' } },
    ],
    // No stage filter - includes CLOSED
  },
});
```

### Close Operation
```typescript
const closedTicket = await prisma.ticket.update({
  where: { id: ticketId, version: expectedVersion },
  data: {
    stage: 'CLOSED',
    closedAt: new Date(),
    version: { increment: 1 },
  },
});
```
