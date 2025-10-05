# Data Model: GitHub Branch Tracking and Automation Flags

**Feature**: 014-add-github-branch
**Date**: 2025-10-04

## Entity Changes

### Ticket Model (Extended)

**Purpose**: Track Git branch associated with ticket development and automation mode flag

**Schema Changes**:
```prisma
model Ticket {
  // Existing fields (preserved)
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(100)
  description String   @db.VarChar(1000)
  stage       Stage    @default(INBOX)
  version     Int      @default(1)
  projectId   Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // NEW FIELDS
  branch      String?  @db.VarChar(200)  // Git branch name (null until /specify workflow)
  autoMode    Boolean  @default(false)    // Enable automatic workflow progression

  // Existing relations (preserved)
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  jobs        Job[]

  // Existing indexes (preserved)
  @@index([stage])
  @@index([updatedAt])
  @@index([projectId])
}
```

**Field Specifications**:

#### `branch: String?`
- **Type**: Nullable string (PostgreSQL VARCHAR(200))
- **Default**: NULL (not set until /specify workflow creates branch)
- **Purpose**: Store Git branch name associated with ticket development
- **Lifecycle**:
  1. Ticket created → branch = NULL
  2. `/specify` workflow runs → branch = "###-feature-name" (e.g., "014-add-github-branch")
  3. Optional: Can be updated or cleared (set to NULL) via API
- **Validation**: Max 200 characters (enforced at DB and API layers)
- **Examples**:
  - NULL (not yet assigned)
  - "014-add-github-branch"
  - "123-user-authentication"
  - "999-fix-critical-bug"
- **Naming Convention**: `###-kebab-case-description` (enforced by create-new-feature.sh script)

#### `autoMode: Boolean`
- **Type**: Non-nullable boolean
- **Default**: false (manual workflow progression)
- **Purpose**: Flag indicating whether automation scripts should automatically advance ticket through stages
- **Lifecycle**:
  1. Ticket created → autoMode = false (default)
  2. User/API enables automation → autoMode = true
  3. Automation scripts check this flag before advancing stages
- **Behavior**:
  - `false`: Ticket requires manual stage transitions (user must explicitly move ticket)
  - `true`: Automation scripts can advance ticket automatically (e.g., INBOX→SPECIFY after /specify succeeds)
- **Examples**:
  - false: Manual development workflow
  - true: Fully automated ticket progression

**Relationships** (unchanged):
- **Many-to-One**: Ticket → Project (via projectId foreign key, cascade delete)
- **One-to-Many**: Ticket → Jobs (jobs track spec-kit command executions)

**Indexes** (unchanged):
- `@@index([stage])` - For filtering tickets by development stage
- `@@index([updatedAt])` - For sorting by most recently updated
- `@@index([projectId])` - For querying tickets by project

**Constraints**:
- Primary key: `id` (auto-increment)
- Foreign key: `projectId` references Project.id (cascade delete)
- Unique: None (multiple tickets can have same branch if needed)
- Not null: All fields except `branch` (explicitly nullable)

---

## State Transitions

### Branch Assignment Flow

```
┌─────────────────┐
│ Ticket Created  │
│ branch = NULL   │
│ autoMode = false│
└────────┬────────┘
         │
         │ User runs: /specify "Feature description"
         │
         ▼
┌─────────────────────────────────────┐
│ Workflow: create-new-feature.sh     │
│ - Creates Git branch: ###-name      │
│ - Initializes spec.md               │
│ - Returns branch name to /specify   │
└────────┬────────────────────────────┘
         │
         │ /specify updates ticket via API
         │
         ▼
┌─────────────────────────────────┐
│ PATCH /api/tickets/:id/branch   │
│ { branch: "014-add-github..." } │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────┐
│ Ticket Updated      │
│ branch = "014-..." │
│ (ready for /plan)   │
└─────────────────────┘
```

### AutoMode Workflow

```
┌─────────────────┐
│ Ticket Created  │
│ autoMode = false│ ◄─── Default: Manual workflow
└────────┬────────┘
         │
         │ User enables automation (UI or API)
         │
         ▼
┌──────────────────────────────┐
│ PATCH /api/tickets/:id       │
│ { autoMode: true }           │
└────────┬─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ autoMode = true     │
└────────┬────────────┘
         │
         │ Automation script executes (e.g., post-/specify hook)
         │
         ▼
┌──────────────────────────────────┐
│ if (ticket.autoMode === true) {  │
│   // Auto-advance stage:         │
│   // INBOX → SPECIFY             │
│   updateTicket({ stage: SPECIFY })│
│ }                                 │
└───────────────────────────────────┘
```

---

## Validation Rules

### Database-Level Validation
- `branch`: VARCHAR(200) constraint enforces max length
- `autoMode`: BOOLEAN constraint enforces true/false only
- Foreign key constraint ensures projectId references valid Project

### Application-Level Validation (Zod)

```typescript
// lib/validations/ticket.ts

import { z } from 'zod';

// POST /api/tickets - create new ticket
export const createTicketSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(1000),
  projectId: z.number().int().positive(),
}).strict();

// PATCH /api/tickets/:id - update any ticket fields
export const updateTicketSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  stage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']).optional(),
  branch: z.string().max(200).nullable().optional(),
  autoMode: z.boolean().optional(),
}).strict();

// PATCH /api/tickets/:id/branch - specialized branch update
export const updateBranchSchema = z.object({
  branch: z.string().max(200).nullable(),  // Required in request body
}).strict();
```

**Validation Behavior**:
- `createTicketSchema`: Does NOT accept branch or autoMode (set by defaults)
- `updateTicketSchema`: Accepts optional branch (nullable) and autoMode (boolean)
- `updateBranchSchema`: Requires branch in body, validates max length

**Edge Cases**:
1. **Branch exceeds 200 chars**: Validation error (400 Bad Request)
2. **Branch is empty string**: Allowed (distinct from NULL)
3. **Branch is null**: Allowed (clears branch assignment)
4. **AutoMode is non-boolean**: Validation error (400 Bad Request)

---

## Migration Strategy

### Migration SQL (generated by Prisma)

```sql
-- Migration: add_branch_tracking
-- Created: [timestamp]

-- Add nullable branch column
ALTER TABLE "Ticket" ADD COLUMN "branch" VARCHAR(200);

-- Add non-null autoMode column with default false
ALTER TABLE "Ticket" ADD COLUMN "autoMode" BOOLEAN NOT NULL DEFAULT false;
```

### Rollback SQL (down migration)

```sql
-- Rollback: add_branch_tracking

-- Drop new columns (reversible)
ALTER TABLE "Ticket" DROP COLUMN "autoMode";
ALTER TABLE "Ticket" DROP COLUMN "branch";
```

### Migration Execution

```bash
# Development environment
npx prisma migrate dev --name add_branch_tracking

# Production environment (via CI/CD)
npx prisma migrate deploy
```

**Existing Data Handling**:
- All existing tickets get `branch = NULL` (no branch assigned yet)
- All existing tickets get `autoMode = false` (manual workflow by default)
- No data loss or corruption
- Migration is atomic (all-or-nothing)

---

## TypeScript Types (Generated by Prisma Client)

```typescript
// Generated by Prisma Client after migration

export type Ticket = {
  id: number;
  title: string;
  description: string;
  stage: Stage;
  version: number;
  projectId: number;
  branch: string | null;      // NEW: Nullable string
  autoMode: boolean;          // NEW: Non-null boolean
  createdAt: Date;
  updatedAt: Date;
};

// Prisma create input
export type TicketCreateInput = {
  title: string;
  description: string;
  stage?: Stage;               // Optional, defaults to INBOX
  version?: number;            // Optional, defaults to 1
  branch?: string | null;      // Optional, defaults to NULL
  autoMode?: boolean;          // Optional, defaults to false
  project: { connect: { id: number } };
};

// Prisma update input
export type TicketUpdateInput = {
  title?: string;
  description?: string;
  stage?: Stage;
  version?: number;
  branch?: string | null;      // Can set to null or string
  autoMode?: boolean;          // Can toggle true/false
};
```

**Type Safety Notes**:
- TypeScript enforces `branch` is `string | null` (not `string | undefined`)
- `autoMode` is always `boolean` (never null or undefined)
- Prisma client prevents inserting invalid values at compile time

---

## Query Examples

### Create Ticket (defaults applied)
```typescript
const ticket = await prisma.ticket.create({
  data: {
    title: "Add user authentication",
    description: "Implement JWT-based auth",
    projectId: 1,
    // branch and autoMode use defaults (NULL and false)
  },
});

console.log(ticket.branch);    // null
console.log(ticket.autoMode);  // false
```

### Update Branch (workflow script)
```typescript
const updated = await prisma.ticket.update({
  where: { id: 123 },
  data: { branch: "014-add-github-branch" },
  select: { id: true, branch: true, updatedAt: true },
});

console.log(updated.branch);  // "014-add-github-branch"
```

### Enable AutoMode (user action)
```typescript
const automated = await prisma.ticket.update({
  where: { id: 123 },
  data: { autoMode: true },
});

console.log(automated.autoMode);  // true
```

### Query Tickets with Branch
```typescript
// Find tickets with assigned branches
const withBranches = await prisma.ticket.findMany({
  where: { branch: { not: null } },
});

// Find tickets in autoMode
const automated = await prisma.ticket.findMany({
  where: { autoMode: true },
});
```

### Clear Branch (reset)
```typescript
const cleared = await prisma.ticket.update({
  where: { id: 123 },
  data: { branch: null },  // Explicitly set to NULL
});

console.log(cleared.branch);  // null
```

---

## Summary

**Changes**:
- 2 new fields added to Ticket model (branch, autoMode)
- Both fields optional at creation time (use defaults)
- Migration is reversible and preserves existing data
- Type-safe via Prisma generated types and Zod validation

**No Changes**:
- Existing Ticket fields unchanged
- Project and Job relationships unchanged
- Existing indexes unchanged
- Database constraints unchanged (except new fields)

**Ready for**: Contract generation and test implementation
