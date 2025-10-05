# Research: GitHub Branch Tracking and Automation Flags

**Feature**: 014-add-github-branch
**Date**: 2025-10-04

## Research Questions

### 1. Prisma Nullable Field Patterns

**Question**: What's the best practice for adding a nullable string field that will be set asynchronously after record creation?

**Decision**: Use `String?` with no default value

**Rationale**:
- Null semantically represents "not yet set" better than empty string
- Prisma's nullable fields work cleanly with TypeScript's strict null checks
- No need for additional validation to distinguish between "empty" and "unset"
- Prisma client generates proper `string | null` TypeScript types automatically

**Alternatives Considered**:
1. **Required field with empty string default**: `String @default("")`
   - Rejected: Empty string doesn't clearly indicate "branch not created yet"
   - Requires additional validation logic to check for meaningful values

2. **Optional field with undefined**: Just `String?`
   - Selected: This is the correct approach
   - Prisma maps `String?` to nullable column in PostgreSQL
   - TypeScript types will be `string | null`

**Implementation**:
```prisma
model Ticket {
  // existing fields...
  branch    String?  @db.VarChar(200)  // null until /specify workflow creates branch
}
```

**References**:
- Prisma docs: Optional vs required fields
- PostgreSQL: NULL semantics vs empty strings
- TypeScript strict mode: Handling nullable types

---

### 2. Prisma Migration Backfill Strategies

**Question**: How should we handle existing records when adding new fields with defaults?

**Decision**: Use `@default(false)` for autoMode, let Prisma handle backfill automatically during migration

**Rationale**:
- Prisma migrations automatically apply default values to existing rows
- No manual SQL UPDATE queries needed
- Migration is atomic and reversible
- Simpler and less error-prone than manual backfill

**Alternatives Considered**:
1. **Manual UPDATE in migration**:
   ```sql
   ALTER TABLE "Ticket" ADD COLUMN "autoMode" BOOLEAN;
   UPDATE "Ticket" SET "autoMode" = false WHERE "autoMode" IS NULL;
   ALTER TABLE "Ticket" ALTER COLUMN "autoMode" SET DEFAULT false;
   ALTER TABLE "Ticket" ALTER COLUMN "autoMode" SET NOT NULL;
   ```
   - Rejected: Unnecessarily complex
   - Prisma generates this automatically with `@default(false)`

2. **Use nullable boolean with default**:
   ```prisma
   autoMode Boolean? @default(false)
   ```
   - Rejected: Boolean should not be nullable
   - Tristate boolean (true/false/null) adds semantic confusion
   - Default false is always correct for new and existing tickets

**Implementation**:
```prisma
model Ticket {
  // existing fields...
  autoMode  Boolean  @default(false)  // defaults to false for all tickets
}
```

**Migration Strategy**:
1. Run `npx prisma migrate dev --name add_branch_tracking`
2. Prisma will generate migration SQL with:
   - `ALTER TABLE "Ticket" ADD COLUMN "branch" VARCHAR(200);` (nullable)
   - `ALTER TABLE "Ticket" ADD COLUMN "autoMode" BOOLEAN DEFAULT false NOT NULL;`
3. Existing tickets automatically get `branch = NULL` and `autoMode = false`

**References**:
- Prisma migrations: Adding columns with defaults
- PostgreSQL: DEFAULT constraints and ALTER TABLE

---

### 3. Zod Validation for Optional/Nullable Strings

**Question**: How should Zod schemas handle Prisma's nullable `String?` fields?

**Decision**: Use `z.string().max(200).nullable()` for branch field

**Rationale**:
- Matches Prisma's `String?` semantics exactly
- Distinguishes between field not provided (undefined) and explicitly null
- TypeScript types align: `string | null` from Prisma matches Zod's nullable()
- Allows PATCH requests to explicitly set branch to null (clear branch)

**Alternatives Considered**:
1. **Optional instead of nullable**: `z.string().max(200).optional()`
   - Rejected: Optional means field can be undefined, not null
   - Prisma generates `string | null`, not `string | undefined`
   - Mismatch between database (NULL) and validation (undefined)

2. **Transform null to empty string**: `z.string().max(200).transform(v => v ?? '')`
   - Rejected: Loses semantic distinction between null and empty
   - Makes it harder to distinguish "not set" from "set to empty"

3. **Nullable with refinement**:
   ```typescript
   z.string().max(200).nullable().refine(
     v => v === null || v.length > 0,
     "Branch name must be null or non-empty"
   )
   ```
   - Considered: Would prevent empty strings
   - Deferred: Not required by spec, add if needed later

**Implementation**:
```typescript
// lib/validations/ticket.ts

import { z } from 'zod';

export const createTicketSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(1000),
  projectId: z.number().int().positive(),
});

export const updateTicketSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  stage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']).optional(),
  branch: z.string().max(200).nullable().optional(),  // NEW: can be null or string
  autoMode: z.boolean().optional(),                    // NEW: boolean flag
}).strict();

export const updateBranchSchema = z.object({
  branch: z.string().max(200).nullable(),  // Required in body, can be null or string
}).strict();
```

**Type Safety**:
- Zod infers: `{ branch?: string | null | undefined }` for updateTicketSchema
- Prisma client type: `{ branch: string | null }`
- They align when `branch` is provided in request body

**References**:
- Zod docs: nullable() vs optional()
- TypeScript: null vs undefined semantics
- Prisma Client: Generated types for nullable fields

---

### 4. Next.js API Route Patterns for PATCH Endpoints

**Question**: Should branch updates use the general PATCH /api/tickets/:id or a specialized endpoint?

**Decision**: Support both patterns:
1. General update: `PATCH /api/tickets/:id` accepts branch in request body
2. Specialized endpoint: `PATCH /api/tickets/:id/branch` for workflow scripts

**Rationale**:
- General endpoint: Allows UI to update multiple fields atomically
- Specialized endpoint: Clearer intent for automation scripts
- Both follow REST conventions
- Specialized endpoint can have stricter validation and logging

**Alternatives Considered**:
1. **Only general endpoint**: `PATCH /api/tickets/:id { branch: "..." }`
   - Rejected: Automation scripts would need to know full ticket update schema
   - Less clear when branch update is part of workflow vs user action

2. **Only specialized endpoint**: `PATCH /api/tickets/:id/branch`
   - Rejected: Forces UI to make separate requests for each field
   - Violates principle of atomic updates

3. **PUT instead of PATCH**: `PUT /api/tickets/:id/branch`
   - Rejected: PATCH is correct for partial updates
   - PUT implies replacing entire resource

**Implementation**:

```typescript
// app/api/tickets/[id]/route.ts (existing - extend)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);
  const body = await request.json();

  // Validate with updateTicketSchema (includes branch and autoMode)
  const validated = updateTicketSchema.parse(body);

  const updated = await prisma.ticket.update({
    where: { id },
    data: validated,  // Can include branch and/or autoMode
  });

  return Response.json(updated);
}
```

```typescript
// app/api/tickets/[id]/branch/route.ts (NEW)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);
  const body = await request.json();

  // Validate with specialized schema
  const { branch } = updateBranchSchema.parse(body);

  const updated = await prisma.ticket.update({
    where: { id },
    data: { branch },
    select: { id: true, branch: true, updatedAt: true },  // Return minimal data
  });

  return Response.json(updated);
}
```

**Usage Examples**:

```bash
# General update (UI or manual)
curl -X PATCH /api/tickets/123 \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated","branch":"014-new-feature"}'

# Specialized branch update (automation scripts)
curl -X PATCH /api/tickets/123/branch \
  -H "Content-Type: application/json" \
  -d '{"branch":"014-new-feature"}'
```

**References**:
- Next.js App Router: Route handlers
- REST API design: Resource-oriented URLs
- Existing pattern in codebase: `/app/api/tickets/[id]/route.ts`

---

## Summary

All research questions resolved. Key decisions:

1. **Database**: Use `String?` for nullable branch, `Boolean @default(false)` for autoMode
2. **Migration**: Let Prisma handle backfill with `@default(false)`, no manual SQL
3. **Validation**: Zod `nullable()` for branch field to match Prisma semantics
4. **API Design**: Support both general PATCH and specialized /branch endpoint

No unknowns remain. Ready to proceed to Phase 1: Design & Contracts.
