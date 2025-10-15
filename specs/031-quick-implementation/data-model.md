# Data Model: Quick Implementation Workflow

**Feature**: 031-quick-implementation
**Date**: 2025-01-15
**Purpose**: Entity definitions and relationships for INBOX → BUILD fast-track workflow

---

## 1. Affected Database Entities

### 1.1 Job Entity (MODIFIED)

**Prisma Schema** (existing, no changes required):
```prisma
model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  projectId   Int       // Added in feature 028-519-replace-sse
  command     String    // VARCHAR - supports "quick-impl" value
  status      JobStatus @default(PENDING)
  startedAt   DateTime
  completedAt DateTime?
  updatedAt   DateTime

  ticket      Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId]) // For efficient polling queries
  @@index([ticketId])
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

**Quick-Impl Modifications**:
- **command Field**: Add support for value `"quick-impl"` (in addition to "specify", "plan", "implement")
- **No Schema Changes**: VARCHAR field already supports arbitrary string values
- **Job Lifecycle**: Identical to other commands (PENDING → RUNNING → COMPLETED/FAILED/CANCELLED)

**Relevant Operations**:
```typescript
// Create quick-impl job (lib/workflows/transition.ts)
const job = await prisma.job.create({
  data: {
    ticketId: ticket.id,
    projectId: ticket.projectId,
    command: 'quick-impl',  // NEW VALUE
    status: JobStatus.PENDING,
    startedAt: new Date(),
    updatedAt: new Date(),
  },
});

// Query jobs (existing API endpoint - no changes)
const jobs = await prisma.job.findMany({
  where: { projectId: 1 },
  orderBy: { startedAt: 'desc' },
});
```

**Test Data Example**:
```typescript
// tests/api/ticket-transition.spec.ts (NEW TEST)
const quickImplJob = await prisma.job.create({
  data: {
    ticketId: ticket.id,
    projectId: 1,
    command: 'quick-impl',
    status: 'COMPLETED',
    startedAt: new Date(),
    completedAt: new Date(),
    updatedAt: new Date(),
  },
});
```

---

### 1.2 Ticket Entity (UNMODIFIED)

**Prisma Schema** (existing, no changes required):
```prisma
model Ticket {
  id                   Int                   @id @default(autoincrement())
  title                String
  description          String
  stage                Stage                 @default(INBOX)
  branch               String?               @db.VarChar(200)
  version              Int                   @default(1)
  autoMode             Boolean               @default(false)
  clarificationPolicy  ClarificationPolicy?
  projectId            Int
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt

  project              Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)
  jobs                 Job[]

  @@index([projectId])
  @@index([stage])
}

enum Stage {
  INBOX
  SPECIFY
  PLAN
  BUILD
  VERIFY
  SHIP
}
```

**Quick-Impl Impact**:
- **stage Field**: Ticket can transition directly from INBOX to BUILD
- **branch Field**: Set by GitHub workflow via `PATCH /branch` endpoint (unchanged)
- **version Field**: Incremented on quick-impl transitions (optimistic concurrency)
- **jobs Relation**: Quick-impl creates Job with command="quick-impl"

**Relevant Operations**:
```typescript
// Transition INBOX → BUILD (app/api/projects/:projectId/tickets/:id/transition/route.ts)
await prisma.ticket.update({
  where: {
    id: ticketId,
    version: currentTicket.version, // Optimistic concurrency
  },
  data: {
    stage: 'BUILD',
    version: { increment: 1 },
  },
});
```

**Stage Transition State Machine** (updated):
```
INBOX ──→ SPECIFY ──→ PLAN ──→ BUILD ──→ VERIFY ──→ SHIP
  ↓                                ↑
  └───────── Quick-Impl ───────────┘
```

**Valid Transitions**:
- INBOX → SPECIFY (normal)
- INBOX → BUILD (quick-impl, NEW)
- SPECIFY → PLAN (normal)
- PLAN → BUILD (normal)
- BUILD → VERIFY (normal)
- VERIFY → SHIP (normal)

**Invalid Transitions** (unchanged):
- INBOX → PLAN (skipping SPECIFY)
- INBOX → VERIFY (skipping SPECIFY, PLAN, BUILD)
- INBOX → SHIP (skipping all stages)
- SPECIFY → BUILD (skipping PLAN)
- Any backwards transition (e.g., BUILD → PLAN)

---

## 2. Non-Persisted Entities (Conceptual)

### 2.1 TransitionMode (Conceptual Entity)

**Purpose**: Represents the workflow type detected during ticket transition

**Definition**:
```typescript
type TransitionMode = 'normal' | 'quick-impl';
```

**Determination Logic** (lib/workflows/transition.ts):
```typescript
const isQuickImpl = (currentStage === Stage.INBOX && targetStage === Stage.BUILD);
const mode: TransitionMode = isQuickImpl ? 'quick-impl' : 'normal';
```

**Usage**:
- Workflow dispatch decision: `quick-impl.yml` vs `speckit.yml`
- Job command assignment: `'quick-impl'` vs `STAGE_COMMAND_MAP[targetStage]`
- Job validation bypass: Skip validation for quick-impl mode
- Frontend modal trigger: Show confirmation modal for quick-impl

**Not Persisted**: TransitionMode is computed on-the-fly during transition handling

---

### 2.2 DropZoneVisualState (Frontend State)

**Purpose**: Represents visual feedback during drag-and-drop operation

**Definition** (components/board/board.tsx):
```typescript
type DropZoneVisualState = {
  isDragging: boolean;
  dragSource: Stage | null;
  currentHover: Stage | null;
};
```

**State Transitions**:
```
IDLE ──┬──→ DRAGGING_FROM_INBOX ──┬──→ HOVERING_SPECIFY (blue)
       │                           ├──→ HOVERING_BUILD (green)
       │                           ├──→ HOVERING_INVALID (gray)
       │                           └──→ DROPPED ──→ MODAL_OPEN
       │
       └──→ DRAGGING_FROM_OTHER ───────→ HOVERING_* (normal behavior)
```

**Visual Mappings**:
| State | Column | Border | Background | Opacity | Icon | Badge |
|-------|--------|--------|------------|---------|------|-------|
| HOVERING_SPECIFY | SPECIFY | `border-blue-400` | `bg-blue-50` | 100% | 📝 | - |
| HOVERING_BUILD | BUILD | `border-green-400` | `bg-green-50` | 100% | ⚡ | "Quick Implementation" |
| HOVERING_INVALID | PLAN/VERIFY/SHIP | default | default | 50% | 🚫 | - |

**Not Persisted**: DropZoneVisualState lives in React component state only

---

## 3. Entity Relationships Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                           Project                                │
│  - id: Int                                                       │
│  - name: String                                                  │
│  - userId: String (FK → User.id)                                │
│  - clarificationPolicy: ClarificationPolicy                      │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            │ 1:N
                ┌───────────┴───────────┐
                │                       │
                ↓                       ↓
    ┌─────────────────────┐   ┌─────────────────────┐
    │      Ticket         │   │        Job          │
    │  - id: Int          │   │  - id: Int          │
    │  - stage: Stage     │   │  - command: String  │
    │  - branch: String?  │   │    ("specify",      │
    │  - version: Int     │   │     "plan",         │
    │  - projectId: FK    │◄──┤     "implement",    │
    └─────────────────────┘ N:1│     "quick-impl")   │
                            │  │  - status: JobStatus│
                            │  │  - ticketId: FK     │
                            │  │  - projectId: FK    │
                            │  └─────────────────────┘
                            │
                      INBOX → BUILD
                    (creates Job with
                     command="quick-impl")
```

**Key Relationships**:
1. **Project → Ticket** (1:N): One project has many tickets
2. **Project → Job** (1:N): One project has many jobs
3. **Ticket → Job** (1:N): One ticket has many jobs (one per stage transition)
4. **Quick-Impl Trigger**: When Ticket transitions from INBOX to BUILD, Job is created with command="quick-impl"

---

## 4. Database Queries

### 4.1 Quick-Impl Transition Query

**Create Job** (lib/workflows/transition.ts):
```typescript
const job = await prisma.job.create({
  data: {
    ticketId: ticket.id,
    projectId: ticket.projectId,
    command: 'quick-impl',
    status: JobStatus.PENDING,
    startedAt: new Date(),
    updatedAt: new Date(),
  },
});
```

**Update Ticket** (app/api/projects/:projectId/tickets/:id/transition/route.ts):
```typescript
await prisma.ticket.update({
  where: {
    id: ticketId,
    version: currentTicket.version, // Optimistic concurrency
  },
  data: {
    stage: 'BUILD',
    version: { increment: 1 },
  },
});
```

**Query Performance**:
- Job creation: O(1) insert
- Ticket update: O(1) update with version check (indexed on id)
- Version conflict detection: Automatic via Prisma (P2025 error if version mismatch)

---

### 4.2 Job Validation Query (Exemption for Quick-Impl)

**Find Most Recent Job** (lib/workflows/transition.ts):
```typescript
// This query is SKIPPED for INBOX → BUILD transitions
const mostRecentJob = await prisma.job.findFirst({
  where: { ticketId: ticket.id },
  orderBy: { startedAt: 'desc' },
  select: {
    id: true,
    status: true,
    command: true,
    startedAt: true,
  },
});
```

**Quick-Impl Exemption Logic**:
```typescript
// lib/workflows/transition.ts (NEW CODE)
const isQuickImpl = currentStage === Stage.INBOX && targetStage === Stage.BUILD;

if (!isQuickImpl && shouldValidateJobCompletion(currentStage)) {
  const jobValidation = await validateJobCompletion(ticket, targetStage);
  if (!jobValidation.success) {
    return jobValidation; // Block transition
  }
}
```

**Rationale**: INBOX stage has no prior jobs to validate (first transition)

---

### 4.3 Job Polling Query (Unchanged)

**Fetch All Project Jobs** (app/api/projects/:projectId/jobs/status/route.ts):
```typescript
const jobs = await prisma.job.findMany({
  where: { projectId: parseInt(projectId) },
  select: {
    id: true,
    status: true,
    ticketId: true,
    updatedAt: true,
  },
});
```

**Quick-Impl Impact**: None - command="quick-impl" jobs poll identically to other commands

**Performance**: O(N) where N = number of jobs in project (indexed query on projectId)

---

## 5. Data Validation Rules

### 5.1 Job Command Validation

**Valid Values**:
```typescript
type JobCommand = 'specify' | 'plan' | 'implement' | 'quick-impl';
```

**Validation** (not enforced at schema level, but by application logic):
```typescript
// lib/workflows/transition.ts
export const STAGE_COMMAND_MAP: Record<Stage, string | null> = {
  INBOX: null,
  SPECIFY: 'specify',
  PLAN: 'plan',
  BUILD: 'implement', // Overridden to 'quick-impl' when isQuickImpl === true
  VERIFY: null,
  SHIP: null,
};
```

**No Database Constraint**: Job.command is VARCHAR, accepts any string
**Validation Layer**: Application code ensures only valid commands are created

---

### 5.2 Stage Transition Validation

**Valid Transition Matrix**:
| From Stage | To Stage | Valid? | Mode |
|------------|----------|--------|------|
| INBOX | SPECIFY | ✓ | normal |
| INBOX | PLAN | ✗ | - |
| INBOX | BUILD | ✓ | **quick-impl** |
| INBOX | VERIFY | ✗ | - |
| INBOX | SHIP | ✗ | - |
| SPECIFY | PLAN | ✓ | normal |
| SPECIFY | BUILD | ✗ | - |
| PLAN | BUILD | ✓ | normal |
| BUILD | VERIFY | ✓ | normal |
| VERIFY | SHIP | ✓ | normal |

**Validation Function** (lib/stage-validation.ts):
```typescript
export function isValidTransition(fromStage: Stage, toStage: Stage): boolean {
  // Special case: Quick-impl allows INBOX → BUILD
  if (fromStage === Stage.INBOX && toStage === Stage.BUILD) {
    return true;
  }

  // Default: Sequential validation
  const nextStage = getNextStage(fromStage);
  return nextStage === toStage;
}
```

**Enforcement Point**: `app/api/projects/:projectId/tickets/:id/transition/route.ts` (line 174)

---

### 5.3 Job Status Validation (Unchanged)

**Valid Status Transitions** (from feature 030-should-not-be):
```
PENDING → RUNNING
RUNNING → COMPLETED | FAILED | CANCELLED
```

**Terminal States** (no further transitions):
- COMPLETED
- FAILED
- CANCELLED

**Quick-Impl Impact**: None - job state machine is identical for all commands

---

## 6. Migration Requirements

### 6.1 Schema Changes

**NONE REQUIRED** - All database fields already support quick-impl workflow:
- Job.command is VARCHAR (supports "quick-impl" value)
- Ticket.stage is Stage enum (already includes BUILD)
- Job.status is JobStatus enum (unchanged)

### 6.2 Data Migration

**NONE REQUIRED** - No historical data needs to be migrated

### 6.3 Seed Data

**Development Seed** (optional - for testing quick-impl UI):
```typescript
// scripts/seed-quick-impl.ts (optional)
const quickImplTicket = await prisma.ticket.create({
  data: {
    title: 'Quick bug fix: Fix typo in button label',
    description: 'Change "Sumbit" to "Submit"',
    stage: 'INBOX',
    projectId: 3, // Development project
    updatedAt: new Date(),
  },
});
```

---

## 7. Data Model Testing

### 7.1 Job Entity Tests

**Test File**: `tests/api/ticket-transition.spec.ts` (MODIFY)

**New Test Cases**:
```typescript
test('should create job with command="quick-impl" for INBOX → BUILD', async ({ request }) => {
  const { ticket } = await setupTestData();

  await request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
    data: { targetStage: 'BUILD' },
  });

  const job = await prisma.job.findFirst({
    where: { ticketId: ticket.id },
  });

  expect(job?.command).toBe('quick-impl');
  expect(job?.status).toBe('PENDING');
});
```

---

### 7.2 Stage Transition Tests

**Test File**: `tests/unit/stage-validation.spec.ts` (NEW FILE)

**Test Cases**:
```typescript
describe('isValidTransition', () => {
  test('allows INBOX → BUILD (quick-impl)', () => {
    expect(isValidTransition(Stage.INBOX, Stage.BUILD)).toBe(true);
  });

  test('rejects SPECIFY → BUILD (skipping PLAN)', () => {
    expect(isValidTransition(Stage.SPECIFY, Stage.BUILD)).toBe(false);
  });

  test('allows normal sequential transitions', () => {
    expect(isValidTransition(Stage.INBOX, Stage.SPECIFY)).toBe(true);
    expect(isValidTransition(Stage.SPECIFY, Stage.PLAN)).toBe(true);
    expect(isValidTransition(Stage.PLAN, Stage.BUILD)).toBe(true);
  });
});
```

---

### 7.3 Optimistic Concurrency Tests

**Test File**: `tests/api/ticket-transition.spec.ts` (EXISTING)

**Existing Test** (line 383-422): "should handle optimistic concurrency conflicts"
- **Status**: Already covers quick-impl via generic transition logic
- **Action**: NO CHANGES NEEDED

---

## 8. Performance Considerations

### 8.1 Query Optimization

**Quick-Impl Transition**:
- Job creation: 1 INSERT (O(1))
- Ticket update: 1 UPDATE (O(1), indexed on id)
- Total queries: 2 (same as normal transitions)

**Job Validation Exemption**:
- Normal transitions: 1 SELECT + 2 writes = 3 queries
- Quick-impl: 2 writes = 2 queries (20% fewer queries)

### 8.2 Indexing

**Existing Indexes** (no changes needed):
```prisma
@@index([projectId]) // Job polling queries
@@index([ticketId])  // Job lookup by ticket
@@index([stage])     // Ticket filtering by stage
```

**Quick-Impl Impact**: None - all queries use existing indexes

---

## 9. Data Model Summary

### 9.1 Modified Entities

| Entity | Changes | Migration Required |
|--------|---------|-------------------|
| Job | Add support for command="quick-impl" | NO (VARCHAR field) |
| Ticket | Support INBOX → BUILD transition | NO (Stage enum unchanged) |

### 9.2 New Entities

| Entity | Type | Persisted |
|--------|------|-----------|
| TransitionMode | Conceptual | NO (computed) |
| DropZoneVisualState | Frontend state | NO (React state) |

### 9.3 Validation Changes

| Validation Rule | Before | After |
|----------------|--------|-------|
| INBOX → BUILD | INVALID | **VALID** (quick-impl) |
| SPECIFY → BUILD | INVALID | INVALID (unchanged) |
| INBOX → PLAN | INVALID | INVALID (unchanged) |
| Job validation for INBOX | N/A | **SKIPPED** (no prior job) |

---

## Data Model Complete

**Status**: ✅ All entities documented
**Schema Changes**: NONE REQUIRED
**Performance Impact**: POSITIVE (fewer validation queries)
**Ready for Contracts**: YES
